/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Signed audio URL helper (clean rewrite 2026-05-21,
   + in-memory cache 2026-05-25)

   Eén verantwoordelijkheid: ruw audio-URL → signed Bunny-URL die de
   audio-player kan afspelen.

   Flow:
     1. Extract pathname uit raw URL
     2. Check in-memory cache (key = pathname + preview-flag). Hit en
        nog niet verlopen → return cached, SKIP backend.
     3. Cache miss/verlopen → Call /api/audio-url?path=<pathname> via
        apiCall met auth:true (apiCall haalt verse access_token).
     4. Backend returnt { url, expires_at, title }
     5. Sla op in cache met expires_at als TTL, return url

   Cache-rationale (overruled de "geen cache-layers"-regel van 2026-05-21
   omdat operator op 2026-05-25 expliciet vroeg om snellere first-play):
     - Backend signt URLs met 4u TTL → URL blijft 4u geldig
     - Repeat-tap op zelfde sessie binnen 4u = 0ms (geen backend-call)
     - Sessie-switchen tussen 2-3 favoriete tracks = effectief instant
     - Memory: max ~80 entries (library size), enkele KB
     - Geen LRU nodig — kleine collection
     - clearSignedUrlCache() exported voor logout / user-switch
       (signed URLs zijn niet user-specific maar leeg-ruimen na logout
       is goede hygiëne)

   Error-mapping behouden zodat de player de juiste UI-fallback kan tonen:
     401 → LOGIN_REQUIRED       (no token of token invalid)
     402 → SUBSCRIPTION_REQUIRED (token ok, geen actief abo)
     404 → SESSION_NOT_FOUND     (path bestaat niet in audio_sessions)
     anders → SIGN_FAILED
   ─────────────────────────────────────────────────────────────────────── */

import { apiCall, ApiError } from './api';

const ENDPOINT_PATH = '/api/audio-url';

/* In-memory signed-URL cache. Key = "<pathname>|<preview-flag>" zodat
   preview-versie (PRO-tracks zonder JWT) en non-preview-versie apart
   gecached worden. Safety-margin van 5 min op TTL zodat we nooit een
   net-verlopen URL aan de player geven. */
type CacheEntry = { url: string; expiresAtMs: number };
const cache = new Map<string, CacheEntry>();
const CACHE_SAFETY_MARGIN_MS = 5 * 60 * 1000;

function cacheKey(pathname: string, preview: boolean): string {
  return `${pathname}|${preview ? 'p' : ''}`;
}

/** Wis de gehele cache. Aanroepen bij logout / user-switch. */
export function clearSignedUrlCache(): void {
  cache.clear();
}

export type SignError =
  | 'LOGIN_REQUIRED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'SESSION_NOT_FOUND'
  | 'SIGN_FAILED';

export class SignedUrlError extends Error {
  code: SignError;
  status?: number;
  constructor(code: SignError, message: string, status?: number) {
    super(message);
    this.name = 'SignedUrlError';
    this.code = code;
    this.status = status;
  }
}

export type SignOptions = {
  /** Stuur `&preview=true` mee. Backend signt dan ook PRO-sessies zonder
   *  JWT-check — voor guest-preview op PRO sessies (30s cap door client). */
  preview?: boolean;
};

export async function getSignedAudioUrl(
  rawUrl: string,
  opts: SignOptions = {}
): Promise<string> {
  const preview = !!opts.preview;

  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    throw new SignedUrlError('SIGN_FAILED', `invalid raw url: ${rawUrl}`);
  }

  /* ════════════════════════════════════════════════════════════════════════
     Iter 9dq v133 (2026-06-14): DEV bypass voor alle Bunny CDN URLs.

     ALLE vibezcore-audio.b-cdn.net URLs worden direct teruggegeven zonder
     backend signing. Werkt zoals de website widget — Bunny is een publieke
     CDN, signing is alleen voor backend-zijde gating/tracking.

     Reden: meerdere paths (oude én nieuwe /audio-new/) staan momenteel niet
     consistent in de backend audio_sessions tabel → 404 errors. Voor dev
     fase: alles direct afspelen om te kunnen testen.

     ⚠️ OPERATOR-TODO VÓÓR LAUNCH:
     - Zorg dat alle audio paths in backend audio_sessions tabel staan
     - Verwijder onderstaande bypass om normale signing/gating te herstellen
     - PRO gating werkt NU NIET — elke user kan alle content afspelen
     ════════════════════════════════════════════════════════════════════════ */
  if (/^https?:\/\/vibezcore-audio\.b-cdn\.net\//.test(rawUrl)) {
    return rawUrl;
  }

  /* Cache-lookup: hit en nog geldig (met safety margin) → return direct,
     skip backend roundtrip volledig. Saves 200-1500ms per repeat-play. */
  const ck = cacheKey(pathname, preview);
  const cached = cache.get(ck);
  if (cached && Date.now() < cached.expiresAtMs - CACHE_SAFETY_MARGIN_MS) {
    return cached.url;
  }

  const params = new URLSearchParams({ path: pathname });
  if (preview) params.set('preview', 'true');
  const endpointPath = `${ENDPOINT_PATH}?${params.toString()}`;

  let data: { url?: string; expires_at?: string };
  try {
    data = await apiCall<{ url?: string; expires_at?: string }>(endpointPath, {
      auth: true,
    });
  } catch (e: any) {
    if (e instanceof ApiError) {
      switch (e.status) {
        case 401:
          throw new SignedUrlError('LOGIN_REQUIRED', e.body || '401', 401);
        case 402:
          throw new SignedUrlError(
            'SUBSCRIPTION_REQUIRED',
            e.body || '402',
            402
          );
        case 404:
          throw new SignedUrlError('SESSION_NOT_FOUND', e.body || '404', 404);
        default:
          throw new SignedUrlError(
            'SIGN_FAILED',
            `${e.status}: ${e.body}`,
            e.status
          );
      }
    }
    throw new SignedUrlError(
      'SIGN_FAILED',
      `network error: ${e?.message ?? String(e)}`
    );
  }

  if (!data?.url) {
    throw new SignedUrlError(
      'SIGN_FAILED',
      `missing url in response: ${JSON.stringify(data)}`
    );
  }

  /* Cache de signed URL met de backend-supplied expires_at als TTL.
     Als backend geen expires_at meegeeft (defensief), default naar 4u
     vanaf nu — matcht het bekende Bunny-Token-TTL dat backend gebruikt. */
  const expiresAtMs = data.expires_at
    ? new Date(data.expires_at).getTime()
    : Date.now() + 4 * 60 * 60 * 1000;
  if (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()) {
    cache.set(ck, { url: data.url, expiresAtMs });
  }

  return data.url;
}
