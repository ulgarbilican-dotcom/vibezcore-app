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

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new ApiError(path, res.status, txt);
  }

  return (await res.json()) as T;
}
