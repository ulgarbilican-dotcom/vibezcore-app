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
/* Iter v230 (2026-07-08, audit BUG 6/8): pending RC-link marker. Als
   Purchases.logIn faalt (offline, SDK not ready, transient) tijdens
   signup/login/deep-link → schrijf de gewenste userId hier. Bij AppState
   =active + successful auth wordt de link opnieuw geprobeerd zodat de
   volgende purchase/entitlement-event bij de juiste app_user_id aankomt
   (geen $RCAnonymousID-lek naar webhook). */
export const PENDING_RC_LINK_KEY = 'vz_pending_rc_link';

const REFRESH_MARGIN_SEC = 60;

export type AuthResult =
  | { ok: true; token: string; email?: string }
  | { ok: false; error: string };

type SessionPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string };
};

/* ── RevenueCat user-linking helpers ───────────────────────────────────────
   Iter v165 (2026-06-27): zodra een user inlogt/signupt koppelen we z'n
   Supabase auth.users.id (de `sub` in de JWT) aan z'n RevenueCat-customer.
   Vanaf dat moment komen alle RevenueCat webhook-events bij onze backend
   binnen met `event.app_user_id === <supabaseAuthUserId>`, waardoor we
   server-side de juiste public.users-row kunnen vinden zonder ooit nog een
   client-driven /api/iap-verify call nodig te hebben.

   Op clearSession() doen we Purchases.logOut() zodat het volgende account
   op hetzelfde toestel niet de entitlements erft van de vorige user.

   Alle calls zijn try/catch + lazy require — geen fatale fail als
   react-native-purchases native module niet ready is (bv. bij koude start
   vóór RealIAP.init). De auth flow mag NOOIT blokkeren op IAP-state. */

export async function linkRevenueCatUser(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  try {
    /* Iter v227 (2026-07-07, audit B8): AWAIT getIAP().init() vóór
       Purchases.logIn. Voorheen: op deep-link naar /subscribe kon
       linkRevenueCatUser fired zijn vóór _layout.tsx.init() klaar was →
       Purchases.configure() nog niet gedraaid → logIn thrown, gecatched,
       purchase attribueert aan $RCAnonymousID → webhook filtert anon →
       hasBracelet sync broken voor die user. */
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getIAP } = require('./iap');
    await getIAP().init();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Purchases = require('react-native-purchases').default;
    if (!Purchases || typeof Purchases.logIn !== 'function') return;

    /* Iter v237c (2026-07-09, KRITIEK SECURITY uit vC 76 test):
       vóór Purchases.logIn(newUserId) checken of de huidige RC customer
       (anonymous) al actieve entitlements heeft. Zo ja → NIET logIn,
       want RC's auto-TRANSFER zou de sub van de vorige user aan de
       nieuwe user attribueren zonder betaling.
       Legit re-install scenario: anonymous customer is nieuw → geen
       entitlements → check passes → logIn OK → RC valideert Play Store
       sub bij expliciete restorePurchases-tap.
       Multi-user attack scenario: anonymous customer heeft entitlements
       geërfd van vorige user's Play Store sub → check FAALT → logIn
       skipped → geen attributie-lek. */
    try {
      const currentInfo = await Purchases.getCustomerInfo();
      const activeEntitlements = currentInfo?.entitlements?.active;
      const hasActiveEntitlement =
        activeEntitlements && Object.keys(activeEntitlements).length > 0;
      const currentId: string = currentInfo?.originalAppUserId ?? '';
      const isCurrentlyAnonymous =
        !currentId || currentId.startsWith('$RCAnonymousID');
      const isSameUser = currentId === userId;
      if (hasActiveEntitlement && isCurrentlyAnonymous && !isSameUser) {
        if (__DEV__) {
          console.warn(
            '[auth] v237c BLOCKED linkRevenueCatUser: anonymous RC customer has active entitlement — skip logIn to prevent TRANSFER leak. User can tap "Restore purchases" if this is their sub.',
          );
        }
        return;
      }
    } catch {
      /* Als getCustomerInfo faalt: veiliger om NIET te logIn (defensief).
         Purchase-flow triggert linkRC opnieuw wanneer user explicitely
         gaat kopen, dan is 't OK om door te gaan. */
      if (__DEV__) console.warn('[auth] v237c: getCustomerInfo failed, skip logIn');
      return;
    }

    await Purchases.logIn(userId);
    /* Iter v230 (2026-07-08): success → clear pending marker. */
    try {
      await AsyncStorage.removeItem(PENDING_RC_LINK_KEY);
    } catch {
      /* swallow */
    }
  } catch (e) {
    if (__DEV__) {
      console.warn(
        '[auth] linkRevenueCatUser failed (non-fatal):',
        e instanceof Error ? e.message : String(e)
      );
    }
    /* Iter v230 (2026-07-08, audit BUG 6/8): mark for retry. Bij falen
       hier zit RC nog op $RCAnonymousID; volgende purchase zou naar
       anonymous customer routen → webhook filtert dat weg → user krijgt
       geen backend PRO. AppState=active + succesvolle auth retryt de link. */
    try {
      await AsyncStorage.setItem(PENDING_RC_LINK_KEY, userId);
    } catch {
      /* swallow */
    }
  }
}

