/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Achtergrond fase-loop voor de begeleide ademsessie

   Waarom dit bestaat: Android's Doze-modus bevriest de React Native
   JS-thread — waar de fase-timer van breath-session.tsx op draait — zodra
   het scherm lang genoeg op slot staat, ONGEACHT of er audio speelt.
   Empirisch bevestigd (13-14 augustus 2026, echt toestel): 90 seconden
   vergrendeld, nul audio-focus-events. Dit is dus geen JS/Expo-config-fix;
   de fase-cyclus moet ook BUITEN de JS-thread kunnen doorlopen.

   Deze module herhaalt exact dezelfde cyclus-logica als runPhase() in
   breath-session.tsx, maar op Android via AlarmManager.setExactAndAllow-
   WhileIdle() (Doze-bestendig) en op iOS via een achtergrond-audiosessie
   die het hele proces — inclusief timers — actief houdt.

   De bestaande wall-clock "inhaalslag" (AppState-listener in breath-
   session.tsx) blijft de brug tussen "native hield de sessie draaiende" en
   "JS toont weer de juiste stand" — die hoeft niet aangepast te worden.

   Web/Expo Go (geen native module gelinkt): valt stil terug op een no-op.
   De bestaande JS-fase-loop blijft in dat geval de enige bron van waarheid,
   precies zoals vóór deze module bestond. */

import { requireNativeModule } from 'expo-modules-core';

export type BreathBackgroundPhase = {
  key: 'inhale' | 'hold-in' | 'exhale' | 'hold-out';
  secs: number;
};

export type StartBreathBackgroundOptions = {
  /** Eén ronde se fase-volgorde, bv. tech.phases. */
  phases: BreathBackgroundPhase[];
  /** Totaal aantal rondes voor deze sessie (effectiveRoundsRef.current). */
  rounds: number;
  /** Lokaal bestandspad, al opgelost via assetUri() — geen CDN-URL. */
  inhaleCueUri: string;
  /** Gedeeld door hold-in en hold-out. */
  holdCueUri: string;
  exhaleCueUri: string;
  /** Hoeveel ms de cue van de KOMENDE fase vóór de overgang start.
   *  Doorgegeven i.p.v. hardcoded native constante — zie CUE_LEAD_MS in
   *  breath-session.tsx, dat blijft de ene bron van waarheid. */
  cueLeadMs: number;
  /** Index in `phases` waar de sessie NU al in zit (operator, 13 augustus
   *  2026: "dubbele stem" — native start pas als het scherm al op slot
   *  gaat, dus altijd MIDDEN in een fase, nooit bij fase 0). */
  startPhaseIdx: number;
  /** De ronde waar de sessie NU al in zit. */
  startRound: number;
  /** Hoeveel ms er nog over is in de HUIDIGE fase op het moment dat native
   *  overneemt. Native speelt bij het overnemen zelf GEEN cue/haptiek voor
   *  deze fase — JS deed dat al toen de fase begon — en plant alleen de
   *  timer voor wat daarna komt, met deze resterende tijd i.p.v. de volle
   *  fase-duur. */
  startRemainingMs: number;
  /** Modusnaam voor de melding, bv. "Calm Control" (operator, 15 augustus
   *  2026: "juiste informatie geven"). Puur cosmetisch, geen cyclus-logica. */
  modeName: string;
  /** Totale sessieduur in ms (cycle * rounds * 1000) — voortgangsbalk-max. */
  totalDurationMs: number;
  /** Resterende tijd voor de HELE sessie (niet alleen de huidige fase) op
   *  het moment dat native overneemt — bepaalt de chronometer-aftelling en
   *  het startpunt van de voortgangsbalk. */
  sessionRemainingMs: number;
};

type BreathBackgroundNativeModule = {
  startBackgroundBreathSession(options: StartBreathBackgroundOptions): void;
  stopBackgroundBreathSession(): void;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): void;
};

let native: BreathBackgroundNativeModule | null = null;
try {
  native = requireNativeModule<BreathBackgroundNativeModule>(
    'BreathBackground',
  );
} catch {
  /* Geen native module gelinkt (web, of Expo Go) — no-op, zie boven. */
  native = null;
}

/** Start de native achtergrond-loop NAAST (niet in plaats van) de bestaande
 *  JS-fase-loop en startSessionKeepAlive(). Faalt stil: de achtergrond-
 *  sessie is een aanvulling op scherm-op-slot, geen vereiste om te kunnen
 *  starten. */
export function startBackgroundBreathSession(
  options: StartBreathBackgroundOptions,
): void {
  try {
    native?.startBackgroundBreathSession(options);
  } catch {
    /* stil — een falende achtergrond-sessie mag de voorgrond-sessie niet
       raken */
  }
}

/** Symmetrisch met stopSessionKeepAlive() — aanroepen bij elke `finish`/
 *  cleanup, ook als er nooit succesvol gestart is (dubbel-stoppen is
 *  onschadelijk aan de native kant). */
export function stopBackgroundBreathSession(): void {
  try {
    native?.stopBackgroundBreathSession();
  } catch {
    /* stil */
  }
}

/** Staat de app al buiten het batterijbeheer van het toestel (operator, 14
 *  augustus 2026: "met batterij onbeperkt lukt het wel")? `true` op web/
 *  Expo Go en iOS (geen native module, of geen Android-concept) — daar is
 *  er niets te vragen, dus de UI die dit gebruikt hoort dan gewoon niets te
 *  tonen in plaats van een onterechte waarschuwing. */
export function isIgnoringBatteryOptimizations(): boolean {
  try {
    return native?.isIgnoringBatteryOptimizations() ?? true;
  } catch {
    return true;
  }
}

/** Opent het systeemdialoog dat in twee tikken toestemming vraagt om
 *  buiten batterijbeheer te vallen — dezelfde die WhatsApp/Spotify
 *  gebruiken. Geen-op op web/Expo Go/iOS. */
export function requestIgnoreBatteryOptimizations(): void {
  try {
    native?.requestIgnoreBatteryOptimizations();
  } catch {
    /* stil */
  }
}
