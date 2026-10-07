/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Reset password / Set password screen (native)

   Twee modi op één scherm — gedetecteerd via aanwezigheid van `token_hash`:

   1. RECOVERY (token_hash aanwezig)
      Landing voor de Supabase password-recovery deep link:
        vibezcoreapp://reset-password?token_hash=xxx&type=recovery
      Flow: parse token → /auth/v1/verify (type=recovery) → ready → PUT user

   2. SETUP (geen token_hash)
      Komt via auth-callback.tsx na een succesvolle invite-verificatie,
      wanneer Gumroad-flag `needs_password_setup` true was. Er is al een
      geldige session — token-exchange skipt.

   Copy branches op `mode`: "Set your password" voor first-time setup vs
   "Reset your password" voor recovery — anders voelt het laatste vreemd
   ("set a NEW password" suggereert dat er een oude was).

   Provider-uitzondering: direct Supabase (zie auth-callback.tsx).
   ─────────────────────────────────────────────────────────────────── */

import { SUPABASE_KEY, SUPABASE_URL } from '@/constants/supabase';
import { AudioAccent, Brand, BrandFonts } from '@/constants/theme';
import { HeaderBackButton } from '@/components/HeaderBackButton';
/* Operator, 26 september 2026 (Huisstijl & Design Handboek v4.4):
   Brand.accent (#3a8fff, Signal Blue) is enkel voor haptic-pulse/"nu
   actief" — nooit voor spinners/links/CTA. AudioAccent is de
   link-kleur op donker; CTA-regel v4.4: witte knop-bg + donkere tekst. */
import { refreshSubscription } from '@/hooks/useSubscription';
import { clearSession, getToken, persistSession, relinkAfterSessionChange } from '@/services/auth';
import { refreshUserBucket as refreshBraceletBucket } from '@/utils/bracelet-history';
import { refreshUserBucket as refreshAudioBucket } from '@/utils/user-bucket';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/* Standaard press-scale-animatie (zie breath-welcome.tsx `StartCard`
   voor de referentie-implementatie) — additief, geen layout/logica-
   wijziging. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Mode = 'recovery' | 'setup';
type Phase = 'verifying' | 'ready' | 'updating' | 'done' | 'error';

/* Copy-pakketten per modus. Eén plek wijzigen wijzigt overal. */
const COPY = {
  recovery: {
    screenTitle: 'Reset password',
    heading: 'Reset your password',
    sub: 'Choose a strong password — at least 8 characters.',
    submit: 'Update password',
    doneTitle: 'Password updated',
  },
  setup: {
    screenTitle: 'Set password',
    heading: 'Set your password',
    sub: "Welcome — let's secure your account. Choose a strong password (at least 8 characters).",
    submit: 'Save password',
    doneTitle: 'Password saved',
  },
} as const;

