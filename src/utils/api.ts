/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Centrale API-client

   Eén plek voor alle calls naar https://app.vibezcore.com/api/*.
   Provider-agnostisch — de app praat NOOIT direct met Gumroad of Stripe
   (CLAUDE.md §1).

   Lazy import van auth.ts voorkomt een circulaire import als auth ooit de
   api-client zou willen gebruiken.
   ─────────────────────────────────────────────────────────────────────── */

export const API_BASE_URL = 'https://app.vibezcore.com';

export type ApiOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** true → Bearer-token uit auth.ts meesturen. Default false (guest). */
  auth?: boolean;
};

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(path: string, status: number, body: string) {
    super(`API ${path} ${status}: ${body || '(no body)'}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Iter v221 (2026-07-07): 20s timeout via AbortController.
 *  Zonder dit hangt fetch() indefinite bij DNS-lag of traag netwerk →
 *  gebruiker ziet eeuwige spinner. Timeout gooit een ApiError met
 *  status=0 en body='timeout' zodat callers 'm kunnen herkennen. */
const REQUEST_TIMEOUT_MS = 20000;

export async function apiCall<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, auth = false } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (auth) {
    /* getToken() haalt VERSE access_token uit Supabase SDK — refresht
       automatisch indien bijna verlopen. Geen stale-token mogelijk. */
    const { getToken } = await import('../services/auth');
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new ApiError(path, res.status, txt);
    }

    return (await res.json()) as T;
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') {
      throw new ApiError(path, 0, 'timeout');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}
