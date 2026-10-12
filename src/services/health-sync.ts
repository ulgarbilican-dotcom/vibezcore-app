/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Apple Health (iPhone) / Health Connect (Android)
   (operator, 12 okt 2026: "go, wel 100% in orde brengen")

   Twee dingen, allebei vrijwillig en pas na toestemming:
     1. SCHRIJVEN — elke Breathwork- of State Control-sessie van minstens
        1 minuut als sessie in de gezondheidsapp (Apple: "Mindful
        Minutes", Health Connect: "Mindfulness"). Enkel begin, einde en
        soort — geen inhoud.
     2. LEZEN — de rusthartslag die je horloge of ring daar bewaart, zodat
        State Control op je echte rusthartslag start zonder camerameting
        (fase 3 van "Match your rhythm").
   Niets van deze gegevens gaat naar onze servers, naar Sentry of naar
   reclame — zo staat het ook in de privacyverklaring (legal-content.ts) en
   zo eisen Apple (HealthKit-richtlijnen) en Google (Health Connect-beleid)
   het. Uitzetten kan altijd (Settings); toestemming intrekken in de
   gezondheidsapp zelf.

   De native modules bestaan pas vanaf de volgende build; tot dan (en op
   toestellen zonder Health) doet alles hier stil niets.
   ───────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { importHealthRestingPulse } from './resting-pulse';

const KEY = 'vz_health_sync_v1';
/** Kortere sessies schrijven we niet weg — dat is een vergissing, geen sessie. */
const MIN_SESSION_SEC = 60;
/** Een rusthartslag ouder dan dit gebruiken we niet meer als startpunt. */
const RESTING_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

let enabled = false;
const listeners = new Set<(on: boolean) => void>();

void AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === '1' && !enabled) {
      enabled = true;
      listeners.forEach((l) => l(true));
    }
  })
  .catch(() => {});

function setEnabled(on: boolean): void {
  enabled = on;
  listeners.forEach((l) => l(on));
  void AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => {});
}

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
function healthKit(): any | null {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('@kingstinct/react-native-healthkit');
  } catch {
    return null;
  }
}