/** Iter v230 (2026-07-08, audit BUG 6/8): retry link vanaf de pending
 *  marker. Aangeroepen door _layout.tsx bij AppState=active en na
 *  succesvolle sessie-restore. Idempotent — als de marker gelinkt kan
 *  worden, wordt hij gewist door linkRevenueCatUser zelf. */
export async function retryPendingRcLink(): Promise<void> {
  try {
    const pending = await AsyncStorage.getItem(PENDING_RC_LINK_KEY);
    if (!pending) return;
    await linkRevenueCatUser(pending);
  } catch {
    /* swallow */
  }
}

export async function unlinkRevenueCatUser(): Promise<void> {
  /* Iter v230: bij logOut ook pending-link marker wissen (behoort bij
     de user die net uitgelogd is; retryen zou anders user A koppelen
     terwijl user B nu actief is). */
  try {
    await AsyncStorage.removeItem(PENDING_RC_LINK_KEY);
  } catch {
    /* swallow */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Purchases = require('react-native-purchases').default;
    if (!Purchases || typeof Purchases.logOut !== 'function') return;
    await Purchases.logOut();
  } catch (e) {
    if (__DEV__) {
      console.warn(
        '[auth] unlinkRevenueCatUser failed (non-fatal):',
        e instanceof Error ? e.message : String(e)
      );
    }
  }
}

/** Decode the JWT payload to extract the `sub` (= Supabase auth.users.id).
 *  We don't verify the signature here — backend does that on every request.
 *  Purpose is purely to know WHICH user to link to RevenueCat. */
export function getAuthUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    // global.atob is available in RN 0.81+ via Hermes
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const decoded = typeof atob === 'function' ? atob(b64) : '';
    if (!decoded) return null;
    const json = JSON.parse(decoded);
    return typeof json?.sub === 'string' ? json.sub : null;
  } catch {
    return null;
  }
}

type ErrorPayload = {
  error?: string;
  error_description?: string;
  msg?: string;
};

/* ── Persistence ────────────────────────────────────────────────────────── */

export async function persistSession(s: SessionPayload): Promise<void> {
  if (!s.access_token) return;
  /* Iter v194 (2026-07-04): dev-mock override flags wissen wanneer
     een NIEUWE email inlogt op dit toestel. Zonder deze guard blijft
     bracelet-activation state van vorige user hangen. clearSession
     handelt sign-out af; deze branch dekt "andere email logt in
     zonder eerst uitloggen" (bv. via sign-in modal na signup). */
  if (s.user?.email) {
    try {
      const prevEmail = await AsyncStorage.getItem(EMAIL_KEY);
      if (prevEmail && prevEmail !== s.user.email) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { clearDevOverridesForAuthEvent } = require('@/utils/dev-user-override');
        await clearDevOverridesForAuthEvent();
        /* Iter v227 (2026-07-07, audit A2): bucket + last-played + signed-URL
           caches ook wissen bij email-switch. Voorheen draaide deze cleanup
           pas in account.tsx callback NA login-return → race-venster waarin
           BraceletCard/Library nog user-A's history/last-played toonde voor
           user-B na een re-render. Nu hier synchroon met de sessie-switch. */
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { refreshUserBucket: refreshBraceletBucket } = require('@/utils/bracelet-history');
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { refreshUserBucket: refreshAudioBucket } = require('@/utils/user-bucket');
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { clearLastPlayed } = require('@/utils/last-played');
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { clearSignedUrlCache } = require('@/utils/audio-url');
          await Promise.all([
            refreshBraceletBucket().catch(() => {}),
            refreshAudioBucket().catch(() => {}),
            clearLastPlayed().catch(() => {}),
          ]);
          clearSignedUrlCache();
        } catch {
          /* Non-fatal: één of meer helpers ontbreken (defensief) */
        }
      }
    } catch {
      /* swallow */
    }
  }
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
    if (__DEV__) {
      console.warn(
        '[auth] persistSession failed:',
        e instanceof Error ? e.message : String(e)
      );
    }
  }
}

