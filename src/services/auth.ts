/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Auth service (native)

   Direct port of the proven web-app login/signup flow (sign-in.html).
   Backend is UNCHANGED: this talks to the exact same Supabase Auth endpoints
   the web app uses. Only difference vs web: token is stored in AsyncStorage
   instead of localStorage.
   ─────────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';

/* Public config — identical to sign-in.html. The publishable key is
   public by design (it is already served to every visitor in the web app). */
export const VZ_SUPABASE_URL = 'https://zotxpyjvcamnlzwdgceh.supabase.co';
export const VZ_SUPABASE_KEY = 'sb_publishable_LZH7TZUskMTphvMIiefiQQ_8As5C_Q2';

/* Same storage key the web app uses, so the mental model stays identical. */
export const TOKEN_KEY = 'vz_session_token';
export const EMAIL_KEY = 'vz_user_email';

export type AuthResult =
  | { ok: true; token: string; email?: string }
  | { ok: false; error: string };

/* ── Token helpers ──────────────────────────────────────────────────────── */

export async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* non-fatal */
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, EMAIL_KEY]);
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

/* ── Login (email + password) ─ mirrors vzLogin() in sign-in.html ───────── */

export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(
      VZ_SUPABASE_URL + '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        headers: {
          apikey: VZ_SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      },
    );

    const data = await res.json();

    if (!res.ok) {
      let msg =
        (data && (data.error_description || data.msg || data.error)) ||
        'Login failed';
      if (/invalid login credentials/i.test(msg)) msg = 'Wrong email or password';
      else if (/email not confirmed/i.test(msg))
        msg = 'Please confirm your email first (check your inbox)';
      return { ok: false, error: msg };
    }

    const token: string | undefined = data && data.access_token;
    if (!token) return { ok: false, error: 'No session token returned' };

    await setToken(token);

    const userEmail: string | undefined =
      data && data.user && data.user.email ? data.user.email : undefined;
    if (userEmail) {
      try {
        await AsyncStorage.setItem(EMAIL_KEY, userEmail);
      } catch {
        /* non-fatal */
      }
    }

    return { ok: true, token, email: userEmail };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  }
}

/* ── Signup ─ mirrors vzSignup() in sign-in.html ────────────────────────── */

export async function signup(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(VZ_SUPABASE_URL + '/auth/v1/signup', {
      method: 'POST',
      headers: {
        apikey: VZ_SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg =
        (data && (data.error_description || data.msg || data.error)) ||
        'Signup failed';
      return { ok: false, error: msg };
    }

    const token: string | undefined = data && data.access_token;
    if (token) {
      await setToken(token);
      const userEmail: string | undefined =
        data && data.user && data.user.email ? data.user.email : undefined;
      if (userEmail) {
        try {
          await AsyncStorage.setItem(EMAIL_KEY, userEmail);
        } catch {
          /* non-fatal */
        }
      }
      return { ok: true, token, email: userEmail };
    }

    return {
      ok: false,
      error: 'Account created — please confirm your email, then sign in.',
    };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  }
}