function healthConnect(): any | null {
  if (Platform.OS !== 'android') return null;
  try {
    return require('react-native-health-connect');
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

/** Is de native koppeling in deze build aanwezig? (Bepaalt of de
 *  instelling getoond wordt — vóór de nieuwe build: nee.) */
export function isHealthModulePresent(): boolean {
  return Platform.OS === 'ios' ? healthKit() !== null : healthConnect() !== null;
}

/** Naam zoals het systeem hem noemt (nooit een eigen naam verzinnen). */
export function healthAppName(): 'Apple Health' | 'Health Connect' {
  return Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
}

let hcReady: Promise<boolean> | null = null;
function initHealthConnect(): Promise<boolean> {
  const hc = healthConnect();
  if (!hc) return Promise.resolve(false);
  if (!hcReady) {
    hcReady = (async () => {
      try {
        const status = await hc.getSdkStatus();
        if (status !== hc.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
        return !!(await hc.initialize());
      } catch {
        return false;
      }
    })();
    /* Mislukt → volgende keer opnieuw proberen (Health Connect kan intussen
       geïnstalleerd of bijgewerkt zijn). */
    void hcReady.then((ok) => {
      if (!ok) hcReady = null;
    });
  }
  return hcReady;
}

/** Kan dit toestel het (module gelinkt + gezondheidsapp aanwezig)? */
export async function isHealthAvailable(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const hk = healthKit();
      return !!hk && (await hk.isHealthDataAvailableAsync());
    }
    if (Platform.OS === 'android') return await initHealthConnect();
  } catch {
    /* geen Health → gewoon niet aanbieden */
  }
  return false;
}

export type ConnectResult = 'connected' | 'denied' | 'unavailable';

/** Toestemming vragen (systeemscherm van Apple/Google) en de koppeling aanzetten. */
export async function connectHealth(): Promise<ConnectResult> {
  try {
    if (Platform.OS === 'ios') {
      const hk = healthKit();
      if (!hk || !(await hk.isHealthDataAvailableAsync())) return 'unavailable';
      /* Apple vertelt bewust niet of LEZEN is toegestaan (privacy) — enkel
         of het venster getoond is. Schrijven controleren we per sessie. */
      await hk.requestAuthorization({
        toShare: ['HKCategoryTypeIdentifierMindfulSession'],
        toRead: ['HKQuantityTypeIdentifierRestingHeartRate'],
      });
      setEnabled(true);
      void syncRestingFromHealth();
      return 'connected';
    }
    if (Platform.OS === 'android') {
      const hc = healthConnect();
      if (!hc || !(await initHealthConnect())) return 'unavailable';
      const granted: { accessType: string; recordType: string }[] = await hc.requestPermission([
        { accessType: 'write', recordType: 'MindfulnessSession' },
        { accessType: 'read', recordType: 'RestingHeartRate' },
      ]);
      const any = granted.some(
        (g) =>
          (g.accessType === 'write' && g.recordType === 'MindfulnessSession') ||
          (g.accessType === 'read' && g.recordType === 'RestingHeartRate'),
      );
      if (!any) return 'denied';
      setEnabled(true);
      void syncRestingFromHealth();
      return 'connected';
    }
  } catch {
    return 'unavailable';
  }
  return 'unavailable';
}

/** Koppeling uit: niets meer schrijven of lezen. Toestemming zelf trekt de
 *  gebruiker in via de gezondheidsapp (Android: we openen die). */
export function disconnectHealth(): void {
  setEnabled(false);
}

export function openHealthSettings(): void {
  try {
    if (Platform.OS === 'android') healthConnect()?.openHealthConnectSettings();
  } catch {
    /* stil */
  }
}

export function isHealthSyncEnabled(): boolean {
  return enabled;
}

export function useHealthSync(): boolean {
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    listeners.add(setOn);
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return on;
}

/** Een afgeronde of gestopte sessie wegschrijven. Faalt stil. */
export async function saveSessionToHealth(opts: {
  kind: 'breath' | 'state';
  title: string;
  startMs: number;
  endMs: number;
}): Promise<void> {
  if (!enabled) return;
  if (!(opts.endMs - opts.startMs >= MIN_SESSION_SEC * 1000)) return;
  try {
    if (Platform.OS === 'ios') {
      const hk = healthKit();
      if (!hk) return;
      await hk.saveCategorySample(
        'HKCategoryTypeIdentifierMindfulSession',
        0 /* HKCategoryValue.notApplicable */,
        new Date(opts.startMs),
        new Date(opts.endMs),
      );
      return;
    }
    if (Platform.OS === 'android') {
      const hc = healthConnect();
      if (!hc || !(await initHealthConnect())) return;
      await hc.insertRecords([
        {
          recordType: 'MindfulnessSession',
          startTime: new Date(opts.startMs).toISOString(),
          endTime: new Date(opts.endMs).toISOString(),
          /* Breathwork = ademhaling; State Control = een trilritme, geen
             eigen categorie → "unknown" met de naam als titel. */
          mindfulnessSessionType:
            opts.kind === 'breath' ? hc.MindfulnessSessionType.BREATHING : hc.MindfulnessSessionType.UNKNOWN,
          title: opts.title,
        },
      ]);
    }
  } catch {
    /* geen toestemming meer / oudere Health Connect zonder Mindfulness */
  }
}

/** De meest recente rusthartslag uit de gezondheidsapp (≤ 7 dagen oud). */
export async function readLatestRestingHeartRate(): Promise<{ bpm: number; at: number } | null> {
  if (!enabled) return null;
  try {
    if (Platform.OS === 'ios') {
      const hk = healthKit();
      if (!hk) return null;
      const s = await hk.getMostRecentQuantitySample('HKQuantityTypeIdentifierRestingHeartRate', 'count/min');
      if (!s) return null;
      const at = new Date(s.endDate ?? s.startDate).getTime();
      const bpm = Math.round(Number(s.quantity));
      return fresh(bpm, at);
    }
    if (Platform.OS === 'android') {
      const hc = healthConnect();
      if (!hc || !(await initHealthConnect())) return null;
      const res = await hc.readRecords('RestingHeartRate', {
        timeRangeFilter: { operator: 'after', startTime: new Date(Date.now() - RESTING_MAX_AGE_MS).toISOString() },
        ascendingOrder: false,
        pageSize: 1,
      });
      const r = res?.records?.[0];
      if (!r) return null;
      return fresh(Math.round(Number(r.beatsPerMinute)), new Date(r.time).getTime());
    }
  } catch {
    /* geen leestoestemming of geen gegevens */
  }
  return null;
}

function fresh(bpm: number, at: number): { bpm: number; at: number } | null {
  if (!Number.isFinite(bpm) || !Number.isFinite(at)) return null;
  if (Date.now() - at > RESTING_MAX_AGE_MS) return null;
  return { bpm, at };
}

/** De rusthartslag van het horloge overnemen als die nieuwer is dan wat er
 *  staat (resting-pulse beslist: nieuwste wint, niets van vóór "Clear"). */
export async function syncRestingFromHealth(): Promise<void> {
  if (!enabled) return;
  const r = await readLatestRestingHeartRate();
  if (r) importHealthRestingPulse(r.bpm, r.at);
}

/* Bij het openen en elke keer dat de app terug in beeld komt — je horloge
   werkt de rusthartslag doorgaans één keer per dag bij. */
let lastSync = 0;
function syncSoon(): void {
  if (!enabled || Date.now() - lastSync < 10 * 60_000) return;
  lastSync = Date.now();
  void syncRestingFromHealth();
}
listeners.add((on) => {
  if (on) syncSoon();
});
AppState.addEventListener('change', (st) => {
  if (st === 'active') syncSoon();
});
