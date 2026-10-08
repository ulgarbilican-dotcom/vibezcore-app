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
/* Operator, 26 september 2026 (Huisstijl & Design Handboek v4.4):
   Brand.accent (#3a8fff, Signal Blue) is enkel voor haptic-pulse/"nu
   actief" — nooit voor spinners of CTA-knoppen. CTA-regel v4.4 op een
   donkere achtergrond: witte knop-bg + donkere tekst. */
import { clearSession, persistSession, relinkAfterSessionChange, fetchWithTimeout } from '@/services/auth';
import { refreshSubscription } from '@/hooks/useSubscription';
import { refreshUserBucket as refreshBraceletBucket } from '@/utils/bracelet-history';
import { refreshUserBucket as refreshAudioBucket } from '@/utils/user-bucket';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

/* Standaard press-scale-animatie (zie breath-welcome.tsx `StartCard`
   voor de referentie-implementatie) — additief, geen layout/logica-
   wijziging. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Supabase config uit centrale constants. Eén plek wijzigen = alle
   auth-flows mee. Publishable keys zijn safe in client-code (scoped). */
import { SUPABASE_KEY, SUPABASE_URL } from '@/constants/supabase';

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

  /* Press-scale-animatie — één losse shared value per tappable element
     (zie breath-welcome.tsx `StartCard`). */
  const signInBtnPressScale = useSharedValue(1);
  const onSignInBtnPressIn = () => {
    signInBtnPressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onSignInBtnPressOut = () => {
    signInBtnPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const signInBtnPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: signInBtnPressScale.value }],
  }));

  useEffect(() => {
    let cancelled = false;
    /* Redirect-timer — bewaard in een lokale variabele zodat cleanup
       'm kan clearen. Voorkomt navigate-after-unmount warnings + dubbele
       routes als de user weg-tikt voordat de 1200ms verstreken zijn. */
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

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
        const verifyRes = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/verify`, {
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

        /* Persist session — gebruik clearSession + persistSession uit
           auth.ts in plaats van rechtstreekse AsyncStorage.multiSet.

           Iter 9dq v52 (2026-06-03, audit-finding C3): clearSession ÉÉRST.
           Zonder die stap blijft een eventueel-oude refresh_token van een
           VORIGE user-sessie in AsyncStorage staan wanneer deze magic-link
           uitwisseling om de een of andere reden GEEN refresh_token
           teruggeeft (bv. recovery-type Verify-responses). De volgende
           auto-refresh in auth.ts grijpt dan die stale refresh_token van
           de vorige user, krijgt 401 van Supabase → clearSession → silent
           logout. Door eerst alles te wissen kan dit niet meer mismatchen:
           ofwel zit alle data van de nieuwe user erin, ofwel niets. */
        await clearSession();
        await persistSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          user: { email: session.user?.email },
        });

        /* Iter 9dq v55 (2026-06-03, audit C5+C6): bucket-switch hier
           afwachten zodat de Audio Library / Bracelet-tab waar we
           straks naar redirecten al de juiste per-user bucket-key
           gebruikt. Zonder dit kon een snelle interactie na landing
           nog naar de oude bucket schrijven. */
        await Promise.all([refreshBraceletBucket(), refreshAudioBucket()]);
        /* Operator, 7 okt 2026 (account-audit): RevenueCat terug aan dit
           account koppelen en de abonnementsstatus verversen. */
        await relinkAfterSessionChange();
        void refreshSubscription();

        /* Twee redenen om naar /reset-password te routen:
           1. needs_password_setup-flag (gezet door gumroad-webhook bij
              eerste keer; user moet een password kiezen)
           2. type=recovery (forgot-password email kwam via auth-callback
              ipv direct naar /reset-password — defense-in-depth: user
              moet expliciet een nieuw password kiezen, niet "stilletjes"
              ingelogd worden met een eenmalige recovery-token) */
        const needsPasswordSetup =
          session.user?.user_metadata?.needs_password_setup === true;
        const isRecovery = (type || '') === 'recovery';
        const forcePasswordScreen = needsPasswordSetup || isRecovery;

        if (!cancelled) {
          setState({ phase: 'success', needsPasswordSetup: forcePasswordScreen });
        }

        /* Automatische redirect na korte vertraging — geeft user kans
           om de success-state te zien. Timer wordt gecleared bij unmount. */
        redirectTimer = setTimeout(() => {
          if (cancelled) return;
          if (forcePasswordScreen) {
            router.replace('/reset-password' as never);
          } else {
            router.replace('/');
          }
        }, 1200);
      } catch (e) {
        if (__DEV__) console.warn('[auth-callback] verify failed:', e);
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
      if (redirectTimer) {
        clearTimeout(redirectTimer);
        redirectTimer = null;
      }
    };
  }, [params.token_hash, params.type]);

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.center}>
        {state.phase === 'loading' && (
          <>
            <ActivityIndicator size="large" color={Brand.textDim} />
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
            <AnimatedPressable
              style={[s.btn, signInBtnPressStyle]}
              onPress={() => router.replace('/account')}
              onPressIn={onSignInBtnPressIn}
              onPressOut={onSignInBtnPressOut}
              accessibilityLabel="Go to sign in"
            >
              <Text style={s.btnText}>Go to sign in</Text>
            </AnimatedPressable>
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 24,
  },
  btnText: {
    color: Brand.bg,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
});
