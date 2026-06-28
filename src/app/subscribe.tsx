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
import { getIAP } from '@/services/iap';
import {
  queuePendingVerify,
  verifyWithRetry,
} from '@/services/iap-recovery';
import { restorePurchases } from '@/services/restore-purchases';
import {
  getLastLoginEmail,
  getToken,
  getUserEmail,
  login as authLogin,
  signup as authSignup,
  VZ_BACKEND_URL,
} from '@/services/auth';
import type { AudioTier, IapPurchase } from '@/services/iap-contract';
import {
  isAppleSignInAvailable,
  isGoogleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
} from '@/services/social-auth';
import { refreshUserBucket as refreshBraceletBucket } from '@/utils/bracelet-history';
import { refreshUserBucket as refreshAudioBucket } from '@/utils/user-bucket';
import { validateEmail, emailHintText } from '@/utils/validate-email';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { showVibezAlert } from '@/components/VibezAlert';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Mode = 'signup' | 'signin';
type Phase = 'form' | 'creating-account' | 'iap-popup' | 'verifying' | 'done' | 'error';

/* Iter 9dq v134 (2026-06-14): mapt rauwe technische errors (auth-proxy
   "upstream fetch failed", IAP "network error", Supabase 401's, etc.)
   naar leesbare user-facing tekst. Operator-feedback 2026-06-14: gast
   zag "upstream fetch failed" na tap op Get Yearly — niet acceptabel.
   Defensief: onbekende strings vallen terug op een veilige default ipv
   de raw error te tonen (kan tokens/IDs lekken). */
const SUPPORT_URL = 'https://www.vibezcore.com/support';
function friendlyError(raw: string | null | undefined): string {
  if (!raw) return 'Something went wrong. Please try again.';
  const t = String(raw).toLowerCase();
  if (
    t.includes('upstream') ||
    t.includes('fetch failed') ||
    t.includes('failed to fetch') ||
    t.includes('network') ||
    t.includes('timeout') ||
    t.includes('econnrefused') ||
    t.includes('econnreset') ||
    t.includes('socket')
  ) {
    return "We couldn't reach our servers. Check your connection and try again.";
  }
  if (t.includes('already') && (t.includes('exist') || t.includes('registered'))) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (
    (t.includes('invalid') || t.includes('wrong') || t.includes('incorrect')) &&
    (t.includes('password') || t.includes('credentials') || t.includes('login') || t.includes('email'))
  ) {
    return 'Email or password is incorrect.';
  }
  if (t.includes('email') && (t.includes('invalid') || t.includes('not valid'))) {
    return "That email address doesn't look valid.";
  }
  if (t.includes('email not confirmed') || t.includes('confirm your email')) {
    return 'Please confirm your email first — check your inbox.';
  }
  if (t.includes('weak') && t.includes('password')) {
    return 'Please choose a stronger password (8+ characters).';
  }
  if (t.includes('sign in') && (t.includes('before') || t.includes('first'))) {
    return 'Please sign in first, then try again.';
  }
  if (t.includes('no session') || t.includes('no token') || t.includes('not signed in')) {
    return 'You are not signed in. Please sign in and try again.';
  }
  if (t.includes('not available') || t.includes('unavailable') || t.includes('store')) {
    return 'In-app purchases are not available right now. Please try again later.';
  }
  if (t.includes('rate limit') || t.includes('too many')) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  /* Iter v143 (2026-06-24): pass-through voor reeds-user-friendly messages.
     Detectie: korte string (<140 char), geen stack-trace markers, geen
     opaque codes/IDs. Voorkomt dat onze eigen vriendelijke errors (uit
     auth.ts, restore-purchases.ts, etc.) onnodig worden weggegooid. */
  const looksFriendly =
    raw.length < 140 &&
    !/[{}<>]/.test(raw) &&
    !/\b[a-f0-9]{16,}\b/i.test(raw) &&
    !raw.includes('Error:') &&
    !raw.includes('at ') &&
    !raw.match(/^[A-Z_]+$/);
  if (looksFriendly) return raw;
  /* Onbekend & niet pass-through-veilig → safe default. */
  return 'Something went wrong. Please try again — or contact support if it keeps happening.';
}

