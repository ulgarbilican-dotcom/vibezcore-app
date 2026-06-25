/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — IAP Recovery (retry + persistent purchase queue)

   Iter v148 (2026-06-25): KRITIEKE robuustheid voor de aankoopflow.
   Operator-doel: 100% van paid users moet hun PRO-toegang krijgen, ook
   wanneer er iets misgaat tussen Apple/Google purchase en onze backend
   verify.

   Probleem dat dit oplost:
     - User betaalt → Apple/Google bevestigt → backend verify call faalt
       (netwerk hiccup, server outage, app crash) → user heeft betaald
       maar krijgt geen PRO. Zonder dit module zou hij vastzitten op
       "contact support".

   Oplossing — drie lagen:
     1. INLINE RETRY: 3x retry met exponential backoff (1s, 2s, 4s) op
        elke /api/iap-verify call. Dekt 95% van transient failures.
     2. PERSISTENT QUEUE: na 3 mislukte retries → opslaan in AsyncStorage.
        Bij volgende app-open: opnieuw proberen. Dekt extended outages,
        offline scenarios, app-crashes mid-verify.
     3. RESTORE AT STARTUP: bij iedere app-launch een silent restorePurchases
        call zodat Apple/Google's purchase-history altijd gesynced is met
        onze backend, ook na een fresh install op een nieuw toestel.

   Performance-notes:
     - Inline retry-budget = max ~7s wallclock (1+2+4). Acceptabel voor
       de subscribe-flow (gebruiker is op een 'Confirming...' loader).
     - Persistent queue is small (max 5 entries) en wordt na succesvolle
       verify gewist. AsyncStorage I/O is fire-and-forget.
     - Startup-restore is async en blokkeert geen UI.
   ─────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getIAP } from './iap';
import { getToken, VZ_BACKEND_URL } from './auth';
import type { IapPurchase } from './iap-contract';

const PENDING_KEY = '@vzc:iap:pending-verifies';
const MAX_QUEUE_SIZE = 5;
const INLINE_RETRY_DELAYS = [1000, 2000, 4000]; // ms

export type VerifyOutcome =
  | { ok: true; active: boolean; tier?: string }
  | { ok: false; retriable: boolean; error: string; status?: number };

/* ── Public API ────────────────────────────────────────────────────── */

/** Verify een receipt met inline retry. Returnt outcome — caller beslist
 *  hoe te tonen aan user (success → activate; retriable failure → queue;
 *  permanent failure → support). */
export async function verifyWithRetry(
  purchase: IapPurchase,
): Promise<VerifyOutcome> {
  let lastError = '';
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt <= INLINE_RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      await sleep(INLINE_RETRY_DELAYS[attempt - 1]);
    }
    try {
      const outcome = await callVerifyEndpoint(purchase);
      if (outcome.ok) return outcome;
      lastError = outcome.error;
      lastStatus = outcome.status;
      /* 4xx behalve 408/429 = permanent fail (bad data, replay,
         invalid receipt) — geen verdere retry. */
      if (!outcome.retriable) return outcome;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, retriable: true, error: lastError, status: lastStatus };
}

/** Voeg een purchase toe aan de persistent retry queue. Beperkt tot
 *  MAX_QUEUE_SIZE — oudste entries vallen eraf. */
export async function queuePendingVerify(purchase: IapPurchase): Promise<void> {
  try {
    const queue = await loadQueue();
    /* Dedup op transactionId — als al in queue, vervang met laatste data. */
    const filtered = queue.filter(
      (p) => p.transactionId !== purchase.transactionId,
    );
    filtered.push(purchase);
    while (filtered.length > MAX_QUEUE_SIZE) filtered.shift();
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(filtered));
  } catch {
    /* AsyncStorage failure is non-fatal — startup-restore zal de purchase
       alsnog detecteren via store. */
  }
}

/** Drain de queue: probeer elke pending verify opnieuw. Returnt aantal
 *  succesvolle activations. Wordt op app-startup geroepen. */
export async function drainPendingVerifies(): Promise<number> {
  const queue = await loadQueue();
  if (queue.length === 0) return 0;
  let activated = 0;
  const remaining: IapPurchase[] = [];
  for (const p of queue) {
    const outcome = await verifyWithRetry(p);
    if (outcome.ok && outcome.active) {
      activated += 1;
      /* Acknowledge bij store nu backend bevestigd heeft. */
      try {
        await getIAP().acknowledge(p.transactionId);
      } catch {
        /* non-fatal */
      }
    } else if (outcome.ok === false && outcome.retriable) {
      /* Houd in queue voor volgende keer. */
      remaining.push(p);
    }
    /* Permanent failures (non-retriable) → laten vallen uit queue. */
  }
  try {
    if (remaining.length > 0) {
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
    } else {
      await AsyncStorage.removeItem(PENDING_KEY);
    }
  } catch {
    /* swallow */
  }
  return activated;
}

/** Volledige startup-recovery: drain de queue + silent restorePurchases.
 *  Wordt eenmalig per app-launch geroepen (zie app/_layout.tsx). */
export async function recoverOnStartup(): Promise<void> {
  /* Geen recovery zonder ingelogde user — anders kunnen we de verify
     niet authenticated doen. */
  const token = await getToken();
  if (!token) return;

  try {
    await drainPendingVerifies();
  } catch (e) {
    if (__DEV__) console.warn('[iap-recovery] drainPendingVerifies:', e);
  }

  /* Silent restorePurchases — vraag Apple/Google welke active subs deze
     account heeft en sync ze met onze backend. Dekt het scenario waar
     user installeert app op nieuw toestel of na fresh install. */
  try {
    const iap = getIAP();
    await iap.init();
    const purchases = await iap.restorePurchases();
    for (const p of purchases) {
      const outcome = await verifyWithRetry(p);
      if (!outcome.ok && outcome.retriable) {
        await queuePendingVerify(p);
      } else if (outcome.ok && outcome.active) {
        try {
          await getIAP().acknowledge(p.transactionId);
        } catch {
          /* non-fatal */
        }
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[iap-recovery] restorePurchases:', e);
  }
}

/* ── Internals ─────────────────────────────────────────────────────── */

async function callVerifyEndpoint(
  purchase: IapPurchase,
): Promise<VerifyOutcome> {
  const token = await getToken();
  if (!token) {
    return { ok: false, retriable: false, error: 'Not signed in' };
  }
  try {
    const res = await fetch(`${VZ_BACKEND_URL}/api/iap-verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        platform: Platform.OS === 'ios' ? 'apple' : 'google',
        tier: purchase.tier,
        productId: purchase.productId,
        transactionId: purchase.transactionId,
        receipt: purchase.receiptToken,
      }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: true,
        active: data?.active === true,
        tier: data?.tier,
      };
    }
    /* 408 = timeout, 429 = rate limit, 5xx = server error → retriable.
       4xx (anders) = client/data error → niet retriable. */
    const retriable =
      res.status === 408 || res.status === 429 || res.status >= 500;
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      retriable,
      error: text || `HTTP ${res.status}`,
      status: res.status,
    };
  } catch (e) {
    /* Network/transport error → altijd retriable. */
    return {
      ok: false,
      retriable: true,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function loadQueue(): Promise<IapPurchase[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) =>
        p &&
        typeof p.transactionId === 'string' &&
        typeof p.receiptToken === 'string' &&
        typeof p.tier === 'string' &&
        typeof p.productId === 'string',
    );
  } catch {
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
