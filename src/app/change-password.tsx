/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Change password (voor ingelogde users)

   Aparte flow t.o.v. `/reset-password`. Reset is voor users die hun
   password VERGETEN zijn (email-link flow). Deze is voor users die hun
   huidige password kennen en gewoon willen wijzigen.

   Security: vereist huidige password als verificatie — voorkomt
   account-takeover bij verloren/gedeeld toestel. Matched Apple/Google/
   Spotify standard practice.

   Flow:
     1. User vult: current password, new password (×2)
     2. Verify current password via /auth/v1/token (grant_type=password)
     3. Bij success → PUT /auth/v1/user met nieuwe password
     4. Update local session (token + expires)
     5. Success-state → terug naar Account

   Reachable via:
     - Account-tab → "Change password" row
   ─────────────────────────────────────────────────────────────────── */

import { SUPABASE_KEY, SUPABASE_URL } from '@/constants/supabase';
import { AudioAccent, Brand, BrandFonts } from '@/constants/theme';
import { HeaderBackButton } from '@/components/HeaderBackButton';
/* Operator, 26 september 2026 (Huisstijl & Design Handboek v4.4):
   Brand.accent (#3a8fff, Signal Blue) is enkel voor haptic-pulse/"nu
   actief" — nooit voor links/CTA. AudioAccent is de link-kleur op
   donker; CTA-regel v4.4: witte knop-bg + donkere tekst. */
import { refreshSubscription } from '@/hooks/useSubscription';
import { getUserEmail, persistSession } from '@/services/auth';
import { Stack, router } from 'expo-router';
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

type Phase = 'form' | 'updating' | 'done';

