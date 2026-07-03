/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Dev-only user-type override

   Voor het testen van verschillende user-states zonder backend-roundtrip:
     - 'guest'    : geen account
     - 'audio'    : PRO audio-abonnement, geen bracelet
     - 'bracelet' : bracelet owner, geen audio-PRO
     - 'pro'      : full PRO (audio + bracelet owner)
     - null       : geen override — gebruik echte backend-state

   Patroon: module-state + listener-set (zelfde als history.ts, settings.ts).
   AsyncStorage-persistent zodat reload behouden blijft.

   ⚠️ Alleen gerespecteerd in __DEV__ builds. Productie negeert het.
   ─────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { clearLastPlayed } from '@/utils/last-played';

const KEY = 'vz_dev_user_override_v1';

export type DevUserOverride = null | 'guest' | 'audio' | 'bracelet' | 'pro';

let cached: DevUserOverride = null;
let loaded = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<(v: DevUserOverride) => void>();

function notify(): void {
  listeners.forEach((cb) => cb(cached));
}

async function loadOnce(): Promise<void> {
  if (loaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw === 'guest' || raw === 'audio' || raw === 'bracelet' || raw === 'pro') {
        cached = raw;
      }
    } catch {
      /* corrupt → null */
    }
    loaded = true;
    notify();
  })();
  return loadPromise;
}

/** Synchroon lezen (na initial load). Voor non-hook callers.
 *  Iter v193 (2026-07-03): __DEV__ guard weggehaald zodat de override
 *  ook in productie gerespecteerd wordt door bracelet activation mock.
 *  Zonder deze fix: activate → setDevUserOverride('bracelet') → maar
 *  getDevUserOverride/useDevUserOverride retourneren null in prod →
 *  useBraceletOwner() blijft false → Account tab toont "free environment"
 *  ondanks succesvolle activatie. Root cause van vC 49 foto 1+2 bugs. */
export function getDevUserOverride(): DevUserOverride {
  return cached;
}

/** Iter 9dn (2026-05-31): publieke subscribe-API voor non-hook modules
 *  zoals bracelet-history.ts die op override-wijzigingen moeten reageren
 *  (bv. opnieuw laden van per-user bucket). Returnt een unsubscribe-fn. */
export function subscribeDevUserOverride(
  cb: (v: DevUserOverride) => void,
): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Iter 9ar (2026-05-31): wacht tot de AsyncStorage-cache geladen is.
 *  Welcome screen heeft dit nodig zodat de 'guest'-override gerespecteerd
 *  wordt vóór de token-check beslist of welcome zichtbaar is. In prod
 *  resolved direct (geen override). */
export function awaitDevUserOverrideLoaded(): Promise<void> {
  /* Iter v193 (2026-07-03): __DEV__ guard weg — welkomstscherm moet ook
     in productie op de override wachten (activation-mock flow). */
  if (loaded) return Promise.resolve();
  return loadPromise ?? Promise.resolve();
}

/** Set override + persist + broadcast.
 *  Iter v191 (2026-07-03): __DEV__ guard weggehaald — bracelet activation
 *  mock heeft dit nodig in productie om bundle-owner state te simuleren
 *  totdat backend endpoint /api/bracelet/activate live is. */
export async function setDevUserOverride(
  value: DevUserOverride,
): Promise<void> {
  const prev = cached;
  cached = value;
  notify();
  try {
    if (value === null) {
      await AsyncStorage.removeItem(KEY);
    } else {
      await AsyncStorage.setItem(KEY, value);
    }
  } catch {
    /* swallow */
  }
  /* Iter 9dq v125 (2026-06-04): bij elke override-verandering ook de
     activation-flag resetten. Anders bleef bv. activation=true uit een
     Bracelet-test plakken wanneer je naar Pro/Full PRO switcht → eerste
     bezoek aan bracelet-control toonde "Looking for your bracelet" (=
     activated owner zonder hardware) i.p.v. "Bracelet not linked" (=
     not-yet-activated owner). Elke override start nu schoon: activate
     opnieuw via /activate-bracelet om de geactiveerde state te krijgen. */
  if (prev !== value) {
    await setDevBraceletActivated(false);
    /* Iter 9dq v158 (operator-fix 2026-06-18): bij elke override-switch
       ook last-played wissen. Anders krijgt de "nieuwe" user de Continue-
       listening popup voor een sessie van de "oude" user → cross-user
       data leak. Productie-sign-out doet dit al in account.tsx:631; deze
       dev-pad mistte het. */
    await clearLastPlayed();
  }
}

