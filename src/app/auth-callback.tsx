/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Auth callback screen

   Komt binnen via deep link `vibezcoreapp://auth-callback?...`. Mirror
   van de webapp auth-callback.html, maar in de native app:
     1. Parse token_hash + type uit query params
     2. Roep Supabase `/auth/v1/verify` aan om token uit te wisselen tegen
        een session (access_token + refresh_token)
     3. Persist session via auth-service
     4. Beslis waar de user heen moet:
        - needs_password_setup → /reset-password (forced new-password flow)
        - anders → / (Audio Library)

   IMPORTANT (CLAUDE.md §1 — provider-agnostisch):
   Deze screen praat DIRECT met Supabase ipv via onze auth-proxy. Reden:
   token-uitwisseling via `/auth/v1/verify` is een Supabase-specifiek
   protocol dat de webapp ook gebruikt; onze auth-proxy ondersteunt geen
   verify-action. Operator-akkoord 2026-05-27 — deze ene uitzondering
   blijft tot we de proxy uitbreiden met een verify-route.
   ─────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import {
  EMAIL_KEY,
  EXPIRES_KEY,
  LAST_EMAIL_KEY,
  REFRESH_KEY,
  TOKEN_KEY,
} from '@/services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* Supabase publishable key — zelfde als gebruikt in de webapp's
   auth-callback.html. Publishable keys zijn safe om in client-code te
   hebben (alleen scoped permissions). */
const SUPABASE_URL = 'https://zotxpyjvcamnlzwdgceh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LZH7TZUskMTphvMIiefiQQ_8As5C_Q2';

type State =
  | { phase: 'loading' }
  | { phase: 'success'; needsPasswordSetup: boolean }
  | { phase: 'error'; message: string };

export default function AuthCallback() {
  const params = useLocalSearchParams<{
    token_hash?: string;
    type?: string;
  }>();
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const tokenHash = params.token_hash;
      const type = params.type;

      if (!tokenHash) {
        if (!cancelled) {
          setState({
            phase: 'error',
            message: 'Invalid link — no token found.',
          });
        }
        return;
      }

      try {
        /* Token uitwisselen tegen access_token + refresh_token. */
        const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: type || 'magiclink',
            token_hash: tokenHash,
          }),
        });

        if (!verifyRes.ok) {
          if (!cancelled) {
            setState({
              phase: 'error',
              message:
                'This link has expired or was already used. Request a new one.',
            });
          }
          return;
        }

        const session = await verifyRes.json();
        if (!session.access_token) {
          if (!cancelled) {
            setState({
              phase: 'error',
              message: 'Could not complete sign-in.',
            });
          }
          return;
        }

        /* Persist session — zelfde keys als auth.ts gebruikt zodat
           de bestaande getToken() / useSubscription() flow alles
           direct ziet. */
        const expiresIn =
          typeof session.expires_in === 'number' ? session.expires_in : 3600;
        const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
        const pairs: [string, string][] = [
          [TOKEN_KEY, session.access_token],
          [EXPIRES_KEY, String(expiresAt)],
        ];
        if (session.refresh_token) pairs.push([REFRESH_KEY, session.refresh_token]);
        if (session.user?.email) {
          pairs.push([EMAIL_KEY, session.user.email]);
          pairs.push([LAST_EMAIL_KEY, session.user.email]);
        }
        await AsyncStorage.multiSet(pairs);

        /* Check needs_password_setup flag — gezet door gumroad-webhook
           wanneer 'ie een nieuwe user aanmaakt. Forceert eerst password-
           setup voordat user kan luisteren. */
        const needsPasswordSetup =
          session.user?.user_metadata?.needs_password_setup === true;

        if (!cancelled) {
          setState({ phase: 'success', needsPasswordSetup });
        }

        /* Automatische redirect na korte vertraging — geeft user kans
           om de success-state te zien. */
        setTimeout(() => {
          if (cancelled) return;
          if (needsPasswordSetup) {
            router.replace('/reset-password' as never);
          } else {
            router.replace('/');
          }
        }, 1200);
      } catch (e) {
        if (!cancelled) {
          setState({
            phase: 'error',
            message: 'Network error — please try again.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.token_hash, params.type]);

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.center}>
        {state.phase === 'loading' && (
          <>
            <ActivityIndicator size="large" color={Brand.accent} />
            <Text style={s.title}>Signing you in…</Text>
            <Text style={s.sub}>One moment — verifying your link.</Text>
          </>
        )}
        {state.phase === 'success' && (
          <>
            <View style={s.checkCircle}>
              <Text style={s.checkText}>✓</Text>
            </View>
            <Text style={s.title}>You're in.</Text>
            <Text style={s.sub}>
              {state.needsPasswordSetup
                ? 'Setting up your account…'
                : 'Opening your library…'}
            </Text>
          </>
        )}
        {state.phase === 'error' && (
          <>
            <View style={s.errorCircle}>
              <Text style={s.errorText}>!</Text>
            </View>
            <Text style={s.title}>Link expired</Text>
            <Text style={s.sub}>{state.message}</Text>
            <Pressable
              style={s.btn}
              onPress={() => router.replace('/account')}
              accessibilityLabel="Go to sign in"
            >
              <Text style={s.btnText}>Go to sign in</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginTop: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  sub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderColor: 'rgba(74,222,128,0.4)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: Brand.success,
    fontSize: 28,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 32,
  },
  errorCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.4)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: Brand.error,
    fontSize: 28,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 32,
  },
  btn: {
    backgroundColor: Brand.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 24,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
});
