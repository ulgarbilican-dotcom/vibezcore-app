/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Auth service (via backend auth-proxy)

   Belangrijke wijziging 2026-05-22: RN-app praat NIET meer rechtstreeks
   met supabase.co. Alle auth-calls gaan via onze eigen backend
   (https://app.vibezcore.com/api/auth-proxy?action=login|signup|refresh).
   Reden: bepaalde Android-
   emulators (Pixel 8 AVD) gaven "Network request failed" naar
   supabase.co terwijl app.vibezcore.com prima werkte (DNS/routing
   verschil op emulator). Backend proxiet 1:1 naar Supabase
   server-side, RN-app ziet alleen ons eigen domain.

   Public API (gebruikt door account.tsx, useSubscription, etc.):
     login(email, password) → AuthResult
     signup(email, password) → AuthResult
     getToken() → string | null  (VERSE token; auto-refresht via
                                   refresh_token wanneer < 60s over is)
     clearSession() → void
     getUserEmail() → string | null

   AsyncStorage keys:
     vz_session_token       — access_token (JWT, ~1h leven)
     vz_refresh_token       — refresh_token (lange levensduur)
     vz_token_expires_at    — unix seconds wanneer access_token verloopt
     vz_user_email          — voor UI

   Refresh: getToken() checkt op every call de expiry. Als < 60s →
   POST naar /api/auth-proxy?action=refresh, krijgt nieuwe sessie,
   opslaan, return. Race-safe via `refreshInFlight` Promise-singleton.
   ─────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';

/* Backend base — zelfde als utils/api.ts en utils/audio-url.ts.
   Hardcoded omdat we provider-agnostisch zijn (CLAUDE.md §1). */
export const VZ_BACKEND_URL = 'https://app.vibezcore.com';

export const TOKEN_KEY = 'vz_session_token';
export const REFRESH_KEY = 'vz_refresh_token';
export const EXPIRES_KEY = 'vz_token_expires_at';
export const EMAIL_KEY = 'vz_user_email';
/* Laatst-gebruikte login-email. OVERLEEFT explicit sign-out zodat we
   het email-veld kunnen pre-fillen op de login-form → user typt alleen
   nog wachtwoord (standaard UX-pattern voor mobile apps). */
export const LAST_EMAIL_KEY = 'vz_last_login_email';

const REFRESH_MARGIN_SEC = 60;

export type AuthResult =
  | { ok: true; token: string; email?: string }
  | { ok: false; error: string };

type SessionPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { email?: string };
};

type ErrorPayload = {
  error?: string;
  error_description?: string;
  msg?: string;
};

/* ── Persistence ────────────────────────────────────────────────────────── */

async function persistSession(s: SessionPayload): Promise<void> {
  if (!s.access_token) return;
  const expiresIn = typeof s.expires_in === 'number' ? s.expires_in : 3600;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const pairs: [string, string][] = [
    [TOKEN_KEY, s.access_token],
    [EXPIRES_KEY, String(expiresAt)],
  ];
  if (s.refresh_token) pairs.push([REFRESH_KEY, s.refresh_token]);
  if (s.user?.email) {
    pairs.push([EMAIL_KEY, s.user.email]);
    /* Ook persistent onthouden voor pre-fill op de login-form NA sign-out.
       EMAIL_KEY wordt door clearSession gewist; LAST_EMAIL_KEY niet. */
    pairs.push([LAST_EMAIL_KEY, s.user.email]);
  }
  try {
    await AsyncStorage.multiSet(pairs);
  } catch (e) {
    /* Silent fail zou betekenen dat user wel "ingelogd" lijkt maar bij
       volgende app-open weer login-form ziet. Console.warn zodat we
       deze stille fail zien in logs als er ooit een issue is. */
    console.warn(
      '[auth] persistSession failed:',
      e instanceof Error ? e.message : String(e)
    );
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      TOKEN_KEY,
      REFRESH_KEY,
      EXPIRES_KEY,
      EMAIL_KEY,
    ]);
  } catch {
    /* non-fatal */
  }
}

export async function getUserEmail(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

/**
 * Lees de laatst-gebruikte login-email. Overleeft sign-out zodat de
 * login-form 'm kan pre-fillen — user typt alleen nog z'n wachtwoord
 * opnieuw, niet ook z'n hele email-adres.
 */
export async function getLastLoginEmail(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_EMAIL_KEY);
  } catch {
    return null;
  }
}