export default function ChangePassword() {
  const [email, setEmail] = useState<string | null>(null);
  const [current, setCurrent] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [err, setErr] = useState<string | null>(null);
  /* Iter 9dq v77 (2026-06-03): safe-area-aware scroll padding.
     Floor 72 = consistent met andere bottom-CTAs. */
  const safeInsets = useSafeAreaInsets();

  /* Email ophalen uit auth-state — nodig voor de current-password
     verificatie via /auth/v1/token. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const e = await getUserEmail();
      if (!cancelled) setEmail(e ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Auto-navigate terug na success — geeft user kans om de success-
     state te zien, dan back to Account. Ref voor cleanup bij unmount. */
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, []);

  /* Press-scale-animatie — één losse shared value per tappable element
     (zie breath-welcome.tsx `StartCard`). */
  const currentTogglePressScale = useSharedValue(1);
  const onCurrentTogglePressIn = () => {
    currentTogglePressScale.value = withTiming(0.93, { duration: 80 });
  };
  const onCurrentTogglePressOut = () => {
    currentTogglePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const currentTogglePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: currentTogglePressScale.value }],
  }));

  const pw1TogglePressScale = useSharedValue(1);
  const onPw1TogglePressIn = () => {
    pw1TogglePressScale.value = withTiming(0.93, { duration: 80 });
  };
  const onPw1TogglePressOut = () => {
    pw1TogglePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pw1TogglePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pw1TogglePressScale.value }],
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

  /* Live "match" feedback — pas tonen zodra user iets in pw2 typt,
     anders rode flash terwijl 'ie nog aan 't typen is. */
  const showMatch = pw1.length > 0 && pw2.length > 0;
  const matches = pw1 === pw2;

  const canSubmit =
    current.length >= 1 &&
    pw1.length >= 8 &&
    pw2.length >= 8 &&
    matches &&
    phase === 'form';

  const onSubmit = async () => {
    setErr(null);
    if (!email) {
      setErr('Email not found. Please sign in again.');
      return;
    }
    if (pw1.length < 8) {
      setErr('New password must be at least 8 characters.');
      return;
    }
    if (pw1 !== pw2) {
      setErr('New passwords do not match.');
      return;
    }
    if (pw1 === current) {
      setErr('New password must be different from the current one.');
      return;
    }

    setPhase('updating');

    try {
      /* ── Stap 1: verifieer current password ──
         /auth/v1/token met grant_type=password retourneert een nieuwe
         session als email+password correct zijn. Als 't fout is,
         krijgen we 400 met error_description="Invalid login credentials". */
      const verifyRes = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email,
            password: current,
          }),
        },
      );

      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        const msg = (data?.error_description || data?.msg || '').toLowerCase();
        if (msg.includes('invalid') || msg.includes('credentials')) {
          setErr('Current password is incorrect.');
        } else {
          setErr('Could not verify current password. Please try again.');
        }
        setPhase('form');
        return;
      }

      const session = await verifyRes.json();
      if (!session.access_token) {
        setErr('Could not verify your account. Please try again.');
        setPhase('form');
        return;
      }

      /* ── Stap 2: update password met nieuw token ── */
      const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: pw1,
          /* Clear needs_password_setup flag voor het geval 'ie nog op
             true stond (bv. user had via invite een password gezet
             maar de flag niet gecleared). */
          data: { needs_password_setup: false },
        }),
      });

      if (!updateRes.ok) {
        const data = await updateRes.json().catch(() => ({}));
        const msg =
          data?.msg ||
          data?.error_description ||
          data?.error ||
          'Could not update password. Please try again.';
        setErr(typeof msg === 'string' ? msg : 'Could not update password.');
        setPhase('form');
        return;
      }

      /* ── Stap 3: fresh login met NIEUW password ──
         Iter 9dq v51 (2026-06-03, audit-finding C1): Supabase REVOKET
         ALLE refresh_tokens wanneer een password gewijzigd wordt
         (security-best-practice — alle bestaande sessies moeten dood).
         Voorheen persistte deze code alleen het access_token uit step 1
         (de verify-call), maar de refresh_token in AsyncStorage bleef
         de OUDE (van vóór de password-change). Wanneer dat access_token
         binnen ~1u expireerde → auto-refresh in auth.ts → 401 → silent
         logout. User dacht dat 'ie ingelogd was, kreeg ineens login-form.

         Fix: doe een verse /token?grant_type=password met het NIEUWE
         password om een fresh access_token + refresh_token + expires_in
         te krijgen die NIET door de password-wijziging gerevoket worden.
         persistSession (uit auth.ts) schrijft alle keys correct
         (TOKEN_KEY, REFRESH_KEY, EXPIRES_KEY, EMAIL_KEY, LAST_EMAIL_KEY).

         Mocht deze fresh-login ooit falen (zeldzaam — Supabase rate
         limit?), behouden we de bestaande verify-session als fallback
         zodat user niet uitgelogd is — alleen worst case is dat binnen
         1u refresh faalt en hij dan opnieuw moet inloggen (= current
         broken state, niet erger). */
      const updated = await updateRes.json();
      try {
        const freshRes = await fetch(
          `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
          {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password: pw1 }),
          },
        );
        if (freshRes.ok) {
          const freshSession = await freshRes.json();
          if (freshSession?.access_token) {
            await persistSession({
              access_token: freshSession.access_token,
              refresh_token: freshSession.refresh_token,
              expires_in: freshSession.expires_in,
              user: { email: updated?.email || email },
            });
          } else {
            /* Fallback: gebruik de verify-session uit step 1 — minder ideaal
               maar voorkomt silent logout vandaag (refresh kan binnen 1u
               nog falen, gelijk aan oude gedrag). */
            await persistSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_in: session.expires_in,
              user: { email: updated?.email || email },
            });
          }
        } else {
          await persistSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            user: { email: updated?.email || email },
          });
        }
      } catch {
        /* Network glitch op de fresh-login — fallback op verify-session. */
        await persistSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          user: { email: updated?.email || email },
        });
      }

      /* Subscription state refreshen zodat Audio Library de juiste
         entitlements toont (in praktijk al hetzelfde, maar safe). */
      await refreshSubscription();

      setPhase('done');
      doneTimerRef.current = setTimeout(() => {
        router.back();
      }, 1500);
    } catch {
      setErr('Network error — please check your connection and try again.');
      setPhase('form');
    }
  };

  /* ── Render ───────────────────────────────────────────────────── */

  if (phase === 'done') {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.center}>
          <View style={s.checkCircle}>
            <Text style={s.checkText}>✓</Text>
          </View>
          <Text style={s.title}>Password changed</Text>
          <Text style={s.sub}>
            Your password has been updated. Returning to your account…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen
        options={{
          title: 'Change password',
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
        <Text style={s.title}>Change your password</Text>
        <Text style={s.sub}>
          Enter your current password to confirm it's you, then choose
          a new one — at least 8 characters.
        </Text>

        {/* Email (read-only context, helpt user te zien voor welk
            account 'ie het password wijzigt) */}
        {email && (
          <View style={s.emailChip}>
            <Text style={s.emailLabel}>Your account</Text>
            <Text style={s.emailValue}>{email}</Text>
          </View>
        )}

        {/* Current password */}
        <Text style={s.label}>Current password</Text>
        <View style={s.inputWrap}>
          <TextInput
            style={s.inputField}
            value={current}
            onChangeText={setCurrent}
            placeholder="Your existing password"
            placeholderTextColor={Brand.textDim}
            secureTextEntry={!showCurrent}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            editable={phase === 'form'}
          />
          <AnimatedPressable
            onPress={() => setShowCurrent((v) => !v)}
            onPressIn={onCurrentTogglePressIn}
            onPressOut={onCurrentTogglePressOut}
            accessibilityLabel={
              showCurrent ? 'Hide password' : 'Show password'
            }
            hitSlop={8}
            style={[s.toggleBtn, currentTogglePressStyle]}
          >
            <Text style={s.toggleText}>{showCurrent ? 'Hide' : 'Show'}</Text>
          </AnimatedPressable>
        </View>

        {/* New password */}
        <Text style={s.label}>New password</Text>
        <View style={s.inputWrap}>
          <TextInput
            style={s.inputField}
            value={pw1}
            onChangeText={setPw1}
            placeholder="At least 8 characters"
            placeholderTextColor={Brand.textDim}
            secureTextEntry={!show1}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            editable={phase === 'form'}
          />
          <AnimatedPressable
            onPress={() => setShow1((v) => !v)}
            onPressIn={onPw1TogglePressIn}
            onPressOut={onPw1TogglePressOut}
            accessibilityLabel={show1 ? 'Hide password' : 'Show password'}
            hitSlop={8}
            style={[s.toggleBtn, pw1TogglePressStyle]}
          >
            <Text style={s.toggleText}>{show1 ? 'Hide' : 'Show'}</Text>
          </AnimatedPressable>
        </View>

        {/* Confirm new password */}
        <Text style={s.label}>Confirm new password</Text>
        <View style={s.inputWrap}>
          <TextInput
            style={s.inputField}
            value={pw2}
            onChangeText={setPw2}
            placeholder="Re-type your new password"
            placeholderTextColor={Brand.textDim}
            secureTextEntry={!show2}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            editable={phase === 'form'}
          />
          <AnimatedPressable
            onPress={() => setShow2((v) => !v)}
            onPressIn={onPw2TogglePressIn}
            onPressOut={onPw2TogglePressOut}
            accessibilityLabel={show2 ? 'Hide password' : 'Show password'}
            hitSlop={8}
            style={[s.toggleBtn, pw2TogglePressStyle]}
          >
            <Text style={s.toggleText}>{show2 ? 'Hide' : 'Show'}</Text>
          </AnimatedPressable>
        </View>

        {/* Match indicator */}
        {showMatch && (
          <Text style={matches ? s.matchOk : s.matchBad}>
            {matches ? '✓ Passwords match' : 'Passwords do not match yet'}
          </Text>
        )}

        {err && <Text style={s.err}>{err}</Text>}

        <AnimatedPressable
          style={[s.btnPrimary, !canSubmit && s.btnDisabled, submitPressStyle]}
          onPress={onSubmit}
          onPressIn={onSubmitPressIn}
          onPressOut={onSubmitPressOut}
          disabled={!canSubmit}
          accessibilityLabel="Update password"
        >
          {phase === 'updating' ? (
            /* Knop-bg is nu wit (Huisstijl v4.4) — spinner moet donker zijn. */
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={s.btnPrimaryText}>Update password</Text>
          )}
        </AnimatedPressable>

        <Text style={s.help}>
          Forgot your current password? Sign out and use{' '}
          <Text style={s.helpLink}>Forgot password</Text> from the
          sign-in screen instead.
        </Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 20, paddingTop: 28, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  sub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    marginBottom: 22,
    maxWidth: 360,
  },
  /* Email chip — context-display ("voor welk account") */
  emailChip: {
    alignSelf: 'flex-start',
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  emailLabel: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  emailValue: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  /* Field labels */
  label: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 14,
  },
  /* Input wrapper met show/hide toggle inline */
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
  /* Match indicator */
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
  /* Primary submit button */
  btnPrimary: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
  },
  btnPrimaryText: {
    color: Brand.bg,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  btnDisabled: { opacity: 0.4 },
  /* Helper text onderaan — voor users die current password vergeten zijn */
  help: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
    marginTop: 22,
    textAlign: 'center',
  },
  helpLink: {
    color: AudioAccent,
    fontFamily: BrandFonts.semibold,
  },
  /* Done state */
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
});