/** React-hook variant. Re-renders bij wijziging. */
export function useDevUserOverride(): DevUserOverride {
  const [value, setValue] = useState<DevUserOverride>(cached);
  useEffect(() => {
    listeners.add(setValue);
    if (cached !== value) setValue(cached);
    loadOnce();
    return () => {
      listeners.delete(setValue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Iter v193 (2026-07-03): __DEV__ guard weg — zie getDevUserOverride. */
  return value;
}

/* ── Bracelet activation tracking (iter 9dq v89, 2026-06-03) ────────
   Operator-feedback: override 'bracelet' / 'pro' liet de user direct
   zien als "Bracelet activated" terwijl in productie een gekochte
   bracelet ook eerst geactiveerd moet worden met de 12-char code.
   Twee onafhankelijke staten nu:
     1. Entitled = paid → override 'bracelet' of 'pro'
     2. Activated = code geredeem'd → separate flag
   Account-tab toont "Activate"-CTA bij entitled-niet-activated.
   BraceletCard verschijnt pas wanneer activated.
   In productie regelt backend has_bracelet=true dit; deze flag is
   alleen voor dev-mock-flow. Clear bij override-change voor schone tests.

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ⚠️  BELANGRIJK — ACTIVATIE IS ACCOUNT-LEVEL, NIET DEVICE-LEVEL
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   In productie moet de bracelet-activated-status uit de BACKEND komen
   (per-user, niet per-telefoon). Concreet: /api/subscription-status
   uitbreiden met een veld `has_bracelet_activated: boolean` dat true
   wordt zodra de 12-char code is geredeem'd in /api/bracelet/activate.

   Waarom account-level:
     - User koopt nieuwe telefoon → install app → login zelfde account
       → backend zegt "yes activated" → géén code-her-invoer nodig
     - User installeert op tablet naast telefoon → beide zien activated
     - Backend is source-of-truth voor "wie heeft welke bracelet"
     - Verloren-telefoon-scenario: oude device kan via support los-
       gekoppeld worden (zie deactivate-flow, separate spec)

   Wat deze module DOET in dev-mode:
     - Lokale AsyncStorage-flag (ACTIVATED_KEY) als dev-mock
     - Alleen voor operator/tester om de pre- en post-activation UI
       te previewen zonder echte backend-roundtrip
     - Productie negeert dit (alleen __DEV__-guards return)

   Backend-implementatie checklist (vibezcore-backend repo):
     □ Tabel `bracelet_activations` met (user_id, code, activated_at)
     □ Endpoint POST /api/bracelet/activate valideert + insert + zet
       user.has_bracelet_activated = true
     □ GET /api/subscription-status returnt has_bracelet_activated
     □ useSubscription-hook leest dat veld → useBraceletActivated
       (productie-versie) baseert op subscription-state ipv lokale flag
     □ Deactivate-flow: support-handmatig of /api/bracelet/deactivate
       (operator-keuze pending) — clear het flag-veld backend-side
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const ACTIVATED_KEY = 'vz_dev_bracelet_activated_v1';
let activatedCached = false;
let activatedLoaded = false;
const activationListeners = new Set<(v: boolean) => void>();

function notifyActivation(): void {
  activationListeners.forEach((cb) => cb(activatedCached));
}

async function loadActivationOnce(): Promise<void> {
  if (activatedLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(ACTIVATED_KEY);
    activatedCached = raw === '1';
  } catch {
    /* swallow */
  }
  activatedLoaded = true;
  notifyActivation();
}

export async function setDevBraceletActivated(value: boolean): Promise<void> {
  /* Iter v191 (2026-07-03): __DEV__ guard weggehaald zodat activation-mock
     ook in productie de state daadwerkelijk switcht naar bracelet-owner.
     Bij live backend endpoint: deze functie niet meer nodig — backend zet
     has_bracelet_activated in /api/subscription-status. */
  activatedCached = value;
  notifyActivation();
  try {
    if (value) {
      await AsyncStorage.setItem(ACTIVATED_KEY, '1');
    } else {
      await AsyncStorage.removeItem(ACTIVATED_KEY);
    }
  } catch {
    /* swallow */
  }
}

/** Heeft user de activation-code ingevoerd? Dev-only flag. */
export function useDevBraceletActivated(): boolean {
  const [value, setValue] = useState<boolean>(activatedCached);
  useEffect(() => {
    activationListeners.add(setValue);
    if (activatedCached !== value) setValue(activatedCached);
    loadActivationOnce();
    return () => {
      activationListeners.delete(setValue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Iter v193 (2026-07-03): __DEV__ guard weg voor activation-mock. */
  return value;
}

/* Iter 9dq v90 (2026-06-03): activation-flag GEEN auto-reset meer.
   Vorige versie reset op elke loadOnce-notify, ook bij cold-start →
   activated user verloor z'n state bij kill+reopen. Nu persistent;
   operator wist via Settings → Clear all local data wanneer ze een
   schone test willen. */

/** Bracelet-ownership = heeft betaald.
 *  Iter 9dq v91 (2026-06-03): teruggedraaid naar override-only. Reden:
 *  operator-feedback "na aankoop+account moet user in PRO omgeving zitten".
 *  Activation is een SUB-STAP in de bracelet-flow zelf (welk apparaat
 *  bind ik aan dit account?), niet een gate naar PRO entitlement. Wie
 *  betaald heeft = is PRO user, ook al moet 'ie nog z'n code invoeren.
 *
 *  De activation-status (useDevBraceletActivated) bepaalt vervolgens
 *  wat de BraceletCard intern toont (pending vs activated), niet of
 *  de user wel/niet bracelet-owner is.
 *
 *  useBraceletEntitled is verwijderd — was hetzelfde concept onder
 *  andere naam. */
export function useBraceletOwner(): boolean {
  const override = useDevUserOverride();
  if (override === 'bracelet' || override === 'pro') return true;
  return false;
}

loadOnce();
loadActivationOnce();
