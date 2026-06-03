/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Subscribe screen (account-create + IAP-purchase bridge)

   Operator-flow 2026-06-03:
     1. Gast browst free in (tabs)/index.tsx → tikt een pricing-card
        (Monthly of Yearly) of de "GET FULL ACCESS"-knop.
     2. Route push: /subscribe?tier=monthly|yearly
     3. Dit scherm checkt of user al ingelogd is.
        - Ingelogd → direct IAP-popup (stap 5).
        - Niet ingelogd → toon email/password-form (stap 4).
     4. User maakt account (POST /signup) → bucket-refresh → stap 5.
     5. iap.requestSubscription(tier) → Apple/Google native popup.
     6. Receipt → /api/iap-verify (backend) → Supabase active=true.
     7. refreshSubscription → user is PRO.
     8. router.replace('/') → Audio Library, alles unlocked.

   Failure-paden:
     - Account-create fail (email in gebruik / netwerk) → error-state op
       form, geen IAP-popup gestart, user kan opnieuw proberen.
     - IAP-popup user-cancelled → terug naar form-state, account blijft
       bestaan (free user nu). User kan opnieuw tikken.
     - IAP success maar verify failed → toon support-fallback.

   Reachable via:
     - (tabs)/index.tsx pricing-cards en GET FULL ACCESS-knop.
   ─────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { useIAP } from '@/hooks/useIAP';
import { refreshSubscription } from '@/hooks/useSubscription';
import {
  getToken,
  getUserEmail,
  login as authLogin,
  signup as authSignup,
} from '@/services/auth';
import type { AudioTier, IapPurchase } from '@/services/iap-contract';
import { refreshUserBucket as refreshBraceletBucket } from '@/utils/bracelet-history';
import { refreshUserBucket as refreshAudioBucket } from '@/utils/user-bucket';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

type Mode = 'signup' | 'signin';
type Phase = 'form' | 'creating-account' | 'iap-popup' | 'verifying' | 'done' | 'error';

