/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Account tab

   Optional. NOT a wall (gast-first §1). Guests use the whole app without an
   account; an account is only needed for full audio or (later) bracelet
   activation. Hooks the EXISTING proven auth.ts (unchanged backend).
   Login + signup both present (bracelet will require an account — §1/§2).

   Uiterlijk: MERK_ANKER — Brand-palet, Inter via _layout, wordmark in
   signed-out header (vervangt platte tekst "VIBEZCORE").
   ─────────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { refreshSubscription, useSubscription } from '@/hooks/useSubscription';
import { refreshUserBucket as refreshBraceletBucket } from '@/utils/bracelet-history';
import { refreshUserBucket as refreshAudioBucket } from '@/utils/user-bucket';

/* Iter 9dq v44 (2026-06-03): bij elke sign-in/out moeten ZOWEL de
   bracelet-bucket als de audio-bucket (history, favorites, positions)
   her-evalueren naar de nieuwe user. Beide gebruiken dezelfde bucket-
   resolutie (override of JWT sub) en triggeren cache-reload bij
   bucket-switch.

   Iter 9dq v55 (2026-06-03, audit-finding C5+C6): functie maakt nu
   ECHT async en wordt voor navigatie geawait. Voorheen fire-and-forget
   → race-window waarin user na sign-in al naar Audio Library was
   genavigeerd terwijl de bucket nog 'anon' was → een toggle in dat
   window schreef naar 'vzf_anon_v1' (visible voor de volgende anon
   user op het device). Door te awaiten weten we dat de bucket switch
   compleet is voor de UI verder gaat. */
async function refreshUserBucket(): Promise<void> {
  await Promise.all([refreshBraceletBucket(), refreshAudioBucket()]);
}
import {
  awaitDevUserOverrideLoaded,
  getDevUserOverride,
  setDevBraceletActivated,
  setDevUserOverride,
  useBraceletOwner,
  useDevBraceletActivated,
  useDevUserOverride,
} from '@/utils/dev-user-override';
import {
  storeSubscriptionsUrl,
} from '@/services/subscription-actions';
import { restorePurchases } from '@/services/restore-purchases';
import { clearSignedUrlCache } from '@/utils/audio-url';
import { clearLastPlayed } from '@/utils/last-played';
import { validateEmail, emailHintText } from '@/utils/validate-email';
import {
  consumeScrollIntent,
  requestScrollTo,
  subscribeScrollIntent,
} from '@/utils/scroll-intent';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    clearSession,
    deleteAccount,
    getLastLoginEmail,
    getToken,
    getUserEmail,
    login,
    signup,
} from '../../services/auth';
import {
    isAppleSignInAvailable,
    isGoogleSignInAvailable,
    signInWithApple,
    signInWithGoogle,
} from '@/services/social-auth';

type Mode = 'login' | 'signup';

/* Externe URL voor bracelet-purchase (operator-keuze 2026-05-26).
   Webapp shop covered ook Kickstarter-reservering pre-launch en
   reguliere purchase post-launch — één URL voor beide stadia. */
const BRACELET_SHOP_URL = 'https://www.vibezcore.com/shop';

/* Support-form op de webapp (Wix). Geen native endpoint nodig — link out. */
const SUPPORT_URL = 'https://www.vibezcore.com/support';

/* Forgot-password-flow draait volledig op de webapp (auth-flow met
   email-link → reset-password.html → webapp login). De native app
   linkt door zodat user 'm daar afhandelt en daarna terugkomt naar
   de Account-tab om in te loggen. */
const FORGOT_PASSWORD_URL = 'https://app.vibezcore.com/forgot-password.html';

/* Audio-library scrolt naar pricing-block via scroll-intent (`pricing`).
   Bestaand patroon — gebruikt al voor "library-settings"-link. */

/* External link helper — primair via WebBrowser (Custom Tab op Android,
   SFSafariViewController op iOS), fallback naar Linking wanneer
   WebBrowser cancelled wordt. Zelfde patroon als (tabs)/bracelet.tsx
   en (tabs)/index.tsx — bewust gedupliceerd ipv shared util omdat
   log-paden subtiel anders zijn per call-site. */
async function openExternal(url: string): Promise<void> {
  if (__DEV__) console.log('[VIBEZCORE] account openExternal →', url);
  try {
    const result = await WebBrowser.openBrowserAsync(url);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      if (__DEV__) console.log('[VIBEZCORE] WebBrowser cancelled — fallback Linking');
      await Linking.openURL(url);
    }
  } catch (e) {
    if (__DEV__) console.log('[VIBEZCORE] WebBrowser threw — fallback Linking:', e);
    await Linking.openURL(url);
  }
}

/* Subscription-card. Toont live PRO-status uit useSubscription()
   (= /api/subscription-status van backend). Drie render-paden:
     - isLoading      → "Checking…"
     - isPro=false    → "Free account" + upgrade-hint
     - isPro=true     → "PRO — Monthly/Yearly" + datum-regel
   Datum-formatting via toLocaleDateString('en-GB') → "16 June 2026". */
function SubscriptionCard() {
  const {
    isPro,
    tier,
    validUntil,
    willRenew,
    isLoading,
  } = useSubscription();
  /* Iter 9r: bracelet-ownership óók in account-card. Full PRO = audio
     PRO + bracelet owner → speciale "Full PRO" label. */
  const isBraceletOwner = useBraceletOwner();

  let bigText: string;
  let bigColor: string;
  let subText: string;

  if (isLoading) {
    bigText = 'Checking…';
    bigColor = Brand.textDim;
    subText = '';
  } else if (!isPro && !isBraceletOwner) {
    bigText = 'Free account';
    bigColor = Brand.text;
    subText = 'Upgrade for full library access';
  } else if (isPro && isBraceletOwner) {
    /* Full PRO — beide producten actief.
       Iter 9dq v49 (2026-06-03): operator-feedback — los "Full PRO"
       voelde te dun naast "Audio PRO — Yearly" voor audio-only. Pakket-
       scope nu inline in de bigText ("Full PRO — Audio + Bracelet")
       zodat de status zelf direct vertelt wat erin zit, geen 2e regel
       nodig om dezelfde info te dragen. subText hergebruikt vervolgens
       de renew/active-datum van het audio-deel (zelfde format als
       Audio-PRO-alleen), wat dus écht extra info toevoegt ipv echo. */
    bigText = 'Full PRO — Audio + Bracelet';
    bigColor = Brand.accent;
    if (validUntil) {
      const d = new Date(validUntil);
      if (!isNaN(d.getTime())) {
        const formatted = d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        subText = willRenew
          ? `Audio renews on ${formatted}`
          : `Audio active until ${formatted}`;
      } else {
        subText = '';
      }
    } else {
      subText = '';
    }
  } else if (isBraceletOwner) {
    /* Bracelet-only owner — geen audio sub. Operator-update 2026-05-30:
       wijst nu expliciet op wat er nog WEL kan: Audio Library toevoegen
       om het systeem compleet te maken. Niet "missing" framing maar
       "complete the system" — past bij VIBEZCORE's holistic-tone.
       Iter 9dq v94 (2026-06-03): label "Bracelet active" → "Bracelet PRO".
       Reden: "active" was verwarrend met de device-activation-state
       (geactiveerd vs niet-geactiveerd via code). "PRO" is symmetrisch
       met "Audio PRO" en duidelijk een entitlement-label, niet een
       link-status. Subscription-card praat over WAT JE BEZIT;
       BraceletCard praat over WAT GEKOPPELD IS. Verandering alleen
       in deze branche — andere staten (Free / Audio PRO / Full PRO)
       blijven ongewijzigd. */
    bigText = 'Bracelet PRO';
    bigColor = Brand.accent;
    subText = 'Audio Library not yet activated';
  } else {
    /* tier kan undefined zijn (defensief — backend zou dat niet
       moeten doen voor een active=true sub, maar we crashen er niet
       op). */
    const tierLabel =
      tier === 'yearly'
        ? 'Yearly'
        : tier === 'monthly'
          ? 'Monthly'
          : null;
    /* "Audio PRO" ipv "PRO" — disambigueert van Bracelet-bezit. Een user
       met alleen audio-sub moet zien dat dit hun AUDIO-product is, niet
       een algemene "PRO"-status (operator-keuze 2026-05-29). */
    bigText = tierLabel ? `Audio PRO — ${tierLabel}` : 'Audio PRO';
    bigColor = Brand.accent;

    /* Datum-regel — alleen als we een geldige validUntil hebben. */
    if (validUntil) {
      const d = new Date(validUntil);
      if (!isNaN(d.getTime())) {
        const formatted = d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        subText = willRenew
          ? `Renews on ${formatted}`
          : `Active until ${formatted}`;
      } else {
        subText = 'Active';
      }
    } else {
      subText = 'Active';
    }
  }

  /* CTA-paden afhankelijk van state — iter 9dq v150 (operator 2026-06-17):
       - Loading                  → geen CTA (anders flicker)
       - Free (geen products)     → "Upgrade to full library" → /subscribe
       - Bracelet-only            → "Add Audio Library" → /subscribe
       - PRO                      → "Manage subscription" → Apple/Google
                                    store-subscription-page (IAP-policy
                                    verplicht in-app manage-link).

     Voorheen was er een dubbel pad (Gumroad customer portal vs store-link),
     maar Gumroad is verwijderd uit de app — geen branching meer nodig.
     Apple eist altijd toegang tot manage-subscription voor PRO users. */
  const showUpgrade = !isLoading && !isPro;
  const showManageStore = !isLoading && isPro;
  const upgradeCtaText = isBraceletOwner
    ? 'Add Audio Library'
    : 'Upgrade to full library';
  const upgradeAccessibilityLabel = isBraceletOwner
    ? 'Add Audio Library to your bracelet'
    : 'Upgrade to full library access';

  return (
    <View style={s.card}>
      <Text style={s.label}>Subscription</Text>
      <Text style={[s.subBig, { color: bigColor }]}>{bigText}</Text>
      {subText ? <Text style={s.subSmall}>{subText}</Text> : null}
      {showUpgrade && (
        <Pressable
          style={s.cardCta}
          onPress={() => {
            requestScrollTo('pricing');
            router.navigate('/');
          }}
          accessibilityLabel={upgradeAccessibilityLabel}
        >
          <Text style={s.cardCtaText}>{upgradeCtaText}</Text>
          <Text style={s.cardCtaArrow}>→</Text>
        </Pressable>
      )}
      {showManageStore && (
        <Pressable
          style={s.cardCta}
          onPress={() => openExternal(storeSubscriptionsUrl())}
          accessibilityLabel="Manage your subscription in the App Store or Google Play"
        >
          <Text style={s.cardCtaText}>Manage subscription</Text>
          <Text style={s.cardCtaArrow}>→</Text>
        </Pressable>
      )}
    </View>
  );
}

