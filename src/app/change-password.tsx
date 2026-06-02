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
import { Brand, BrandFonts } from '@/constants/theme';
import { refreshSubscription } from '@/hooks/useSubscription';
import {
  EMAIL_KEY,
  EXPIRES_KEY,
  TOKEN_KEY,
  getUserEmail,
} from '@/services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

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

      /* ── Stap 3: persist nieuwe session ── */
      const updated = await updateRes.json();
      const expiresIn =
        typeof session?.expires_in === 'number' ? session.expires_in : 3600;
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
      const pairs: [string, string][] = [
        [TOKEN_KEY, session.access_token],
        [EXPIRES_KEY, String(expiresAt)],
      ];
      if (updated?.email) pairs.push([EMAIL_KEY, updated.email]);
      await AsyncStorage.multiSet(pairs);

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
        options={{ title: 'Change password', headerBackTitle: 'Account' }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={s.scroll}
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
          <Pressable
            onPress={() => setShowCurrent((v) => !v)}
            accessibilityLabel={
              showCurrent ? 'Hide password' : 'Show password'
            }
            hitSlop={8}
            style={s.toggleBtn}
          >
            <Text style={s.toggleText}>{showCurrent ? 'Hide' : 'Show'}</Text>
          </Pressable>
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
          <Pressable
            onPress={() => setShow1((v) => !v)}
            accessibilityLabel={show1 ? 'Hide password' : 'Show password'}
            hitSlop={8}
            style={s.toggleBtn}
          >
            <Text style={s.toggleText}>{show1 ? 'Hide' : 'Show'}</Text>
          </Pressable>
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
          <Pressable
            onPress={() => setShow2((v) => !v)}
            accessibilityLabel={show2 ? 'Hide password' : 'Show password'}
            hitSlop={8}
            style={s.toggleBtn}
          >
            <Text style={s.toggleText}>{show2 ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>

        {/* Match indicator */}
        {showMatch && (
          <Text style={matches ? s.matchOk : s.matchBad}>
            {matches ? '✓ Passwords match' : 'Passwords do not match yet'}
          </Text>
        )}

        {err && <Text style={s.err}>{err}</Text>}

        <Pressable
          style={[s.btnPrimary, !canSubmit && s.btnDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit}
          accessibilityLabel="Update password"
        >
          {phase === 'updating' ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={s.btnPrimaryText}>Update password</Text>
          )}
        </Pressable>

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
    color: Brand.accent,
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
    backgroundColor: Brand.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
  },
  btnPrimaryText: {
    color: '#ffffff',
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
    color: Brand.accent,
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