export default function SubscribeScreen() {
  const params = useLocalSearchParams<{ tier?: string; devForceSignedIn?: string }>();
  const tier: AudioTier = params.tier === 'monthly' ? 'monthly' : 'yearly';
  /* Iter 9dq v77 (2026-06-03): safe-area-aware bottom padding zodat
     de Continue/Create-account knop nooit onder de Samsung 3-button
     nav valt. Floor 72 = consistent met alle andere bottom-CTAs. */
  const safeInsets = useSafeAreaInsets();
  const scrollBottomPadding = Math.max(safeInsets.bottom + 24, 72);
  /* Iter 9dq v69 (2026-06-03): dev-only param om de signed-in review-
     flow te kunnen previewen zonder een echt test-account te hoeven
     aanmaken. Geactiveerd via Settings → Developer · screen previews →
     "Subscribe — signed-in review". Productie negeert deze param
     (geguard met __DEV__). */
  const devForceSignedIn =
    __DEV__ && params.devForceSignedIn === '1';

  const { getProduct, purchase, loading: iapLoading } = useIAP();
  const product = getProduct(tier);
  /* Iter v160 (2026-06-27): VERWIJDERD orderSaveLabel (verzonnen SAVE %
     berekening). Operator-correctie: 'bezoeker moet altijd zien wat hij
     effectief betaalt — geen verzonnen besparing-claims'. Review-card
     toont nu alleen de prijs die de klant betaalt. */
  const orderSaveLabel = '';

  /* Iter 9dq v142 (2026-06-23): default mode is 'signup' bij echte first-
     timers, maar pre-fillen we straks de email + flippen we naar 'signin'
     wanneer er al een eerder gebruikt e-mailadres in storage staat — dat is
     de overgrote meerderheid van returning users. Voorkomt dat ze worden
     gevraagd om een account te "maken" voor een email die ze al hebben. */
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  /* Iter v145 (2026-06-25): raw IAP error info voor diagnose. Operator
     krijgt op het error-scherm de rauwe code + message te zien wanneer
     IAP faalt — anders weten we nooit waarom Google Play niet wil
     verkopen (license tester, product status, config, etc.). Klein en
     dim ondercroten — niet primair UI maar wel zichtbaar voor copy-
     pasten naar support of debugging. */
  const [errDebug, setErrDebug] = useState<string | null>(null);

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
      /* Dev-shortcut: render review-flow met fake email zonder echte
         token check. Alleen __DEV__ — productie negeert. */
      if (devForceSignedIn) {
        setSignedIn(true);
        setSignedInEmail('dev-preview@vibezcore.local');
        return;
      }
      const t = await getToken();
      if (cancelled) return;
      if (t) {
        setSignedIn(true);
        const e = await getUserEmail();
        if (cancelled) return;
        setSignedInEmail(e);
        return;
      }
      setSignedIn(false);
      /* Iter 9dq v142: returning user (heeft eerder al ingelogd op dit
         toestel) → pre-fill email + default naar 'signin' mode. Voorkomt
         dat ze worden gevraagd een account te "maken" voor een email die
         ze al hebben. Eerste echte first-timers (geen LAST_EMAIL_KEY) zien
         de standaard 'signup' mode. */
      const lastEmail = await getLastLoginEmail();
      if (cancelled) return;
      if (lastEmail) {
        setEmail(lastEmail);
        /* Iter v150 (2026-06-25): pre-fill email maar BLIJF in signup-mode
           omdat user via pricing CTA komt (intent = kopen, niet inloggen).
           Operator-feedback: 'Sign in to subscribe' suggereerde verkeerd
           dat hij MOET inloggen. Tabs bovenaan laten hem alsnog switchen
           als hij wel een bestaand account heeft. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [devForceSignedIn]);

  /* Iter v144 (2026-06-24): IAP-specifieke error mapping. friendlyError()
     mapt rauwe strings naar leesbare tekst, maar IAP-errors hebben een
     gestructureerde `code` die we explicieter kunnen vertalen — operator
     krijgt nu te zien WAAROM de aankoop niet doorging ipv een blanco
     "Something went wrong".

     Speciale aandacht voor `unavailable` (ItemUnavailable/SkuNotFound):
     dit is wat een net-toegevoegde Google Play license-tester ziet
     gedurende de propagatie-window (kan tot 24h duren). */
  const iapErrorMessage = (code: string, rawMessage: string): string => {
    if (code === 'network') {
      return "We couldn't reach the store. Check your connection and try again.";
    }
    if (code === 'unavailable') {
      return Platform.OS === 'android'
        ? "This subscription isn't available on this device yet. If you were just added as a license tester, this can take up to 24 hours. Otherwise, please contact support."
        : "This subscription isn't available right now. Please try again later.";
    }
    if (code === 'already_owned') {
      return 'You already own this subscription. Tap "Already subscribed? Restore purchases" below to activate it on this device.';
    }
    /* Onbekende codes → val terug op friendlyError voor consistentie. */
    return friendlyError(rawMessage);
  };

  /* ── Sub-flow: account-create wanneer nodig, dan IAP popup ─── */
  const runIapFlow = async () => {
    setErrMsg(null);
    setPhase('iap-popup');
    /* Iter v166 (2026-06-27): defensive RC user-link direct vóór de purchase.
       authSignup/authLogin koppelen al na sessie-persist, maar deze flow kan
       ook worden bereikt door een ingelogde user die /subscribe direct opent
       (auth.ts linkRevenueCatUser niet recent gefired). Een dubbele logIn-
       call is idempotent in RevenueCat SDK — kosten = ~500ms extra latency,
       baten = ZEKERHEID dat de purchase op de Supabase user attribute'd
       wordt en niet op een lingering $RCAnonymousID. */
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getAuthUserIdFromToken, getToken, linkRevenueCatUser } =
        require('@/services/auth');
      const token = await getToken();
      if (token) {
        const authUserId = getAuthUserIdFromToken(token);
        if (authUserId) await linkRevenueCatUser(authUserId);
      }
    } catch {
      /* swallow — non-fatal; purchase may still succeed and webhook will
         eventually correct via TRANSFER event when user re-opens app. */
    }
    const result = await purchase(tier);
    if (!result.ok) {
      if (result.error.code === 'user_cancelled') {
        /* User wegtikte de popup → terug naar form-state, geen error
           tonen (cancelled is expliciete actie, geen fout). */
        setPhase('form');
        return;
      }
      if (__DEV__) {
        console.warn(
          '[subscribe] purchase failed:',
          result.error.code,
          result.error.message,
        );
      }
      setErrMsg(iapErrorMessage(result.error.code, result.error.message));
      setErrDebug(`code=${result.error.code} · ${result.error.message || '(no message)'}`);
      setPhase('error');
      return;
    }
    await verifyAndComplete(result.purchase);
  };

  const verifyAndComplete = async (purchaseData: IapPurchase) => {
    setPhase('verifying');

    /* Iter v148 (2026-06-25): drie-laagse robuustheid voor de aankoop-
       verificatie zodat een transient hiccup nooit een betalende user
       achterlaat zonder PRO.

       Laag 1 — verifyWithRetry: inline 3x retry met exponential backoff
                                 (1s, 2s, 4s). Dekt 95% van failures.
       Laag 2 — queuePendingVerify: bij retriable final failure → opslaan
                                    in AsyncStorage. App-startup recovery
                                    pakt het later op.
       Laag 3 — acknowledge: pas finishTransaction() NA succesvolle
                             backend activate. Behoudt Google Play's
                             eigen retry-mechanisme als laatste vangnet. */
    /* Iter v164 (2026-06-27): RevenueCat customerInfo is bron-van-waarheid.
       Voorheen stuurden we purchaseData.receiptToken naar /api/iap-verify
       wat een raw Google purchase token verwachtte. RevenueCat geeft echter
       z'n eigen transactionIdentifier terug — Google's verify API geeft 400
       (invalid_receipt google_400) op die identifier. Resultaat: échte
       betaling lukte, maar app activate'de niet → user kwam niet in PRO.

       RevenueCat heeft de receipt al server-to-server bij Google
       gevalideerd vóór hij customerInfo teruggeeft. We vertrouwen die
       bron-van-waarheid: als customerInfo.entitlements.active['audio_pro']
       bestaat, dan ÍS de user PRO. */
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Purchases = require('react-native-purchases').default;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ENTITLEMENT_AUDIO_PRO } = require('@/services/iap-real');
      const customerInfo = await Purchases.getCustomerInfo();
      const isPro = !!customerInfo?.entitlements?.active?.[ENTITLEMENT_AUDIO_PRO];

      if (isPro) {
        /* Acknowledge bij store zodat de purchase niet na 3 dagen wordt
           gerefund. RevenueCat doet dit eigenlijk al automatisch, maar
           we behouden onze eigen acknowledge() voor symmetrie. */
        try {
          await getIAP().acknowledge(purchaseData.transactionId);
        } catch {
          /* swallow — non-fatal */
        }
        refreshSubscription();
        setPhase('done');
        setTimeout(() => router.replace('/'), 1200);
        return;
      }

      /* Edge case: customerInfo zegt geen entitlement. Kan gebeuren bij
         cross-platform sync race-condition. Queue voor app-startup
         recovery (zelfde mechanisme als voorheen). */
      await queuePendingVerify(purchaseData);
      setErrMsg(
        "Your purchase went through, but we couldn't confirm it just now. " +
          "We'll finish setting up your subscription automatically the next " +
          'time you open the app. No action needed.',
      );
      setErrDebug(`entitlement · queued · audio_pro inactive after purchase`);
      setPhase('error');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      /* getCustomerInfo zelf gefaald (network, SDK-error). Behandel als
         retriable — startup recovery pakt 'm later op. */
      if (__DEV__) console.warn('[subscribe] customerInfo fetch failed:', e);
      await queuePendingVerify(purchaseData);
      setErrMsg(
        "Your purchase went through, but we couldn't confirm it just now. " +
          "We'll finish setting up your subscription automatically the next " +
          'time you open the app. No action needed.',
      );
      setErrDebug(`entitlement · queued · ${e?.message ?? String(e)}`);
      setPhase('error');
    }

    /* Verwijderd: outcome-based retry/permanent split die op het oude
       verifyWithRetry result rustte. Niet meer relevant — RevenueCat
       customerInfo is binary (PRO of niet) en server-side al gevalideerd. */
  };

  const onSubmit = async () => {
    setErrMsg(null);
    if (!email.trim() || !pw) {
      setErrMsg('Enter your email and password.');
      return;
    }
    /* Iter v144 (2026-06-24): strikte email-validatie vóór submit. Voorkomt
       incident waarbij `name@gmail.comn` (typo) door Supabase werd
       geaccepteerd → account aangemaakt → IAP faalde → user vast in een
       onbruikbaar account. Bij signup ÉN signin van toepassing — een typo
       in signin maakt evenmin zin (krijgt sowieso "wrong credentials"). */
    const v = validateEmail(email);
    if (v.ok === false) {
      setErrMsg(
        v.reason === 'format'
          ? "That email address doesn't look right — check the spelling."
          : 'Enter your email address.',
      );
      return;
    }
    if (v.ok === 'maybe') {
      /* Format is technisch geldig maar lijkt op een bekende typo.
         Tonen we als waarschuwing + suggestion onder het email-veld
         (live hint); hier in onSubmit BLOKKEREN we omdat dit altijd
         een typo blijkt te zijn in praktijk (gmial→gmail, .comn→.com).
         User moet de suggestion tappen of de email handmatig corrigeren. */
      setErrMsg(`Did you mean ${v.suggestion}? Tap the suggestion above to fix.`);
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
      if (__DEV__) console.warn(`[subscribe] ${mode} failed (raw):`, r.error);
      /* Iter 9dq v142: signup → "already exists" → auto-switch naar signin
         mode met email behouden + lege password. User hoeft niet zelf de
         toggle te zoeken — de UI doet wat hij toch al ging doen. */
      const t = String(r.error || '').toLowerCase();
      if (
        mode === 'signup' &&
        t.includes('already') &&
        (t.includes('exist') || t.includes('registered'))
      ) {
        setMode('signin');
        setPw('');
        setErrMsg('You already have an account — sign in with your password.');
        setPhase('form');
        return;
      }
      setErrMsg(friendlyError(r.error));
      setPhase('form');
      return;
    }
    /* Audit-fix C5+C6 toegepast: bucket-switch AWAIT vóór we verder gaan,
       anders kan een snelle IAP-trigger nog naar de oude bucket schrijven. */
    await Promise.all([refreshBraceletBucket(), refreshAudioBucket()]);
    refreshSubscription();
    /* Iter v144: na geslaagde signup/signin de lokale signedIn-state ook
       updaten. Zonder dit toont het error-scherm (als IAP daarna faalt) de
       "user is gast"-tekst terwijl het account wèl is aangemaakt. Met deze
       update kan de error-recovery flow expliciet zeggen "Je account
       bestaat — probeer Subscribe later opnieuw vanuit Account". */
    setSignedIn(true);
    setSignedInEmail(email.trim());

    /* Iter v153 (2026-06-25): operator-feedback — na signin met een
       BESTAAND PRO-account moet de user direct naar de Audio Library
       worden geleid (entitlement-aware routing), NIET door de IAP-popup
       die alleen verwarrend is voor iemand die al betaalt. */
    if (mode === 'signin') {
      try {
        const token = await getToken();
        if (token) {
          const res = await fetch(`${VZ_BACKEND_URL}/api/subscription-status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const status = await res.json().catch(() => ({}));
            if (status?.active === true) {
              router.replace('/');
              return;
            }
          }
        }
      } catch {
        /* fetch failed — val terug op IAP flow. */
      }
    }

    /* Door naar IAP-popup. */
    void runIapFlow();
  };

  /* Iter 9dq v142: forgot-password link → externe pagina op vibezcore.com.
     Geen in-app reset-flow (backend ondersteunt 'm nog niet) maar wel een
     duidelijke uitweg voor users die hun wachtwoord kwijt zijn. Operator
     kan op vibezcore.com/reset-password een Supabase password-reset email
     triggeren via een simpel formulier. */
  const onForgotPassword = () => {
    const target = email.trim()
      ? `${VZ_BACKEND_URL}/reset-password?email=${encodeURIComponent(email.trim())}`
      : `${VZ_BACKEND_URL}/reset-password`;
    void Linking.openURL(target).catch(() => {
      void showVibezAlert({
        title: 'Reset password',
        message: `Open this link in your browser to reset your password:\n\n${target}`,
      });
    });
  };

  /* Iter v142: social sign-in beschikbaarheid. Google = synchroon check op
     web client ID. Apple = async (native isAvailableAsync). */
  const googleAvailable = isGoogleSignInAvailable();
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const a = await isAppleSignInAvailable();
      if (!cancelled) setAppleAvailable(a);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onGoogleSignIn = async () => {
    setErrMsg(null);
    setErrDebug(null);
    setPhase('creating-account');
    const r = await signInWithGoogle();
    if (!r.ok) {
      if (r.reason === 'cancelled') {
        setPhase('form');
        return;
      }
      if (__DEV__) console.warn('[subscribe] Google sign-in failed:', r.reason, r.error);
      setErrMsg(friendlyError(r.error));
      /* Iter v153 (2026-06-25): raw reason+error zichtbaar voor diagnose.
         Operator vroeg om de raw error te kunnen lezen — friendlyError()
         zegt alleen 'Something went wrong' en verbergt de echte oorzaak
         (SHA-1 mismatch, Web Client ID config, OAuth consent screen,
         network, etc.). Net als bij IAP errors — selectable monospace. */
      setErrDebug(`google · reason=${r.reason} · ${r.error || '(no message)'}`);
      setPhase('form');
      return;
    }
    await Promise.all([refreshBraceletBucket(), refreshAudioBucket()]);
    refreshSubscription();
    /* Iter v144: zelfde signedIn-state update als bij email/password
       signup zodat het error-scherm de juiste recovery-flow toont. */
    setSignedIn(true);
    if (r.email) setSignedInEmail(r.email);

    /* Iter v153: entitlement-aware routing — als de Google-user al PRO
       is, skip IAP popup en direct naar Audio Library. Google sign-in
       is by-design hetzelfde voor signup als signin — Supabase verifieert
       de id_token en maakt-of-vindt de user. Dus check ALTIJD. */
    try {
      const token = await getToken();
      if (token) {
        const res = await fetch(`${VZ_BACKEND_URL}/api/subscription-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const status = await res.json().catch(() => ({}));
          if (status?.active === true) {
            router.replace('/');
            return;
          }
        }
      }
    } catch {
      /* fall through to IAP flow */
    }

    void runIapFlow();
  };

  const onAppleSignIn = async () => {
    setErrMsg(null);
    setErrDebug(null);
    setPhase('creating-account');
    const r = await signInWithApple();
    if (!r.ok) {
      if (r.reason === 'cancelled') {
        setPhase('form');
        return;
      }
      if (__DEV__) console.warn('[subscribe] Apple sign-in failed:', r.reason, r.error);
      setErrMsg(friendlyError(r.error));
      /* Iter v153: raw reason+error zichtbaar voor diagnose (zelfde als Google). */
      setErrDebug(`apple · reason=${r.reason} · ${r.error || '(no message)'}`);
      setPhase('form');
      return;
    }
    await Promise.all([refreshBraceletBucket(), refreshAudioBucket()]);
    refreshSubscription();
    setSignedIn(true);
    if (r.email) setSignedInEmail(r.email);

    /* Iter v153: entitlement-aware routing — zelfde als Google flow. */
    try {
      const token = await getToken();
      if (token) {
        const res = await fetch(`${VZ_BACKEND_URL}/api/subscription-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const status = await res.json().catch(() => ({}));
          if (status?.active === true) {
            router.replace('/');
            return;
          }
        }
      }
    } catch {
      /* fall through to IAP flow */
    }

    void runIapFlow();
  };

  /* ── Render ─────────────────────────────────────────────────────── */

  const tierLabel = tier === 'yearly' ? 'Yearly' : 'Monthly';
  const priceLabel = product?.localizedPrice ?? (tier === 'yearly' ? '€69,99' : '€9,99');
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
    /* Iter v157 (2026-06-26): operator-correctie. Verwijderd: 'You're in'
       success-framing bij IAP fail. Per operator-spec: 'ingelogd en free
       account bestaat niet — zodra er een account is moet er iets aan
       gekoppeld zijn (audio, bracelet, of beide)'. Een dangling account
       zonder entitlement is een UX-bug, geen feature.

       Nieuwe regel: ELKE IAP-fail toont error-screen met retry als
       primary CTA. Geen 'free environment' troostprijs meer. */
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen options={{ title: 'Subscribe', headerBackTitle: 'Back' }} />
        <View style={s.center}>
          <View style={s.errorCircle}>
            <Text style={s.errorText}>!</Text>
          </View>
          <Text style={s.busyTitle}>Something went wrong</Text>
          <Text style={s.busySub}>{errMsg ?? 'Please try again.'}</Text>

          {errDebug && (
            <Text selectable style={s.debugInfo}>
              {errDebug}
            </Text>
          )}

          <Pressable
            style={s.btnPrimary}
            onPress={() => {
              setErrMsg(null);
              setErrDebug(null);
              setPhase('form');
            }}
          >
            <Text style={s.btnPrimaryText}>Try again</Text>
          </Pressable>

          <Pressable
            style={s.linkBtn}
            onPress={() => {
              void Linking.openURL(
                SUPPORT_URL,
              );
            }}
          >
            <Text style={s.linkText}>Contact support</Text>
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
      {/* Iter v160 (2026-06-27): orderSave label verwijderd — geen
          verzonnen 'Save 42%' meer. Klant ziet alleen de werkelijke
          prijs in priceLabel hierboven. */}
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

  /* Iter 9dq v86 (2026-06-03): Restore-purchases link — Apple App Review
     Guideline 3.1.1 vereist deze knop. Onder de legal-line zodat 'ie
     beschikbaar is voor terugkerende users zonder de upsell te onderbreken. */
  const handleRestore = async () => {
    const result = await restorePurchases();
    if (result.ok) {
      if (result.restoredCount > 0) {
        void showVibezAlert({
          title: 'Subscription restored',
          message: `${result.restoredCount} active subscription${result.restoredCount === 1 ? '' : 's'} restored — opening your library.`,
          buttons: [{ text: 'OK', onPress: () => router.replace('/') }],
        });
      } else {
        void showVibezAlert({
          title: 'Nothing to restore',
          message:
            'No active subscriptions were found for this Apple ID or Google account.',
        });
      }
    } else {
      if (__DEV__) console.warn('[subscribe] restore failed (raw):', result.error);
      void showVibezAlert({
        title: 'Could not restore',
        message: friendlyError(result.error),
      });
    }
  };
  const RestoreLink = (
    <Pressable
      style={s.restoreLink}
      onPress={() => void handleRestore()}
      accessibilityLabel="Restore previous purchases"
    >
      <Text style={s.restoreLinkText}>Already subscribed? Restore purchases</Text>
    </Pressable>
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
          contentContainerStyle={[s.scroll, { paddingBottom: scrollBottomPadding }]}
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
          {RestoreLink}
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

        {/* Iter v150 (2026-06-25): operator-feedback — copy was verwarrend
            voor users die via pricing CTA komen ("ik kom om te kopen,
            waarom moet ik inloggen?"). Nu één duidelijke heading +
            prominente mode-tabs zodat user direct ziet dat er twee
            paden zijn: nieuwe account OF bestaande. */}
        <Text style={s.heading}>One step from your subscription</Text>
        <Text style={s.sub}>
          Create a new account or sign in to your existing one. We need
          this to link your purchase to your library.
        </Text>

        <View style={s.modeTabsWrap}>
          <Pressable
            style={[s.modeTab, mode === 'signup' && s.modeTabActive]}
            onPress={() => {
              setErrMsg(null);
              setMode('signup');
            }}
          >
            <Text
              style={[
                s.modeTabText,
                mode === 'signup' && s.modeTabTextActive,
              ]}
            >
              New account
            </Text>
          </Pressable>
          <Pressable
            style={[s.modeTab, mode === 'signin' && s.modeTabActive]}
            onPress={() => {
              setErrMsg(null);
              setMode('signin');
            }}
          >
            <Text
              style={[
                s.modeTabText,
                mode === 'signin' && s.modeTabTextActive,
              ]}
            >
              I have an account
            </Text>
          </Pressable>
        </View>

        {/* Iter v142: Social sign-in knoppen (Google / Apple).
            Bovenaan zodat 't de eerste optie is — één tap, geen
            wachtwoord. Email/password blijft beschikbaar onder de
            "or"-divider voor users die geen Google/Apple-account willen
            gebruiken of er geen hebben. */}
        {(googleAvailable || appleAvailable) && (
          <View style={s.socialBlock}>
            {appleAvailable && (
              <Pressable
                style={[s.socialBtn, s.socialBtnApple]}
                onPress={() => void onAppleSignIn()}
              >
                <Text style={s.socialBtnIconApple}></Text>
                <Text style={s.socialBtnTextApple}>Continue with Apple</Text>
              </Pressable>
            )}
            {googleAvailable && (
              <Pressable
                style={[s.socialBtn, s.socialBtnGoogle]}
                onPress={() => void onGoogleSignIn()}
              >
                <Text style={s.socialBtnIconGoogle}>G</Text>
                <Text style={s.socialBtnTextGoogle}>Continue with Google</Text>
              </Pressable>
            )}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>
          </View>
        )}

        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (errMsg) setErrMsg(null);
          }}
          placeholder="you@example.com"
          placeholderTextColor={Brand.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />

        {/* Iter v144: live email-feedback. Toont niets bij leeg veld; bij
            valid format → groen "Looks good"; bij typo → tap-baar
            "Did you mean X?" suggestion; bij format-fout → rood. */}
        {(() => {
          if (!email.trim()) return null;
          const v = validateEmail(email);
          const hint = emailHintText(v);
          if (!hint.text) return null;
          const tone =
            hint.tone === 'success'
              ? s.emailHintSuccess
              : hint.tone === 'warn'
                ? s.emailHintWarn
                : hint.tone === 'error'
                  ? s.emailHintError
                  : s.emailHintDim;
          if (v.ok === 'maybe' && v.reason === 'typo') {
            return (
              <Pressable
                onPress={() => {
                  setEmail(v.suggestion);
                  if (errMsg) setErrMsg(null);
                }}
                style={s.emailHintTap}
                accessibilityLabel={`Use suggested email ${v.suggestion}`}
              >
                <Text style={[s.emailHintBase, tone]}>
                  {hint.text}
                </Text>
                <Text style={s.emailHintAction}>Tap to use it</Text>
              </Pressable>
            );
          }
          return <Text style={[s.emailHintBase, tone]}>{hint.text}</Text>;
        })()}

        <Text style={s.label}>Password</Text>
        <View style={s.pwWrap}>
          <TextInput
            style={[s.input, s.pwInput]}
            value={pw}
            onChangeText={(v) => {
              setPw(v);
              if (errMsg) setErrMsg(null);
            }}
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

        {/* Iter 9dq v134 (2026-06-14): live password-hint voor signup. Begint
            dim, wordt success-groen zodra de 8-char drempel is gehaald. Geen
            tekstuele claim over "strength" — alleen lengte, want we eisen
            niet meer (operator-policy: geen friction op signup). */}
        {mode === 'signup' && pw.length > 0 && (
          <Text style={[s.pwHint, pw.length >= 8 && s.pwHintMet]}>
            {pw.length >= 8
              ? 'Looks good'
              : `${pw.length}/8 characters`}
          </Text>
        )}

        {/* Iter 9dq v142: Forgot-password link onder password-veld, alleen
            in signin mode (signup heeft geen wachtwoord om te resetten). */}
        {mode === 'signin' && (
          <Pressable
            style={s.forgotLink}
            onPress={onForgotPassword}
            hitSlop={6}
          >
            <Text style={s.forgotLinkText}>Forgot password?</Text>
          </Pressable>
        )}

        {errMsg && <Text style={s.err}>{errMsg}</Text>}

        {/* Iter v153: raw debug-info bij signin/Google-failures zodat
            operator/support de echte oorzaak kan zien (SHA-1 mismatch,
            OAuth config, etc.) ipv alleen 'Something went wrong'. */}
        {errDebug && (
          <Text selectable style={s.debugInfo}>
            {errDebug}
          </Text>
        )}

        <Pressable style={s.btnPrimary} onPress={onSubmit}>
          <Text style={s.btnPrimaryText}>
            {mode === 'signup' ? 'Create account & continue' : 'Sign in & continue'}
          </Text>
        </Pressable>

        {/* Iter v150: toggle-link onderaan weggehaald — mode-tabs bovenaan
            zijn nu de primaire wisselaar. Voorkomt twee plekken die
            hetzelfde doen (operator-feedback: 'is heel onduidelijk
            deze sectie'). */}

        {LegalLine}
        {RestoreLink}
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
  /* Iter v150 (2026-06-25): mode-tabs voor signup/signin keuze. */
  modeTabsWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 4,
    marginTop: 8,
    marginBottom: 18,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: Brand.accent,
  },
  modeTabText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
  },
  modeTabTextActive: {
    color: '#ffffff',
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
  pwHint: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    marginTop: 8,
  },
  pwHintMet: {
    color: Brand.success,
  },
  /* Iter v144: email-hint styles. Mirror van pwHint maar met tonen voor
     success / warn (typo) / error (format) / dim (neutraal). */
  emailHintBase: {
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    marginTop: 8,
  },
  emailHintSuccess: { color: Brand.success },
  emailHintWarn: { color: '#ffb450' },
  emailHintError: { color: Brand.error },
  emailHintDim: { color: Brand.textDim },
  emailHintTap: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,180,80,0.10)',
    borderColor: 'rgba(255,180,80,0.35)',
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  emailHintAction: {
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#ffb450',
    marginTop: 2,
  },
  /* Forgot-password link onder password-veld (alleen in signin mode).
     Klein, dim, rechts uitgelijnd zodat 't niet competeert met de primary
     "Sign in & continue" knop maar wel zichtbaar is voor wie 't nodig heeft. */
  forgotLink: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  forgotLinkText: {
    color: Brand.accent,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.1,
    textDecorationLine: 'underline',
  },
  /* Social sign-in block — boven email/password form. Apple knop volgt
     Apple HIG (zwart, witte tekst). Google knop volgt Google's branding
     (witte achtergrond, donkere tekst, gekleurde G). Beide vol-breed +
     gap zodat ze tap-targets van >=48dp halen (a11y). */
  socialBlock: {
    marginTop: 4,
    marginBottom: 4,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  socialBtnApple: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  socialBtnGoogle: {
    backgroundColor: '#ffffff',
  },
  socialBtnIconApple: {
    color: '#ffffff',
    fontSize: 18,
    marginRight: 10,
    /* Apple-glyph komt direct uit het Unicode  symbool. Past op iOS
       altijd, op Android valt 't terug op een visueel-vergelijkbaar
       icoon van de system font. */
  },
  socialBtnIconGoogle: {
    color: '#4285F4',
    fontSize: 18,
    fontFamily: BrandFonts.extrabold,
    marginRight: 10,
    /* Single-letter "G" placeholder. Voor échte Google-brand-compliant
       knop zou je 't 4-kleurige G-logo SVG moeten gebruiken; voor MVP
       is dit acceptabel (geen brand violation). */
  },
  socialBtnTextApple: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.1,
  },
  socialBtnTextGoogle: {
    color: '#1f1f1f',
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.1,
  },
  /* "or" divider tussen social en email/password. Twee lijntjes met de
     tekst gecentreerd ertussen. Conventioneel patroon op login-schermen. */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Brand.border,
  },
  dividerText: {
    marginHorizontal: 12,
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
  /* Iter 9dq v86 (2026-06-03): Restore-purchases link. Subtiel onder
     legal-line, accent-kleur zodat de tap-affordance duidelijk is
     maar zonder upsell-momentum te onderbreken. */
  restoreLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  restoreLinkText: {
    color: Brand.accent,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
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
  /* Iter v144: recovery-note voor "signup OK maar IAP failed" pad.
     Toont het email-adres + reassurance dat account bestaat. */
  recoveryNote: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 4,
    maxWidth: 360,
    width: '100%',
  },
  recoveryNoteLabel: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  recoveryNoteEmail: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    marginBottom: 8,
  },
  recoveryNoteText: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 17,
  },
  /* Iter v145: raw debug-info — monospace, dim, selectable. Bedoeld voor
     diagnose (operator/support kunnen exact zien wat Google Play of de
     verify-server teruggaf). Niet primary UI maar zichtbaar. */
  debugInfo: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 12,
    paddingHorizontal: 12,
    textAlign: 'center',
    maxWidth: 360,
  },
});