/* BraceletCard (iter 9r) — bracelet-status block in Account.
   Operator-update 2026-05-30: non-owner state verwijderd. Reden:
   Account-tab is voor "wat heb ik / wat beheer ik", niet voor
   product-discovery. De Bracelet-tab handelt reservatie/info al af
   — duplicate "Reserve your bracelet" CTA in Account voelt als
   marketing-prik op de verkeerde plek.

   Iter 9dq v91 (2026-06-03): activation is een SUB-STAP binnen deze
   card, geen gate vóór deze card. Bracelet-owner ziet altijd:
     - Niet-geactiveerd : "Activate your bracelet" als primary CTA +
                          dim sub-text dat 't nog wacht op de code
     - Geactiveerd      : "Open Bracelet Control" + beadband-upsell
   Operator-rationale: "na aankoop en account aanmaken moet elke user
   altijd in PRO omgeving zitten" — Bracelet-card hoort bij PRO, alleen
   z'n binnenkant verschilt. */
function BraceletCard() {
  const isBraceletOwner = useBraceletOwner();
  const isActivated = useDevBraceletActivated();
  if (!isBraceletOwner) return null;

  /* Niet-geactiveerde owner — toon activate-prompt als primary action.
     User is wel PRO (heeft betaald) maar de bracelet is nog NIET aan
     dit account gekoppeld. Iter 9dq v93 (2026-06-03): label aangepast
     van "Bracelet ready" → "Activation required" + amber-kleur. Reden:
     "ready" suggereerde dat 't klaar voor gebruik was, terwijl er nog
     niets gelinkt is. Amber matched de PREVIEW-banner-tint en signaleert
     "wacht op actie van de user". */
  if (!isActivated) {
    return (
      <View style={s.card}>
        <Text style={s.label}>Bracelet</Text>
        <Text style={[s.subBig, { color: '#f59e0b' }]}>
          Activation required
        </Text>
        <Text style={s.subSmall}>
          Your bracelet is not yet linked to this account. Enter your
          12-character activation code to pair it.
        </Text>
        <Pressable
          style={s.cardCta}
          onPress={() => router.navigate('/activate-bracelet' as never)}
          accessibilityLabel="Activate your bracelet with a code"
        >
          <Text style={s.cardCtaText}>Activate your bracelet</Text>
          <Text style={s.cardCtaArrow}>→</Text>
        </Pressable>
      </View>
    );
  }

  /* Geactiveerde owner — volledige bracelet-card met control + beadband-
     upsell. */
  return (
    <View style={s.card}>
      <Text style={s.label}>Bracelet</Text>
      <Text style={[s.subBig, { color: Brand.accent }]}>
        Bracelet activated
      </Text>
      {/* Iter 9dq v79 (2026-06-03): copy was "paired and ready to use"
          maar voor pre-launch activatie-code users (Kickstarter sept 2026)
          is de hardware nog niet verzonden — "paired" misleidt. Bracelet-
          pagina's tonen nu een aparte PREVIEW-banner, dus hier alleen
          state-neutrale tekst over wat de user kan doen. */}
      <Text style={s.subSmall}>
        Open Bracelet to preview your modes and review your activation.
      </Text>
      <Pressable
        style={s.cardCta}
        /* Operator 2026-05-30: navigate naar /bracelet tab ipv push naar
           /bracelet-control stack-screen. Reden: navigatie was inconsistent
           — vanaf Account kreeg user een back-arrow naar Account, maar
           vanuit de tab geen exit-pad. Nu uniforme tab-flow: user gaat naar
           Bracelet tab waar BraceletControl inline rendert + tab-bar
           zichtbaar blijft voor uitstappen via andere tabs. */
        onPress={() => router.navigate('/bracelet' as never)}
        accessibilityLabel="Open bracelet control"
      >
        <Text style={s.cardCtaText}>Open Bracelet Control</Text>
        <Text style={s.cardCtaArrow}>→</Text>
      </Pressable>
      {/* Iter 9gg (operator-correctie): bracelet heeft VERVANGBARE bead-
          bands, geen "rechargeable edition". Klanten kunnen nieuwe
          beadbands bestellen (andere stones, vervanging). URL volgt
          van operator.
          Iter 9dq v85 (2026-06-03): styling fix — opacity:0.6 maakte de
          knop disabled-looking terwijl 't een actieve secondary-action
          is. Nu eigen subtieler outlined style (transparent bg, dim
          border) ipv de gevulde primary cardCta met fade. Tekst en
          arrow op accent-kleur zodat de tap-affordance duidelijk is. */}
      <Pressable
        style={s.cardCtaSecondary}
        onPress={() =>
          openExternal('https://www.vibezcore.com/shop/beadbands')
        }
        accessibilityLabel="Order new beadband"
      >
        <Text style={s.cardCtaSecondaryText}>Order new beadband</Text>
        <Text style={s.cardCtaSecondaryArrow}>→</Text>
      </Pressable>
    </View>
  );
}

/* Iter 9dq v91 (2026-06-03): losse ActivateBraceletCta verwijderd. Reden:
   operator-feedback "na aankoop+account moet user altijd in PRO omgeving
   zitten". Een aparte CTA naast de BraceletCard wekte de indruk dat
   bracelet-ownership pas na activation echt was. De activate-prompt zit
   nu IN BraceletCard zelf (als de niet-geactiveerde variant) zodat de
   user direct in z'n eigen PRO-card landt met de juiste sub-stap. */

/* Library-settings link. Vervangt de oude PlaybackSettingsCard die de
   auto-play-toggle inline had — die toggle is verhuisd naar Audio
   Library zelf (audio-ervaring-instelling, hoort visueel daar). Account
   houdt alleen deze "→"-link die de gebruiker direct op de toggle laat
   landen via scroll-intent + tab-switch. Werkt voor zowel guest als
   ingelogde users. */
function LibrarySettingsLink() {
  return (
    <Pressable
      style={s.linkCard}
      onPress={() => {
        /* requestScrollTo() fired het signal eerst (de listener in
           (tabs)/index.tsx subscribed al — bij live tab-switch zal die
           direct triggeren; bij cold start consumeert hij via
           consumeScrollIntent()). Dan router.navigate('/') switcht naar
           Library-tab. */
        requestScrollTo('library-settings');
        router.navigate('/');
      }}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
    >
      <View style={s.linkTextWrap}>
        <Text style={s.linkTitle}>Library settings</Text>
        <Text style={s.linkSub}>Auto-play and playback preferences</Text>
      </View>
      <Text style={s.linkArrow}>›</Text>
    </Pressable>
  );
}