export default function SubscribeScreen() {
  const params = useLocalSearchParams<{ tier?: string }>();
  const tier: AudioTier = params.tier === 'monthly' ? 'monthly' : 'yearly';

  const { getProduct, purchase, loading: iapLoading } = useIAP();
  const product = getProduct(tier);

  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  /* Auth-state detectie. Voor ingelogde users tonen we een review-step
     (order-summary + "Continue to checkout"-knop) ipv direct de IAP-popup
     te firen. Apple HIG: altijd een expliciete bevestigings-tap vóór
     payment.
     Iter 9dq v68 (2026-06-03): operator-keuze om de auto-fire weg te
     halen die voorheen ingelogde users meteen in een Apple-popup gooide
     zonder enige review-stap. Te abrupt UX-wise. */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await getToken();
      if (cancelled) return;
      if (t) {
        setSignedIn(true);
        const e = await getUserEmail();
        if (cancelled) return;
        setSignedInEmail(e);
      } else {
        setSignedIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Sub-flow: account-create wanneer nodig, dan IAP popup ─── */
  const runIapFlow = async () => {
    setErrMsg(null);
    setPhase('iap-popup');
    const result = await purchase(tier);
    if (!result.ok) {
      if (result.error.code === 'user_cancelled') {
        /* User wegtikte de popup → terug naar form-state, geen error
           tonen (cancelled is expliciete actie, geen fout). */
        setPhase('form');
        return;
      }
      setErrMsg(result.error.message || 'Purchase failed. Please try again.');
      setPhase('error');
      return;
    }
    await verifyAndComplete(result.purchase);
  };

  const verifyAndComplete = async (purchaseData: IapPurchase) => {
    setPhase('verifying');
    try {
      /* TODO (backend-dependency): receipt server-side valideren.
         Endpoint nog te bouwen: POST /api/iap-verify met body
         { platform: 'ios'|'android', tier, transactionId, receiptToken,
           productId }. Backend valideert bij Apple/Google, update
         Supabase subscription-row, returnt success/fail. Voor nu skippen
         we de fetch zodat de mock-flow eind-tot-eind werkt; verver dit
         door echte fetch wanneer endpoint live is. */
      if (__DEV__) {
        console.log('[subscribe] would POST /api/iap-verify:', {
          tier: purchaseData.tier,
          transactionId: purchaseData.transactionId,
          productId: purchaseData.productId,
        });
      }
      /* Triggert UI-refetch van /api/subscription-status — straks ziet
         de hele app dat user PRO is. */
      refreshSubscription();
      setPhase('done');
      setTimeout(() => router.replace('/'), 1200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (__DEV__) console.warn('[subscribe] verify failed:', msg);
      setErrMsg(
        'Could not verify your purchase. Contact support — your account will be set up shortly.',
      );
      setPhase('error');
    }
  };

  const onSubmit = async () => {
    setErrMsg(null);
    if (!email.trim() || !pw) {
      setErrMsg('Enter your email and password.');
      return;
    }
    if (mode === 'signup' && pw.length < 8) {
      setErrMsg('Password must be at least 8 characters.');
      return;
    }
    setPhase('creating-account');
    const fn = mode === 'signup' ? authSignup : authLogin;
    const r = await fn(email.trim(), pw);
    if (!r.ok) {
      setErrMsg(r.error);
      setPhase('form');
      return;
    }
    /* Audit-fix C5+C6 toegepast: bucket-switch AWAIT vóór we verder gaan,
       anders kan een snelle IAP-trigger nog naar de oude bucket schrijven. */
    await Promise.all([refreshBraceletBucket(), refreshAudioBucket()]);
    refreshSubscription();
    /* Door naar IAP-popup. */
    void runIapFlow();
  };

  /* ── Render ─────────────────────────────────────────────────────── */

  const tierLabel = tier === 'yearly' ? 'Yearly' : 'Monthly';
  const priceLabel = product?.localizedPrice ?? (tier === 'yearly' ? '€59,99' : '€9,99');
  const periodLabel = tier === 'yearly' ? '/year' : '/month';

  /* Loading/transitional phases — single full-screen state */
  if (phase === 'creating-account' || phase === 'iap-popup' || phase === 'verifying') {
    const sub =
      phase === 'creating-account'
        ? 'Creating your account…'
        : phase === 'iap-popup'
          ? `Opening secure checkout…`
          : 'Confirming your purchase…';
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen options={{ title: 'Subscribe', headerBackTitle: 'Back' }} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={Brand.accent} />
          <Text style={s.busyTitle}>Just a moment</Text>
          <Text style={s.busySub}>{sub}</Text>
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
          <Text style={s.busyTitle}>You're PRO</Text>
          <Text style={s.busySub}>Opening your library…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen options={{ title: 'Subscribe', headerBackTitle: 'Back' }} />
        <View style={s.center}>
          <View style={s.errorCircle}>
            <Text style={s.errorText}>!</Text>
          </View>
          <Text style={s.busyTitle}>Something went wrong</Text>
          <Text style={s.busySub}>{errMsg ?? 'Please try again.'}</Text>
          <Pressable
            style={s.btnPrimary}
            onPress={() => {
              setErrMsg(null);
              setPhase('form');
            }}
          >
            <Text style={s.btnPrimaryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* Auth-state nog onbekend → spinner. Voorkomt flash van form/review-
     card vóór we weten welk pad de user nodig heeft. */
  if (signedIn === null) {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen options={{ title: 'Subscribe', headerBackTitle: 'Back' }} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={Brand.accent} />
        </View>
      </SafeAreaView>
    );
  }

  /* Gedeelde order-summary card — toont wat user gaat kopen.
     Verschijnt boven zowel de signed-in review-flow als de signed-out
     account-create-form. */
  const OrderSummary = (
    <View style={s.orderCard}>
      <Text style={s.orderEyebrow}>YOUR SELECTION</Text>
      <Text style={s.orderTitle}>VIBEZCORE Audio — {tierLabel}</Text>
      <View style={s.orderPriceRow}>
        <Text style={s.orderPrice}>
          {priceLabel}
          <Text style={s.orderPeriod}>{periodLabel}</Text>
        </Text>
        {iapLoading ? (
          <ActivityIndicator color={Brand.textDim} size="small" />
        ) : null}
      </View>
      {tier === 'yearly' && (
        <Text style={s.orderSave}>Save 50% vs monthly</Text>
      )}
    </View>
  );

  /* Gedeelde legal-line onderaan — disclosure voor auto-renew + cancel
     (Apple- en Google-policy: moet expliciet vermeld vóór purchase). */
  const LegalLine = (
    <Text style={s.legal}>
      By continuing you agree to our Terms and Privacy Policy.
      Subscription auto-renews. Cancel anytime in your Apple ID or
      Google Play account settings.
    </Text>
  );

  /* ── Signed-in review-flow ─────────────────────────────────────────
     User heeft al een account → geen form. Toon order-summary, hun
     ingelogd-email als context, en een expliciete "Continue to
     checkout"-knop die de IAP-popup pas firet na hun tap. */
  if (signedIn === true) {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen options={{ title: 'Subscribe', headerBackTitle: 'Back' }} />
        <KeyboardAwareScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          extraScrollHeight={20}
        >
          {OrderSummary}

          <Text style={s.heading}>Review your purchase</Text>
          <Text style={s.sub}>
            You'll be asked to confirm payment with{' '}
            {Platform.OS === 'ios' ? 'Touch ID / Face ID' : 'your Google account'}
            {' '}in the next step.
          </Text>

          {/* Signed-in context — laat user zien aan welk account de
              aankoop wordt gekoppeld. Voorkomt verwarring "wie ben ik
              ook al weer ingelogd?". */}
          <View style={s.accountContext}>
            <Text style={s.accountLabel}>SIGNED IN AS</Text>
            <Text style={s.accountEmail} numberOfLines={1}>
              {signedInEmail ?? 'your VIBEZCORE account'}
            </Text>
          </View>

          {errMsg && <Text style={s.err}>{errMsg}</Text>}

          <Pressable style={s.btnPrimary} onPress={() => void runIapFlow()}>
            <Text style={s.btnPrimaryText}>Continue to checkout</Text>
          </Pressable>

          <Pressable
            style={s.linkBtn}
            onPress={() => router.back()}
          >
            <Text style={s.linkText}>Cancel</Text>
          </Pressable>

          {LegalLine}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    );
  }

  /* ── Signed-out signup/signin-flow ─────────────────────────────────
     User heeft nog geen sessie op dit device → email + password form,
     dan account-create OF sign-in (mode-toggle), dan IAP-popup. */
  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen options={{ title: 'Subscribe', headerBackTitle: 'Back' }} />
      <KeyboardAwareScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        {OrderSummary}

        <Text style={s.heading}>
          {mode === 'signup'
            ? 'Create your account to subscribe'
            : 'Sign in to subscribe'}
        </Text>
        <Text style={s.sub}>
          {mode === 'signup'
            ? 'One account to access your audio across all your devices.'
            : 'Welcome back — sign in to continue with checkout.'}
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

        <Text style={s.label}>Password</Text>
        <View style={s.pwWrap}>
          <TextInput
            style={[s.input, s.pwInput]}
            value={pw}
            onChangeText={setPw}
            placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
            placeholderTextColor={Brand.textDim}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
          <Pressable
            style={s.pwToggle}
            onPress={() => setShowPw((v) => !v)}
            hitSlop={8}
          >
            <Text style={s.pwToggleText}>{showPw ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>

        {errMsg && <Text style={s.err}>{errMsg}</Text>}

        <Pressable style={s.btnPrimary} onPress={onSubmit}>
          <Text style={s.btnPrimaryText}>
            {mode === 'signup' ? 'Create account & continue' : 'Sign in & continue'}
          </Text>
        </Pressable>

        <Pressable
          style={s.linkBtn}
          onPress={() => {
            setErrMsg(null);
            setMode((m) => (m === 'signup' ? 'signin' : 'signup'));
          }}
        >
          <Text style={s.linkText}>
            {mode === 'signup'
              ? 'Already have an account? Sign in'
              : "Don't have an account? Create one"}
          </Text>
        </Pressable>

        {LegalLine}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  /* Order summary card */
  orderCard: {
    backgroundColor: Brand.panel,
    borderColor: 'rgba(58, 143, 255, 0.28)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginBottom: 28,
    marginTop: 6,
  },
  orderEyebrow: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  orderTitle: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  orderPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  orderPrice: {
    color: Brand.accent,
    fontSize: 28,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.6,
  },
  orderPeriod: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
  },
  orderSave: {
    color: Brand.success,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    marginTop: 6,
  },
  /* Form */
  heading: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 8,
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
    marginTop: 12,
  },
  input: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
  },
  pwWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pwInput: {
    flex: 1,
  },
  pwToggle: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginLeft: -56,
  },
  pwToggleText: {
    color: Brand.accent,
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  err: {
    color: Brand.error,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    marginTop: 12,
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
  linkBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  linkText: {
    color: Brand.accent,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
  },
  /* Signed-in review-flow: laat user expliciet zien onder welk account
     ze straks de subscription krijgen. Dim panel met SIGNED IN AS label
     + email — voorkomt "wie ben ik?"-verwarring. */
  accountContext: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 18,
    marginBottom: 6,
  },
  accountLabel: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  accountEmail: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  legal: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 24,
  },
  /* Busy / done / error */
  busyTitle: {
    color: Brand.text,
    fontSize: 20,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginTop: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  busySub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
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
});
