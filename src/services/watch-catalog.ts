/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — catalogus voor het horloge (13 okt 2026)

   Operator: "de app vanuit de smartwatch bedienen zal belangrijk zijn voor
   users". Het horloge start zelf Breathwork, ook zonder telefoon. De
   telefoon blijft de enige bron van waarheid: ze stuurt per toestand de
   techniek die ZIJ zou kiezen (ervaring + niveau, zelfde regels als
   breath-setup.tsx), de fasen met hun trilpatroon (breath-haptics.ts), de
   vaste duurstappen, de sterkte en of de gebruiker toegang heeft.

   Sessies die op het horloge gedaan zijn, komen hier terug in de
   geschiedenis (en zo in Apple Health / Health Connect).
   ───────────────────────────────────────────────────────────────────────── */

import { BREATH_STATES, roundsFor, type BreathState, type BreathStateKey } from '@/data/breath-states';
import { useSubscription } from '@/hooks/useSubscription';
import { phaseHapticPattern, watchBreathAmplitude } from '@/services/breath-haptics';
import { useHapticStrength } from '@/services/haptic-strength-pref';
import { levelForTechnique, personalRecommendedMinutes, techniqueForLevel } from '@/utils/breath-level';
import { addBreathSession, getBreathHistory, useBreathHistory } from '@/utils/breath-history';
import { durationOptionsFor } from '@/utils/duration-options';
import { getSetting, setSetting, useSetting } from '@/utils/settings';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { syncWatchCatalog, takeWatchSessions } from '../../modules/wear-breath';

const ORDER: BreathStateKey[] = ['boost', 'focus', 'calm', 'clarity', 'rest'];

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/ (\w)/g, (m) => m.toUpperCase());

/** Zelfde standaardtechniek als breath-setup.tsx (ervaring → 0/1/2). */
function defaultTechIdx(maxIdx: number): number {
  const level = getSetting('experienceLevel');
  const idx = level === 'advanced' ? 2 : level === 'intermediate' ? 1 : 0;
  return Math.min(idx, maxIdx);
}

/** Eén techniek zoals het horloge hem nodig heeft: fasen (met het ritme van
 *  het niveau van de gebruiker), trilpatronen en de vaste duurstappen. */
function techForWatch(key: BreathStateKey, base: BreathState['techniques'][number]) {
  const st = BREATH_STATES[key];
  const lvl = levelForTechnique(key, base.key, getBreathHistory());
  const tech = techniqueForLevel(key, base, lvl);
  const durations = tech.durations ?? st.durations;
  const personal = personalRecommendedMinutes(key, tech.key, durations, lvl);
  let def = personal != null ? durations.findIndex((d) => d.minutes === personal) : -1;
  if (def < 0) def = durations.findIndex((d) => d.recommended);
  if (def < 0) def = Math.min(st.defaultDuration, durations.length - 1);
  const watchMinutes = durationOptionsFor(key, base.key).options.map((o) => o.value);
  return {
    key: tech.key,
    name: tech.name,
    level: base.level,
    phases: tech.phases.map((p) => ({
      key: p.key,
      secs: p.secs,
      via: p.via ?? '',
      pattern: phaseHapticPattern(p.key, p.secs),
    })),
    /* Operator 13 okt 2026 ("waarom per 5 minuten? in de app kan het per
       minuut"): dezelfde keuzes als het instelscherm van de telefoon
       (duration-options.ts) — elke hele minuut, cyclus-technieken enkel hun
       vaste stappen. */
    durations: watchMinutes.map((m) => {
      const preset = durations.find((d) => d.minutes === m);
      return {
        label: preset?.cycles ? `${preset.cycles} cycles` : `${m} min`,
        minutes: m,
        rounds: preset?.cycles ?? roundsFor(tech, m),
      };
    }),
    defaultIdx: Math.max(0, watchMinutes.indexOf(durations[Math.max(0, def)]?.minutes ?? -1)),
  };
}