export default function AccountScreen() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  /* Iter 9dq v17 (2026-06-02): dynamic safe-area inset. Voorheen had de
     ScrollView hardcoded paddingBottom: 48 wat op iOS 15+ devices met
     groot home-indicator (tot 34px) onvoldoende kon zijn. Met tab-bar
     (64px) eronder was 't praktisch ok, maar 't was niet future-proof.
     Nu dynamisch zodat content altijd boven safe-zone blijft. */
  const safeInsets = useSafeAreaInsets();

  /* Iter 9dq v110 (2026-06-04): scroll-ref voor signed-out KeyboardAware-
     ScrollView. Listent op scroll-intent 'account-top' (gefired vanuit
     Audio Library bottom "Sign in"-link) en scrollt naar top zodat de
     guest meteen de SIGN IN-card ziet i.p.v. een preserved scroll-
     positie van een vorige bezoek. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signedOutScrollRef = useRef<any>(null);
  useEffect(() => {
    const scrollToTop = () => {
      requestAnimationFrame(() => {
        signedOutScrollRef.current?.scrollToPosition?.(0, 0, false);
      });
    };
    /* Cold-start: intent kan al gezet zijn voordat deze listener leeft. */
    if (consumeScrollIntent() === 'account-top') {
      scrollToTop();
    }
    const unsub = subscribeScrollIntent((target) => {
      if (target === 'account-top') scrollToTop();
    });
    return unsub;
  }, []);

  const [mode, setMode] = useState<Mode>('login');
  const [emailInput, setEmailInput] = useState('');
  const [pwInput, setPwInput] = useState('');
  const [showPw, setShowPw] = useState(false);
  /* Iter 9dq v86 (2026-06-03): restore-purchases state. Apple/Google
     verplichten zo'n knop voor IAP-apps zodat users hun sub kunnen
     herstellen na reinstall of op een nieuw toestel. */
  const [restoring, setRestoring] = useState(false);

  /* Iter v149 (2026-06-25): social sign-in op de Account-tab login,
     mirror van subscribe.tsx. Eerder was social-auth alleen via
     /subscribe → inconsistent voor users die via Account willen inloggen
     zonder eerst een pricing-card te tikken. */
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
    setMsg(null);
    setBusy(true);
    try {
      const r = await signInWithGoogle();
      if (!r.ok) {
        if (r.reason === 'cancelled') return;
        setMsg(r.error);
        return;
      }
      setEmail(r.email || 'Signed in');
      setPwInput('');
      refreshSubscription();
      await refreshUserBucket();
      await clearLastPlayed();
      clearSignedUrlCache();
    } finally {
      setBusy(false);
    }
  };

  const onAppleSignIn = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const r = await signInWithApple();
      if (!r.ok) {
        if (r.reason === 'cancelled') return;
        setMsg(r.error);
        return;
      }
      setEmail(r.email || 'Signed in');
      setPwInput('');
      refreshSubscription();
      await refreshUserBucket();
      await clearLastPlayed();
      clearSignedUrlCache();
    } finally {
      setBusy(false);
    }
  };

  const onRestorePurchases = async () => {
    if (restoring) return;
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.ok) {
      if (result.restoredCount > 0) {
        Alert.alert(
          'Subscription restored',
          `${result.restoredCount} active subscription${result.restoredCount === 1 ? '' : 's'} restored to your account.`,
        );
      } else {
        Alert.alert(
          'Nothing to restore',
          'No active subscriptions were found for this Apple ID or Google account. If you believe this is wrong, contact support.',
        );
      }
    } else {
      Alert.alert('Could not restore', result.error);
    }
  };
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /* Iter 9dq v150 (operator 2026-06-17): gumroadSubscriberId weg —
     IAP-only, geen cancel-button meer in-app (Apple/Google handelen
     cancellation via storeSubscriptionsUrl). isProForActions blijft
     bestaan want andere code-paden checken hier nog op. */
  const { isPro: isProForActions } = useSubscription();

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) {
        setEmail((await getUserEmail()) || 'Signed in');
      } else {
        /* Niet ingelogd → pre-fill het email-veld met de laatst-gebruikte
           login-email als die bekend is. Overleeft explicit sign-out
           (vz_last_login_email persistent key). User hoeft alleen nog
           het wachtwoord te typen voor re-login. */
        const lastEmail = await getLastLoginEmail();
        if (lastEmail) setEmailInput(lastEmail);
      }
      setLoading(false);
    })();
  }, []);

  const onSubmit = async () => {
    setMsg(null);
    if (!emailInput.trim() || !pwInput) {
      setMsg('Enter your email and password.');
      return;
    }
    /* Iter v144 (2026-06-24): strikte email-validatie. Voorkomt incident
       waarbij typo-emails (`@gmail.comn`) een Supabase-account aanmaken
       dat de user nooit meer kan verifieren. Zelfde util als subscribe.tsx. */
    const v = validateEmail(emailInput);
    if (v.ok === false) {
      setMsg(
        v.reason === 'format'
          ? "That email address doesn't look right — check the spelling."
          : 'Enter your email address.',
      );
      return;
    }
    if (v.ok === 'maybe') {
      setMsg(`Did you mean ${v.suggestion}? Check spelling and try again.`);
      return;
    }
    setBusy(true);
    try {
      const fn = mode === 'login' ? login : signup;
      const r = await fn(emailInput.trim(), pwInput);
      if (r.ok) {
        setEmail(r.email || 'Signed in');
        setPwInput('');
        /* Login/signup succesvol → forceer een fetch van
           /api/subscription-status zodat useSubscription-consumers
           (Library, Player) direct de echte PRO-status zien. */
        refreshSubscription();
        /* Iter 9dn (2026-05-31): history-bucket re-evalueren — nieuwe
           token = potentieel nieuwe user = andere local-storage key.
           Iter 9dq v55 (2026-06-03, audit C5+C6): AWAIT zodat bucket
           switch echt klaar is voordat user op de Audio Library kan
           interacten. Anders schreef een snelle toggle nog naar de
           anon-bucket en lekte data tussen sessies. */
        await refreshUserBucket();
        /* Iter 9dq v158 (operator-fix 2026-06-18): last-played wissen bij
           login zodat de Continue-listening popup nooit een sessie van
           de vorige user op dit toestel toont aan de nieuwe user. Vorige
           pad (sign-out) deed dit al, maar account-switch zonder
           tussentijdse sign-out (gebruiker A blijft ingelogd → gebruiker
           B logt in met andere creds) miste de cleanup. */
        await clearLastPlayed();

        /* ── Post-login routing ────────────────────────────────────────
           Iter 9dq v96 (2026-06-03): differentiated routing per user-type.
           Operator-spec:
             - SIGN-UP (eerste keer)        → blijf op /account
                 → user ziet meteen "Activation required" + activate-CTA
             - LOGIN + Bracelet PRO         → /bracelet
                 → returning bracelet-owner landt direct bij z'n bracelet
             - LOGIN + Audio PRO            → /         (Audio Library)
             - LOGIN + Full PRO             → /bracelet (bracelet is premium)
             - LOGIN + Free                 → /         (Audio Library)

           Bracelet-ownership-detectie in dev:
             - Synchroon via getDevUserOverride() (cache is geladen door
               loadOnce() bij module-import; awaitDevUserOverrideLoaded
               is een safety-net voor cold-start race).

           Productie-pad (na backend-endpoint):
             - useSubscription cache lezen na refreshSubscription:
               const hasBracelet = cachedStatus?.has_bracelet_activated;
             - cachedStatus is module-level in useSubscription.ts;
               getter exporteren wanneer endpoint live is.

           setTimeout 50ms zodat React eerst de state-updates van
           setEmail/setPwInput commit; voorkomt edge-cases waar de
           component-rerender met de oude (login-form) view nog draait
           wanneer de nav fired. router.replace ipv navigate: clear de
           account-tab-stack zodat back-knop niet terug naar het login-
           formulier gaat. */
        await awaitDevUserOverrideLoaded();
        const override = getDevUserOverride();
        const isBraceletPro = override === 'bracelet' || override === 'pro';
        if (mode === 'signup') {
          /* Sign-up: blijf op /account. User ziet nu de signed-in view
             met BraceletCard (Activation required) of subscription-card,
             en kan vandaaruit de juiste eerstvolgende stap nemen
             (bracelet activeren / audio upgraden). */
          /* no redirect — gewoon de huidige view re-renderen */
        } else if (isBraceletPro) {
          setTimeout(() => router.replace('/bracelet' as never), 50);
        } else {
          /* Sign-in vanuit account tab → audio library opent op bovenkant.
             Zonder dit behoudt de tab z'n vorige scroll-positie (bv. van
             een eerdere free-browse sessie) en landt user halverwege. */
          requestScrollTo('top');
          setTimeout(() => router.replace('/'), 50);
        }
      } else {
        setMsg(r.error);
      }
    } finally {
      setBusy(false);
    }
  };

  /* Sign Out met confirmation-dialog. Voorkomt accidentele 1-tap sign-
     outs (operator-feedback 2026-05-25: "lastig om telkens opnieuw in
     te moeten loggen"). Default-knop is Cancel zodat onbedoelde tap geen
     consequenties heeft. "Sign out" is destructive-style op iOS → rood
     gerendered ter visuele waarschuwing. */
  const onSignOut = () => {
    Alert.alert(
      'Sign out?',
      'You will stay signed in on this device unless you sign out. After signing out, you will need to enter your password again next time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await clearSession();
            /* Iter 9dq v99 (2026-06-04): bij sign-out óók dev-overrides
               wissen. Anders bleef de override (bv 'bracelet') hangen
               terwijl Account 'uitgelogd' toonde — andere tabs (Bracelet,
               Audio) toonden nog steeds de PRO-omgeving = inconsistent.
               Productie kent dit probleem niet (overrides bestaan daar
               niet); puur dev-hygiene zodat sign-out altijd in een
               schone 'echte gast'-staat eindigt. Re-test als PRO?
               Settings → Override opnieuw zetten. */
            if (__DEV__) {
              await setDevUserOverride(null);
              await setDevBraceletActivated(false);
            }
            setEmail(null);
            setEmailInput('');
            setPwInput('');
            /* Token weg → refreshSubscription detecteert no-token, wist
               persisted cache en notifiet alle consumers {active:false}. */
            refreshSubscription();
            /* Iter 9dn (2026-05-31): history-bucket re-evalueren — geen
               token meer → schakelt naar 'anon' bucket, voormalige user's
               history blijft staan onder hun eigen key (niet gewist).
               Iter 9dq v55 (2026-06-03, audit C5+C6): AWAIT zodat de
               bucket-switch klaar is voordat we de in-memory cleanups
               (clearSignedUrlCache, clearLastPlayed) firen — zonder
               await kon een vroege re-render nog op de oude bucket
               schrijven. */
            await refreshUserBucket();
            /* Wis ook de in-memory signed-URL cache zodat een volgende user
               op dit toestel geen leftover-URLs van vorige sessie krijgt. */
            clearSignedUrlCache();
            /* Continue-card op de library mag geen sessie van de vorige
               user tonen aan de volgende user op dit toestel. */
            clearLastPlayed();
            /* Email-veld pre-fillen met laatst-gebruikte email zodat
               re-login alleen wachtwoord vergt (LAST_EMAIL_KEY overleeft
               clearSession). */
            const lastEmail = await getLastLoginEmail();
            if (lastEmail) setEmailInput(lastEmail);
          },
        },
      ]
    );
  };

  /* ── Cancel Subscription verwijderd ──
     Iter 9dq v150 (operator 2026-06-17): Apple/Google policy verbiedt
     in-app subscription cancellation voor IAP-content. Cancellation
     gaat via Settings → Apple ID → Subscriptions (iOS) of Play Store →
     Subscriptions (Android). De "Manage subscription"-knop bovenaan
     deze tab opent dat OS-scherm via storeSubscriptionsUrl(). */

  /* ── Change Password ──
     Routeert door naar de webapp forgot-password flow (Supabase recovery
     email → reset-password.html → opnieuw in app inloggen met nieuw
     password). Webapp handelt het volledige proces af; native app is
     alleen de launcher. */
  /* Change password — directe in-app flow voor ingelogde users die
     hun bekende password willen wijzigen (anders dan /forgot-password
     wat een email-reset is voor vergeten passwords). Operator-keuze
     2026-05-30: voorheen ging deze route via een alert naar de forgot
     flow — overdreven voor users die gewoon hun password willen
     veranderen. */
  const onChangePassword = () => {
    router.navigate('/change-password' as never);
  };

  /* ── Delete Account ──
     Iter v145 (2026-06-25): self-service delete, Apple/Google policy.
     Vervangt de oude "open support form"-flow die NIET aan Apple
     Guideline 5.1.1(v) voldeed. Twee-staps confirm zodat een accident-
     tap niet alles wist. Backend doet de echte Supabase admin delete,
     daarna clearSession + replace('/') zodat user landt in de gast-app. */
  const onDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      "This will permanently remove your VIBEZCORE account, listening history, favorites, and saved settings.\n\nIf you have an active subscription, this does NOT cancel it — you must cancel via Google Play (or App Store) Subscriptions separately.\n\nThis cannot be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => {
            /* Tweede confirm voor zekerheid — destructive action waar
               we niet van terug kunnen. */
            Alert.alert(
              'Are you sure?',
              'Last chance to cancel. Once deleted, your account cannot be recovered.',
              [
                { text: 'Keep my account', style: 'cancel' },
                {
                  text: 'Yes, delete',
                  style: 'destructive',
                  onPress: async () => {
                    setBusy(true);
                    const r = await deleteAccount();
                    setBusy(false);
                    if (r.ok) {
                      /* App-state cleanup mirror van sign-out — bracelet
                         override, last-played, etc. */
                      if (__DEV__) {
                        await setDevUserOverride(null);
                        await setDevBraceletActivated(false);
                      }
                      setEmail(null);
                      setEmailInput('');
                      setPwInput('');
                      await clearLastPlayed();
                      await clearSignedUrlCache();
                      refreshSubscription();
                      Alert.alert(
                        'Account deleted',
                        'Your account has been permanently deleted.',
                        [{ text: 'OK', onPress: () => router.replace('/') }],
                      );
                    } else {
                      Alert.alert('Could not delete account', r.error);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, s.center]}>
        <ActivityIndicator color={Brand.text} />
      </SafeAreaView>
    );
  }

  /* Signed-in view. KeyboardAwareScrollView ipv KeyboardAvoidingView —
     laatstgenoemde gaf op Android + expo-router bottom tabs een race-
     condition tussen tab-bar-resize en keyboard-animation (operator-
     bevestigd 2026-05-20: "trillen + zwart scherm"). Pure-JS package,
     geen native rebuild nodig. Future-proof voor activatiecode-input. */
  if (email) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={s.root}>
        <KeyboardAwareScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: Math.max(safeInsets.bottom + 24, 72) }]}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          extraScrollHeight={20}
          enableAutomaticScroll={true}
        >
          <Text style={s.screenTitle}>Account</Text>

          {/* ── My account ──
              Persoonlijke account-info op één plek: email (read-only —
              kan alleen via support gewijzigd worden, GDPR/verifiable
              workflow) + password (interactief, opent in-app change
              flow). Voorheen waren deze gespreid (email in subscription
              card, password in Account Actions). Consolidatie maakt
              "waar staat mijn info?" voor de hand liggend.
              Operator-feedback 2026-05-30. */}
          <View style={s.card}>
            <Text style={s.label}>My account</Text>

            {/* Email row — niet interactief, label boven value gestackt */}
            <View style={s.accountField}>
              <Text style={s.accountFieldLabel}>Email</Text>
              <Text style={s.accountFieldValue} numberOfLines={1}>
                {email}
              </Text>
            </View>

            <View style={s.cardRowDivider} />

            {/* Password row — interactief: label/value gestackt links,
                "Change" + chevron rechts. Dot-string als "value" voor
                visuele bevestiging dat er een password is ingesteld. */}
            <Pressable
              style={s.accountFieldInteractive}
              onPress={onChangePassword}
              accessibilityLabel="Change your password"
            >
              <View style={{ flex: 1 }}>
                <Text style={s.accountFieldLabel}>Password</Text>
                <Text style={s.accountFieldValue}>••••••••••</Text>
              </View>
              <Text style={s.accountFieldCta}>Change</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
          </View>

          <SubscriptionCard />
          <BraceletCard />
          {/* Iter 9r: LibrarySettingsLink weggehaald — operator-feedback
              "Library settings mag overal uit settings weg". Auto-play
              en track-history toggles leven al in Settings sub-screen. */}

          {/* ── Account Actions (Settings, Change Password, Support) ──
              Structuur matched account.html van de webapp. Sign Out blijft
              z'n eigen prominente rode knop onderaan, niet in deze
              "actions"-card — operator-besluit 2026-05-25: Sign Out moet
              visueel onmiskenbaar zijn. */}
          {/* ── Settings & Help ──
              Hernoemd van "Account" → "Settings & Help" (Change password
              is verhuisd naar My account card bovenaan). Dit card bevat
              alleen secundaire actions: app-settings, about, FAQ, contact. */}
          <View style={s.card}>
            <Text style={s.label}>Settings & help</Text>
            {/* Iter 9dq v86 (2026-06-03): Restore Purchases. Apple App
                Review Guideline 3.1.1 vereist deze knop voor IAP-apps.
                Bovenaan de lijst zodat 'ie vindbaar is na een reinstall
                of new-device sign-in. */}
            <Pressable
              style={s.cardRow}
              onPress={onRestorePurchases}
              disabled={restoring}
              accessibilityLabel="Restore previous purchases"
            >
              <Text style={s.cardRowText}>
                {restoring ? 'Restoring…' : 'Restore purchases'}
              </Text>
              {restoring ? (
                <ActivityIndicator color={Brand.textDim} size="small" />
              ) : (
                <Text style={s.cardRowArrow}>›</Text>
              )}
            </Pressable>
            <View style={s.cardRowDivider} />
            <Pressable
              style={s.cardRow}
              onPress={() => router.navigate('/settings')}
              accessibilityLabel="Open settings"
            >
              <Text style={s.cardRowText}>Settings</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
            <View style={s.cardRowDivider} />
            {/* About VIBEZCORE — brand-story screen voor users die
                meer willen weten over wat VIBEZCORE is. Custom screen
                src/app/about.tsx, gesynced met vibezcore.com/about-
                vibezcore. */}
            <Pressable
              style={s.cardRow}
              onPress={() => router.navigate('/about' as never)}
              accessibilityLabel="Learn about VIBEZCORE"
            >
              <Text style={s.cardRowText}>About VIBEZCORE</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
            <View style={s.cardRowDivider} />
            {/* FAQ — voor "Contact support" zodat user eerst self-serve
                kan proberen. Mirror van vibezcore.com/faq, content in
                src/data/faq-content.ts. */}
            <Pressable
              style={s.cardRow}
              onPress={() => router.navigate('/faq' as never)}
              accessibilityLabel="Browse frequently asked questions"
            >
              <Text style={s.cardRowText}>Frequently asked questions</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
            <View style={s.cardRowDivider} />
            <Pressable
              style={s.cardRow}
              onPress={() => router.navigate('/support')}
              accessibilityLabel="Contact VIBEZCORE support"
            >
              <Text style={s.cardRowText}>Contact support</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
          </View>

          {/* Cancel Subscription verwijderd — iter 9dq v150 (operator
              2026-06-17): app is IAP-only. Apple/Google verbieden in-app
              cancellation; user gebruikt de "Manage subscription"-knop
              bovenaan deze tab (opent Settings → Apple ID → Subscriptions
              of Play Store → Subscriptions). */}

          <Pressable style={s.signOut} onPress={onSignOut}>
            <Text style={s.signOutText}>Sign out</Text>
          </Pressable>

          {/* ── Danger Zone — Delete Account ──
              Visueel duidelijk gescheiden van Sign Out (welke reversible is)
              en gemarkeerd met rode border zodat onbedoelde tap visueel
              gestopt wordt. Opent support-form voor manual deletion. */}
          <View style={s.dangerZone}>
            <Text style={s.dangerLabel}>Danger Zone</Text>
            <Text style={s.dangerText}>
              Deleting your account is permanent. Your listening history,
              favorites, and subscription data will be removed.
            </Text>
            <Pressable
              style={s.dangerBtn}
              onPress={onDeleteAccount}
              accessibilityLabel="Request account deletion"
            >
              <Text style={s.dangerBtnText}>Delete my account</Text>
            </Pressable>
          </View>

          {/* ── Legal section ──
              Vervangt de oude [OPERATOR]-placeholder. 5 sub-screens
              gepushed via `legal/[doc]`. Inhoud van de webapp HTMLs
              (operator-bevestigd 2026-05-27) en wordt onafhankelijk
              van die webapp in de app onderhouden — als de webapp
              uitgefaseerd wordt blijven deze docs gewoon staan. */}
          <View style={s.card}>
            <Text style={s.label}>Legal & Safety</Text>
            <Pressable
              style={s.cardRow}
              onPress={() =>
                router.navigate({
                  pathname: '/legal/[doc]' as never,
                  params: { doc: 'terms' } as never,
                })
              }
              accessibilityLabel="Read Terms and Conditions"
            >
              <Text style={s.cardRowText}>Terms and Conditions</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
            <View style={s.cardRowDivider} />
            <Pressable
              style={s.cardRow}
              onPress={() =>
                router.navigate({
                  pathname: '/legal/[doc]' as never,
                  params: { doc: 'privacy' } as never,
                })
              }
              accessibilityLabel="Read Privacy Policy"
            >
              <Text style={s.cardRowText}>Privacy Policy</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
            <View style={s.cardRowDivider} />
            <Pressable
              style={s.cardRow}
              onPress={() =>
                router.navigate({
                  pathname: '/legal/[doc]' as never,
                  params: { doc: 'accessibility' } as never,
                })
              }
              accessibilityLabel="Read Accessibility Statement"
            >
              <Text style={s.cardRowText}>Accessibility Statement</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
            <View style={s.cardRowDivider} />
            <Pressable
              style={s.cardRow}
              onPress={() =>
                router.navigate({
                  pathname: '/legal/[doc]' as never,
                  params: { doc: 'shipping' } as never,
                })
              }
              accessibilityLabel="Read Shipping Policy"
            >
              <Text style={s.cardRowText}>Shipping Policy</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
            <View style={s.cardRowDivider} />
            <Pressable
              style={s.cardRow}
              onPress={() =>
                router.navigate({
                  pathname: '/legal/[doc]' as never,
                  params: { doc: 'refund' } as never,
                })
              }
              accessibilityLabel="Read Refund and Returns Policy"
            >
              <Text style={s.cardRowText}>Refund & Returns Policy</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
            <View style={s.cardRowDivider} />
            <Pressable
              style={s.cardRow}
              onPress={() =>
                router.navigate({
                  pathname: '/legal/[doc]' as never,
                  params: { doc: 'cookies' } as never,
                })
              }
              accessibilityLabel="Read Cookie Policy"
            >
              <Text style={s.cardRowText}>Cookie Policy</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
            <View style={s.cardRowDivider} />
            <Pressable
              style={s.cardRow}
              onPress={() =>
                router.navigate({
                  pathname: '/legal/[doc]' as never,
                  params: { doc: 'health' } as never,
                })
              }
              accessibilityLabel="Read Consumer Health Notice"
            >
              <Text style={s.cardRowText}>Consumer Health Notice</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
            <View style={s.cardRowDivider} />
            {/* Audio Sessions — legal-disclaimer specifiek voor de
                audio content (no affiliation, IP, etc). Op de website
                staat 'ie onder PLATFORM-footer, in de app bij Legal
                & Safety omdat de inhoud legal van aard is. */}
            <Pressable
              style={s.cardRow}
              onPress={() =>
                router.navigate({
                  pathname: '/legal/[doc]' as never,
                  params: { doc: 'audio-sessions' } as never,
                })
              }
              accessibilityLabel="Read Audio Sessions disclaimer"
            >
              <Text style={s.cardRowText}>Audio Sessions</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
          </View>

          <Text style={s.legal}>
            © VIBEZCORE · All rights reserved
          </Text>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    );
  }

  /* Signed-out view — optional auth, not a wall. KeyboardAwareScrollView
     scrollt automatisch naar het gefocuste TextInput zodat het niet
     onder het soft-keyboard valt. enableOnAndroid=true is essentieel:
     de library skipt anders Android (ios-only default).
     extraScrollHeight=20 geeft een buffer onder het veld zodat het
     niet pal tegen het keyboard plakt. */
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.root}>
      <KeyboardAwareScrollView
        ref={signedOutScrollRef}
        contentContainerStyle={[s.scroll, { paddingBottom: 48 + safeInsets.bottom }]}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
        enableAutomaticScroll={true}
      >
        {/* Iter 9iii: complete redesign signed-out view.
            - Hero greeting (warm, professional)
            - Sign-in card (één frame met form + forgot + stay-signed)
            - "or get started" divider
            - Product card (één frame, 3 knoppen, 1 disclaimer)
            - Legal footer met 5 doc-links (compliance + altijd accessibel)
            - Apple SSO weggehaald uit guest-flow (komt terug als 't werkt) */}

        {/* Hero greeting — iter 9mmm: brand-style met wordmark + accent
            bar conform welcome.tsx voor consistentie tussen Welcome en
            Account guest-view. */}
        <View style={s.heroBlock}>
          <Text style={s.heroEyebrow}>WELCOME TO</Text>
          <Image
            source={require('../../../assets/vibezcore_wordmark.png')}
            style={s.heroWordmark}
            resizeMode="contain"
            accessibilityLabel="VIBEZCORE"
          />
          <View style={s.heroAccentBar} />
          <Text style={s.heroSub}>
            Sign in if you already have access,{'\n'}or get started below.
          </Text>
        </View>

        {/* ── SIGN-IN CARD ── */}
        <View style={s.authCard}>
          <Text style={s.authCardLabel}>SIGN IN</Text>

          {/* Iter v149: social sign-in. Boven email/password zoals
              subscribe.tsx — één tap, geen wachtwoord. Apple HIG +
              Google branding. Werkt voor zowel sign-in als signup
              (Supabase grant_type=id_token maakt-of-vindt user). */}
          {(googleAvailable || appleAvailable) && (
            <View style={{ marginBottom: 14 }}>
              {appleAvailable && (
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 48,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    marginBottom: 10,
                    backgroundColor: '#000000',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.18)',
                  }}
                  onPress={() => void onAppleSignIn()}
                >
                  <Text style={{ color: '#ffffff', fontSize: 18, marginRight: 10 }}></Text>
                  <Text style={{ color: '#ffffff', fontSize: 14, fontFamily: BrandFonts.semibold }}>
                    Continue with Apple
                  </Text>
                </Pressable>
              )}
              {googleAvailable && (
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 48,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    backgroundColor: '#ffffff',
                  }}
                  onPress={() => void onGoogleSignIn()}
                >
                  <Text style={{ color: '#4285F4', fontSize: 18, fontFamily: BrandFonts.extrabold, marginRight: 10 }}>
                    G
                  </Text>
                  <Text style={{ color: '#1f1f1f', fontSize: 14, fontFamily: BrandFonts.semibold }}>
                    Continue with Google
                  </Text>
                </Pressable>
              )}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 14,
                  marginBottom: 4,
                }}
              >
                <View style={{ flex: 1, height: 1, backgroundColor: Brand.border }} />
                <Text
                  style={{
                    marginHorizontal: 12,
                    color: Brand.textDim,
                    fontSize: 11,
                    fontFamily: BrandFonts.semibold,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                  }}
                >
                  or
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: Brand.border }} />
              </View>
            </View>
          )}

          <Text style={s.inputLabel}>Email</Text>
          <TextInput
            style={s.input}
            value={emailInput}
            onChangeText={(v) => {
              setEmailInput(v);
              if (msg) setMsg(null);
            }}
            placeholder="you@example.com"
            placeholderTextColor={Brand.textDim}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />

          {/* Iter v144: live email-feedback. Toont niets bij leeg veld;
              warn bij typo (met tap-to-fix); success bij valid format. */}
          {(() => {
            if (!emailInput.trim()) return null;
            const v = validateEmail(emailInput);
            const hint = emailHintText(v);
            if (!hint.text) return null;
            const toneStyle =
              hint.tone === 'success'
                ? { color: Brand.success }
                : hint.tone === 'warn'
                  ? { color: '#ffb450' }
                  : hint.tone === 'error'
                    ? { color: Brand.error }
                    : { color: Brand.textDim };
            if (v.ok === 'maybe' && v.reason === 'typo') {
              return (
                <Pressable
                  onPress={() => {
                    setEmailInput(v.suggestion);
                    if (msg) setMsg(null);
                  }}
                  style={{
                    marginTop: 8,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255,180,80,0.10)',
                    borderColor: 'rgba(255,180,80,0.35)',
                    borderWidth: 1,
                    alignSelf: 'flex-start',
                  }}
                  accessibilityLabel={`Use suggested email ${v.suggestion}`}
                >
                  <Text style={[{ fontSize: 12, fontFamily: BrandFonts.medium }, toneStyle]}>
                    {hint.text}
                  </Text>
                  <Text style={{
                    fontSize: 11,
                    fontFamily: BrandFonts.bold,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: '#ffb450',
                    marginTop: 2,
                  }}>
                    Tap to use it
                  </Text>
                </Pressable>
              );
            }
            return (
              <Text style={[{ fontSize: 12, fontFamily: BrandFonts.medium, marginTop: 8 }, toneStyle]}>
                {hint.text}
              </Text>
            );
          })()}

          <Text style={s.inputLabel}>Password</Text>
          <View style={s.pwWrap}>
            <TextInput
              style={[s.input, s.pwInput]}
              value={pwInput}
              onChangeText={setPwInput}
              placeholder="••••••••"
              placeholderTextColor={Brand.textDim}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
            <Pressable
              style={s.pwToggle}
              onPress={() => setShowPw((v: boolean) => !v)}
            >
              <Text style={s.pwToggleText}>{showPw ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {msg && <Text style={s.msg}>{msg}</Text>}

          <Pressable
            style={[s.primaryBtn, busy && s.btnDisabled]}
            onPress={onSubmit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={Brand.text} />
            ) : (
              <Text style={s.primaryBtnText}>Sign in</Text>
            )}
          </Pressable>

          <Pressable
            style={s.forgotLink}
            onPress={() => router.navigate('/forgot-password' as never)}
            accessibilityLabel="Reset your password"
          >
            <Text style={s.forgotLinkText}>Forgot password?</Text>
          </Pressable>

          <Text style={s.staySignedIn}>
            You'll stay signed in on this device
          </Text>

          {/* Iter v149 (2026-06-25): bracelet-code activation entry-point
              voor uitgelogde users. Bracelet-kopers (Kickstarter-backers,
              webshop) krijgen een activatiecode bij verzending — die
              code unlockt zowel bracelet als (afhankelijk van pakket)
              1 jaar audio library zonder dat ze eerst een subscription
              moeten kopen. Voorheen alleen zichtbaar NA signin → backers
              dachten dat ze eerst account moesten kopen + dan code.
              Tap routeert naar /activate-bracelet die zelf vraagt om
              signin/signup zodat de grant aan een account gekoppeld
              wordt. */}
          <Pressable
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: Brand.border,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => router.navigate('/activate-bracelet' as never)}
            accessibilityLabel="Activate a bracelet code"
          >
            <Text style={{ fontSize: 13, color: Brand.textDim, fontFamily: BrandFonts.regular }}>
              Have a bracelet code?{' '}
            </Text>
            <Text style={{ fontSize: 13, color: Brand.accent, fontFamily: BrandFonts.semibold }}>
              Activate it →
            </Text>
          </Pressable>
        </View>

        {/* "or get started" divider */}
        <View style={s.orDivider}>
          <View style={s.orLine} />
          <Text style={s.orText}>or get started</Text>
          <View style={s.orLine} />
        </View>

        {/* ── PRODUCT CARDS — restructured iter 9dq v10 (2026-06-02) ──
            Was: 2 cards × 16 tekstlagen + 3 CTAs + 3 badges = visueel
            druk voor een gast. Operator-feedback: rustiger maar boeiend,
            upsell behouden.
            Nu: 2 cards, elk met eyebrow-status + titel + 1-line + CTA.
            Bundle leeft INSIDE de bracelet-card als inline BEST VALUE-
            rij ipv eigen CTA. Reassurance gereduceerd tot 1 dim regel. */}

        {/* Card 1: Audio Library — available now (primary product) */}
        <View style={s.productCard}>
          <View style={s.productStatusRow}>
            <View
              style={[
                s.productStatusDot,
                { backgroundColor: Brand.success },
              ]}
            />
            <Text style={s.productStatusLabel}>AVAILABLE NOW</Text>
          </View>
          <Text style={s.productTitle}>Audio Library</Text>
          <Text style={s.productOneLiner}>
            All sessions · monthly or yearly
          </Text>
          <Pressable
            style={s.productCtaPrimary}
            onPress={() => {
              requestScrollTo('pricing');
              router.navigate('/');
            }}
            accessibilityLabel="Subscribe to Audio Library"
          >
            <Text style={s.productCtaPrimaryText}>Subscribe</Text>
            <Text style={s.productCtaPrimaryArrow}>→</Text>
          </Pressable>
        </View>

        {/* Card 2: Smart Bead Bracelet — preorder, met 2 duidelijke
            reserveringsopties (Bracelet alone vs Bundle). Iter 9dq v11
            (2026-06-02): operator-feedback — verschil tussen opties was
            niet duidelijk + CTA moest "Reserve your spot" zijn ipv los
            "Reserve". Beide opties tonen nu titel + sub-line die exact
            zegt wat je reserveert.
            Iter 9dq v12 (2026-06-02): Early Bird-framing + product-namen.
            Eyebrow combineert "EARLY BIRD" met launch-datum. Onder titel
            staan de oorspronkelijke scarcity-zinnen ("lowest Kickstarter
            price" + "first reserved, first served") in 2 dim regels.
            Opties tonen nu de pakketnamen: VIBEZCORE Smart Bead Bracelet
            en VIBEZCORE Full Bundle (laatste met sub "Bracelet + 12-mo
            Audio Library" voor inhoud-duidelijkheid). */}
        <View style={s.productCard}>
          <View style={s.productStatusRow}>
            <View
              style={[
                s.productStatusDot,
                { backgroundColor: 'rgba(255,255,255,0.30)' },
              ]}
            />
            <Text style={s.productStatusLabel}>
              EARLY BIRD · LAUNCHING 1 SEPT
            </Text>
          </View>
          <Text style={s.productTitle}>Smart Bead Bracelet</Text>
          <Text style={s.productOneLiner}>
            Secure the lowest Kickstarter price
          </Text>
          <Text style={s.productSubOneLiner}>
            Limited units — first reserved, first served
          </Text>

          {/* Option A: Bracelet alone — outlined, lower-key */}
          <Pressable
            style={s.reserveOption}
            onPress={() =>
              openExternal('https://www.vibezcore.com/subscribe-bracelet')
            }
            accessibilityLabel="Reserve your spot for VIBEZCORE Smart Bead Bracelet"
          >
            <View style={s.reserveOptionLeft}>
              <Text style={s.reserveOptionTitle}>Reserve your spot</Text>
              <Text style={s.reserveOptionSub}>
                VIBEZCORE Smart Bead Bracelet
              </Text>
            </View>
            <Text style={s.reserveOptionArrow}>→</Text>
          </Pressable>

          {/* Option B: Bundle — BEST VALUE highlighted, order-bump styling.
              Pakketnaam (VIBEZCORE Full Bundle) prominent + extra dim
              regel onder met wat de bundle inhoudt. */}
          <Pressable
            style={s.reserveOptionBundle}
            onPress={() =>
              openExternal('https://www.vibezcore.com/subscribe-bundle')
            }
            accessibilityLabel="Reserve your spot for VIBEZCORE Full Bundle, bracelet plus 12-month Audio"
          >
            <View style={s.reserveOptionLeft}>
              <View style={s.bundleInlineBadge}>
                <Text style={s.bundleInlineBadgeText}>BEST VALUE</Text>
              </View>
              <Text style={s.reserveOptionTitle}>Reserve your spot</Text>
              <Text style={s.reserveOptionSub}>VIBEZCORE Full Bundle</Text>
              <Text style={s.reserveOptionSubFine}>
                Bracelet + 12-month Audio Library
              </Text>
            </View>
            <Text style={s.reserveOptionArrow}>→</Text>
          </Pressable>

          {/* Disclaimer — 2-regel volledig zoals voorheen, omdat dit
              juridisch + emotioneel relevant is voor preorders. */}
          <Text style={s.productCardDisclaimer}>
            No credit card · No financial data · No purchase obligation
          </Text>
          <Text style={s.productCardDisclaimerSub}>
            We only use your email to notify you before launch
          </Text>
        </View>

        {/* ── LEGAL FOOTER ──
            5 docs altijd toegankelijk, ook voor guests (AVG/compliance +
            UX-conventie). Inline link-row, subtle, Apple-style. */}
        <View style={s.legalFooter}>
          <View style={s.legalLinkRow}>
            <Pressable
              onPress={() => router.navigate('/legal/terms' as never)}
              hitSlop={8}
            >
              <Text style={s.legalLink}>Terms</Text>
            </Pressable>
            <Text style={s.legalLinkSep}>·</Text>
            <Pressable
              onPress={() => router.navigate('/legal/privacy' as never)}
              hitSlop={8}
            >
              <Text style={s.legalLink}>Privacy</Text>
            </Pressable>
            <Text style={s.legalLinkSep}>·</Text>
            <Pressable
              onPress={() =>
                router.navigate('/legal/accessibility' as never)
              }
              hitSlop={8}
            >
              <Text style={s.legalLink}>Access</Text>
            </Pressable>
            <Text style={s.legalLinkSep}>·</Text>
            <Pressable
              onPress={() =>
                router.navigate('/legal/shipping' as never)
              }
              hitSlop={8}
            >
              <Text style={s.legalLink}>Shipping</Text>
            </Pressable>
            <Text style={s.legalLinkSep}>·</Text>
            <Pressable
              onPress={() => router.navigate('/legal/refund' as never)}
              hitSlop={8}
            >
              <Text style={s.legalLink}>Refund</Text>
            </Pressable>
            <Text style={s.legalLinkSep}>·</Text>
            <Pressable
              onPress={() => router.navigate('/legal/cookies' as never)}
              hitSlop={8}
            >
              <Text style={s.legalLink}>Cookies</Text>
            </Pressable>
            <Text style={s.legalLinkSep}>·</Text>
            <Pressable
              onPress={() => router.navigate('/legal/health' as never)}
              hitSlop={8}
            >
              <Text style={s.legalLink}>Health</Text>
            </Pressable>
            <Text style={s.legalLinkSep}>·</Text>
            <Pressable
              onPress={() =>
                router.navigate('/legal/audio-sessions' as never)
              }
              hitSlop={8}
            >
              <Text style={s.legalLink}>Audio</Text>
            </Pressable>
          </View>
          <Text style={s.legalCopy}>© VIBEZCORE 2026</Text>
        </View>

        {/* Iter 9dq (2026-06-02): dev-only Settings-link in signed-out
            view. De normale Settings-link zit alleen in de ingelogde
            Account-view, dus voor het wisselen van de Dev user-override
            in test (bv. 'Free / Guest' vs 'Audio PRO') moest je eerst
            inloggen. Met deze link kan een tester de override aanpassen
            zonder eerst een account-roundtrip te doen. Verschijnt enkel
            in __DEV__ builds — productie ziet 'm niet. */}
        {__DEV__ && (
          <Pressable
            onPress={() => router.navigate('/settings' as never)}
            hitSlop={12}
            style={s.devSettingsLink}
            accessibilityLabel="Open developer settings"
          >
            <Text style={s.devSettingsLinkText}>
              🔧 Developer settings (dev only)
            </Text>
          </Pressable>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 48 },
  /* ── Iter 9iii → 9mmm: signed-out hero ──
     Brand-style hero block met "WELCOME TO" eyebrow + wordmark image
     + accent bar + sub. Conform welcome.tsx voor consistente brand-
     presence tussen Welcome screen en Account guest-view. */
  heroBlock: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 6,
    marginBottom: 20,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2.4,
    marginBottom: 12,
  },
  heroWordmark: {
    width: 220,
    height: 36,
    /* Subtle shadow voor brand-presence — matched welcome.tsx style. */
    shadowColor: '#000',
    shadowOpacity: 0.40,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  heroAccentBar: {
    width: 34,
    height: 3,
    backgroundColor: Brand.accent,
    marginTop: 18,
    marginBottom: 16,
  },
  /* Old heroGreeting (Welcome to VIBEZCORE plain text) replaced by
     heroBlock met wordmark. Style kept for any legacy usage. */
  heroGreeting: {
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginTop: 8,
    marginBottom: 6,
  },
  heroSub: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    textAlign: 'center',
  },
  /* Card-frame voor zowel sign-in als product-sectie. Subtle bg-tint
     + hairline border = visueel één geheel per sectie. */
  authCard: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 18,
  },
  authCardLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
    marginBottom: 14,
  },
  authCardIntro: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 19,
    marginBottom: 14,
  },

  /* ── Iter 9dq v10 (2026-06-02): restructured product-cards ──
     Clean layout: eyebrow → title → 1-liner → CTA. Bundle als inline
     order-bump met BEST VALUE stamp. Vervangt de oude druk gestapelde
     2-card layout met 3 CTAs en 3 badges. */
  productCard: {
    marginTop: 14,
    padding: 18,
    borderRadius: 14,
    backgroundColor: Brand.panel,
    /* Subtiele blauwe omlijning matched de history-page card-style. */
    borderColor: 'rgba(58, 143, 255, 0.28)',
    borderWidth: 1,
  },
  productStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  productStatusLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
  },
  productTitle: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  productOneLiner: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    marginBottom: 18,
  },
  /* Iter 9dq v12: extra dim regel onder one-liner voor "limited units —
     first reserved, first served". Subtieler dan one-liner zodat het
     als scarcity-microcopy leest, niet als hoofdpunt. */
  productSubOneLiner: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    fontStyle: 'italic',
    marginTop: -12,
    marginBottom: 18,
  },
  /* Primary CTA — solid accent fill voor Audio (direct verkoopbaar). */
  productCtaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.accent,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 8,
  },
  productCtaPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  productCtaPrimaryArrow: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
  },
  /* Secondary CTA — outlined voor Reserve (geen aankoop, lower commitment). */
  productCtaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderColor: Brand.accent,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 8,
    marginBottom: 14,
  },
  productCtaSecondaryText: {
    color: Brand.accent,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  productCtaSecondaryArrow: {
    color: Brand.accent,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
  },
  /* Iter 9dq v11 (2026-06-02): twee reservation-opties met duidelijk
     verschillende klasse.
     Option A (Bracelet alone) — outlined accent border, neutrale bg.
     Option B (Bundle) — subtle blauwe tint bg, stronger border, BEST
     VALUE stamp bovenaan. Visueel duidelijk dat dit dezelfde actie is
     met meer waarde, niet een totaal andere knop. */
  reserveOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderColor: 'rgba(58, 143, 255, 0.45)',
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  reserveOptionBundle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(58, 143, 255, 0.10)',
    borderColor: 'rgba(58, 143, 255, 0.50)',
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 14,
  },
  reserveOptionLeft: {
    flex: 1,
  },
  reserveOptionTitle: {
    color: Brand.accent,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  reserveOptionSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    marginTop: 3,
  },
  /* Iter 9dq v12: extra fine-print onder pakketnaam (alleen bundle).
     Toont wat in de bundle zit zonder de pakketnaam te overschaduwen. */
  reserveOptionSubFine: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    marginTop: 2,
  },
  reserveOptionArrow: {
    color: Brand.accent,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    marginLeft: 10,
  },
  /* BEST VALUE pill — gedeeld door bundle inline. */
  bundleInlineBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Brand.success,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  bundleInlineBadgeText: {
    color: '#0a0a0a',
    fontSize: 9,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: 0.8,
  },

  /* "or get started" divider tussen de twee cards. Hairlines + text. */
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 18,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  orText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.4,
    paddingHorizontal: 12,
  },
  /* Iter 9lll — Audio btn wrapper voor "AVAILABLE NOW" badge. */
  audioBtnWrap: {
    position: 'relative',
    marginTop: 4,
  },
  availableBadge: {
    position: 'absolute',
    top: -8,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Brand.success,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  availableDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  availableBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.8,
  },
  /* Iter 9lll: outlined variant voor secundaire reservatie-CTAs.
     Accent-border, transparante bg, accent-tekst — lichter visueel
     gewicht dan de solid-filled audio-knop. */
  getProductBtnOutlined: {
    backgroundColor: 'rgba(58,143,255,0.06)',
    borderColor: Brand.accent,
    borderWidth: 1,
  },
  /* Iter 9kkk — Bundle btn wrapper voor BEST VALUE-badge die boven
     de knop uitsteekt (overflow visible nodig). */
  bundleBtnWrap: {
    position: 'relative',
    marginTop: 4,
  },
  bundleBadge: {
    position: 'absolute',
    top: -8,
    right: 14,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bundleBadgeText: {
    color: Brand.accent,
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1,
  },
  /* Iter 9jjj — Early Bird card (Bracelet + Bundle, Kickstarter pre-order) */
  earlyBirdEyebrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  earlyBirdLabel: {
    color: Brand.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
  },
  earlyBirdDate: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  earlyBirdHeadline: {
    color: Brand.text,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  earlyBirdSub: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 17,
    marginBottom: 14,
  },
  /* Disclaimer onder de 3 product-knoppen (samengevoegd uit 2 dubbele) */
  productCardDisclaimer: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 6,
  },
  productCardDisclaimerSub: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 10,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
    lineHeight: 14,
  },
  /* Legal footer — 5 doc-links als inline link-row, altijd zichtbaar
     (ook voor guests = AVG/compliance + UX-conventie). */
  legalFooter: {
    marginTop: 14,
    paddingTop: 18,
    paddingBottom: 8,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  legalLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 10,
  },
  legalLink: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  legalLinkSep: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
  },
  legalCopy: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.6,
  },
  /* Iter 9dq — dev-only Settings-link in signed-out account view.
     Subtiel maar herkenbaar (🔧 prefix + dim accent kleur). */
  devSettingsLink: {
    marginTop: 24,
    paddingVertical: 10,
    alignItems: 'center',
  },
  devSettingsLinkText: {
    color: 'rgba(58,143,255,0.65)',
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.4,
  },
  /* Iter 9ii — Get-product sectie (vervangt Create-account toggle) */
  getProductSection: {
    marginTop: 28,
    marginBottom: 18,
  },
  getProductHeader: {
    color: Brand.text,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  getProductSub: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
    marginBottom: 14,
  },
  getProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  getProductBtnFeatured: {
    backgroundColor: Brand.accent,
    borderColor: Brand.accent,
  },
  getProductBtnLeft: {
    flex: 1,
  },
  getProductBtnTitle: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  getProductBtnSub: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    marginTop: 2,
  },
  getProductBtnSubFeatured: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    marginTop: 2,
  },
  getProductBtnArrow: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    marginLeft: 12,
  },
  /* Iter 9jj: disclaimer-tekst onder bracelet + bundle (waitlist-flow).
     "No credit card · No financial data · No purchase obligation" +
     "We only use your email to notify you before launch". */
  getProductDisclaimer: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
    marginTop: -4,
    marginBottom: 1,
    paddingHorizontal: 6,
    lineHeight: 14,
  },
  getProductDisclaimerSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
    marginBottom: 12,
    paddingHorizontal: 6,
    lineHeight: 14,
  },
  /* Top-bar met klein V-logo links — vervangt de oude grote wordmark
     in de signed-out view én de platte 'Account'-koptekst-only in de
     signed-in view. Operator-besluit 2026-05-22: groot wordmark alleen
     op welcome + splash. */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
  },
  screenTitle: {
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: 1,
    marginTop: 12,
  },
  subtitle: {
    color: Brand.text,
    fontSize: 20,
    fontFamily: BrandFonts.bold,
    marginTop: 8,
  },
  optional: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    marginTop: 8,
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    marginTop: 22,
    marginBottom: 22,
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 7,
  },
  toggleActive: { backgroundColor: 'rgba(244,244,244,0.07)' },
  toggleText: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  toggleTextActive: { color: Brand.text },
  inputLabel: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: Brand.text,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
  },
  pwWrap: { position: 'relative', justifyContent: 'center' },
  pwInput: { paddingRight: 64 },
  pwToggle: { position: 'absolute', right: 12, padding: 6 },
  pwToggleText: {
    color: Brand.accent,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
  },
  msg: {
    color: Brand.error,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    marginTop: 14,
  },
  primaryBtn: {
    backgroundColor: Brand.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  primaryBtnText: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
  },
  btnDisabled: { opacity: 0.5 },

  /* "Stay signed in"-reassurance — kleine gedimde regel onder de primary
     Sign-in knop. Komt uit operator-feedback dat user wist of de session
     bewaard blijft. Bovendien mobiele-app-conventie. */
  staySignedIn: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  /* "OR" divider — scheidt email/password-flow van de SSO-knop(pen). */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Brand.border,
  },
  dividerText: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    marginHorizontal: 12,
  },

  /* SSO-knop — Apple-style: zwarte achtergrond, witte tekst. */
  ssoBtn: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
  },
  /* Disabled state — gedimd zodat duidelijk is dat de knop nog niet
     actief is. Combineert met de SOON-badge rechts. */
  ssoBtnDisabled: {
    opacity: 0.55,
  },
  /* Apple-logo glyph (Unicode ). Apple's brand-guidelines toestaan
     deze glyph als logo-vervanger op donker veld. */
  ssoBtnApple: {
    color: '#ffffff',
    fontSize: 18,
    marginRight: 8,
    marginTop: -2,
  },
  ssoBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: BrandFonts.semibold,
  },
  /* SOON-badge — kleine pill rechts naast de knop-tekst. Duidelijk visueel
     signaal dat de knop nog niet werkt zonder gebruiker te frustreren
     met onverklaarde non-respons bij tap. */
  soonBadge: {
    marginLeft: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  soonBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginTop: 14,
  },
  label: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  email: {
    color: Brand.text,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
  },
  /* Subscription-card live data — bigText: PRO-status of "Free account".
     Kleur wordt inline gezet (accent voor PRO, normaal voor Free,
     textDim voor loading). */
  subBig: {
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.2,
  },
  subSmall: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    marginTop: 4,
    lineHeight: 18,
  },
  dimText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
  },
  signOut: {
    borderColor: 'rgba(239,68,68,0.4)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  signOutText: {
    color: Brand.error,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
  },
  legal: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
    lineHeight: 16,
    opacity: 0.6,
  },

  /* Library-settings link (vervangt oude toggleRow2-styling van de
     in-place auto-play card). Visueel een tap-rij in Account-stijl:
     bg .04 / border .08 / radius 14 — match met de andere cards. */
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: 14,
  },
  linkTextWrap: { flex: 1 },
  linkTitle: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  linkSub: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    marginTop: 4,
  },
  linkArrow: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 28,
    marginLeft: 8,
    lineHeight: 28,
  },
  /* CTA-link binnen een card (Subscription's "Upgrade", Bracelet's
     "Reserve"). Subtiele accent-link onder de card-content, met arrow.
     Hairline-divider boven om visueel te scheiden van de info-tekst. */
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  cardCtaText: {
    color: Brand.accent,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  cardCtaArrow: {
    color: Brand.accent,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
  },
  /* Iter 9dq v85 (2026-06-03): secondary cardCta — voor extra acties
     in een card (bv. "Order new beadband") die wel actief klikbaar zijn
     maar niet de primary action. Visueel: dim grijze tekst ipv accent,
     géén border-top. Voorheen werd hiervoor de primary cardCta met
     opacity:0.6 hergebruikt → leek disabled. */
  cardCtaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingVertical: 4,
  },
  cardCtaSecondaryText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  cardCtaSecondaryArrow: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  /* Forgot Password — kleine subtiele link onder de Sign In knop. */
  forgotLink: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  forgotLinkText: {
    color: Brand.accent,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  /* Account Actions card-rows (Change Password / Contact Support). Lijst-
     style binnen een card, met hairline tussen items. Geen aparte
     "Account"-label nodig — de card-Text "Account" doet 't werk. */
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  cardRowText: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  cardRowArrow: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 22,
    fontFamily: BrandFonts.medium,
  },
  cardRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  /* My Account-card field rows — andere visuele structuur dan de
     normale cardRow (die heeft alleen tekst + chevron). Hier tonen we
     LABEL boven VALUE — klassieke iOS Settings-stijl voor account-info.
     `accountField` = niet-interactief (column stack), `accountField-
     Interactive` = interactief met CTA + chevron rechts. */
  accountField: {
    paddingVertical: 14,
  },
  accountFieldInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  accountFieldLabel: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  accountFieldValue: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  /* "Change" CTA tekst in password-row — accent-blauw, naast de
     chevron. Geeft direct duidelijk dat dit interactief is. */
  accountFieldCta: {
    color: Brand.accent,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  /* Cancel Subscription — neutraal-bordered knop (niet rood; cancel is
     reversible binnen huidige periode). Visueel minder dramatisch dan
     Sign Out (rood). */
  cancelBtn: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  /* Danger Zone — Delete Account. Rode border + rode tekst voor
     permanente actie. */
  dangerZone: {
    marginTop: 24,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(239,68,68,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 14,
  },
  dangerLabel: {
    color: Brand.error,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  dangerText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 19,
    marginBottom: 14,
  },
  dangerBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 10,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: Brand.error,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
});
