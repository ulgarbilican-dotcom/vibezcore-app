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

import { Brand, BrandFonts, AudioAccent } from '@/constants/theme';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { clearSession, getToken, login, signup } from '@/services/auth';
import { clearLastPlayed } from '@/utils/last-played';
import {
  activateBracelet,
  isValidActivationCodeFormat,
  normalizeActivationCode,
} from '@/services/bracelet-activation';
import {
  awaitDevUserOverrideLoaded,
  getDevUserOverride,
  setDevBraceletActivated,
  setDevUserOverride,
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
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

/* Standaardiseerde press-scale (2026-09-23) — zelfde curve als StartCard
   in breath-welcome.tsx. */
const AnimatedPressable = ReanimatedAnimated.createAnimatedComponent(Pressable);
function usePressScale(scaleTo: number) {
  const scale = useSharedValue(1);
  const onPressIn = () => {
    scale.value = withTiming(scaleTo, { duration: 80 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return { onPressIn, onPressOut, pressStyle };
}

type Phase = 'form' | 'submitting' | 'success' | 'error';

/** Simple email format check — same rule as subscribe.tsx. */
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function ActivateBraceletScreen() {
  const safeInsets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isBundle, setIsBundle] = useState(false);
  const doneBtnScale = usePressScale(0.96);
  const pwShowScale = usePressScale(0.92);
  const submitBtnScale = usePressScale(0.96);
  const signInLinkScale = usePressScale(0.95);

  /* Iter v183 (2026-07-02): "Sign in first"-gate verwijderd. Nu gecombineerde
     form: als user niet ingelogd is toont het scherm email + password + code
     inputs in één flow (bracelet als main product krijgt een volwaardige
     signup flow, net als audio). Als user al ingelogd is: alleen code input.
     Backend flow: signup(email, password) → activateBracelet(code) sequentieel.
     Voor bestaande accounts (returning users met code): "Already have an
     account? Sign in" link onderaan navigeert naar Account-tab. */
  const [authChecked, setAuthChecked] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

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
          setIsSignedIn(true);
          setAuthChecked(true);
        }
        return;
      }
      const t = await getToken();
      if (!cancelled) {
        setIsSignedIn(!!t);
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
    /* Iter v218 (2026-07-07): outer try/catch als vangnet — een onverwachte
       TypeError (zoals de ontbrekende isValidActivationCodeFormat-import in
       v217) mag NOOIT meer de spinner locked achterlaten. Bestaande
       error-branches returnen nog steeds vóór de catch, dus dit is puur
       safety. */
    setErrMsg(null);
    setPhase('submitting');

    try {

    /* 1. Code format check */
    if (!isValidActivationCodeFormat(code)) {
      setErrMsg('Please enter a 12-character activation code.');
      setPhase('form');
      return;
    }

    /* 2. Signup als niet ingelogd. Iter v228 (2026-07-08, KRITIEK
       AUTH-FIX): track `justSignedUp` zodat we bij failed activate de
       zojuist-aangemaakte session kunnen rollbacken (clearSession).
       Voorheen: foute code met geldig format → signup OK → activate fail
       → user blijft ingelogd op net-aangemaakt account → app restart
       landt op live sessie. Dat is auth-persistence-bypass. */
    let justSignedUp = false;
    if (!isSignedIn) {
      if (!isValidEmail(email)) {
        setErrMsg('Enter a valid email address.');
        setPhase('form');
        return;
      }
      if (password.length < 8) {
        setErrMsg('Password must be at least 8 characters.');
        setPhase('form');
        return;
      }
      try {
        const signupResult = await signup(email.trim(), password);
        if (!signupResult.ok) {
          const errBody =
            typeof signupResult.error === 'string' ? signupResult.error : '';
          if (errBody.toLowerCase().includes('already') || errBody.toLowerCase().includes('exists')) {
            /* Iter v226 (2026-07-07): auto-signin patroon zoals subscribe.tsx.
               Voorheen werd de user weggejaagd naar de Account-tab om apart
               in te loggen — Kickstarter-backers kregen dit constant. Nu:
               probeer meteen login met dezelfde credentials, dan door met
               activate. Als login ook faalt (verkeerd wachtwoord) → nette
               error dat 't oude wachtwoord verkeerd is. */
            const loginResult = await login(email.trim(), password);
            if (!loginResult.ok) {
              setErrMsg(
                'This email already has an account, but that password does not match. Reset your password via the Account tab, then activate your bracelet.',
              );
              setPhase('form');
              return;
            }
            /* Login geslaagd → doorloop de rest van de flow (activate).
               justSignedUp blijft false — het was een bestaande user. */
          } else {
            setErrMsg(errBody || 'Could not create account. Please try again.');
            setPhase('form');
            return;
          }
        } else {
          /* Verse signup — als activate straks faalt, rollback deze session. */
          justSignedUp = true;
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setErrMsg(`Signup failed: ${message}`);
        setPhase('form');
        return;
      }

      /* Iter v221 (2026-07-07): defensive token-check. signup() awaits
         persistSession() intern, dus dit hoort direct te lukken. Als
         'ie null returned is de sessie stuk — vragen om apart in te
         loggen ipv 401 op activateBracelet. */
      const freshToken = await getToken();
      if (!freshToken) {
        setErrMsg(
          'Account created, but sign-in did not persist. Please sign in from the Account tab and activate again.',
        );
        setPhase('form');
        return;
      }

      /* Iter v235 (2026-07-09, KRITIEK privacy-fix): wis last-played van
         vorige user op dit toestel. Zonder deze call zag een verse
         bracelet-account op re-open de "Welcome back — Continue listening?"
         modal van de vorige gebruiker (bv. audio-PRO user die eerder
         luisterde op dit device). Symmetrisch met account.tsx login-pad
         waar clearLastPlayed al werd aangeroepen na sign-in. */
      await clearLastPlayed().catch(() => {});
    }

    /* 3. Activate bracelet. Iter v228 (2026-07-08, KRITIEK AUTH-FIX):
       bij faal rollback de zojuist-aangemaakte session zodat user niet
       geauthenticeerd blijft op een net-aangemaakt account met foute code. */
    let result;
    try {
      result = await activateBracelet(code);
    } catch (e) {
      if (justSignedUp) await clearSession().catch(() => {});
      const message = e instanceof Error ? e.message : String(e);
      setErrMsg(`Activation failed: ${message}`);
      setPhase('form');
      return;
    }

    if (!result.ok) {
      if (justSignedUp) await clearSession().catch(() => {});
      setErrMsg(result.message);
      setPhase('error');
      return;
    }

    /* 4. Owner-state.
       Iter v221 (2026-07-07): dev-flags alleen in __DEV__ zetten.
       In productie is de backend (via refreshSubscription inside
       activateBracelet) leidend. setIsBundle() is puur lokale UI-state
       voor het success-screen en draait altijd. */
    if (result.model === 'bundle') {
      setIsBundle(true);
    }

    if (__DEV__) {
      try {
        if (result.model === 'bundle') {
          await setDevUserOverride('pro');
        } else {
          await setDevUserOverride('bracelet');
        }
        await setDevBraceletActivated(true);
      } catch (e) {
        console.warn('[activate-bracelet] dev-flag error:', e);
      }
    }

    setPhase('success');

    } catch (e) {
      /* Iter v221 (2026-07-07): gebruikersvriendelijke copy ipv raw
         error dump. Details worden alleen in __DEV__ console gelogd. */
      if (__DEV__) console.warn('[activate-bracelet] unexpected error:', e);
      setErrMsg(
        'Something went wrong on our side. Please try again, or contact support if the problem continues.',
      );
      setPhase('form');
    }
  };

  /* ── Auth-guard loading (heel kort: AsyncStorage-token-check) ──── */
  if (!authChecked) {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen
          options={{
            title: 'Activate your bracelet',
            headerTitleAlign: 'center',
            headerBackVisible: false,
            headerLeft: () => <HeaderBackButton />,
          }}
        />
        <View style={s.center}>
          <ActivityIndicator color={Brand.text} />
        </View>
      </SafeAreaView>
    );
  }

  /* Iter v183 (2026-07-02): "Sign in first"-gate verwijderd. Vervangen door
     één gecombineerd formulier hieronder waar user email + password + code
     tegelijk invult. Backend flow: signup → activate in één submit. */

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
          <Text style={s.doneTitle}>
            {isBundle ? 'Bundle activated' : 'Bracelet activated'}
          </Text>
          <Text style={s.doneThanks}>Welcome to VIBEZCORE.</Text>

          <View style={s.donePerks}>
            <Text style={s.donePerkTitle}>You now have access to:</Text>
            <Text style={s.donePerkLine}>· 5 haptic session modes</Text>
            <Text style={s.donePerkLine}>· Full bracelet controls in the app</Text>
            <Text style={s.donePerkLine}>· Session history and progress tracking</Text>
            {isBundle && (
              <>
                <Text style={s.donePerkLine}>· 144 audio sessions across 4 pillars</Text>
                <Text style={s.donePerkLine}>· 1 year of Audio Library access</Text>
              </>
            )}
          </View>

          <AnimatedPressable
            style={[s.doneBtn, doneBtnScale.pressStyle]}
            /* Iter v227 (2026-07-07, audit BLE1): route naar (tabs)/bracelet
               ipv naar stack-route /bracelet-control. Bracelet-tab rendert
               BraceletControl inline voor owners MET tab-bar; standalone
               stack-route had geen tab-bar en back-button popte naar
               welcome. */
            onPress={() => router.replace('/(tabs)/bracelet' as never)}
            onPressIn={doneBtnScale.onPressIn}
            onPressOut={doneBtnScale.onPressOut}
            accessibilityLabel="Open Bracelet Control screen"
          >
            <Text style={s.doneBtnText}>Open Bracelet Control</Text>
          </AnimatedPressable>

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
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton />,
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
          {isSignedIn
            ? 'Enter the 12-character activation code from the email we sent when your bracelet shipped.'
            : 'Create your VIBEZCORE account and activate your bracelet in one step. Your bracelet is linked to this account for cross-device access.'}
        </Text>

        {/* Iter v183 (2026-07-02): email + password inputs alleen tonen bij
            niet-ingelogde users. Signed-in users zien direct code-field. */}
        {!isSignedIn && (
          <>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.inputEmail}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (errMsg) setErrMsg(null);
              }}
              placeholder="you@example.com"
              placeholderTextColor={Brand.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              editable={phase !== 'submitting'}
            />

            <Text style={s.label}>Password</Text>
            <View style={s.pwWrap}>
              <TextInput
                style={s.inputPw}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errMsg) setErrMsg(null);
                }}
                placeholder="At least 8 characters"
                placeholderTextColor={Brand.textDim}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showPw}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={phase !== 'submitting'}
              />
              <AnimatedPressable
                onPress={() => setShowPw((v) => !v)}
                onPressIn={pwShowScale.onPressIn}
                onPressOut={pwShowScale.onPressOut}
                hitSlop={8}
                style={[s.pwShow, pwShowScale.pressStyle]}
              >
                <Text style={s.pwShowText}>{showPw ? 'Hide' : 'Show'}</Text>
              </AnimatedPressable>
            </View>
          </>
        )}

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

        <AnimatedPressable
          style={[
            s.btnPrimary,
            phase === 'submitting' && s.btnDisabled,
            submitBtnScale.pressStyle,
          ]}
          onPress={onSubmit}
          onPressIn={submitBtnScale.onPressIn}
          onPressOut={submitBtnScale.onPressOut}
          disabled={phase === 'submitting' || code.replace(/-/g, '').length < 12}
          accessibilityLabel="Activate bracelet"
        >
          {phase === 'submitting' ? (
            /* Knop-bg is nu wit (Huisstijl v4.4) — spinner moet donker zijn. */
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={s.btnPrimaryText}>
              {isSignedIn ? 'Activate' : 'Create account & activate'}
            </Text>
          )}
        </AnimatedPressable>

        {!isSignedIn && (
          <AnimatedPressable
            onPress={() => router.replace('/account' as never)}
            onPressIn={signInLinkScale.onPressIn}
            onPressOut={signInLinkScale.onPressOut}
            style={[s.signInLink, signInLinkScale.pressStyle]}
            hitSlop={8}
          >
            <Text style={s.signInLinkText}>
              Already have an account?{' '}
              <Text style={s.signInLinkAccent}>Sign in first</Text>
            </Text>
          </AnimatedPressable>
        )}

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
  /* Iter v183 (2026-07-02): email input met minder letterSpacing en
     left-aligned (email is niet spaced-uppercase zoals de code). */
  inputEmail: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0,
  },
  /* Password wrap: input met Show-button rechts. */
  pwWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputPw: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 70, /* ruimte voor Show-button */
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0,
  },
  pwShow: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  /* Huisstijl v4.4: link-tekst op donkere achtergrond = AudioAccent, geen Signal Blue. */
  pwShowText: {
    color: AudioAccent,
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.3,
  },
  signInLink: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },
  signInLinkText: {
    color: Brand.textDim,
    fontSize: 13.5,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
  },
  /* Huisstijl v4.4: link-tekst op donkere achtergrond = AudioAccent, geen Signal Blue. */
  signInLinkAccent: {
    color: AudioAccent,
    fontFamily: BrandFonts.bold,
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
  /* Huisstijl v4.4: primaire CTA op donkere achtergrond = wit bg + donkere tekst. */
  btnPrimary: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 22,
  },
  btnPrimaryText: {
    color: '#0a0a0a',
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
  /* Huisstijl v4.4: primaire CTA op donkere achtergrond = wit bg + donkere tekst. */
  doneBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    alignItems: 'center',
    minWidth: 240,
  },
  doneBtnText: {
    color: '#0a0a0a',
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
  /* Huisstijl v4.4: decoratieve icoon-cirkel, niet haptic/status — AudioAccent. */
  lockCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(110,133,196,0.12)',
    borderColor: 'rgba(110,133,196,0.40)',
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
