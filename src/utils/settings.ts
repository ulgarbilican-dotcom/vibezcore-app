/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — User settings (vzs_v1)

   Persistente UI-instellingen. Webapp-parity: zelfde key. Schema is
   extensible — nieuwe setting = veld + default toevoegen. JSON-parse
   gaat door try/catch en valt terug op defaults bij corruptie.

   Patroon: module-state + listener-set (zelfde als history.ts, vzp.ts,
   useFavorites.ts). Synchrone getter (`getSetting`) zodat de audio-
   service zonder hook kan lezen — een eerste auto-import van dit
   bestand triggert direct de load van AsyncStorage.
   ─────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export const SETTINGS_KEY = 'vzs_v1';

export type Settings = {
  autoPlayNext: boolean;
  /** Save listening progress — bewaart positie zodat sessies kunnen
   *  hervatten waar je gebleven was. Default true (gewenste UX).
   *  Wanneer uitgezet wordt vzp_v1 (saved-position) genegeerd door de
   *  audio-player. Bestaande positie-state blijft staan tot user
   *  Clear local data uitvoert. */
  saveProgress: boolean;
  /** Track listening history — vult vzh_v1 (Your Journey). Default true.
   *  Uitschakelen voorkomt nieuwe history-entries; bestaande blijven
   *  staan tot user 'm clear. */
  trackHistory: boolean;
  /** Audio quality — high (default) of low. Backend levert nu nog 1
   *  bitrate, dus deze setting is voor toekomstige variant-keuze.
   *  Comment-stub: audio-player respecteert deze nog niet (pas nodig
   *  wanneer backend multi-bitrate ondersteunt). */
  audioQuality: 'high' | 'low';
  /** Voice cues aan/uit voor breath- én bracelet-sessies. Eén schakelaar
   *  voor alles wat spreekt: de fasecues tijdens een sessie én de
   *  afsluitende monoloog bij het eindscherm. De knoppen op het
   *  sessiescherm en bij de bracelet zijn deze waarde — geen kopie ervan.
   *
   *  Default AAN (operator, 3 augustus 2026). Stond sinds 25 juni op UIT,
   *  zodat een ongeplande bracelet-activatie nooit onverwacht zou praten.
   *  Dat kostte meer dan het opleverde: begeleiding met stem is waar het
   *  product om draait, en een gebruiker die niets instelt hoorde niets.
   *  Wie stilte wil zet 'm uit — in Settings, met de knop in de sessie, of
   *  door in de onboarding voor trillingen of stil te kiezen — en dan is
   *  álles stil, tot en met het eindscherm. */
  voiceCues: boolean;
  /** Heeft de gebruiker de stem OOIT zelf aan- of uitgezet?
   *
   *  Nodig om een bewaarde `false` te kunnen onderscheiden van een `false`
   *  die er alleen stond omdat dat vroeger de standaard was. Zonder dit
   *  onderscheid zou het omzetten van de standaard (3 augustus 2026) iedereen
   *  die de app al draaide in stilte achterlaten — en juist die mensen hebben
   *  nooit om stilte gevraagd.
   *  Wordt door `setSetting('voiceCues', …)` automatisch op true gezet; vanaf
   *  dat moment is de bewaarde waarde leidend en raakt hij nooit meer kwijt. */
  voiceCuesChosen: boolean;
  /** Iter v??? (breath-onboarding): timestamp (ms) wanneer de gebruiker
   *  de eerste-run Breath-onboarding heeft afgerond (of geskipt).
   *  null = nog nooit doorlopen → Breath-tab-focus stuurt naar
   *  /breath-welcome. Non-null → onboarding voorbij, ga direct naar
   *  Breath-tab. Bestaande users (die al breath-history hebben vóór dit
   *  veld bestond) worden herkend op history.length > 0 in de
   *  Breath-tab-focus-check, dus zij zien de onboarding NIET ondanks
   *  null-waarde. Geen data-migratie nodig. */
  breathOnboardingCompletedAt: number | null;
};

