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
import { getToken } from '@/services/auth';
import {
  activateBracelet,
  normalizeActivationCode,
} from '@/services/bracelet-activation';
import {
  awaitDevUserOverrideLoaded,
  getDevUserOverride,
  setDevBraceletActivated,
} from '@/utils/dev-user-override';
import { Stack, router } from 'expo-router';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Phase = 'form' | 'submitting' | 'success' | 'error';

export default function ActivateBraceletScreen() {
  const safeInsets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  /* Iter 9dq v97 (2026-06-04): auth-guard. Backend
     /api/bracelet/activate vereist Bearer-token; zonder login krijg je
     401 → user heeft net 12 chars getypt voor niets. Hier blokkeren
     we vóór de form: niet ingelogd → "Sign in first"-scherm met knop
     naar /account. Dev-override 'bracelet'/'pro'/'audio' simuleert
     signed-in en passeert (zelfde semantiek als useSubscription). */
  const [authChecked, setAuthChecked] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await awaitDevUserOverrideLoaded();
      const override = getDevUserOverride();
      const overrideSignedIn =
        override === 'bracelet' ||
        override === 'pro' ||
        override === 'audio';
      if (overrideSignedIn) {
        if (!cancelled) {
          setNeedsSignIn(false);
          setAuthChecked(true);
        }
        return;
      }
      const t = await getToken();
      if (!cancelled) {
        setNeedsSignIn(!t);
        setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      /* Iter 9dq v89 (2026-06-03): dev-flag setten zodat useBraceletOwner
         na deze activation true returnt (samen met override = 'bracelet'
         / 'pro'). Productie wordt afgehandeld door backend has_bracelet
         in /api/subscription-status — die zet zichzelf na backend-
         validatie van de code. */
      if (__DEV__) {
        await setDevBraceletActivated(true);
      }
      /* Iter v177 (2026-07-02): auto-redirect na 1.2s vervangen door manual
         "Open your bracelet" CTA. Matchet de subscribe-flow (v175): post-
         success is emotioneel moment — user moet het kunnen absorberen. */
      setPhase('success');
      return;
    }
    setErrMsg(result.message);
    setPhase('error');
  };

  /* ── Auth-guard loading (heel kort: AsyncStorage-token-check) ──── */
  if (!authChecked) {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen options={{ title: 'Activate your bracelet' }} />
        <View style={s.center}>
          <ActivityIndicator color={Brand.text} />
        </View>
      </SafeAreaView>
    );
  }

  /* ── Auth-guard: niet ingelogd ──────────────────────────────────
     Geen token + geen override-simulatie van sign-in → blokkeer de
     code-form. User moet eerst account aanmaken/inloggen anders
     krijgt 'ie van backend toch 401. */
  if (needsSignIn) {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen
          options={{ title: 'Activate your bracelet', headerBackTitle: 'Back' }}
        />
        <View style={s.center}>
          <View style={s.lockCircle}>
            <Text style={s.lockText}>🔒</Text>
          </View>
          <Text style={s.gateTitle}>Sign in first</Text>
          <Text style={s.gateSub}>
            Your bracelet is linked to your VIBEZCORE account. Please sign
            in or create an account before entering your activation code.
          </Text>
          <Pressable
            style={s.btnPrimary}
            onPress={() => router.replace('/account' as never)}
            accessibilityLabel="Go to account sign in"
          >
            <Text style={s.btnPrimaryText}>Go to sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Success-state ─────────────────────────────────────────────── */
  /* Iter v177 (2026-07-02): full confirmation screen met manual CTA — matcht
     subscribe.tsx v175 done-phase patroon. Voorheen flitste dit 1.2s en dan
     auto-redirect, wat voelde als bug. Nu neemt user zelf actie. */
  if (phase === 'success') {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.doneWrap}>
          <View style={s.checkCircle}>
            <Text style={s.checkText}>✓</Text>
          </View>
          <Text style={s.doneTitle}>Bracelet activated</Text>
          <Text style={s.doneThanks}>Welcome to VIBEZCORE.</Text>

          <View style={s.donePerks}>
            <Text style={s.donePerkTitle}>You now have access to:</Text>
            <Text style={s.donePerkLine}>· 5 haptic session modes</Text>
            <Text style={s.donePerkLine}>· Full bracelet controls in the app</Text>
            <Text style={s.donePerkLine}>· Session history and progress tracking</Text>
          </View>

          <Pressable
            style={s.doneBtn}
            onPress={() => router.replace('/bracelet-control' as never)}
            accessibilityLabel="Open your bracelet control screen"
          >
            <Text style={s.doneBtnText}>Open your bracelet</Text>
          </Pressable>

          <Text style={s.doneFooter}>
            You can manage your bracelet anytime from the Bracelet tab.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Form / error / submitting ─────────────────────────────────── */
  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen
        options={{
          title: 'Activate your bracelet',
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
          Enter the 12-character activation code from the email we sent
          when your bracelet shipped.
        </Text>

        <Text style={s.label}>Activation code</Text>
        <TextInput
          style={s.input}
          value={code}
          onChangeText={onChangeCode}
          placeholder="XXXX-XXXX-XXXX"
          placeholderTextColor={Brand.textDim}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={14} /* 12 chars + 2 dashes */
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
          disabled={phase === 'submitting' || code.replace(/-/g, '').length < 12}
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
  /* Iter v180 (2026-07-02): CTA breder + tekst-ademruimte (systemisch met
     subscribe.tsx). */
  btnPrimary: {
    backgroundColor: Brand.accent,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 22,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 16.5,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.4,
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
  /* Iter v177 (2026-07-02): full confirmation screen styles — match
     subscribe.tsx done-phase. */
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  doneTitle: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 6,
    maxWidth: 320,
  },
  doneThanks: {
    color: Brand.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    marginBottom: 26,
  },
  donePerks: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 24,
    width: '100%',
    maxWidth: 340,
  },
  donePerkTitle: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.1,
    marginBottom: 10,
  },
  donePerkLine: {
    color: Brand.textDim,
    fontSize: 13.5,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.05,
    marginBottom: 4,
    lineHeight: 20,
  },
  doneBtn: {
    backgroundColor: Brand.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    alignItems: 'center',
    minWidth: 240,
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  doneFooter: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11.5,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
    marginTop: 22,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 320,
  },
  /* Auth-guard state — iter 9dq v97 (2026-06-04) */
  lockCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(58,143,255,0.12)',
    borderColor: 'rgba(58,143,255,0.40)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  lockText: {
    fontSize: 24,
    lineHeight: 28,
  },
  gateTitle: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 10,
    textAlign: 'center',
  },
  gateSub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
});
