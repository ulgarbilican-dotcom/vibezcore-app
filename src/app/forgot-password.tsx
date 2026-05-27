/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Forgot password screen (native)

   In-app vervanging van de webapp forgot-password.html. User typt email
   in, krijgt reset-link via Supabase `/auth/v1/recover`. Link in email
   wijst naar `vibezcoreapp://reset-password?token_hash=xxx` — opent
   straks de reset-password screen via de deep-link handler in _layout.

   Reachable via:
     - Account-tab → "Forgot password?" link (signed-out state)
     - Deep link `vibezcoreapp://forgot-password` (zeldzaam)

   Provider-uitzondering: praat direct met Supabase ipv via auth-proxy
   (zie auth-callback.tsx voor zelfde rationale). Operator-akkoord
   2026-05-27.
   ─────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
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
import { SUPABASE_KEY, SUPABASE_URL } from '@/constants/supabase';
/* Redirect-URL die in de email-link verschijnt. Supabase voegt zelf
   `&token_hash=...&type=recovery` toe. Deep-link handler in _layout
   vangt 't pad `/reset-password` en routet erheen. */
const REDIRECT_TO = 'vibezcoreapp://reset-password';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErr('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmed,
          redirect_to: REDIRECT_TO,
        }),
      });
      /* Supabase returnt 200 ongeacht of email bestaat (privacy-feature).
         We tonen altijd dezelfde confirmation zodat user-existence niet
         lekt via timing. */
      if (res.ok || res.status === 200) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        const msg =
          data?.msg ||
          data?.error_description ||
          data?.error ||
          'Could not send reset link';
        setErr(msg);
      }
    } catch {
      setErr('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen
          options={{ title: 'Forgot password', headerBackTitle: 'Back' }}
        />
        <View style={s.center}>
          <View style={s.checkCircle}>
            <Text style={s.checkText}>✓</Text>
          </View>
          <Text style={s.title}>Check your inbox</Text>
          <Text style={s.sub}>
            If an account matches that email, a reset link is on its
            way. The link opens directly in this app and is valid for
            1 hour.
          </Text>
          <Pressable
            style={s.btnSecondary}
            onPress={() => router.replace('/account')}
            accessibilityLabel="Back to sign in"
          >
            <Text style={s.btnSecondaryText}>Back to sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen
        options={{ title: 'Forgot password', headerBackTitle: 'Back' }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        <Text style={s.title}>Forgot your password?</Text>
        <Text style={s.sub}>
          No problem. Enter the email associated with your account
          and we'll send a link to reset it.
        </Text>

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={Brand.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />
        {err && <Text style={s.err}>{err}</Text>}

        <Pressable
          style={[s.btnPrimary, busy && s.btnDisabled]}
          onPress={onSubmit}
          disabled={busy}
          accessibilityLabel="Send reset link"
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={s.btnPrimaryText}>Send reset link</Text>
          )}
        </Pressable>

        <Text style={s.helpLine}>
          The reset link opens directly in this app.
        </Text>
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
    marginBottom: 24,
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
  },
  input: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
  },
  err: {
    color: Brand.error,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    marginTop: 8,
  },
  btnPrimary: {
    backgroundColor: Brand.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 24,
  },
  btnSecondaryText: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  btnDisabled: { opacity: 0.5 },
  helpLine: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 18,
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
    marginBottom: 18,
  },
  checkText: {
    color: Brand.success,
    fontSize: 28,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 32,
  },
});
