/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Reset password screen (native)

   Landing-page voor de Supabase password-recovery deep link:
     vibezcoreapp://reset-password?token_hash=xxx&type=recovery

   Flow:
     1. Parse token_hash uit query params
     2. Wissel token in voor temp access_token via `/auth/v1/verify`
        (type=recovery)
     3. User typt nieuwe password
     4. PUT `/auth/v1/user` met Authorization: Bearer <access_token>
     5. Success → persist session + redirect naar Audio Library

   Ook gebruikt voor de "needs_password_setup"-flow van nieuwe Gumroad-
   kopers: auth-callback.tsx detecteert die flag en routet direct hier-
   heen na succesvolle invite-verificatie. In dat geval is er al een
   geldige session — token-exchange-step skipt dan.

   Provider-uitzondering: direct Supabase (zie auth-callback.tsx).
   ─────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import {
  EMAIL_KEY,
  EXPIRES_KEY,
  LAST_EMAIL_KEY,
  REFRESH_KEY,
  TOKEN_KEY,
  getToken,
} from '@/services/auth';
import { refreshSubscription } from '@/hooks/useSubscription';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function ResetPassword() {
  const params = useLocalSearchParams<{ token_hash?: string }>();

  /* Phase: bezig met token-exchange | klaar om password te kiezen |
     bezig met updaten | klaar | fout. */
  const [phase, setPhase] = useState<
    'verifying' | 'ready' | 'updating' | 'done' | 'error'
  >('verifying');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);

  /* Verify token-hash → access_token. Of: gebruik bestaande session
     (needs_password_setup-flow van auth-callback). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokenHash = params.token_hash;

      if (tokenHash) {
        /* Reset via email-link — wissel token in voor session. */
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
        /* Geen token_hash — verwacht een bestaande session (kwam via
           auth-callback met needs_password_setup). */
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
      setErr('Recovery link expired. Request a new one.');
      return;
    }
    setPhase('updating');
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data?.msg ||
          data?.error_description ||
          data?.error ||
          'Could not update password';
        setErr(msg);
        setPhase('ready');
        return;
      }
      /* Update gelukt — Supabase returnt de updated user. Persist een
         schone session (we hebben al access_token; refresh komt later
         vanzelf via auth-service refresh-cycle). */
      const updated = await res.json();
      const expiresIn = 3600;
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
      const pairs: [string, string][] = [
        [TOKEN_KEY, accessToken],
        [EXPIRES_KEY, String(expiresAt)],
      ];
      if (updated?.email) {
        pairs.push([EMAIL_KEY, updated.email]);
        pairs.push([LAST_EMAIL_KEY, updated.email]);
      }
      await AsyncStorage.multiSet(pairs);

      refreshSubscription();
      setPhase('done');

      /* Korte vertraging zodat user de done-state ziet, dan naar
         Audio Library. */
      setTimeout(() => router.replace('/'), 1200);
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
          <ActivityIndicator size="large" color={Brand.accent} />
          <Text style={s.title}>Verifying link…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen
          options={{ title: 'Reset password', headerBackTitle: 'Back' }}
        />
        <View style={s.center}>
          <View style={s.errorCircle}>
            <Text style={s.errorText}>!</Text>
          </View>
          <Text style={s.title}>Link expired</Text>
          <Text style={s.sub}>
            This recovery link has expired or was already used.
            Request a new one.
          </Text>
          <Pressable
            style={s.btnPrimary}
            onPress={() => router.replace('/forgot-password' as never)}
          >
            <Text style={s.btnPrimaryText}>Request new link</Text>
          </Pressable>
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
          <Text style={s.title}>Password updated</Text>
          <Text style={s.sub}>Opening your library…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen
        options={{ title: 'Reset password', headerBackTitle: 'Back' }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        <Text style={s.title}>Set a new password</Text>
        <Text style={s.sub}>
          Choose a strong password — at least 8 characters.
        </Text>

        <Text style={s.label}>New password</Text>
        <TextInput
          style={s.input}
          value={pw}
          onChangeText={setPw}
          placeholder="••••••••"
          placeholderTextColor={Brand.textDim}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <Text style={s.label}>Confirm password</Text>
        <TextInput
          style={s.input}
          value={pw2}
          onChangeText={setPw2}
          placeholder="••••••••"
          placeholderTextColor={Brand.textDim}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        {err && <Text style={s.err}>{err}</Text>}

        <Pressable
          style={[s.btnPrimary, phase === 'updating' && s.btnDisabled]}
          onPress={onSubmit}
          disabled={phase === 'updating'}
        >
          {phase === 'updating' ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={s.btnPrimaryText}>Update password</Text>
          )}
        </Pressable>
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
    marginTop: 10,
  },
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
