/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet activation code redemption screen

   Iter 9dq v87 (2026-06-03): nieuwe activation-flow voor bracelet-owners.
   Bereikbaar via Account-tab → "Activate your bracelet"-CTA wanneer user
   ingelogd is maar nog geen has_bracelet=true heeft.

   Flow:
     1. User typt 16-char code (auto-formatted naar XXXX-XXXX-XXXX-XXXX)
     2. Live validatie (16 alfa-num chars)
     3. Tap "Activate" → POST /api/bracelet/activate
     4. Success → 1.2s confirmation → router.replace('/bracelet')
     5. Error → toon foutbericht inline, user kan opnieuw proberen

   UX-notes:
   - Auto-format vermijdt frustratie ("waar zet ik de dashes?")
   - Geen "Need help?"-link op deze scherm — Support staat al in Account-tab
   - Geen "Don't have a code?"-link want pre-launch is iedereen Kickstarter-
     backer; geen alternatief koop-pad in app (bracelet via webshop, niet IAP)
   ─────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import {
  activateBracelet,
  normalizeActivationCode,
} from '@/services/bracelet-activation';
import { Stack, router } from 'expo-router';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Phase = 'form' | 'submitting' | 'success' | 'error';

export default function ActivateBraceletScreen() {
  const safeInsets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  /* Live auto-formatten — gebruiker typt "ABCD1234" en ziet "ABCD-1234"
     terwijl 'ie verder typt. Tolerant voor spaties + dashes + lowercase. */
  const onChangeCode = (raw: string) => {
    setCode(normalizeActivationCode(raw));
    if (errMsg) setErrMsg(null);
  };

  const onSubmit = async () => {
    setErrMsg(null);
    setPhase('submitting');
    const result = await activateBracelet(code);
    if (result.ok) {
      setPhase('success');
      setTimeout(() => router.replace('/bracelet' as never), 1200);
      return;
    }
    setErrMsg(result.message);
    setPhase('error');
  };

  /* ── Success-state ─────────────────────────────────────────────── */
  if (phase === 'success') {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.center}>
          <View style={s.checkCircle}>
            <Text style={s.checkText}>✓</Text>
          </View>
          <Text style={s.successTitle}>Bracelet activated</Text>
          <Text style={s.successSub}>Opening your bracelet…</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Form / error / submitting ─────────────────────────────────── */
  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen
        options={{
          title: 'Activate bracelet',
          headerBackTitle: 'Back',
        }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: Math.max(safeInsets.bottom + 24, 72) },
        ]}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        <Text style={s.heading}>Activate your bracelet</Text>
        <Text style={s.sub}>
          Enter the 16-character activation code from the email we sent
          when your bracelet shipped.
        </Text>

        <Text style={s.label}>Activation code</Text>
        <TextInput
          style={s.input}
          value={code}
          onChangeText={onChangeCode}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          placeholderTextColor={Brand.textDim}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={19} /* 16 chars + 3 dashes */
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          editable={phase !== 'submitting'}
        />

        {errMsg && <Text style={s.err}>{errMsg}</Text>}

        <Pressable
          style={[
            s.btnPrimary,
            phase === 'submitting' && s.btnDisabled,
          ]}
          onPress={onSubmit}
          disabled={phase === 'submitting' || code.replace(/-/g, '').length < 16}
          accessibilityLabel="Activate bracelet"
        >
          {phase === 'submitting' ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={s.btnPrimaryText}>Activate</Text>
          )}
        </Pressable>

        <Text style={s.legal}>
          You'll find your activation code in the shipping confirmation
          email. If you can't find it, check your spam folder or contact
          support via your Account tab.
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
  heading: {
    color: Brand.text,
    fontSize: 24,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  sub: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    marginBottom: 22,
  },
  label: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 6,
  },
  input: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    color: Brand.text,
    fontSize: 16,
    fontFamily: BrandFonts.medium,
    letterSpacing: 2,
    textAlign: 'center',
  },
  err: {
    color: Brand.error,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    marginTop: 12,
    textAlign: 'center',
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
  legal: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 24,
  },
  /* Success-state */
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
  successTitle: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    textAlign: 'center',
  },
});
