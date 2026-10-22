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
import { watchStateParams } from '@/services/bracelet-haptics';
import { MODES } from '@/services/ble-contract';
import { BREATH_STATE_MODE, STATE_USAGE } from '@/data/state-usage';
import { getHapticStrength, useHapticStrength } from '@/services/haptic-strength-pref';
import { getRestingPulse, subscribeRestingPulse } from '@/services/resting-pulse';
import { recordSession } from '@/utils/bracelet-history';
import { useBraceletOwner } from '@/utils/dev-user-override';
import { levelForTechnique, personalRecommendedMinutes, techniqueForLevel } from '@/utils/breath-level';
import { addBreathSession, getBreathHistory, useBreathHistory } from '@/utils/breath-history';
import { durationOptionsFor } from '@/utils/duration-options';
import { getSetting, setSetting, useSetting } from '@/utils/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { onWatchSessionLogged, syncWatchCatalog, takeWatchSessions } from '../../modules/wear-breath';
import { onAppleWatchLog, syncAppleWatchCatalog } from '../../modules/watch-breath';

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

/** `breathFreeOnce`: de gratis Breathwork-sessie is nog niet gebruikt (niet-
 *  Premium). Het horloge zet zelf het slot zodra die ene sessie op de pols
 *  gedaan is — ook zonder telefoon (audit 14 okt 2026). */
export function buildWatchCatalog(locked: boolean, stateLocked = false, breathFreeOnce = false): string {
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
      /* korte "wanneer"-regel onder de naam (15 okt 2026) */
      use: STATE_USAGE[BREATH_STATE_MODE[key]],
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
  /* 13 okt 2026 (operator: "in de horloge-app ook State Control bedienen"):
     de vijf toestanden met hun duurbereik en het ritme dat de telefoon nu
     zou spelen — het horloge start ze zelf. */
  const state = MODES.map((m) => ({
    key: m.mode,
    name: m.name,
    use: STATE_USAGE[m.mode],
    colorHex: m.color,
    minMinutes: m.minMinutes,
    maxMinutes: m.maxMinutes,
    defaultMinutes: m.defaultMinutes,
    locked: stateLocked,
    params: watchStateParams(m.mode),
  }));
  return JSON.stringify({ v: 3, amp: watchBreathAmplitude(), breath, state, breathFreeOnce, strength: getHapticStrength() });
}

/** Een State Control-sessie die op het horloge zelf liep (13 okt 2026). */
type WatchStateRecord = {
  kind: 'state';
  mode: number;
  startedAt: number;
  endedAt: number;
  activeSec: number;
  plannedSec: number;
  completed: boolean;
};

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
/* 14 okt 2026 (audit): nooit dubbel in de geschiedenis — één import tegelijk
   (openen en terugkomen vielen soms samen), en elk horloge-record heeft een
   id die we onthouden (voor het geval het wissen op het horloge niet lukt). */
const IMPORTED_KEY = 'vz_watch_imported_ids_v1';
let importing = false;

async function importWatchSessions(): Promise<void> {
  if (importing) return;
  importing = true;
  try {
    await importWatchSessionsOnce();
  } finally {
    importing = false;
  }
}

async function importWatchSessionsOnce(): Promise<void> {
  await importWatchRecords(await takeWatchSessions());
}

/* Apple Watch (18 okt 2026): elk record komt los binnen; één tegelijk
   verwerken, zodat de "al gezien"-lijst nooit door elkaar loopt. */
let appleQueue: Promise<void> = Promise.resolve();
function importAppleWatchRecord(raw: string): void {
  appleQueue = appleQueue.then(() => importWatchRecords([raw])).catch(() => {});
}

async function importWatchRecords(items: string[]): Promise<void> {
  if (items.length === 0) return;
  let seen: string[] = [];
  try {
    seen = JSON.parse((await AsyncStorage.getItem(IMPORTED_KEY)) ?? '[]') as string[];
  } catch {
    seen = [];
  }
  const seenSet = new Set(seen);
  for (const raw of items) {
    try {
      const any = JSON.parse(raw) as { kind?: string; id?: string };
      if (any.id) {
        if (seenSet.has(any.id)) continue;
        seenSet.add(any.id);
        seen.push(any.id);
      }
      if (any.kind === 'state') {
        const st = any as WatchStateRecord;
        if (!(st.activeSec >= 10) || !MODES.some((m) => m.mode === st.mode)) continue;
        await recordSession({
          mode: st.mode,
          startedAt: new Date(st.startedAt).toISOString(),
          endedAt: new Date(st.endedAt).toISOString(),
          durationMin: Math.max(1, Math.round(st.activeSec / 60)),
          plannedMin: Math.max(1, Math.round(st.plannedSec / 60)),
          status: st.completed ? 'completed' : 'stopped',
        });
        continue;
      }
      const r = any as WatchSessionRecord;
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
  try {
    await AsyncStorage.setItem(IMPORTED_KEY, JSON.stringify(seen.slice(-300)));
  } catch {
    /* niet erg: het horloge wist zijn records ook zelf */
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
  const ownsBracelet = useBraceletOwner();
  const [restingBpm, setRestingBpm] = useState(() => getRestingPulse().bpm);
  /* Elke keer dat de app weer open komt, de catalogus opnieuw sturen: een horloge dat
     eerder niet bereikbaar was, blijft anders op een oud slot staan. */
  const [resyncTick, setResyncTick] = useState(0);
  useEffect(() => {
    const s = AppState.addEventListener('change', (st) => {
      if (st === 'active') setResyncTick((n) => n + 1);
    });
    return () => s.remove();
  }, []);
  useEffect(() => subscribeRestingPulse((p) => setRestingBpm(p.bpm)), []);

  useEffect(() => {
    /* Android (Wear OS) én iPhone (Apple Watch, 18 okt 2026): dezelfde
       catalogus, zodat ook de Apple Watch zelf sessies kan starten. */
    /* 14 okt 2026 (audit): pas doorsturen als het abonnement geladen is —
       anders kon een gratis gebruiker State Control open krijgen op het
       horloge (en bleef dat zo als de app daarna sloot). */
    if (sub.isLoading) return;
    const locked = !sub.isPro && !!freeUsedAt;
    /* zelfde regel als het State Control-scherm (bracelet-control.tsx) */
    const stateLocked = !sub.isPro && !ownsBracelet;
    const json = buildWatchCatalog(locked, stateLocked, !sub.isPro && !freeUsedAt);
    if (Platform.OS === 'android') syncWatchCatalog(json);
    else if (Platform.OS === 'ios') syncAppleWatchCatalog(json);
  }, [sub.isPro, sub.isLoading, ownsBracelet, freeUsedAt, strength, experience, history.length, techByState, restingBpm, resyncTick]);

  useEffect(() => {
    if (Platform.OS === 'ios') return onAppleWatchLog(importAppleWatchRecord);
    if (Platform.OS !== 'android') return;
    void importWatchSessions();
    const s = AppState.addEventListener('change', (st) => {
      if (st === 'active') void importWatchSessions();
    });
    /* 15 okt 2026: het horloge meldt een afgelopen sessie meteen (operator:
       sessie stond niet in de geschiedenis terwijl de app open stond). Het
       bericht kan vóór het gegeven zelf aankomen → nog eens na enkele s. */
    const timers: ReturnType<typeof setTimeout>[] = [];
    const offLogged = onWatchSessionLogged(() => {
      for (const ms of [1500, 6000]) timers.push(setTimeout(() => void importWatchSessions(), ms));
    });
    return () => {
      s.remove();
      offLogged();
      timers.forEach(clearTimeout);
    };
  }, []);
}
