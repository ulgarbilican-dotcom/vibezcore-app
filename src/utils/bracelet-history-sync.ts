/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet history sync service
   Iter 9do (2026-05-31)

   Local-first sync naar de bestaande backend. Records worden lokaal
   geschreven en in een sync-queue gehouden. Wanneer netwerk + token
   beschikbaar zijn, pusht deze service ze naar backend en pullt nieuwe
   updates. Conflict-resolution = last-write-wins op updatedAt.

   ARCHITECTURE
   ────────────
   1. recordSession() schrijft lokaal met syncedAt=null
   2. tryFlushSync() pakt alle records waar syncedAt=null, pusht naar
      backend, en zet syncedAt=ISO bij succes.
   3. tryPullSync() pullt records die ge-update zijn sinds onze laatste
      pull-cursor, mergt in lokale cache (last-write-wins).
   4. syncAll() doet beide in volgorde push → pull.

   TRIGGERS (call van app-code):
   - Na recordSession() — direct proberen te pushen
   - App-start / focus — om verse data van andere devices te krijgen
   - Sign-in — om server-data van deze user op te halen
   - Pull-to-refresh — handmatige sync trigger

   OFFLINE
   ───────
   Bij netwerk-failure of geen token: silent fail. Records blijven
   syncedAt=null en worden bij volgende kans opnieuw geprobeerd.

   PROD-READY MAAR BACKEND-AFHANKELIJK
   ───────────────────────────────────
   Werkt zodra:
   1. bracelet-sessions-migration.sql gerund is in Supabase
   2. api-bracelet-sessions-sync.js gedeployed is op Netlify met route
      /api/bracelet/sessions/sync → de function
   ─────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, VZ_BACKEND_URL } from '@/services/auth';
import {
  getAllSessions,
  type SessionRecord,
  _internalMergeFromServer,
  _internalMarkSynced,
  _internalGetActiveBucket,
} from '@/utils/bracelet-history';

/* Per-bucket pull-cursor key. Stelt ons in staat alleen delta's te pullen
   (records die ge-update zijn sinds vorige succesvolle pull). */
const PULL_CURSOR_PREFIX = 'vzbc_sync_cursor_';

/* Endpoint — past in de bestaande /api/* conventie. */
const SYNC_ENDPOINT = `${VZ_BACKEND_URL}/api/bracelet/sessions/sync`;

/* Race-protection: één sync tegelijk per app-instance. */
let inFlight: Promise<SyncResult> | null = null;

export type SyncResult = {
  ok: boolean;
  pushed: number;
  pulled: number;
  conflicts: number;
  error?: string;
};

/** Hoofdpoort voor sync — bundle push + pull in één call.
 *  Race-safe: parallelle calls krijgen dezelfde promise. */
export async function syncAll(): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = doSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSync(): Promise<SyncResult> {
  /* Voorwaarden — geen sync zonder token (kan geen RLS-call doen). */
  let token: string | null = null;
  try {
    token = await getToken();
  } catch {
    return failResult('Token unavailable');
  }
  if (!token) return failResult('No token');

  /* Bucket bepaalt welke records we lokaal hebben + cursor-key. */
  const bucket = _internalGetActiveBucket();
  if (!bucket || !bucket.startsWith('u-')) {
    /* Alleen real-user buckets syncen. Dev-overrides en anon blijven
       puur lokaal — geen backend roundtrip nodig voor test-data. */
    return successResult(0, 0, 0);
  }

  /* Push-set: records met syncedAt === null. */
  const all = getAllSessions();
  const push = all.filter((r) => r.syncedAt == null);

  /* Pull-cursor: tijd van laatste succesvolle pull. */
  const cursorKey = `${PULL_CURSOR_PREFIX}${bucket}`;
  let since: string | null = null;
  try {
    since = await AsyncStorage.getItem(cursorKey);
  } catch {
    /* cursor unavailable → first-sync (pull alles) */
  }

  /* ── HTTP call ──────────────────────────────────────────────────────── */
  let response: Response;
  try {
    response = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ push, since }),
    });
  } catch {
    return failResult('Network error');
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      /* swallow */
    }
    return failResult(`HTTP ${response.status}: ${detail.slice(0, 200)}`);
  }

  let body: {
    pushed: number;
    pulled: SessionRecord[];
    conflicts: SessionRecord[];
    serverTime: string;
  };
  try {
    body = await response.json();
  } catch {
    return failResult('Invalid response JSON');
  }

  /* ── Markeer gepushte records als gesynct ────────────────────────────── */
  if (push.length > 0) {
    const pushedIds = push.map((r) => r.id);
    const syncedAt = body.serverTime || new Date().toISOString();
    await _internalMarkSynced(pushedIds, syncedAt);
  }

  /* ── Merge pulled records in lokale cache (last-write-wins) ─────────── */
  const pulledList = Array.isArray(body.pulled) ? body.pulled : [];
  const conflictList = Array.isArray(body.conflicts) ? body.conflicts : [];
  const toMerge = [...pulledList, ...conflictList];
  if (toMerge.length > 0) {
    await _internalMergeFromServer(toMerge);
  }

  /* ── Update pull-cursor ──────────────────────────────────────────────── */
  if (body.serverTime) {
    try {
      await AsyncStorage.setItem(cursorKey, body.serverTime);
    } catch {
      /* swallow — next sync probeert weer met zelfde cursor */
    }
  }

  return successResult(body.pushed ?? push.length, pulledList.length, conflictList.length);
}

function failResult(error: string): SyncResult {
  return { ok: false, pushed: 0, pulled: 0, conflicts: 0, error };
}

function successResult(pushed: number, pulled: number, conflicts: number): SyncResult {
  return { ok: true, pushed, pulled, conflicts };
}