export async function clearSession(): Promise<void> {
  /* Iter v165 (2026-06-27): unlink RevenueCat customer VÓÓR we de Supabase
     sessie wissen, zodat het volgende account op dit toestel niet de PRO-
     entitlements van de vorige user erft. unlinkRevenueCatUser swallowt
     z'n eigen errors → mag nooit blokkeren op auth-clearance. */
  await unlinkRevenueCatUser();
  /* Iter v194 (2026-07-04): dev-mock override flags OOK wissen bij
     sign-out — anders lekt bracelet-activation state tussen accounts
     (User A activeert → sign out → User B logt in → User B ziet
     "Bracelet activated"). Root cause van vC 50 cross-account leak.
     Wanneer productie-backend /api/bracelet/activate live is, kan
     deze regel weg — backend state is dan account-gescopet. */
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { clearDevOverridesForAuthEvent } = require('@/utils/dev-user-override');
    await clearDevOverridesForAuthEvent();
  } catch {
    /* swallow */
  }
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

/* Iter v177 (2026-07-02): 10-sec network timeout op alle auth-calls.
   Zonder timeout hangt de ActivityIndicator forever bij airplane-mode of
   captive-portal. Met timeout → duidelijke error message binnen 10 sec.
   AbortController is de standaard React Native / fetch-API manier. */
const AUTH_TIMEOUT_MS = 10_000;

