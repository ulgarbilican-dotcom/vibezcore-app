/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — User bucket resolver (shared across all per-user storage)
   Iter 9dq v44 (2026-06-03)

   Bepaalt onder welke "bucket" een user's lokale data wordt opgeslagen:
     - dev-{override}     : dev-mode override actief (testing)
     - u-{jwt-sub}        : real user, ingelogd via Supabase
     - anon               : niet ingelogd, geen override

   Gebruikt door:
     - utils/history.ts      (listening history vzh)
     - utils/vzp.ts          (saved positions)
     - hooks/useFavorites.ts (audio favorites)
     - utils/bracelet-history.ts (al per-user — heeft eigen identieke logica
       voor backward-compat; kan later geüniformeerd worden)

   Subscribers (history.ts etc.) krijgen een callback bij bucket-switch zodat
   ze hun in-memory cache kunnen leegmaken en uit de nieuwe key herladen.
   ─────────────────────────────────────────────────────────────────────── */

import { getToken } from '@/services/auth';
import {
  awaitDevUserOverrideLoaded,
  getDevUserOverride,
  subscribeDevUserOverride,
} from '@/utils/dev-user-override';

let cachedBucket: string | null = null;
const listeners = new Set<(bucket: string) => void>();

/** Decode JWT payload safely, returns the `sub` claim of the Supabase user. */
function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json =
      typeof atob === 'function'
        ? atob(b64)
        : (globalThis as any).Buffer
          ? (globalThis as any).Buffer.from(b64, 'base64').toString('utf8')
          : '';
    if (!json) return null;
    const payload = JSON.parse(json);
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Compute the active bucket. Async because token-fetch is async. */
export async function resolveActiveBucket(): Promise<string> {
  await awaitDevUserOverrideLoaded();
  const override = getDevUserOverride();
  if (override) {
    return `dev-${override}`;
  }
  try {
    const token = await getToken();
    if (token) {
      const sub = decodeJwtSub(token);
      if (sub) return `u-${sub}`;
    }
  } catch {
    /* token-fetch faalt → val terug op anon */
  }
  return 'anon';
}

/** Sync read — returns the bucket as currently cached. Returns 'anon' before
 *  first resolve completes; data-utils that need-to-know-now should call
 *  `ensureBucketLoaded()` instead. */
export function getCurrentBucket(): string {
  return cachedBucket ?? 'anon';
}

/** Resolve & cache the bucket. Safe to call multiple times — does the work
 *  only once unless a refresh has cleared the cache. */
export async function ensureBucketLoaded(): Promise<string> {
  if (cachedBucket !== null) return cachedBucket;
  cachedBucket = await resolveActiveBucket();
  return cachedBucket;
}

/** Subscribe to bucket-switch events. Returns an unsubscribe function.
 *  The callback receives the new bucket string. */
export function subscribeUserBucket(
  cb: (bucket: string) => void,
): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Trigger re-evaluation of the bucket. Call this after:
 *    - sign in / sign out (auth state change)
 *    - dev-override switch
 *  When the bucket changes, all subscribers are notified so they can
 *  reload their data from the new bucket-key. */
export async function refreshUserBucket(): Promise<void> {
  const newBucket = await resolveActiveBucket();
  if (newBucket === cachedBucket) return;
  cachedBucket = newBucket;
  setTimeout(() => {
    listeners.forEach((cb) => {
      try {
        cb(newBucket);
      } catch {
        /* swallow — een listener mag de bucket-flow nooit breken */
      }
    });
  }, 0);
}

/* Init: triggers initial bucket-resolve on module-load. */
ensureBucketLoaded();

/* Auto-refresh on dev-override changes (no-op in production since
   override is always null there). */
subscribeDevUserOverride(() => {
  refreshUserBucket().catch(() => {
    /* swallow */
  });
});