const defaults: Settings = {
  /* Iter 9dq v153 (operator-fix 2026-06-17): default ON. Operator-keuze
     "hij moet automatisch doorspelen volgende" — voorheen stond default
     OFF wat na elke sessie het "Session Complete"-paneel triggerde ook
     wanneer er nog volgende sessies in de serie waren. User kan altijd
     terug-toggle via de Auto-play switch op de Library. */
  autoPlayNext: true,
  saveProgress: true,
  trackHistory: true,
  audioQuality: 'high',
  voiceCues: true,
  voiceCuesChosen: false,
  breathOnboardingCompletedAt: null,
};

let state: Settings = { ...defaults };
let initialized = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function loadOnce(): Promise<void> {
  if (initialized) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          state = {
            ...defaults,
            ...(typeof obj.autoPlayNext === 'boolean'
              ? { autoPlayNext: obj.autoPlayNext }
              : {}),
            ...(typeof obj.saveProgress === 'boolean'
              ? { saveProgress: obj.saveProgress }
              : {}),
            ...(typeof obj.trackHistory === 'boolean'
              ? { trackHistory: obj.trackHistory }
              : {}),
            ...(obj.audioQuality === 'high' || obj.audioQuality === 'low'
              ? { audioQuality: obj.audioQuality }
              : {}),
            /* Deze regel ONTBRAK (gevonden 3 augustus 2026). `voiceCues`
               werd wel weggeschreven maar nooit teruggelezen, dus viel hij
               bij elke start terug op de standaard: wie de stem uitzette had
               hem na herstart weer aan staan. Dat verklaart ook waarom de
               schermen een eigen kopie van die knop bijhielden — de
               instelling zelf hield niets vast.
               Alleen leidend als de gebruiker hem ooit zelf heeft omgezet;
               anders geldt de standaard van vandaag, niet die van toen. */
            ...(obj.voiceCuesChosen === true && typeof obj.voiceCues === 'boolean'
              ? { voiceCues: obj.voiceCues, voiceCuesChosen: true }
              : {}),
            ...(typeof obj.breathOnboardingCompletedAt === 'number' ||
            obj.breathOnboardingCompletedAt === null
              ? { breathOnboardingCompletedAt: obj.breathOnboardingCompletedAt }
              : {}),
          };
        }
      }
    } catch {
      /* corrupt → defaults */
    }
    initialized = true;
    notify();
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
  } catch {
    /* schrijf-fout — runtime-state blijft staan */
  }
}

/** Synchrone read — geldig na initiële load. Vóór de eerste load returnt
 *  hij de defaults; voor onze use-case (autoPlayNext default false) is
 *  een eventuele gemiste eerste finished-event acceptabel. */
export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return state[key];
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): Promise<void> {
  await loadOnce();
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  /* Wie de stem omzet, doet dat bewust — en vanaf dat moment is zijn keuze
     leidend, ook als een latere versie een andere standaard kiest. */
  if (key === 'voiceCues') state = { ...state, voiceCuesChosen: true };
  notify();
  persist();
}

/** Kicker voor de eerste load. Wordt automatisch aangeroepen bij module
 *  init (zie regel onderaan dit bestand). Veilig om handmatig nogmaals
 *  aan te roepen vanuit bv. de root-layout. */
export function ensureSettingsLoaded(): Promise<void> {
  return loadOnce();
}

export function useSetting<K extends keyof Settings>(
  key: K
): [Settings[K], (v: Settings[K]) => void] {
  const [val, setVal] = useState<Settings[K]>(state[key]);
  useEffect(() => {
    loadOnce().then(() => setVal(state[key]));
    const listener = () => setVal(state[key]);
    listeners.add(listener);
    setVal(state[key]);
    return () => {
      listeners.delete(listener);
    };
  }, [key]);
  const setter = (v: Settings[K]) => {
    setSetting(key, v);
  };
  return [val, setter];
}

/* Auto-init: zodra een module dit bestand importeert (bv. audio-service
   of een React-hook in account.tsx) wordt de load alvast gekickt. Tegen
   de tijd dat een sessie eindigt en `getSetting('autoPlayNext')` wordt
   gelezen, zit de waarde in memory. */
loadOnce();