async function postToAuthProxy(
  action: 'login' | 'signup' | 'refresh' | 'google' | 'apple',
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: SessionPayload & ErrorPayload }> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(
      VZ_BACKEND_URL + '/api/auth-proxy?action=' + action,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );
  } catch (e) {
    clearTimeout(timeoutHandle);
    /* AbortError van onze eigen timeout → duidelijke offline message.
       Andere network errors (DNS, TCP reset) → generieke connection message. */
    const isAbort = (e as Error)?.name === 'AbortError';
    const msg = isAbort
      ? 'Request timed out — check your internet connection.'
      : 'No internet connection — try again when you are online.';
    return { ok: false, status: 0, data: { error: msg } };
  }
  clearTimeout(timeoutHandle);

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
        if (__DEV__) console.warn('[auth] refresh-token rejected by backend (401) → clearing session');
        await clearSession();
      } else if (__DEV__) {
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
      /* Iter v227 (2026-07-07, audit A4): als token ECHT expired is
         (niet marginaal binnen REFRESH_MARGIN_SEC), geef null terug ipv
         de dode oude token. Voorheen: dode token → 401-loop op alle
         API-calls tot handmatig uitloggen. Bij marginaal (nog binnen
         window): één laatste kans met oude token — backend 401 → clean
         clearSession pad via doRefresh regel 320. */
      if (expiresAt && expiresAt <= now) return null;
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
    /* Iter v166 (2026-06-27): linkRevenueCatUser AWAITED zodat de RC
       customer GELINKT IS vóór een eventuele directe purchase call. In
       v165 was dit fire-and-forget → race condition: subscribe.tsx
       triggerde Purchases.purchasePackage vóórdat logIn klaar was → de
       purchase werd toegekend aan de anonymous RC user ($RCAnonymousID)
       ipv aan de Supabase user, waardoor de webhook bij anon werd
       gefilterd en Supabase nooit ge-update werd. ~500ms latency hier
       is acceptabel; betere correcte attribution wint van snelheid. */
    await linkRevenueCatUser(
      data.user?.id ?? getAuthUserIdFromToken(data.access_token)
    );
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
      /* Iter v227 (2026-07-07, audit A1): AWAIT linkRevenueCatUser
         (identiek aan login-flow v166). Voorheen fire-and-forget → race
         waar direct-na-signup subscribe.tsx Purchases.purchasePackage
         triggerde vóór RC logIn klaar was → purchase attribueert aan
         $RCAnonymousID ipv Supabase user → backend webhook filtert
         anon → user is RC-PRO maar backend weet niks → hasBracelet
         sync broken voor die user. */
      await linkRevenueCatUser(
        data.user?.id ?? getAuthUserIdFromToken(data.access_token)
      );
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

/* ── Social sign-in (Google / Apple) ──────────────────────────────────────
   Iter v142 (2026-06-23): één-tap auth via Google / Apple ID-token.
   App krijgt het ID-token van de native SDK (Google Sign-In op Android,
   Apple Authentication op iOS), wij sturen 't naar de auth-proxy waar
   Supabase 'm verifieert. Geen wachtwoord-management voor social-flow
   users — een email-clash met een bestaand password-account wordt door
   Supabase opgelost door de Google/Apple-identity te linken aan het
   bestaande user-record (zelfde email = zelfde user).

   Vereiste backend-config:
     - Supabase dashboard → Authentication → Providers → Google enabled
       met Web-Client-ID uit Google Cloud Console
     - Supabase dashboard → Authentication → Providers → Apple enabled
       met Services-ID uit Apple Developer Console (na enrollment) */

export async function loginWithGoogle(idToken: string): Promise<AuthResult> {
  if (!idToken) return { ok: false, error: 'Missing Google ID token' };
  try {
    const { ok, data } = await postToAuthProxy('google', {
      id_token: idToken,
    });
    if (!ok || !data.access_token) {
      const msg =
        data.error_description ||
        data.msg ||
        data.error ||
        'Google sign-in failed';
      return { ok: false, error: msg };
    }
    await persistSession(data);
    /* Iter v168 (2026-06-28): AWAIT zodat RC SDK gekoppeld is vóór
       useSubscription.fetchStatus() draait. Voorheen fire-and-forget
       (`void`) → race condition: fetchStatus liep met anonymous RC
       customer → entitlement miste → Audio Library + Account hingen
       in 'Checking…' tot AppState bg/fg cycle de fetch opnieuw triggerde.
       Operator zag 2+ minuten 'Checking…'. Zelfde await-fix als eerder
       toegepast op login() en signup() — Google/Apple paths waren
       overgeslagen. */
    await linkRevenueCatUser(
      data.user?.id ?? getAuthUserIdFromToken(data.access_token)
    );
    return {
      ok: true,
      token: data.access_token,
      email: data.user?.email,
    };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  }
}

/* ── Account deletion (GDPR + Apple/Google policy) ──────────────────────
   Iter v145 (2026-06-25): self-service delete. Apple Guideline 5.1.1(v)
   en Google Play vereisen sinds 2022 dat een app met account-creatie
   ook in-app account-deletion biedt. "Open a support email" voldoet niet.

   Endpoint: POST /api/delete-account met Bearer access_token.
   Server roept Supabase admin API aan om de auth.users-row te verwijderen
   (cascade naar onze public-schema tabellen). Client wist daarna z'n
   eigen sessie + LAST_EMAIL_KEY.

   Belangrijk: dit cancelt geen actieve Google Play / Apple subscription —
   die leeft in het store-account, niet bij ons. UI moet dit duidelijk
   maken vóór bevestiging. */
export async function deleteAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const token = await getToken();
    if (!token) {
      return { ok: false, error: 'You are not signed in.' };
    }
    const res = await fetch(VZ_BACKEND_URL + '/api/delete-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
    });
    if (!res.ok) {
      let msg = 'Could not delete account.';
      try {
        const body = await res.json();
        if (body && typeof body.message === 'string') msg = body.message;
      } catch {
        /* non-json body — keep default msg */
      }
      return { ok: false, error: msg };
    }
    /* Sessie + last-email wissen zodat de app niet meer probeert te
       refreshen met een nu-niet-bestaande user. LAST_EMAIL_KEY ook
       wissen zodat het login-form geen vorige email pre-fillt. */
    await clearSession();
    try {
      await AsyncStorage.removeItem(LAST_EMAIL_KEY);
    } catch {
      /* non-fatal */
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error — check your connection.' };
  }
}

export async function loginWithApple(
  idToken: string,
  nonce?: string,
): Promise<AuthResult> {
  if (!idToken) return { ok: false, error: 'Missing Apple identity token' };
  try {
    const { ok, data } = await postToAuthProxy('apple', {
      id_token: idToken,
      ...(nonce ? { nonce } : {}),
    });
    if (!ok || !data.access_token) {
      const msg =
        data.error_description ||
        data.msg ||
        data.error ||
        'Apple sign-in failed';
      return { ok: false, error: msg };
    }
    await persistSession(data);
    /* Iter v168 (2026-06-28): AWAIT — zelfde fix als loginWithGoogle.
       Race-condition met fetchStatus voorkomen. */
    await linkRevenueCatUser(
      data.user?.id ?? getAuthUserIdFromToken(data.access_token)
    );
    return {
      ok: true,
      token: data.access_token,
      email: data.user?.email,
    };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  }
}