export function buildWatchCatalog(locked: boolean): string {
  const breath = ORDER.map((key) => {
    const st = BREATH_STATES[key];
    /* 13 okt 2026 (operator: "gebruiker moet eerst de techniek kunnen
       kiezen"): alle technieken van de toestand gaan mee; `recommendedIdx`
       is degene die de telefoon voor deze gebruiker zou kiezen. */
    const recommendedIdx = defaultTechIdx(st.techniques.length - 1);
    const techniques = st.techniques.map((t) => techForWatch(key, t));
    /* De laatst gekozen techniek (telefoon of horloge) staat klaar; "For
       you" blijft het advies van het niveau. */
    const remembered = getSetting('breathTechByState')[key];
    const chosenIdx = Math.max(0, remembered ? techniques.findIndex((t) => t.key === remembered) : -1);
    const selectedIdx = remembered && techniques[chosenIdx]?.key === remembered ? chosenIdx : recommendedIdx;
    const rec = techniques[selectedIdx] ?? techniques[0];
    return {
      key,
      name: titleCase(st.eyebrow),
      /* Sleep in het lichte teal, zoals de ring in de app (relayBreathToWatches). */
      colorHex: key === 'rest' ? '#4AF0D4' : st.accent,
      locked,
      recommendedIdx,
      selectedIdx,
      techniques,
      /* Aanbevolen techniek ook plat, voor oudere horloge-versies. */
      technique: rec.name,
      techniqueKey: rec.key,
      phases: rec.phases,
      durations: rec.durations,
      defaultIdx: rec.defaultIdx,
    };
  });
  return JSON.stringify({ v: 2, amp: watchBreathAmplitude(), breath });
}

type WatchSessionRecord = {
  state: BreathStateKey;
  techniqueKey?: string;
  durSec: number;
  rounds: number;
  completed: boolean;
  endedAt: number;
};

/** Sessies van het horloge in de geschiedenis zetten (en de gratis sessie
 *  als gebruikt markeren, net als op de telefoon). */
async function importWatchSessions(): Promise<void> {
  const items = await takeWatchSessions();
  for (const raw of items) {
    try {
      const r = JSON.parse(raw) as WatchSessionRecord;
      const st = BREATH_STATES[r.state];
      if (!st || !(r.durSec >= 10)) continue;
      await addBreathSession({
        key: st.key,
        name: st.eyebrow,
        techniqueKey: r.techniqueKey,
        durSec: Math.round(r.durSec),
        rounds: Math.max(1, Math.round(r.rounds)),
        completed: !!r.completed,
        ts: typeof r.endedAt === 'number' ? r.endedAt : undefined,
      });
      if (!getSetting('breathFreeSessionUsedAt')) setSetting('breathFreeSessionUsedAt', Date.now());
      /* De techniek die op het horloge gekozen werd, staat ook op de
         telefoon voortaan klaar voor die toestand. */
      if (r.techniqueKey && st.techniques.some((t) => t.key === r.techniqueKey)) {
        setSetting('breathTechByState', { ...getSetting('breathTechByState'), [st.key]: r.techniqueKey });
      }
    } catch {
      /* één kapot record mag de rest niet tegenhouden */
    }
  }
}

/** Eén keer in de root-layout: houdt de catalogus op het horloge actueel en
 *  haalt horloge-sessies op als de app opent of terugkomt. Android (Wear OS);
 *  de Apple Watch volgt apart. */
export function useWatchCatalogSync(): void {
  const sub = useSubscription();
  const strength = useHapticStrength();
  const [experience] = useSetting('experienceLevel');
  const [freeUsedAt] = useSetting('breathFreeSessionUsedAt');
  const [techByState] = useSetting('breathTechByState');
  const history = useBreathHistory();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const locked = !sub.isPro && !!freeUsedAt;
    syncWatchCatalog(buildWatchCatalog(locked));
  }, [sub.isPro, freeUsedAt, strength, experience, history.length, techByState]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void importWatchSessions();
    const s = AppState.addEventListener('change', (st) => {
      if (st === 'active') void importWatchSessions();
    });
    return () => s.remove();
  }, []);
}