/* ── HTTP helper ─────────────────────────────────────────────────────────
   Eén plek voor de POST naar de auth-proxy. JSON in, JSON out + status.

   Endpoint = /api/auth-proxy?action=login|signup|refresh.
   We zetten ?action= ZELF in de URL ipv via een Netlify-redirect-alias
   (vorige opzet `/api/auth-login` → `…/auth-proxy?action=login`): die
   query gaf Netlify in de praktijk niet door, function antwoordde 400
   "Invalid or missing action". Met expliciete query in de client-URL is
   er geen redirect-magie meer nodig. */

async function postToAuthProxy(
  action: 'login' | 'signup' | 'refresh',
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: SessionPayload & ErrorPayload }> {
  const res = await fetch(
    VZ_BACKEND_URL + '/api/auth-proxy?action=' + action,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  /* Body altijd als text lezen — bij upstream-errors kan het non-JSON zijn.
     Toleranter zo. */
  const text = await res.text();
  let data: SessionPayload & ErrorPayload = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 200) };
    }
  }
  return { ok: res.ok, status: res.status, data };
}

/* ── Refresh ────────────────────────────────────────────────────────────── */

let refreshInFlight: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  try {
    const refresh = await AsyncStorage.getItem(REFRESH_KEY);
    if (!refresh) return null;

    const { ok, status, data } = await postToAuthProxy('refresh', {
      refresh_token: refresh,
    });
    if (!ok) {
      /* ALLEEN clearSession bij echte auth-failure (401 = refresh-token
         door Supabase als invalid verklaard). Bij andere errors (network
         hiccup, 5xx server, etc.) sessie BEWAREN — volgende app-open
         doet vanzelf weer een refresh-poging. Vorige iteratie wiste op
         iedere non-2xx response → user moest na elke transient bug
         opnieuw inloggen (bug-fix 2026-05-25). */
      if (status === 401) {
        console.warn('[auth] refresh-token rejected by backend (401) → clearing session');
        await clearSession();
      } else {
        console.warn(
          `[auth] refresh failed with status ${status} — keeping session, will retry next launch`
        );
      }
      return null;
    }
    if (!data.access_token) return null;
    await persistSession(data);
    return data.access_token;
  } catch {
    /* Netwerk-error — sessie niet wissen, volgende call probeert weer. */
    return null;
  }
}

function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/* ── Public token-getter ──────────────────────────────────────────────────
   Returnt een token dat OP HET MOMENT VAN RETURNEN nog minstens
   REFRESH_MARGIN_SEC seconden geldig is. Refresht automatisch indien
   nodig. Returnt null als sessie volledig dood is. */

export async function getToken(): Promise<string | null> {
  try {
    const [token, expiresAtStr] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(EXPIRES_KEY),
    ]);
    if (!token) return null;

    const expiresAt = expiresAtStr ? Number(expiresAtStr) : 0;
    const now = Math.floor(Date.now() / 1000);

    if (!expiresAt || expiresAt - now < REFRESH_MARGIN_SEC) {
      const fresh = await refreshAccessToken();
      if (fresh) return fresh;
      /* Refresh faalde (netwerk?) — geef oude token één kans. Als die
         expired is geeft backend 401 en de UI logt uit. */
      return token;
    }

    return token;
  } catch {
    return null;
  }
}

/* ── Login + Signup ─────────────────────────────────────────────────────── */

export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const { ok, data } = await postToAuthProxy('login', {
      email,
      password,
    });

    if (!ok) {
      let msg =
        data.error_description || data.msg || data.error || 'Login failed';
      if (/invalid login credentials/i.test(msg))
        msg = 'Wrong email or password';
      else if (/email not confirmed/i.test(msg))
        msg = 'Please confirm your email first (check your inbox)';
      return { ok: false, error: msg };
    }

    if (!data.access_token) {
      return { ok: false, error: 'No session token returned' };
    }

    await persistSession(data);
    return {
      ok: true,
      token: data.access_token,
      email: data.user?.email,
    };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  }
}

export async function signup(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const { ok, data } = await postToAuthProxy('signup', {
      email,
      password,
    });

    if (!ok) {
      const msg =
        data.error_description || data.msg || data.error || 'Signup failed';
      return { ok: false, error: msg };
    }

    if (data.access_token) {
      await persistSession(data);
      return {
        ok: true,
        token: data.access_token,
        email: data.user?.email,
      };
    }

    return {
      ok: false,
      error: 'Account created — please confirm your email, then sign in.',
    };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  }
}
