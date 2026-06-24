/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Social sign-in wrapper (Google / Apple)

   Iter v142 (2026-06-23). Eén-tap auth voor de Subscribe-flow zonder
   email/password te hoeven typen.

   Verantwoordelijkheden:
     - Native SDK lazy-initialiseren bij eerste gebruik (geen overhead bij
       app-start als user social-auth niet gebruikt).
     - SDK → ID-token ophalen.
     - ID-token doorgeven aan onze auth-proxy (zie services/auth.ts).
     - User-cancel, network-fail, en config-fail vertalen naar één
       consistent SocialAuthResult shape.

   Platform-restricties:
     - Google: werkt op Android (en iOS, maar niet nodig want Apple Sign-In
       is daar policy-vereist).
     - Apple: enkel iOS — op Android volledig verborgen.

   Configuratie (operator-stappen, zie docs/SETUP_SOCIAL_AUTH.md):
     - GOOGLE_WEB_CLIENT_ID env via app.json `extra.googleWebClientId`,
       dit is de "Web application" OAuth client uit Google Cloud Console.
       Supabase verifieert tokens tegen deze audience.
     - Op Android nog een aparte "Android" OAuth client (met SHA-1) nodig
       in Google Cloud Console maar die wordt enkel client-side door de
       SDK gebruikt — geen ID nodig in onze code.
     - Apple Services-ID komt pas na Apple Developer enrollment.
   ─────────────────────────────────────────────────────────────────── */

import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { loginWithApple, loginWithGoogle } from './auth';

export type SocialProvider = 'google' | 'apple';

export type SocialAuthResult =
  | { ok: true; token: string; email?: string; provider: SocialProvider }
  | {
      ok: false;
      provider: SocialProvider;
      reason: 'cancelled' | 'unavailable' | 'config' | 'network' | 'unknown';
      error: string;
    };

/* Google Web Client ID uit app.json `extra.googleWebClientId`. Wordt door
   Supabase gebruikt als audience-check op het ID-token (zelfde ID staat in
   Supabase dashboard → Authentication → Providers → Google → Client ID).
   Mist deze waarde → Google sign-in faalt met config-error vóór de SDK call. */
const GOOGLE_WEB_CLIENT_ID: string | undefined =
  (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[
    'googleWebClientId'
  ] as string | undefined;

let googleConfigured = false;

async function ensureGoogleConfigured(): Promise<boolean> {
  if (googleConfigured) return true;
  if (!GOOGLE_WEB_CLIENT_ID) {
    if (__DEV__) {
      console.warn(
        '[social-auth] GOOGLE_WEB_CLIENT_ID ontbreekt in app.json extra. Sign in with Google is uitgeschakeld.',
      );
    }
    return false;
  }
  try {
    const mod = await import('@react-native-google-signin/google-signin');
    mod.GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    });
    googleConfigured = true;
    return true;
  } catch (e) {
    if (__DEV__) {
      console.warn(
        '[social-auth] Google SDK config faalde:',
        e instanceof Error ? e.message : String(e),
      );
    }
    return false;
  }
}

export async function signInWithGoogle(): Promise<SocialAuthResult> {
  const configured = await ensureGoogleConfigured();
  if (!configured) {
    return {
      ok: false,
      provider: 'google',
      reason: 'config',
      error: 'Google sign-in is not configured. Please use email & password.',
    };
  }
  try {
    const mod = await import('@react-native-google-signin/google-signin');
    const { GoogleSignin, statusCodes } = mod;
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    /* v13+ API: response.data.idToken. v12 en eerder: response.idToken.
       Defensief: probeer beide. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = response;
    const idToken: string | undefined =
      r?.data?.idToken ?? r?.idToken ?? r?.user?.idToken;
    if (!idToken) {
      return {
        ok: false,
        provider: 'google',
        reason: 'unknown',
        error: 'Google did not return an ID token. Please try again.',
      };
    }
    const auth = await loginWithGoogle(idToken);
    if (!auth.ok) {
      return {
        ok: false,
        provider: 'google',
        reason: /network|fetch/i.test(auth.error) ? 'network' : 'unknown',
        error: auth.error,
      };
    }
    return {
      ok: true,
      token: auth.token,
      email: auth.email,
      provider: 'google',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    /* User-cancel events hebben specifieke status codes — alleen vertalen
       als de SDK is geladen (statusCodes beschikbaar). */
    try {
      const mod = await import('@react-native-google-signin/google-signin');
      const { statusCodes } = mod;
      if (e?.code === statusCodes.SIGN_IN_CANCELLED) {
        return {
          ok: false,
          provider: 'google',
          reason: 'cancelled',
          error: 'Sign in cancelled.',
        };
      }
      if (e?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          ok: false,
          provider: 'google',
          reason: 'unavailable',
          error: 'Google Play Services is not available on this device.',
        };
      }
    } catch {
      /* Module-load faalde — val terug op generic error */
    }
    return {
      ok: false,
      provider: 'google',
      reason: 'unknown',
      error: e?.message ?? String(e),
    };
  }
}

/** Apple-sign-in is enkel beschikbaar op iOS. Op Android resolved deze
 *  function meteen met reason:'unavailable' — UI verbergt de knop dan al
 *  via een Platform.OS check, dit is enkel safety. */
export async function signInWithApple(): Promise<SocialAuthResult> {
  if (Platform.OS !== 'ios') {
    return {
      ok: false,
      provider: 'apple',
      reason: 'unavailable',
      error: 'Apple sign-in is only available on iOS.',
    };
  }
  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return {
        ok: false,
        provider: 'apple',
        reason: 'unavailable',
        error: 'Apple sign-in is not available on this device.',
      };
    }
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const idToken = credential.identityToken;
    if (!idToken) {
      return {
        ok: false,
        provider: 'apple',
        reason: 'unknown',
        error: 'Apple did not return an identity token. Please try again.',
      };
    }
    const auth = await loginWithApple(idToken);
    if (!auth.ok) {
      return {
        ok: false,
        provider: 'apple',
        reason: /network|fetch/i.test(auth.error) ? 'network' : 'unknown',
        error: auth.error,
      };
    }
    return {
      ok: true,
      token: auth.token,
      email: auth.email,
      provider: 'apple',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    /* Expo Apple Authentication user-cancel = error.code === 'ERR_CANCELED'. */
    if (e?.code === 'ERR_CANCELED' || e?.code === 'ERR_REQUEST_CANCELED') {
      return {
        ok: false,
        provider: 'apple',
        reason: 'cancelled',
        error: 'Sign in cancelled.',
      };
    }
    return {
      ok: false,
      provider: 'apple',
      reason: 'unknown',
      error: e?.message ?? String(e),
    };
  }
}

/** Is Google sign-in beschikbaar (web client ID gezet + SDK importeerbaar)?
 *  Voor UI-render-beslissing zodat we de knop niet tonen als 't toch faalt. */
export function isGoogleSignInAvailable(): boolean {
  return Boolean(GOOGLE_WEB_CLIENT_ID);
}

/** Is Apple sign-in beschikbaar (iOS + system support)? Async omdat
 *  isAvailableAsync een native check is. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}
