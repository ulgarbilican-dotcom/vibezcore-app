/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Signed audio URL helper

   De Bunny pullzone vibezcore-audio heeft Token Authentication aan staan;
   raw URLs uit `audio-library-data.ts` geven 403. We laten de bestaande
   Netlify Function `/api/audio-url` (in repo vibezcore-backend) de signing
   doen — die hashing-key (BUNNY_TOKEN_SECURITY_KEY) blijft server-side.

   Endpoint-contract (bevestigd via curl 2026-05-20):
     GET https://app.vibezcore.com/api/audio-url?path=<bunny-path>
         [Authorization: Bearer <supabase-jwt>]
     200 → { url, expires_at, title, preview? }
     401 → "Login required for locked content"  (premium zonder JWT)
     402 → "Subscription required"               (JWT maar abo verlopen)
     404 → "Session not found"                   (path niet in audio_sessions)
     500 → "Internal error"                      (env vars / Supabase down)

   Cache-strategie:
     - Sleutel = raw URL (zoals in audio-library-data.ts).
     - We bewaren {signedUrl, expiresAtMs}. Op een hit binnen TTL-marge
       hergebruiken we; anders re-sign.
     - Bunny TTL is 4 uur (zie audio-url.js, URL_TTL_SECONDS). Wij refreshen
       wanneer er nog <5 min over is — ruim genoeg voor een lange sessie
       die net gestart is, geen onnodige roundtrips voor korte replays.
   ─────────────────────────────────────────────────────────────────────── */

const ENDPOINT = 'https://app.vibezcore.com/api/audio-url';
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 min vóór expires_at opnieuw signen

type CachedSign = { signedUrl: string; expiresAtMs: number };
/* Cache-sleutel = `${rawUrl}|preview=${0|1}` zodat een preview-URL en de
   volledige URL elkaar niet overschrijven (de signed-URL zelf is identiek
   in onze huidige backend-implementatie, maar het server-side gedrag van
   `preview=true` is dat het PRO-sessies signt zonder JWT). */
const cache = new Map<string, CachedSign>();

function cacheKey(rawUrl: string, preview: boolean): string {
  return `${rawUrl}|preview=${preview ? 1 : 0}`;
}

/** Error-codes die de player kan onderscheiden voor UI-fallback. */
export type SignError =
  | 'LOGIN_REQUIRED'        // 401 — premium content, geen JWT meegestuurd
  | 'SUBSCRIPTION_REQUIRED' // 402 — wel JWT, geen actief abonnement
  | 'SESSION_NOT_FOUND'     // 404 — path bestaat niet in Supabase
  | 'SIGN_FAILED';          // alle andere fouten (500, network, parse)

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
   *  JWT (server-side bevestigd via curl, 2026-05-20). UI moet zelf de
   *  30-sec cap enforce'n; de signed URL is de hele file. */
  preview?: boolean;
  /** Supabase-JWT. Vereist voor PRO-sessies zonder preview-flag. */
  bearerToken?: string;
};

/**
 * Vraag een geldige (signed) Bunny-URL voor een raw audio-URL.
 *
 * @param rawUrl  De volledige URL zoals in audio-library-data.ts staat,
 *                bv. "https://vibezcore-audio.b-cdn.net/Andrew_…osg0uy.mp3.mp3"
 * @param opts    Optionele preview-flag (voor guest-preview op PRO) en/of
 *                Supabase JWT (voor ingelogde abonnees).
 */
export async function getSignedAudioUrl(
  rawUrl: string,
  opts: SignOptions = {}
): Promise<string> {
  const preview = !!opts.preview;
  const bearerToken = opts.bearerToken;

  // 1. Cache-check — sleutel houdt rekening met preview-mode
  const key = cacheKey(rawUrl, preview);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAtMs - now > REFRESH_MARGIN_MS) {
    return cached.signedUrl;
  }

  // 2. Extract pathname uit de raw URL. new URL() geeft pathname incl. leading
  //    slash, exact zoals Supabase audio_sessions.bunny_path verwacht.
  let pathname: string;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    throw new SignedUrlError('SIGN_FAILED', `invalid raw url: ${rawUrl}`);
  }

  // 3. Roep het endpoint aan
  const params = new URLSearchParams({ path: pathname });
  if (preview) params.set('preview', 'true');
  const url = `${ENDPOINT}?${params.toString()}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', headers });
  } catch (e: any) {
    throw new SignedUrlError(
      'SIGN_FAILED',
      `network error: ${e?.message ?? String(e)}`
    );
  }

  if (!res.ok) {
    let bodyText = '';
    try {
      bodyText = await res.text();
    } catch {
      /* swallow — gebruik alleen status-code */
    }
    switch (res.status) {
      case 401:
        throw new SignedUrlError('LOGIN_REQUIRED', bodyText || '401', 401);
      case 402:
        throw new SignedUrlError(
          'SUBSCRIPTION_REQUIRED',
          bodyText || '402',
          402
        );
      case 404:
        throw new SignedUrlError(
          'SESSION_NOT_FOUND',
          bodyText || '404',
          404
        );
      default:
        throw new SignedUrlError(
          'SIGN_FAILED',
          `sign endpoint ${res.status}: ${bodyText}`,
          res.status
        );
    }
  }

  // 4. Parse + cache
  let data: any;
  try {
    data = await res.json();
  } catch (e: any) {
    throw new SignedUrlError(
      'SIGN_FAILED',
      `invalid JSON from sign endpoint: ${e?.message ?? String(e)}`
    );
  }
  if (!data?.url || !data?.expires_at) {
    throw new SignedUrlError(
      'SIGN_FAILED',
      `missing url/expires_at in response: ${JSON.stringify(data)}`
    );
  }

  const expiresAtMs = Date.parse(data.expires_at);
  if (!Number.isFinite(expiresAtMs)) {
    throw new SignedUrlError(
      'SIGN_FAILED',
      `invalid expires_at: ${data.expires_at}`
    );
  }

  cache.set(key, { signedUrl: data.url, expiresAtMs });
  return data.url;
}

/** Voor tests / handmatige reset (niet gebruikt in productie-flow). */
export function _clearSignedUrlCache(): void {
  cache.clear();
}