export default function ResetPassword() {
  const params = useLocalSearchParams<{ token_hash?: string }>();

  /* Mode is afgeleid van URL params: token_hash → recovery, anders setup. */
  const mode: Mode = params.token_hash ? 'recovery' : 'setup';
  const copy = COPY[mode];

  const [phase, setPhase] = useState<Phase>('verifying');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* Iter 9dq v77 (2026-06-03): safe-area-aware scroll padding.
     Floor 72 = consistent met andere bottom-CTAs. */
  const safeInsets = useSafeAreaInsets();

  /* Press-scale-animatie — één losse shared value per tappable element
     (zie breath-welcome.tsx `StartCard`). */
  const errorBtnPressScale = useSharedValue(1);
  const onErrorBtnPressIn = () => {
    errorBtnPressScale.value = withTiming(0.96, { duration: 80 });
  };
  const onErrorBtnPressOut = () => {
    errorBtnPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const errorBtnPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: errorBtnPressScale.value }],
  }));

  const pwTogglePressScale = useSharedValue(1);
  const onPwTogglePressIn = () => {
    pwTogglePressScale.value = withTiming(0.93, { duration: 80 });
  };
  const onPwTogglePressOut = () => {
    pwTogglePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pwTogglePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pwTogglePressScale.value }],
  }));

  const pw2TogglePressScale = useSharedValue(1);
  const onPw2TogglePressIn = () => {
    pw2TogglePressScale.value = withTiming(0.93, { duration: 80 });
  };
  const onPw2TogglePressOut = () => {
    pw2TogglePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pw2TogglePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pw2TogglePressScale.value }],
  }));

  const submitPressScale = useSharedValue(1);
  const onSubmitPressIn = () => {
    submitPressScale.value = withTiming(0.96, { duration: 80 });
  };
  const onSubmitPressOut = () => {
    submitPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const submitPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: submitPressScale.value }],
  }));

  /* setTimeout ref — opruimen bij unmount voorkomt navigate-after-unmount
     warnings én double-routes als user snel weg-tikt na success. */
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
        doneTimerRef.current = null;
      }
    };
  }, []);

  /* Verify token-hash → access_token. Of: gebruik bestaande session
     (needs_password_setup-flow van auth-callback). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokenHash = params.token_hash;

      if (tokenHash) {
        try {
          const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'recovery',
              token_hash: tokenHash,
            }),
          });
          if (!res.ok) {
            if (!cancelled) setPhase('error');
            return;
          }
          const session = await res.json();
          if (!session?.access_token) {
            if (!cancelled) setPhase('error');
            return;
          }
          if (!cancelled) {
            setAccessToken(session.access_token);
            setPhase('ready');
          }
        } catch {
          if (!cancelled) setPhase('error');
        }
      } else {
        /* Setup-modus — er moet al een geldige session zijn (afkomstig
           van auth-callback na invite-verify). */
        const existing = await getToken();
        if (!existing) {
          if (!cancelled) setPhase('error');
          return;
        }
        if (!cancelled) {
          setAccessToken(existing);
          setPhase('ready');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.token_hash]);

  /* Live match-indicator: pas tonen zodra user iets in pw2 typt EN pw
     ten minste 1 char heeft. Voorkomt rode flash terwijl user nog typt. */
  const showMatchHint = pw.length > 0 && pw2.length > 0;
  const matches = pw === pw2;

  const onSubmit = async () => {
    setErr(null);
    if (pw.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    if (pw !== pw2) {
      setErr('Passwords do not match.');
      return;
    }
    if (!accessToken) {
      setErr(
        mode === 'recovery'
          ? 'Recovery link expired. Request a new one.'
          : 'Session expired. Please sign in again.'
      );
      return;
    }
    setPhase('updating');
    try {
      /* Body voor PUT /auth/v1/user:
         - password : nieuwe password
         - data     : update user_metadata. ZONDER `needs_password_setup:
                      false` zou een Audio-PRO user die net voor het eerst
                      een password ingesteld heeft bij elke volgende
                      magic-link OPNIEUW door de setup-flow geforceerd
                      worden (auth-callback.tsx leest die flag). Operator-
                      keuze 2026-05-29: clear de flag op iedere
                      password-update — recovery mode mag 't ook clearen
                      (de flag hoort sowieso na een ingestelde password
                      false te zijn). */
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: pw,
          data: { needs_password_setup: false },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (__DEV__) {
          console.warn('[reset-password] PUT /user failed:', res.status, data);
        }
        const msg =
          data?.msg ||
          data?.error_description ||
          data?.error ||
          'Could not update password';
        setErr(typeof msg === 'string' ? msg : 'Could not update password');
        setPhase('ready');
        return;
      }
      const updated = await res.json();
      /* Iter 9dq v53 (2026-06-03, audit-finding C3): voorheen schreven
         we ALLEEN access_token + expires + email weg — geen REFRESH_KEY.
         Gevolg: na de ~1u TTL van het access_token wilde getToken()
         refreshen, vond geen refresh_token (of de stale van vorige
         sessie), kreeg 401 van Supabase → clearSession() → silent
         logout. Reset-password-flow was dus letterlijk een tijdbom
         van 1u.

         Bovendien: Supabase REVOKET alle bestaande refresh_tokens
         wanneer een password gewijzigd wordt — dus zelfs als we een
         oude refresh_token zouden hergebruiken, was die ook dood.

         Fix: doe een verse POST /token?grant_type=password met email
         + NIEUW password om een fresh access_token + refresh_token
         + expires_in te krijgen. clearSession() eerst zodat geen
         stale-data van een vorige user-sessie blijft staan. Fallback:
         als de fresh-login om welke reden ook faalt, persisten we
         minstens het access_token uit de PUT-context zodat user niet
         direct uitgelogd is — slechtste geval blijft current behavior
         (refresh faalt over 1u). */
      const emailForLogin: string | undefined = updated?.email;
      let persistedFresh = false;
      if (emailForLogin) {
        try {
          const freshRes = await fetch(
            `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
            {
              method: 'POST',
              headers: {
                apikey: SUPABASE_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email: emailForLogin, password: pw }),
            }
          );
          if (freshRes.ok) {
            const freshSession = await freshRes.json();
            if (freshSession?.access_token) {
              await clearSession();
              await persistSession({
                access_token: freshSession.access_token,
                refresh_token: freshSession.refresh_token,
                expires_in: freshSession.expires_in,
                user: { email: emailForLogin },
              });
              persistedFresh = true;
            }
          }
        } catch {
          /* Network glitch — val terug op fallback hieronder. */
        }
      }
      if (!persistedFresh) {
        /* Fallback: tenminste access_token van de PUT/verify-context
           wegschrijven zodat user dit scherm nog kan verlaten als
           ingelogd. Geen refresh_token = zelfde tijdbom als voorheen,
           maar dit pad triggert alleen wanneer fresh-login faalt (zeldzaam). */
        await clearSession();
        await persistSession({
          access_token: accessToken,
          expires_in:
            typeof updated?.expires_in === 'number' ? updated.expires_in : 3600,
          user: { email: emailForLogin },
        });
      }

      /* Awaiten zorgt dat Audio Library bij landing de juiste
         entitlement-state heeft (was: race waarbij de tab kort als
         free toonde voordat sub binnenkwam).
         Iter 9dq v55 (2026-06-03, audit C5+C6): óók bucket-switch
         awaiten zodat per-user data (history, favorites, positions)
         vóór landing op de juiste bucket-key staan. */
      /* Operator, 7 okt 2026 (account-audit): RevenueCat opnieuw aan dit
         account koppelen — clearSession() hierboven logde hem uit. */
      await relinkAfterSessionChange();
      await refreshSubscription();
      await Promise.all([refreshBraceletBucket(), refreshAudioBucket()]);
      setPhase('done');

      /* Korte vertraging zodat user de done-state ziet, dan naar
         Audio Library. setTimeout-ref → cleanup bij unmount. */
      doneTimerRef.current = setTimeout(() => router.replace('/'), 1200);
    } catch {
      setErr('Network error — please try again.');
      setPhase('ready');
    }
  };

  if (phase === 'verifying') {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={Brand.textDim} />
          <Text style={s.title}>Verifying link…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen
          options={{
            title: copy.screenTitle,
            headerTitleAlign: 'center',
            headerBackVisible: false,
            headerLeft: () => <HeaderBackButton />,
          }}
        />
        <View style={s.center}>
          <View style={s.errorCircle}>
            <Text style={s.errorText}>!</Text>
          </View>
          <Text style={s.title}>
            {mode === 'recovery' ? 'Link expired' : 'Session expired'}
          </Text>
          <Text style={s.sub}>
            {mode === 'recovery'
              ? 'This recovery link has expired or was already used. Request a new one.'
              : 'Your sign-in session expired before you could set a password. Please sign in again.'}
          </Text>
          <AnimatedPressable
            style={[s.btnPrimary, errorBtnPressStyle]}
            onPress={() =>
              router.replace(
                (mode === 'recovery'
                  ? '/forgot-password'
                  : '/account') as never
              )
            }
            onPressIn={onErrorBtnPressIn}
            onPressOut={onErrorBtnPressOut}
          >
            <Text style={s.btnPrimaryText}>
              {mode === 'recovery' ? 'Request new link' : 'Back to sign in'}
            </Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'done') {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.center}>
          <View style={s.checkCircle}>
            <Text style={s.checkText}>✓</Text>
          </View>
          <Text style={s.title}>{copy.doneTitle}</Text>
          <Text style={s.sub}>Opening your library…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen
        options={{
          title: copy.screenTitle,
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: Math.max(safeInsets.bottom + 24, 72) }]}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        <Text style={s.title}>{copy.heading}</Text>
        <Text style={s.sub}>{copy.sub}</Text>

        <Text style={s.label}>
          {mode === 'recovery' ? 'New password' : 'Password'}
        </Text>
        <View style={s.inputWrap}>
          <TextInput
            style={s.inputField}
            value={pw}
            onChangeText={setPw}
            placeholder="At least 8 characters"
            placeholderTextColor={Brand.textDim}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <AnimatedPressable
            onPress={() => setShowPw((v) => !v)}
            onPressIn={onPwTogglePressIn}
            onPressOut={onPwTogglePressOut}
            accessibilityLabel={showPw ? 'Hide password' : 'Show password'}
            hitSlop={8}
            style={[s.toggleBtn, pwTogglePressStyle]}
          >
            <Text style={s.toggleText}>{showPw ? 'Hide' : 'Show'}</Text>
          </AnimatedPressable>
        </View>

        <Text style={s.label}>Confirm password</Text>
        <View style={s.inputWrap}>
          <TextInput
            style={s.inputField}
            value={pw2}
            onChangeText={setPw2}
            placeholder="Re-type your password"
            placeholderTextColor={Brand.textDim}
            secureTextEntry={!showPw2}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <AnimatedPressable
            onPress={() => setShowPw2((v) => !v)}
            onPressIn={onPw2TogglePressIn}
            onPressOut={onPw2TogglePressOut}
            accessibilityLabel={showPw2 ? 'Hide password' : 'Show password'}
            hitSlop={8}
            style={[s.toggleBtn, pw2TogglePressStyle]}
          >
            <Text style={s.toggleText}>{showPw2 ? 'Hide' : 'Show'}</Text>
          </AnimatedPressable>
        </View>

        {showMatchHint && (
          <Text style={matches ? s.matchOk : s.matchBad}>
            {matches ? '✓ Passwords match' : 'Passwords do not match yet'}
          </Text>
        )}

        {err && <Text style={s.err}>{err}</Text>}

        <AnimatedPressable
          style={[s.btnPrimary, phase === 'updating' && s.btnDisabled, submitPressStyle]}
          onPress={onSubmit}
          onPressIn={onSubmitPressIn}
          onPressOut={onSubmitPressOut}
          disabled={phase === 'updating'}
        >
          {phase === 'updating' ? (
            /* Knop-bg is nu wit (Huisstijl v4.4) — spinner moet donker zijn. */
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={s.btnPrimaryText}>{copy.submit}</Text>
          )}
        </AnimatedPressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 20, paddingTop: 28 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: Brand.text,
    fontSize: 24,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 10,
    marginTop: 14,
    textAlign: 'center',
  },
  sub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    marginBottom: 22,
    textAlign: 'center',
    maxWidth: 360,
  },
  label: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 14,
  },
  /* Wrapper rond TextInput + Show/Hide-knop — gedragspatroon van pro
     auth-forms (Stripe, Apple). Border zit op de wrapper, niet op de
     input zelf, zodat de knop in dezelfde "veld"-rand zit. */
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 4,
  },
  inputField: {
    flex: 1,
    paddingVertical: 13,
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleText: {
    color: AudioAccent,
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  matchOk: {
    color: Brand.success,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    marginTop: 10,
  },
  matchBad: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    marginTop: 10,
  },
  err: {
    color: Brand.error,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    marginTop: 10,
  },
  /* Iter v180 (2026-07-02): CTA breder + tekst-ademruimte (systemisch). */
  btnPrimary: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 22,
  },
  btnPrimaryText: {
    color: Brand.bg,
    fontSize: 16.5,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.4,
  },
  btnDisabled: { opacity: 0.5 },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderColor: 'rgba(74,222,128,0.4)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
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
    marginBottom: 18,
  },
  errorText: {
    color: Brand.error,
    fontSize: 28,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 32,
  },
});
