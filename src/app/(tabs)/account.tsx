/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Account tab

   Optional. NOT a wall (gast-first §1). Guests use the whole app without an
   account; an account is only needed for full audio or (later) bracelet
   activation. Hooks the EXISTING proven auth.ts (unchanged backend).
   Login + signup both present (bracelet will require an account — §1/§2).

   Uiterlijk: MERK_ANKER — Brand-palet, Inter via _layout, wordmark in
   signed-out header (vervangt platte tekst "VIBEZCORE").
   ─────────────────────────────────────────────────────────────────────────── */

import { BrandDark, BrandLight, BrandFonts, TypeScale } from '@/constants/theme';

/* Operator, 15 september 2026: zelfde light/C-token-toggle als
   index.tsx/bracelet.tsx/activity.tsx — hele pagina naar light mode, één
   boolean om terug te draaien. */
/* Operator, 26 september 2026: dark is de nieuwe app-brede default (was
   light, 14 september) — zelfde hardcoded-schakelaar-patroon, enkel de
   waarde omgezet. */
const light = false;
const C = light ? BrandLight : BrandDark;
/* Operator, 26 september 2026 (Huisstijl & Design Handboek v4.4):
   Signal Blue (#3a8fff / rgba(58,143,255,…)) is strikt gereserveerd voor
   haptic-pulsen en "nu actief"-status — nooit voor kaart-tints/borders/
   links/eyebrows. Deze schermen zijn light-mode, dus de vervanging is
   Royal Indigo (#1E2A4A, rgb 30,42,74), gelijk aan BrandLight.accent. */
const ROYAL_INDIGO_RGB = '30,42,74';
import {
  refreshSubscription,
  setSignedOutStatus,
  setSigningInStatus,
  useSubscription,
} from '@/hooks/useSubscription';
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
import { restorePurchases, silentRestoreAfterLogin } from '@/services/restore-purchases';
import { clearSignedUrlCache } from '@/utils/audio-url';
import { clearLastPlayed } from '@/utils/last-played';
import { validateEmail, emailHintText } from '@/utils/validate-email';
import {
  consumeScrollIntent,
  requestScrollTo,
  subscribeScrollIntent,
} from '@/utils/scroll-intent';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Pressable,
    Share,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  ChevronRight,
  Eye,
  EyeOff,
  Headphones,
  HelpCircle,
  Info,
  Lock,
  Mail,
  Package,
  Settings as SettingsIcon,
  Share2,
  UserPlus,
} from 'lucide-react-native';

/* Iter v244 (2026-07-20, operator-feedback): pitch herschreven — noemt
   nu expliciet de denkers/insights ipv generieke "grounded in Science,
   Philosophy & Psychology", en link is de universele vibezcore.com/app
   (werkt voor Android + iOS-status) ipv de directe Play Store-link.
   Single source of truth binnen dit bestand — bij wijziging hoeven we
   maar 1 plek aan te passen. KS-launch: Fall 2026 (operator 2026-07-14
   — sep-datum weg, geen concrete datum meer). */
const APP_LINK_URL = 'https://www.vibezcore.com/app';
/* Breathwork voorop, bracelet als "komt eraan", audio library als
   inbegrepen extra (operator, 11 augustus 2026: bracelet is het
   toekomstige hoofdproduct — uniek, maar nog niet beschikbaar; breathwork
   is NU verkoopbaar; audio library verkoopt moeilijk als eigen product en
   hoort er daarom bij als bonus, niet als kop). Vervangt de eerdere versie
   (9 augustus 2026) die de bibliotheek helemaal wegliet — die redenering
   klopte nog steeds (geen aparte titel), maar één regel "inclusief"
   ontbrak. Toestand-taal, geen claims; de gratis kennismakingssessie is
   wat een genodigde werkelijk krijgt. */
const BRAND_PITCH =
  'Control Your Body. Direct Your Mind. Become The Architect Of Your Life.\n\n' +
  'VIBEZCORE combines guided breathwork, premium audio sessions, and the upcoming Smart Bead Bracelet (Fall 2026) to help you feel calmer, think clearer, perform better, and grow with intention.';
const INVITE_MESSAGE = `${BRAND_PITCH}\n\nStart your 7-day free trial:\n${APP_LINK_URL}`;

async function shareInvite(): Promise<void> {
  try {
    await Share.share({
      title: 'VIBEZCORE',
      message: INVITE_MESSAGE,
      url: APP_LINK_URL,
    });
  } catch {}
}
import { showVibezAlert } from '@/components/VibezAlert';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path as SvgPath } from 'react-native-svg';
import {
    clearSession,
    deleteAccount,
    getLastLoginEmail,
    getToken,
    getUserEmail,
    login,
    signup,
    VZ_BACKEND_URL,
} from '../../services/auth';
import {
    isAppleSignInAvailable,
    isGoogleSignInAvailable,
    signInWithApple,
    signInWithGoogle,
} from '@/services/social-auth';

type Mode = 'login' | 'signup';

/* Press-scale feedback — same recipe as StartCard in breath-welcome.tsx
   (critically-damped spring on release, no bounce on press-in). Used
   throughout this file's tappable cards/rows/CTAs so every one of them
   gets the same tactile feedback without repeating the hook boilerplate
   at every call-site (this file has ~30 such elements). Purely additive:
   forwards every prop unchanged, only swaps Pressable->AnimatedPressable
   and appends the scale transform to the style array. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/* Operator ("kijk alle CTA's na, daar ook niet overal toegepast"): audit
   vond dat deze gedeelde wrapper (~30 call-sites in dit bestand) enkel
   scale animeerde — huisstijl §5 vraagt scale(.97 à .95)+opacity(.85)
   sámen, plus een lichte haptic-tik op het moment van indrukken
   (onPressIn, niet onPress/dieper in de handler — dat was de andere
   terugkerende fout in de rest van de app). Beide nu hier toegevoegd,
   op de gedeelde plek zodat elke call-site het automatisch meekrijgt. */
function PressScale({
  style,
  children,
  scaleTo = 0.95,
  ...rest
}: ComponentProps<typeof Pressable> & { scaleTo?: number }) {
  const pressScale = useSharedValue(1);
  const onPressIn: NonNullable<ComponentProps<typeof Pressable>['onPressIn']> = (e) => {
    pressScale.value = withTiming(scaleTo, { duration: 80 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rest.onPressIn?.(e);
  };
  const onPressOut: NonNullable<ComponentProps<typeof Pressable>['onPressOut']> = (e) => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
    rest.onPressOut?.(e);
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    opacity: 1 - (1 - pressScale.value) * 3,
  }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, pressStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

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

/* Iter v158 (2026-06-26, operator-spec): FreeEnvironmentCard voor
   ingelogd-zonder-entitlement state. Vervangt de oude 'Activate access'
   single-card met een explicit 3-paden view zodat de user direct ziet
   wat de drie acquisitie-paden zijn én welke (nog) niet beschikbaar zijn.

   Operator-quote: 'duidelijk dat het free envoirement is en de upgrade
   naar audio pro of full: bracelet + audio of bracelet moet dan wel
   werken'. Plus 'professioneel communiceren dat user weet wat de
   bedoeling van die knoppen zijn. misschien onder knop available
   summer 2026'.

   Kickstarter launch: Fall 2026 — bracelet-paden disabled tot dan. */
function FreeEnvironmentCard() {
  return (
    <View style={s.card}>
      <Text style={s.label}>Status</Text>
      <Text style={[s.subBig, { color: C.text }]}>
        You&apos;re in the free environment
      </Text>
      {/* Geen sessietelling meer — dat waren audiocijfers. Wat hier staat
          is wat een vrije gebruiker werkelijk heeft en mist. */}
      <Text style={s.subSmall}>
        Your first guided session is free. Unlock every state below:
      </Text>

      {/* Iter v237e (2026-07-09, operator-feedback): Activate CTA BOVENAAN.
          Bundle-koper landt hier na aankoop met code in email — Activate
          moet als eerste zichtbaar zijn, niet onder Audio subscribe.
          Subscribe zakt naar Pad 2. */}
      <PressScale
        style={s.cardCta}
        onPress={() => router.push('/activate-bracelet' as never)}
        accessibilityLabel="Activate your Bracelet or Full Bundle"
      >
        <View style={{ flex: 1 }}>
          <Text style={s.cardCtaText}>Activate Bracelet or Full Bundle</Text>
          <Text style={[s.subSmall, { marginTop: 2, opacity: 0.7 }]}>
            Enter your activation code
          </Text>
        </View>
        <Text style={s.cardCtaArrow}>→</Text>
      </PressScale>

      {/* Pad 2 — Premium. Geen prijs hier: die stond hardgecodeerd
          (€9,99) en dat breekt de WYSIWYG-regel zodra de store iets anders
          zegt — het subscribe-scherm toont de echte prijzen. */}
      <PressScale
        style={s.cardCta}
        onPress={() => router.navigate('/subscribe' as never)}
        accessibilityLabel="Go Premium — unlock Breathwork and the Audio Library"
      >
        <View style={{ flex: 1 }}>
          <Text style={s.cardCtaText}>Go Premium</Text>
          {/* Operator, 1 okt 2026: "49" was fout — correct: 64. */}
          <Text style={[s.subSmall, { marginTop: 2, opacity: 0.7 }]}>
            All 64 guided sessions + full Audio Library
          </Text>
        </View>
        <Text style={s.cardCtaArrow}>→</Text>
      </PressScale>

      {/* Pad 3 — Bundle info (ACTIVE, external)
          Iter v193 (2026-07-03): links naar vibezcore.com voor Bundle
          pre-order/KS-info (fysiek product = mag externe link per
          store policy §3.1.1). */}
      <PressScale
        style={s.cardCta}
        onPress={() => Linking.openURL('https://www.vibezcore.com/')}
        accessibilityLabel="Get the Full Bundle — Bracelet plus Premium, opens vibezcore.com"
      >
        <View style={{ flex: 1 }}>
          <Text style={s.cardCtaText}>Full Bundle — Bracelet + Premium</Text>
          <Text style={[s.subSmall, { marginTop: 2, opacity: 0.7 }]}>
            Learn more at vibezcore.com
          </Text>
        </View>
        <Text style={s.cardCtaArrow}>→</Text>
      </PressScale>
    </View>
  );
}

/* Subscription-card. Toont live PRO-status uit useSubscription()
   (= /api/subscription-status van backend). Drie render-paden:
     - isLoading      → "Checking…"
     - isPro=false    → delegated to FreeEnvironmentCard (Iter v158)
     - isPro=true     → "PRO — Monthly/Yearly" + datum-regel
   Datum-formatting via toLocaleDateString('en-GB') → "16 June 2026". */
function SubscriptionCard() {
  const {
    isPro,
    tier,
    validUntil,
    willRenew,
    isLoading,
    braceletModel,
  } = useSubscription();
  /* Iter 9r: bracelet-ownership óók in account-card. Full PRO = audio
     PRO + bracelet owner → speciale "Full PRO" label. */
  const isBraceletOwner = useBraceletOwner();

  /* Iter v158 (2026-06-26, operator-spec): voor ingelogd-zonder-entitlement
     toon NIET de standaard subscription-card maar een aparte "free
     environment" view met 3 paden (Audio/Bracelet/Bundle). Bracelet en
     Bundle disabled tot Fall 2026 (KS launch). */
  if (!isLoading && !isPro && !isBraceletOwner) {
    return <FreeEnvironmentCard />;
  }

  let bigText: string;
  let bigColor: string;
  let subText: string;

  if (isLoading) {
    bigText = 'Checking…';
    bigColor = C.textDim;
    subText = '';
  } else if (isPro && isBraceletOwner) {
    /* Full PRO — beide producten actief.
       Iter v228 (2026-07-08): tier-specifiek label. Voorheen was elke Full
       PRO user "Full PRO — Audio + Bracelet" onafhankelijk van hoe de audio
       binnenkwam. Nu: Bundle-users → "Full Bundle" (product-naam),
       Monthly/Yearly audio + bracelet → "Full PRO — Monthly/Yearly + Bracelet"
       zodat user in één blik ziet welk audio-tier hij heeft. Fallback naar
       oude copy als tier én braceletModel beide onbekend zijn. */
    if (braceletModel === 'bundle') {
      bigText = 'Full Bundle';
    } else if (tier === 'monthly') {
      bigText = 'Full PRO — Monthly + Bracelet';
    } else if (tier === 'yearly') {
      bigText = 'Full PRO — Yearly + Bracelet';
    } else {
      bigText = 'Full PRO — Premium + Bracelet';
    }
    bigColor = C.accent;
    if (validUntil) {
      const d = new Date(validUntil);
      if (!isNaN(d.getTime())) {
        const formatted = d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        subText = willRenew
          ? `Premium renews on ${formatted}`
          : `Premium active until ${formatted}`;
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
    bigColor = C.accent;
    /* Terugbedraaid (operator, 9 augustus 2026: "breathwork zal niet
       gratis zijn bij aankoop bracelet"). De vorige regel beloofde iets
       wat niet klopt — een bracelet-eigenaar zonder Premium heeft nog
       precies dezelfde vrije proefsessies als ieder ander, geen volledige
       bibliotheek. De regel zegt dat nu eerlijk, in dezelfde "compleet
       maken"-toon als de rest van deze branche. */
    subText = 'Add Premium to unlock every breathwork state and the Audio Library';
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
    bigText = tierLabel ? `Premium — ${tierLabel}` : 'Premium';
    bigColor = C.accent;

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
  /* OOK voor bracelet-eigenaren (operator, 9 augustus 2026): de bracelet
     ontgrendelt de sessies niet, dus er valt voor hen wel degelijk iets
     bij te kopen. Stond hier eerst `&& !isBraceletOwner` — dat verstopte
     precies de knop die een bracelet-only eigenaar nodig heeft. */
  const showUpgrade = !isLoading && !isPro;
  const showManageStore = !isLoading && isPro;
  /* De bracelet dekt de sessies al — een eigenaar heeft niets bij te
     kopen, dus voor hem verdwijnt de knop hieronder via showUpgrade. */
  const upgradeCtaText = 'Go Premium';
  const upgradeAccessibilityLabel =
    'Go Premium — unlock Breathwork and the Audio Library';

  return (
    <View style={s.card}>
      <Text style={s.label}>Subscription</Text>
      <Text style={[s.subBig, { color: bigColor }]}>{bigText}</Text>
      {subText ? <Text style={s.subSmall}>{subText}</Text> : null}
      {showUpgrade && (
        <PressScale
          style={s.cardCta}
          /* Iter v197 (2026-07-04): direct naar /subscribe (tier picker
             Monthly/Yearly) ipv Audio-tab landing. Operator-feedback:
             bracelet-owner die "Add Audio Library" tikt, wilde direct
             naar sales-card, niet eerst nog een landing doorlopen. */
          onPress={() => router.navigate('/subscribe' as never)}
          accessibilityLabel={upgradeAccessibilityLabel}
        >
          <Text style={s.cardCtaText}>{upgradeCtaText}</Text>
          <Text style={s.cardCtaArrow}>→</Text>
        </PressScale>
      )}
      {showManageStore && (
        <PressScale
          style={s.cardCta}
          /* Iter v168 (2026-06-28): SKU-specifieke deeplink (gebaseerd op
             huidige tier) → Play Store landt direct op VIBEZCORE als de
             subscription op het actieve Google account staat. */
          onPress={() => openExternal(storeSubscriptionsUrl(tier))}
          accessibilityLabel="Manage your subscription in the App Store or Google Play"
        >
          <Text style={s.cardCtaText}>Manage subscription</Text>
          <Text style={s.cardCtaArrow}>→</Text>
        </PressScale>
      )}
      {/* Iter v233 (2026-07-09): upgrade-CTA voor Monthly-subscribers →
          Yearly. Deep-linkt naar Play Store subscription page waar
          Google's native change-plan flow zit. Zonder deze CTA had een
          Monthly-user geen ingang naar Yearly (v230 tier-switch guard
          was defensief maar onbereikbaar via UI). Bundle-users hebben
          full access, Yearly-users hebben geen upgrade-pad. */}
      {!isLoading && isPro && tier === 'monthly' && braceletModel !== 'bundle' && (
        <PressScale
          style={s.cardCta}
          onPress={() => openExternal(storeSubscriptionsUrl('yearly'))}
          accessibilityLabel="Switch to the Yearly plan via the Play Store"
        >
          <View style={{ flex: 1 }}>
            <Text style={s.cardCtaText}>Switch to Yearly</Text>
            <Text style={[s.subSmall, { marginTop: 2, opacity: 0.7 }]}>
              Manage the change in the Play Store
            </Text>
          </View>
          <Text style={s.cardCtaArrow}>→</Text>
        </PressScale>
      )}
      {/* Iter v193 (2026-07-03): cross-sell naar bracelet voor audio-only
          users — actief gemaakt. Audio-PRO die z'n bracelet ontvangt kan
          nu meteen activeren zonder te wachten op Fall 2026. */}
      {!isLoading && isPro && !isBraceletOwner && (
        <PressScale
          style={s.cardCta}
          onPress={() => router.push('/activate-bracelet' as never)}
          accessibilityLabel="Activate your Smart Bead Bracelet"
        >
          <View style={{ flex: 1 }}>
            <Text style={s.cardCtaText}>Got a bracelet? Activate your bracelet or Full Bundle</Text>
            <Text style={[s.subSmall, { marginTop: 2, opacity: 0.7 }]}>
              Enter your activation code
            </Text>
          </View>
          <Text style={s.cardCtaArrow}>→</Text>
        </PressScale>
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
        <PressScale
          style={s.cardCta}
          onPress={() => router.navigate('/activate-bracelet' as never)}
          accessibilityLabel="Activate your bracelet with a code"
        >
          <Text style={s.cardCtaText}>Activate your bracelet</Text>
          <Text style={s.cardCtaArrow}>→</Text>
        </PressScale>
      </View>
    );
  }

  /* Geactiveerde owner — volledige bracelet-card met control + beadband-
     upsell. */
  return (
    <View style={s.card}>
      <Text style={s.label}>Bracelet</Text>
      <Text style={[s.subBig, { color: C.accent }]}>
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
      <PressScale
        style={s.cardCta}
        /* Operator 2026-05-30: navigate naar /bracelet tab ipv push naar
           /bracelet-control stack-screen. Reden: navigatie was inconsistent
           — vanaf Account kreeg user een back-arrow naar Account, maar
           vanuit de tab geen exit-pad. Nu uniforme tab-flow: user gaat naar
           Bracelet tab waar BraceletControl inline rendert + tab-bar
           zichtbaar blijft voor uitstappen via andere tabs. */
        onPress={() => router.navigate('/bracelet' as never)}
        accessibilityLabel="Open Session Control"
      >
        <Text style={s.cardCtaText}>Open Session Control</Text>
        <Text style={s.cardCtaArrow}>→</Text>
      </PressScale>
      {/* Iter 9gg (operator-correctie): bracelet heeft VERVANGBARE bead-
          bands, geen "rechargeable edition". Klanten kunnen nieuwe
          beadbands bestellen (andere stones, vervanging). URL volgt
          van operator.
          Iter 9dq v85 (2026-06-03): styling fix — opacity:0.6 maakte de
          knop disabled-looking terwijl 't een actieve secondary-action
          is. Nu eigen subtieler outlined style (transparent bg, dim
          border) ipv de gevulde primary cardCta met fade. Tekst en
          arrow op accent-kleur zodat de tap-affordance duidelijk is. */}
      <PressScale
        style={s.cardCtaSecondary}
        onPress={() =>
          /* /shop/beadbands bestond niet en gaf een 404 in de browser — dat
             was de "foutmelding" die de operator zag. De app deed het goed en
             opende netjes de website; de pagina was er alleen niet.
             Nu naar /shop, dat wél bestaat. Komt er ooit een eigen
             beadband-pagina, dan kan dit terug. */
          openExternal(BRACELET_SHOP_URL)
        }
        accessibilityLabel="Order new beadband"
      >
        <Text style={s.cardCtaSecondaryText}>Order new beadband</Text>
        <Text style={s.cardCtaSecondaryArrow}>→</Text>
      </PressScale>
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
    <PressScale
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
      android_ripple={{ color: 'rgba(10,10,12,0.06)' }}
    >
      <View style={s.linkTextWrap}>
        <Text style={s.linkTitle}>Library settings</Text>
        <Text style={s.linkSub}>Auto-play and playback preferences</Text>
      </View>
      <Text style={s.linkArrow}>›</Text>
    </PressScale>
  );
}

/* Het officiële Google "G"-logo (Google Identity brand-asset, 18×18
   viewBox, de vier merkkleuren) — geen platte letter (operator, 11
   augustus 2026: "moet een officiële google logo zijn de cta continue
   with google"). */
function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <SvgPath
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <SvgPath
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <SvgPath
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
      />
      <SvgPath
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </Svg>
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

  /* Iter v227 (2026-07-07, audit A5): post-signin routing per user-type.
     Voorheen: Google/Apple altijd naar `/` → bracelet-only user landde op
     Audio ipv Bracelet-tab. Nu: zelfde entitlement-check als email/password
     flow. Delegeert naar routeByEntitlement() na state-updates. */
  const routeByEntitlement = async () => {
    let isBraceletPro = false;
    let isAudioPro = false;
    try {
      const token = await getToken();
      if (token) {
        const res = await fetch(`${VZ_BACKEND_URL}/api/subscription-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const status = await res.json().catch(() => ({}));
          isAudioPro = status?.active === true;
          isBraceletPro = status?.has_bracelet_activated === true;
        }
      }
    } catch { /* network hiccup — val terug op override */ }
    if (!isAudioPro && !isBraceletPro) {
      await awaitDevUserOverrideLoaded();
      const override = getDevUserOverride();
      isBraceletPro = override === 'bracelet' || override === 'pro';
      if (override === 'pro') isAudioPro = true;
    }
    if (isBraceletPro && !isAudioPro) {
      setTimeout(() => router.replace('/bracelet' as never), 50);
    } else {
      /* Zelfde correctie als bij het inloggen: `/` is de verborgen
         audiotab, de Breath-tab is waar iemand zonder bracelet hoort te
         landen. */
      setTimeout(() => router.replace('/breath' as never), 50);
    }
  };

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
      /* Iter v229 (2026-07-08): expliciet cache-clear vóór refresh om
         free-environment flash te voorkomen bij login met bestaand PRO. */
      setSigningInStatus();
      await refreshSubscription();
      /* Iter v232 (2026-07-09): silent auto-restore. Na herinstall / verse
         install met bestaand account was handmatige "Restore purchases"-tap
         nodig om Play Store sub op te pikken — geen enkele user weet dat.
         Nu: fire-and-forget na login → RC customerInfo sync + backend
         refresh → PRO-state komt automatisch binnen. */
      /* v237c ROLLBACK v232: silent auto-restore uit login verwijderd.
         Reden: op device met actieve Play Store sub van andere VIBEZCORE-
         user (multi-user, refurbished, test-omgeving) trok silent restore
         die sub AUTOMATISCH naar de nieuwe VIBEZCORE-account. Ronde 21B
         + vC 76 verse +audio93 test bewees het lek — zelfs met v236
         already_owned error was er een tweede attributie-pad via RC's
         auto-TRANSFER bij logIn.
         Nu: user moet expliciet Restore Purchases tikken via Account tab
         als hij zijn bestaande sub wil hertrekken. Trade-off: post-
         reinstall UX minder soepel (extra tap), maar security lek dicht. */
      // silentRestoreAfterLogin();  // <-- disabled voor launch
      await refreshUserBucket();
      await clearLastPlayed();
      clearSignedUrlCache();
      /* Iter v227: entitlement-based routing (was: altijd '/') */
      await routeByEntitlement();
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
      /* Iter v229 (2026-07-08): expliciet cache-clear vóór refresh om
         free-environment flash te voorkomen bij login met bestaand PRO. */
      setSigningInStatus();
      await refreshSubscription();
      /* Iter v232 (2026-07-09): silent auto-restore — zie Google-pad. */
      /* v237c ROLLBACK v232: silent auto-restore uit login verwijderd.
         Reden: op device met actieve Play Store sub van andere VIBEZCORE-
         user (multi-user, refurbished, test-omgeving) trok silent restore
         die sub AUTOMATISCH naar de nieuwe VIBEZCORE-account. Ronde 21B
         + vC 76 verse +audio93 test bewees het lek — zelfs met v236
         already_owned error was er een tweede attributie-pad via RC's
         auto-TRANSFER bij logIn.
         Nu: user moet expliciet Restore Purchases tikken via Account tab
         als hij zijn bestaande sub wil hertrekken. Trade-off: post-
         reinstall UX minder soepel (extra tap), maar security lek dicht. */
      // silentRestoreAfterLogin();  // <-- disabled voor launch
      await refreshUserBucket();
      await clearLastPlayed();
      clearSignedUrlCache();
      /* Iter v227: entitlement-based routing (was: altijd '/') */
      await routeByEntitlement();
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
        void showVibezAlert({
          title: 'Subscription restored',
          message: `${result.restoredCount} active subscription${result.restoredCount === 1 ? '' : 's'} restored to your account.`,
        });
      } else if (result.accountMismatch) {
        /* Iter v168 (2026-06-28): vermijd tegenstrijdige UI 'Audio PRO Monthly'
           + 'Nothing to restore'. Mismatch = Play Store/Apple ID op device ≠
           VIBEZCORE account dat de aankoop deed. */
        void showVibezAlert({
          title: 'Active on your account, not on this device',
          message:
            "Your VIBEZCORE subscription is active, but the Google Play (or Apple ID) account on this device doesn't show the purchase. Switch to the account you used to subscribe, then tap Restore purchases again.",
        });
      } else {
        void showVibezAlert({
          title: 'Nothing to restore',
          message:
            'No active subscriptions were found for this Apple ID or Google account. If you believe this is wrong, contact support.',
        });
      }
    } else {
      void showVibezAlert({ title: 'Could not restore', message: result.error });
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
        /* Iter v177 (2026-07-02): AWAIT refreshSubscription vóór verdere state.
           Vermijdt race conditie waarbij user snel doorklikt naar Subscribe of
           Audio Library terwijl subscription-cache nog stale is.
           Iter v229 (2026-07-08): eerst cache-clear om free-flash te
           voorkomen bij PRO-account login. */
        setSigningInStatus();
        await refreshSubscription();
        /* Iter v232 (2026-07-09): silent auto-restore na login (email/pwd
           pad). Symmetrisch met Google/Apple paden — dekt post-reinstall
           UX zonder handmatige Restore-tap. */
        if (mode === 'login') {
          /* v237c ROLLBACK v232: silent auto-restore uit login verwijderd.
         Reden: op device met actieve Play Store sub van andere VIBEZCORE-
         user (multi-user, refurbished, test-omgeving) trok silent restore
         die sub AUTOMATISCH naar de nieuwe VIBEZCORE-account. Ronde 21B
         + vC 76 verse +audio93 test bewees het lek — zelfs met v236
         already_owned error was er een tweede attributie-pad via RC's
         auto-TRANSFER bij logIn.
         Nu: user moet expliciet Restore Purchases tikken via Account tab
         als hij zijn bestaande sub wil hertrekken. Trade-off: post-
         reinstall UX minder soepel (extra tap), maar security lek dicht. */
      // silentRestoreAfterLogin();  // <-- disabled voor launch
        }
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
        /* Iter v153 (2026-06-25): productie-pad entitlement check via
           backend ipv dev-override. Operator-feedback: 'na ingelogd zijn
           moet bezoeker naar juiste pagina, audio owner audio bracelet
           owner bracelet'. Dev-override blijft beschikbaar als fallback
           voor testing. */
        let isBraceletPro = false;
        let isAudioPro = false;
        try {
          const token = await getToken();
          if (token) {
            const res = await fetch(`${VZ_BACKEND_URL}/api/subscription-status`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const status = await res.json().catch(() => ({}));
              isAudioPro = status?.active === true;
              isBraceletPro = status?.has_bracelet_activated === true;
            }
          }
        } catch {
          /* network hiccup — val terug op dev-override hieronder */
        }
        if (!isAudioPro && !isBraceletPro) {
          await awaitDevUserOverrideLoaded();
          const override = getDevUserOverride();
          isBraceletPro = override === 'bracelet' || override === 'pro';
          if (override === 'pro') isAudioPro = true;
        }

        if (mode === 'signup') {
          /* Sign-up: blijf op /account. User ziet nu de signed-in view
             met BraceletCard (Activation required) of subscription-card,
             en kan vandaaruit de juiste eerstvolgende stap nemen
             (bracelet activeren / audio upgraden). */
          /* no redirect — gewoon de huidige view re-renderen */
        } else if (isBraceletPro && !isAudioPro) {
          /* Bracelet-only owner → direct naar Bracelet tab. */
          setTimeout(() => router.replace('/bracelet' as never), 50);
        } else {
          /* Iedereen zonder bracelet → de Breath-tab. Route `/` is de
             VERBORGEN audiobibliotheek; die stuurt zelf wel door, maar dan
             flitst er eerst een leeg scherm — rechtstreeks is gewoon
             juist. */
          setTimeout(() => router.replace('/breath' as never), 50);
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
    void showVibezAlert({
      title: 'Sign out?',
      message:
        'You will stay signed in on this device unless you sign out. After signing out, you will need to enter your password again next time.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            /* Iter v227 (2026-07-07, audit A6): stop actieve audio + bracelet
               VOORDAT session gewist wordt. Voorheen: playback bleef doorlopen
               na sign-out met dode tokens; bracelet-mode bleef actief zodat
               een volgende user op dit toestel de vorige sessie zag. Beide
               calls swallow errors — mogen sign-out nooit blokkeren. */
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { unload } = require('@/services/audio-player');
              await unload({ skipSave: true }).catch(() => {});
            } catch { /* non-fatal */ }
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { getBracelet } = require('@/services/bracelet');
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { BleCommand } = require('@/services/ble-contract');
              await getBracelet()
                .sendCommand({ mode: 0, duration: 0, command: BleCommand.Stop })
                .catch(() => {});
            } catch { /* non-fatal */ }

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
            /* Iter v170 (2026-06-28): synchroon notify {active:false} ipv
               refreshSubscription() dat een async fetchStatus afwacht.
               Voorheen: na sign-out bleef Audio Library de PRO-rendering
               vasthouden (geen Free Picks tile) totdat fetchStatus voltooide
               of, bij RC SDK cache stale, tot app-restart. Operator zag dit
               direct: "Free Picks card komt pas terug na app afsluiten". */
            setSignedOutStatus();
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
            /* Iter v199 (2026-07-04): na sign-out expliciet naar welkomst-
               scherm. Anders bleef user in Account-tab uitgelogde variant
               (Subscribe + Reserve + Invite) — operator vond dit
               onprofessioneel want de app "onthield" niet dat de user
               net was afgemeld. Welkomstscherm geeft duidelijk pad terug
               naar sign-in of nieuwe onboarding. */
            router.replace('/welcome' as never);
          },
        },
      ],
    });
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
    void showVibezAlert({
      title: 'Delete account?',
      message:
        "This will permanently remove your VIBEZCORE account, listening history, favorites, and saved settings.\n\nIf you have an active subscription, this does NOT cancel it — you must cancel via Google Play (or App Store) Subscriptions separately.\n\nThis cannot be undone.",
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => {
            /* Tweede confirm voor zekerheid — destructive action waar
               we niet van terug kunnen. */
            void showVibezAlert({
              title: 'Are you sure?',
              message:
                'Last chance to cancel. Once deleted, your account cannot be recovered.',
              buttons: [
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
                      /* Iter v170: synchroon FREE-marker, identiek aan
                         sign-out flow — voorkomt UI dat PRO-rendering
                         vasthoudt na delete. */
                      setSignedOutStatus();
                      void showVibezAlert({
                        title: 'Account deleted',
                        message: 'Your account has been permanently deleted.',
                        buttons: [
                          {
                            text: 'OK',
                            onPress: () => router.replace('/'),
                          },
                        ],
                      });
                    } else {
                      void showVibezAlert({
                        title: 'Could not delete account',
                        message: r.error,
                      });
                    }
                  },
                },
              ],
            });
          },
        },
      ],
    });
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, s.center]}>
        <ActivityIndicator color={C.text} />
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
          {/* Operator, 15 september 2026: GradientText (wit→blauw verloop,
              gebouwd voor een donkere achtergrond — zie GradientText.tsx)
              vervangen door platte tekst, anders onzichtbaar op de nieuwe
              lichte pagina. Sentence case i.p.v. ALL CAPS, per het Apple-
              font-framework (14 september 2026) dat elders in de app al
              is doorgevoerd. `screenTitle` blijft ongewijzigd: die haalt
              al `TypeScale.tabHeader` op, de ene bron voor de pagina-
              titel-rol op alle 4 tabs (operator, 11 september 2026). */}
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
            <PressScale
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
            </PressScale>
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
            {/* Iter v174 (2026-06-30): Invite-a-friend met officieel Share2-
                glyph (Android-native share-symbool) ipv ↗ Unicode-arrow.
                Operator: "sharing moet duidelijk en altijd zichtbaar". */}
            <PressScale
              style={s.cardRow}
              onPress={shareInvite}
              accessibilityLabel="Invite a friend to VIBEZCORE"
            >
              <View style={s.cardRowIconText}>
                <Share2 size={17} color="#4ade80" strokeWidth={2.2} />
                <Text style={[s.cardRowText, { color: '#4ade80', marginLeft: 10 }]}>Invite a friend</Text>
              </View>
              <Text style={s.cardRowArrow}>›</Text>
            </PressScale>
            <View style={s.cardRowDivider} />
            {/* Iter 9dq v86 (2026-06-03): Restore Purchases. Apple App
                Review Guideline 3.1.1 vereist deze knop voor IAP-apps.
                Bovenaan de lijst zodat 'ie vindbaar is na een reinstall
                of new-device sign-in. */}
            <PressScale
              style={s.cardRow}
              onPress={onRestorePurchases}
              disabled={restoring}
              accessibilityLabel="Restore previous purchases"
            >
              <Text style={s.cardRowText}>
                {restoring ? 'Restoring…' : 'Restore purchases'}
              </Text>
              {restoring ? (
                <ActivityIndicator color={C.textDim} size="small" />
              ) : (
                <Text style={s.cardRowArrow}>›</Text>
              )}
            </PressScale>
            <View style={s.cardRowDivider} />
            {/* Operator, 13 september 2026: "settings knop is weg, wil hem
               terug met inhoud zoals het was" — herroept de verwijdering
               van 11 september. */}
            <PressScale
              style={s.cardRow}
              onPress={() => router.navigate('/settings')}
              accessibilityLabel="Open settings"
            >
              <Text style={s.cardRowText}>Settings</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </PressScale>
            <View style={s.cardRowDivider} />
            {/* About VIBEZCORE — brand-story screen voor users die
                meer willen weten over wat VIBEZCORE is. Custom screen
                src/app/about.tsx, gesynced met vibezcore.com/about-
                vibezcore. */}
            <PressScale
              style={s.cardRow}
              onPress={() => router.navigate('/about' as never)}
              accessibilityLabel="Learn about VIBEZCORE"
            >
              <Text style={s.cardRowText}>About VIBEZCORE</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </PressScale>
            <View style={s.cardRowDivider} />
            {/* FAQ — voor "Contact support" zodat user eerst self-serve
                kan proberen. Mirror van vibezcore.com/faq, content in
                src/data/faq-content.ts. */}
            <PressScale
              style={s.cardRow}
              onPress={() => router.navigate('/faq' as never)}
              accessibilityLabel="Browse frequently asked questions"
            >
              <Text style={s.cardRowText}>Frequently asked questions</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </PressScale>
            <View style={s.cardRowDivider} />
            <PressScale
              style={s.cardRow}
              onPress={() => router.navigate('/support')}
              accessibilityLabel="Contact VIBEZCORE support"
            >
              <Text style={s.cardRowText}>Contact support</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </PressScale>
          </View>

          {/* Cancel Subscription verwijderd — iter 9dq v150 (operator
              2026-06-17): app is IAP-only. Apple/Google verbieden in-app
              cancellation; user gebruikt de "Manage subscription"-knop
              bovenaan deze tab (opent Settings → Apple ID → Subscriptions
              of Play Store → Subscriptions). */}

          <PressScale style={s.signOut} onPress={onSignOut}>
            <Text style={s.signOutText}>Sign out</Text>
          </PressScale>

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
            <PressScale
              style={s.dangerBtn}
              onPress={onDeleteAccount}
              accessibilityLabel="Request account deletion"
            >
              <Text style={s.dangerBtnText}>Delete my account</Text>
            </PressScale>
          </View>

          {/* ── Legal section ──
              Vervangt de oude [OPERATOR]-placeholder. 5 sub-screens
              gepushed via `legal/[doc]`. Inhoud van de webapp HTMLs
              (operator-bevestigd 2026-05-27) en wordt onafhankelijk
              van die webapp in de app onderhouden — als de webapp
              uitgefaseerd wordt blijven deze docs gewoon staan. */}
          <View style={s.card}>
            <Text style={s.label}>Legal & Safety</Text>
            <PressScale
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
            </PressScale>
            <View style={s.cardRowDivider} />
            <PressScale
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
            </PressScale>
            <View style={s.cardRowDivider} />
            <PressScale
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
            </PressScale>
            <View style={s.cardRowDivider} />
            <PressScale
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
            </PressScale>
            <View style={s.cardRowDivider} />
            <PressScale
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
            </PressScale>
            <View style={s.cardRowDivider} />
            <PressScale
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
            </PressScale>
            <View style={s.cardRowDivider} />
            <PressScale
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
            </PressScale>
            <View style={s.cardRowDivider} />
            {/* Audio Sessions — legal-disclaimer specifiek voor de
                audio content (no affiliation, IP, etc). Op de website
                staat 'ie onder PLATFORM-footer, in de app bij Legal
                & Safety omdat de inhoud legal van aard is. */}
            <PressScale
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
            </PressScale>
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

        {/* Hero greeting — operator-mockup, 11 augustus 2026 ("header/hero
            sectie correct opbouwen", exclusief de productfoto uit de
            mockup — die hoort al bij de welkomstpagina, niet hier
            nogmaals). Klein wordmark boven een echte kop i.p.v. de oude
            opbouw (kleine "WELCOME TO"-label + wordmark + accentstreepje +
            een ondergeschikte instructiezin) — dat las als drie losse
            regeltjes, geen kop. */}
        {/* Wordmark BLIJFT, gecentreerd, met de kop + subtekst eronder ook
            gecentreerd (operator, 11 augustus 2026, verduidelijking:
            "centreren logo boven en eronder enkel welcome en dan
            access...") — het wordmark zelf hoeft dus niet weg, alleen de
            eerdere links-uitlijning van de tekst eronder wordt centered. */}
        <View style={s.heroBlock}>
          <Image
            source={require('../../../assets/vibezcore_wordmark.png')}
            style={s.heroWordmark}
            resizeMode="contain"
            accessibilityLabel="VIBEZCORE"
          />
          {/* "Welcome" alleen (operator, 11 augustus 2026: "enkel welcome
              niet welcome to vibezcore") — het wordmark erboven zegt de
              merknaam al. */}
          <Text style={s.heroGreeting}>Welcome</Text>
          <Text style={s.heroSub}>
            Access your account or explore everything VIBEZCORE has to
            offer.
          </Text>
        </View>

        {/* ── SIGN-IN CARD ── operator-mockup, 11 augustus 2026: intro-blok
            (icoon + "WELCOME BACK" + titel + subtekst) toegevoegd, en
            email/wachtwoord/knop staan nu VOOR de social-knoppen — de
            vorige volgorde (social eerst, velden erna) was het omgekeerde
            van de mockup. */}
        <View style={s.authCard}>
          <View style={s.authCardHeader}>
            <View style={s.authCardIconBadge}>
              <Lock size={18} color={C.accent} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.authCardLabel}>
                {mode === 'login' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
              </Text>
              <Text style={s.authCardTitle}>
                {mode === 'login'
                  ? 'Sign in to your account'
                  : 'Create your account'}
              </Text>
            </View>
          </View>
          <Text style={s.authCardIntro}>
            Access your premium content and manage your products.
          </Text>

          {/* Icoon in het veld, geen los "Email"-label erboven (operator-
              mockup, 11 augustus 2026: "exact wat je ziet" — de mockup
              heeft geen labels boven de velden, de envelop/hangslot-
              iconen IN het veld dragen die rol). */}
          <View style={s.inputIconWrap}>
            <Mail size={17} color={C.textDim} strokeWidth={2} />
            <TextInput
              style={s.inputWithIcon}
              value={emailInput}
              onChangeText={(v) => {
                setEmailInput(v);
                if (msg) setMsg(null);
              }}
              placeholder="Email address"
              placeholderTextColor={C.textDim}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />
          </View>

          {/* Iter v144: live email-feedback. Toont niets bij leeg veld;
              warn bij typo (met tap-to-fix); success bij valid format. */}
          {(() => {
            if (!emailInput.trim()) return null;
            const v = validateEmail(emailInput);
            const hint = emailHintText(v);
            if (!hint.text) return null;
            const toneStyle =
              hint.tone === 'success'
                ? { color: C.success }
                : hint.tone === 'warn'
                  ? { color: '#ffb450' }
                  : hint.tone === 'error'
                    ? { color: C.error }
                    : { color: C.textDim };
            if (v.ok === 'maybe' && v.reason === 'typo') {
              return (
                <PressScale
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
                </PressScale>
              );
            }
            return (
              <Text style={[{ fontSize: 12, fontFamily: BrandFonts.medium, marginTop: 8 }, toneStyle]}>
                {hint.text}
              </Text>
            );
          })()}

          <View style={[s.inputIconWrap, { marginTop: 12 }]}>
            <Lock size={17} color={C.textDim} strokeWidth={2} />
            <TextInput
              style={s.inputWithIcon}
              value={pwInput}
              onChangeText={setPwInput}
              placeholder="Password"
              placeholderTextColor={C.textDim}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
            {/* Oog-icoon i.p.v. "Show"/"Hide"-tekst (operator-mockup). */}
            <PressScale
              onPress={() => setShowPw((v: boolean) => !v)}
              hitSlop={10}
              scaleTo={0.92}
            >
              {showPw ? (
                <EyeOff size={17} color={C.textDim} strokeWidth={2} />
              ) : (
                <Eye size={17} color={C.textDim} strokeWidth={2} />
              )}
            </PressScale>
          </View>

          {msg && <Text style={s.msg}>{msg}</Text>}

          {/* Forgot password VOOR de Sign In-knop, niet erna (operator-
              mockup, 11 augustus 2026: "forgot password staat klein
              rechtsboven de sign in"). */}
          <PressScale
            style={s.forgotLink}
            onPress={() => router.navigate('/forgot-password' as never)}
            accessibilityLabel="Reset your password"
          >
            <Text style={s.forgotLinkText}>Forgot password?</Text>
          </PressScale>

          <PressScale
            style={[s.primaryBtn, busy && s.btnDisabled]}
            onPress={onSubmit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={C.text} />
            ) : (
              <>
                {/* Operator, 9 september 2026: "endowment effect (...) niet
                   sign up maar continue zoals duolingo" — 'Sign Up' framet
                   dit als een nieuwe, extra stap; 'Continue' framet het als
                   verdergaan met wat de user al aan het doen was (minder
                   drempel, geen nieuw "commitment" gevoel). */}
                <Text style={s.primaryBtnText}>
                  {mode === 'login' ? 'Sign In' : 'Continue'}
                </Text>
              </>
            )}
          </PressScale>

          {/* Social sign-in NA de velden (operator-mockup, 11 augustus
              2026) — was ervoor. Apple + Google naast elkaar i.p.v.
              gestapeld, zoals de mockup toont. */}
          {(googleAvailable || appleAvailable) && (
            <View style={{ marginTop: 6 }}>
              <View style={s.orDividerRow}>
                <View style={s.orDividerLine} />
                <Text style={s.orDividerText}>or</Text>
                <View style={s.orDividerLine} />
              </View>
              <View style={s.socialRow}>
                {appleAvailable && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={12}
                    style={{ flex: 1, height: 48 }}
                    onPress={() => void onAppleSignIn()}
                  />
                )}
                {googleAvailable && (
                  <PressScale
                    style={s.googleBtn}
                    onPress={() => void onGoogleSignIn()}
                  >
                    {/* Officieel Google "G"-logo, niet een platte letter
                        (operator, 11 augustus 2026: "moet een officiële
                        google logo zijn"). */}
                    <GoogleGlyph size={16} />
                    <Text style={s.googleBtnText}>Continue with Google</Text>
                  </PressScale>
                )}
              </View>
            </View>
          )}

          <Text style={s.staySignedIn}>
            You'll stay signed in on this device
          </Text>

          {/* "Don't have an account? Sign Up" ontbrak (operator, 11
              augustus 2026: "google sign in apple sign in sign up...").
              `mode` bestond al (login/signup, stuurt onSubmit naar login()
              of signup()) maar had nog geen zichtbare toggle — dit is 'm. */}
          <PressScale
            onPress={() => {
              setMode((m) => (m === 'login' ? 'signup' : 'login'));
              setMsg(null);
            }}
            hitSlop={8}
            style={{ alignSelf: 'center', marginTop: 14 }}
          >
            <Text style={s.staySignedIn}>
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <Text style={{ color: C.accent, fontFamily: BrandFonts.semibold }}>
                    Sign Up
                  </Text>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <Text style={{ color: C.accent, fontFamily: BrandFonts.semibold }}>
                    Sign In
                  </Text>
                </>
              )}
            </Text>
          </PressScale>

        </View>

        {/* Iter v238h (2026-07-10, operator-feedback): "activate moet
            prominenter, dat is geen bijproduct en op gelijke voet met
            library". Herschreven van subtiele text-link naar volwaardige
            product-card met eigen eyebrow, titel, one-liner en primary
            CTA — visueel gelijkwaardig aan Audio Library en Bracelet
            cards hieronder. Boven de "NEW TO VIBEZCORE" divider want
            deze card is voor OWNERS (al gekocht), niet voor discovery. */}
        {/* Hele kaart tikbaar, geen losse knop meer (operator-mockup, 11
            augustus 2026: enkel een chevron rechts, icoon+tekst links). */}
        <PressScale
          style={s.productCardRow}
          onPress={() => router.navigate('/activate-bracelet' as never)}
          accessibilityLabel="Activate your Bracelet or Full Bundle code"
        >
          <View style={s.productCardIconBadge}>
            <Package size={18} color={C.accent} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.productStatusLabel}>ALREADY OWN A PRODUCT?</Text>
            <Text style={s.productTitle}>Activate your product</Text>
            <Text style={s.productOneLiner}>
              Activate your bracelet or full bundle code.
            </Text>
          </View>
          <ChevronRight size={18} color={C.accent} strokeWidth={2.2} />
        </PressScale>

        {/* Iter v238g (2026-07-10, operator-feedback): "in account is blok
            got a bracelet en new to vibezcore redelijk rommelig".
            Gesaneerd: eyebrow-title-subline stack verkort tot 1 subtiele
            divider-header. Activate CTA (hierboven) en product-cards
            (hieronder) hebben nu een duidelijke visuele scheiding zonder
            concurrerende eyebrows. */}
        {/* "EXPLORE VIBEZCORE", niet "NEW TO VIBEZCORE" (operator-mockup,
            11 augustus 2026) — deze sectie toont ook aan bestaande leden
            wat er nog te ontdekken valt, niet alleen aan nieuwkomers. */}
        <View style={s.newHereDivider}>
          <View style={s.newHereDividerLine} />
          <Text style={s.newHereDividerText}>EXPLORE VIBEZCORE</Text>
          <View style={s.newHereDividerLine} />
        </View>

        {/* ── PRODUCT CARDS — restructured iter 9dq v10 (2026-06-02) ──
            Was: 2 cards × 16 tekstlagen + 3 CTAs + 3 badges = visueel
            druk voor een gast. Operator-feedback: rustiger maar boeiend,
            upsell behouden.
            Nu: 2 cards, elk met eyebrow-status + titel + 1-line + CTA.
            Bundle leeft INSIDE de bracelet-card als inline BEST VALUE-
            rij ipv eigen CTA. Reassurance gereduceerd tot 1 dim regel. */}

        {/* Card 1: Guided Breathwork — het product dat er NÚ is. Verving
            de Audio Library-kaart (operator, 9 augustus 2026); die wees
            bovendien naar de verborgen audiotab. */}
        <View style={s.productCard}>
          <View style={s.productStatusRow}>
            <View
              style={[
                s.productStatusDot,
                { backgroundColor: C.success },
              ]}
            />
            <Text style={s.productStatusLabel}>AVAILABLE NOW</Text>
          </View>
          <Text style={s.productTitle}>Guided Breathwork</Text>
          {/* Tekst woordelijk uit de mockup (operator, 11 augustus 2026). */}
          <Text style={s.productOneLiner}>
            Premium sessions to improve focus, sleep and performance.
          </Text>
          {/* Tekstlink met pijltje, geen volle knop (operator-mockup). */}
          <PressScale
            style={s.productCtaLink}
            onPress={() => router.navigate('/subscribe' as never)}
            accessibilityLabel="Go Premium — unlock Breathwork and the Audio Library"
          >
            <Text style={[s.productCtaLinkText, { color: C.accent }]}>
              Go Premium
            </Text>
            <ChevronRight size={15} color={C.accent} strokeWidth={2.2} />
          </PressScale>
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
                { backgroundColor: '#E0B341' },
              ]}
            />
            {/* Geen datum meer (operator, 2026-07-14): sep-datum gedropt,
                communicatie is “Launching Fall 2026”. Goud, niet gedimd
                (operator, 11 augustus 2026: "knop bracelet fall 2026 moet
                heel duidelijk opvallen") — zelfde tint als de
                "COMING FALL 2026"-badge in de onboarding en de
                Activity-tab (#E0B341, "geen defect maar een
                aankondiging"). */}
            <Text style={[s.productStatusLabel, { color: '#E0B341' }]}>
              EARLY BIRD · LAUNCHING FALL 2026
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
          <PressScale
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
          </PressScale>

          {/* Option B: Bundle — BEST VALUE highlighted, order-bump styling.
              Pakketnaam (VIBEZCORE Full Bundle) prominent + extra dim
              regel onder met wat de bundle inhoudt. */}
          <PressScale
            style={s.reserveOptionBundle}
            onPress={() =>
              openExternal('https://www.vibezcore.com/subscribe-bundle')
            }
            accessibilityLabel="Reserve your spot for VIBEZCORE Full Bundle, bracelet plus 12 months Premium"
          >
            <View style={s.reserveOptionLeft}>
              <View style={s.bundleInlineBadge}>
                <Text style={s.bundleInlineBadgeText}>BEST VALUE</Text>
              </View>
              <Text style={s.reserveOptionTitle}>Reserve your spot</Text>
              <Text style={s.reserveOptionSub}>VIBEZCORE Full Bundle</Text>
              <Text style={s.reserveOptionSubFine}>
                Bracelet + 12 months Premium
              </Text>
            </View>
            <Text style={s.reserveOptionArrow}>→</Text>
          </PressScale>

          {/* Disclaimer — 2-regel volledig zoals voorheen, omdat dit
              juridisch + emotioneel relevant is voor preorders. */}
          <Text style={s.productCardDisclaimer}>
            No credit card · No financial data · No purchase obligation
          </Text>
          <Text style={s.productCardDisclaimerSub}>
            We only use your email to notify you before launch
          </Text>
        </View>

        {/* Iter v186: Activate card verplaatst naar direct onder Sign in
            form (hoger op de pagina, boven Get Started). Voorheen stond deze
            hier onder. */}

        {/* Iter v174 (2026-06-30): Invite-a-friend met officieel Share2-glyph
            voor guests. Operator: "sharing moet duidelijk en altijd zichtbaar".
            Gasten zien dit direct na Get Started — primaire growth-loop voor
            pre-KS-launch awareness. */}
        {/* SUPPORT — herbouwd naar de mockup (operator, 11 augustus 2026):
            rijen met icoon + titel + onderschrift + chevron, i.p.v. de
            oude losse "Invite a friend"-knop + een enkele dot-separated
            tekstregel (Settings/About/FAQ/Contact support) die totaal niet
            op de mockup leek. "About" is teruggezet (operator, zelfde dag,
            later bericht: "ik zie die about tab nergens staan" — de
            guest-view had 'm nergens, alleen ingelogde users zagen 'm via
            Settings & Help).

            "Settings" bleef toen bewust weg (niet in de mockup, enkel
            bereikbaar via de __DEV__-link onderaan) — teruggedraaid
            operator, 7 september 2026: "voor user de functies voor echte
            users" — settings.tsx bevat inmiddels functies die precies
            GASTEN nodig hebben (breath-onboarding opnieuw bekijken, welcome
            opnieuw bekijken, gratis-sessie-status), en die zaten zo enkel
            achter een verborgen dev-knop. Bovenaan de lijst: dit is
            inmiddels een eersteklas ingang, geen bijzaak meer. */}
        <Text style={s.supportSectionLabel}>SUPPORT</Text>
        <View style={s.supportList}>
          {/* Operator, 13 september 2026: "settings knop is weg, wil hem
             terug met inhoud zoals het was" — herroept de 24e ronde. */}
          <PressScale
            style={s.supportRow}
            onPress={() => router.navigate('/settings' as never)}
            accessibilityLabel="Open settings"
          >
            <SettingsIcon size={18} color={C.accent} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={s.supportRowTitle}>Settings</Text>
              <Text style={s.supportRowSub}>Playback, privacy, and more</Text>
            </View>
            <ChevronRight size={16} color="rgba(10,10,12,0.3)" strokeWidth={2.2} />
          </PressScale>
          <View style={s.supportRowSep} />
          <PressScale
            style={s.supportRow}
            onPress={shareInvite}
            accessibilityLabel="Invite a friend to VIBEZCORE"
          >
            <UserPlus size={18} color={C.accent} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={s.supportRowTitle}>Invite a Friend</Text>
              <Text style={s.supportRowSub}>
                Share VIBEZCORE and get rewards
              </Text>
            </View>
            <ChevronRight size={16} color="rgba(10,10,12,0.3)" strokeWidth={2.2} />
          </PressScale>
          <View style={s.supportRowSep} />
          <PressScale
            style={s.supportRow}
            onPress={() => router.navigate('/faq' as never)}
            hitSlop={8}
          >
            <HelpCircle size={18} color={C.accent} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={s.supportRowTitle}>FAQ</Text>
              <Text style={s.supportRowSub}>Common questions</Text>
            </View>
            <ChevronRight size={16} color="rgba(10,10,12,0.3)" strokeWidth={2.2} />
          </PressScale>
          <View style={s.supportRowSep} />
          <PressScale
            style={s.supportRow}
            onPress={() => router.navigate('/support' as never)}
            hitSlop={8}
          >
            <Headphones size={18} color={C.accent} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={s.supportRowTitle}>Contact Support</Text>
              <Text style={s.supportRowSub}>We're here to help</Text>
            </View>
            <ChevronRight size={16} color="rgba(10,10,12,0.3)" strokeWidth={2.2} />
          </PressScale>
          <View style={s.supportRowSep} />
          <PressScale
            style={s.supportRow}
            onPress={() => router.navigate('/legal/shipping' as never)}
            hitSlop={8}
          >
            <Package size={18} color={C.accent} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={s.supportRowTitle}>Shipping & Returns</Text>
              <Text style={s.supportRowSub}>
                Info about delivery and returns
              </Text>
            </View>
            <ChevronRight size={16} color="rgba(10,10,12,0.3)" strokeWidth={2.2} />
          </PressScale>
          <View style={s.supportRowSep} />
          <PressScale
            style={s.supportRow}
            onPress={() => router.navigate('/about' as never)}
            accessibilityLabel="Learn about VIBEZCORE"
            hitSlop={8}
          >
            <Info size={18} color={C.accent} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={s.supportRowTitle}>About VIBEZCORE</Text>
              <Text style={s.supportRowSub}>
                What we're building, and why
              </Text>
            </View>
            <ChevronRight size={16} color="rgba(10,10,12,0.3)" strokeWidth={2.2} />
          </PressScale>
        </View>

        {/* ── LEGAL FOOTER ── teruggebracht naar exact de 5 links uit de
            mockup (operator, 11 augustus 2026) — Access/Shipping/Refund
            zijn weg uit deze regel (Shipping leeft nu in de Support-rij
            hierboven; Access en Refund waren geen onderdeel van de mockup
            en blijven bereikbaar via hun eigen /legal/-route voor wie de
            link kent, gewoon niet meer hier opgesomd). */}
        <View style={s.legalFooter}>
          <View style={s.legalLinkRow}>
            <PressScale
              onPress={() => router.navigate('/legal/terms' as never)}
              hitSlop={8}
              scaleTo={0.92}
            >
              <Text style={s.legalLink}>Terms</Text>
            </PressScale>
            <Text style={s.legalLinkSep}>·</Text>
            <PressScale
              onPress={() => router.navigate('/legal/privacy' as never)}
              hitSlop={8}
              scaleTo={0.92}
            >
              <Text style={s.legalLink}>Privacy</Text>
            </PressScale>
            <Text style={s.legalLinkSep}>·</Text>
            <PressScale
              onPress={() => router.navigate('/legal/cookies' as never)}
              hitSlop={8}
              scaleTo={0.92}
            >
              <Text style={s.legalLink}>Cookies</Text>
            </PressScale>
            <Text style={s.legalLinkSep}>·</Text>
            <PressScale
              onPress={() => router.navigate('/legal/health' as never)}
              hitSlop={8}
              scaleTo={0.92}
            >
              <Text style={s.legalLink}>Health Disclaimer</Text>
            </PressScale>
            <Text style={s.legalLinkSep}>·</Text>
            <PressScale
              onPress={() =>
                router.navigate('/legal/audio-sessions' as never)
              }
              hitSlop={8}
              scaleTo={0.92}
            >
              <Text style={s.legalLink}>Audio Disclaimer</Text>
            </PressScale>
          </View>
          <Text style={s.legalCopy}>© VIBEZCORE 2026</Text>
        </View>

        {/* Iter 9dq (2026-06-02): dev-only Settings-link in signed-out
            view. De normale Settings-link zit alleen in de ingelogde
            Account-view, dus voor het wisselen van de Dev user-override
            in test (bv. 'Free / Guest' vs 'Audio PRO') moest je eerst
            inloggen. Met deze link kan een tester de override aanpassen
            zonder eerst een account-roundtrip te doen. Verschijnt enkel
            in __DEV__ builds — productie ziet 'm niet.
            Operator, 13 september 2026: teruggezet, zie de toelichting
            bij de andere twee Settings-links hierboven. */}
        {__DEV__ && (
          <PressScale
            onPress={() => router.navigate('/settings' as never)}
            hitSlop={12}
            style={s.devSettingsLink}
            accessibilityLabel="Open developer settings"
          >
            <Text style={s.devSettingsLinkText}>
              🔧 Developer settings (dev only)
            </Text>
          </PressScale>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
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
  heroWordmark: {
    width: 190,
    height: 30,
    marginBottom: 22,
    /* Subtle shadow voor brand-presence — matched welcome.tsx style. */
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  /* "Welcome to VIBEZCORE" als echte kop i.p.v. de oude losse
     label+wordmark+streepje-opbouw (operator-mockup, 11 augustus 2026). */
  heroGreeting: {
    /* extrabold → regular (operator, 11 augustus 2026: "wat heb ik gezegd
       over de font?" — koppen zijn de hele avond al regular-gewicht op
       Breath/Bracelet/Audio Library, deze bleef nog op het oude zware
       gewicht staan). */
    color: C.text,
    fontSize: 26,
    fontFamily: BrandFonts.regular,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSub: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  /* Card-frame voor zowel sign-in als product-sectie. Subtle bg-tint
     + hairline border = visueel één geheel per sectie. */
  /* Blauw getint i.p.v. neutraal grijs (operator-mockup, 11 augustus
     2026, close-up: "kijk hier" — de kaart draagt duidelijk een blauwe
     achtergrond + rand, niet C.panel-grijs). */
  authCard: {
    backgroundColor: `rgba(${ROYAL_INDIGO_RGB},0.08)`,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: `rgba(${ROYAL_INDIGO_RGB},0.35)`,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 18,
  },
  /* Iter v149 v2 (2026-06-25): bracelet-code activate als eigen prominent
     card — gelijkwaardig aan SIGN IN card. Accent border + glow zodat
     bracelet-owners het meteen vinden. Operator-feedback: bracelet wordt
     main product, niet verstoppen onder dim link. */
  activateBraceletCard: {
    backgroundColor: `rgba(${ROYAL_INDIGO_RGB},0.10)`,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: `rgba(${ROYAL_INDIGO_RGB},0.55)`,
    marginBottom: 18,
    shadowColor: '#1E2A4A',
    shadowOpacity: 0.20,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  activateBraceletCardInner: {
    paddingVertical: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activateBraceletCardTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  activateBraceletCardEyebrow: {
    color: C.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): zelfde rol
     als `activateBraceletEntryLabel` op bracelet.tsx (was daar 18px, hier
     17px) — nu allebei uit `TypeScale.compactCardTitle`. */
  activateBraceletCardLabel: {
    color: C.text,
    ...TypeScale.compactCardTitle,
    marginBottom: 4,
    lineHeight: 21,
  },
  activateBraceletCardSub: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
    lineHeight: 17,
  },
  activateBraceletCardArrow: {
    color: C.accent,
    fontSize: 26,
    fontFamily: BrandFonts.regular,
    lineHeight: 26,
  },
  /* Iter v187 (2026-07-02): "Don't have a Smart Bead Bracelet yet? Learn
     more at vibezcore.com →" — externe link naar marketing site voor
     niet-eigenaars. Subtiel: dim tekst, accent op link-gedeelte. */
  learnMoreLink: {
    marginTop: 4,
    marginBottom: 18,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  learnMoreLinkText: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  learnMoreLinkAccent: {
    color: C.accent,
    fontFamily: BrandFonts.semibold,
  },
  authCardLabel: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
    marginBottom: 14,
  },
  authCardIntro: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 19,
    marginBottom: 14,
  },
  /* Intro-blok boven de velden (operator-mockup, 11 augustus 2026). */
  authCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  authCardIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `rgba(${ROYAL_INDIGO_RGB},0.14)`,
  },
  authCardTitle: {
    color: C.text,
    fontSize: 17,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 12,
  },
  orDividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  orDividerText: {
    marginHorizontal: 12,
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  /* Apple + Google naast elkaar, niet gestapeld (operator-mockup). */
  socialRow: { flexDirection: 'row', gap: 10 },
  googleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
  },
  googleBtnText: {
    color: '#1f1f1f',
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
  },

  /* ── Iter 9dq v10 (2026-06-02): restructured product-cards ──
     Clean layout: eyebrow → title → 1-liner → CTA. Bundle als inline
     order-bump met BEST VALUE stamp. Vervangt de oude druk gestapelde
     2-card layout met 3 CTAs en 3 badges. */
  productCard: {
    marginTop: 14,
    padding: 18,
    borderRadius: 14,
    backgroundColor: C.panel,
    /* Subtiele blauwe omlijning matched de history-page card-style. */
    borderColor: `rgba(${ROYAL_INDIGO_RGB}, 0.28)`,
    borderWidth: 1,
  },
  /* Hele-kaart-tikbaar variant (operator-mockup, 11 augustus 2026) — icoon
     + tekst links, chevron rechts, geen losse knop. */
  productCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderColor: 'rgba(74,222,128,0.35)',
    borderWidth: 1,
  },
  productCardIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74,222,128,0.14)',
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
  /* Gedeeld door 3 labels ("ALREADY OWN A PRODUCT?", "AVAILABLE NOW",
     "EARLY BIRD · LAUNCHING FALL 2026") — bewust neutraal/gedimd hier;
     alleen de FALL 2026-regel krijgt zijn eigen goud-override verderop
     (operator, 11 augustus 2026), niet deze gedeelde basisstijl. */
  productStatusLabel: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
  },
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): 22px was
     al toevallig gelijk aan `TypeScale.cardHeadline`, enkel het gewicht
     (extrabold i.p.v. bold) en letterSpacing (-0.4 i.p.v. -0.3) weken af
     zonder reden — nu uit dezelfde bron. */
  productTitle: {
    color: C.text,
    ...TypeScale.cardHeadline,
    marginBottom: 4,
  },
  productOneLiner: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    marginBottom: 18,
  },
  /* Iter 9dq v12: extra dim regel onder one-liner voor "limited units —
     first reserved, first served". Subtieler dan one-liner zodat het
     als scarcity-microcopy leest, niet als hoofdpunt. */
  productSubOneLiner: {
    color: 'rgba(10,10,12,0.40)',
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
    backgroundColor: C.accent,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 8,
  },
  /* Tekstlink met pijltje i.p.v. volle knop (operator-mockup). */
  productCtaLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    gap: 2,
  },
  productCtaLinkText: {
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
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
    borderColor: C.accent,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 8,
    marginBottom: 14,
  },
  productCtaSecondaryText: {
    color: C.accent,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  productCtaSecondaryArrow: {
    color: C.accent,
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
    borderColor: `rgba(${ROYAL_INDIGO_RGB}, 0.45)`,
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
    backgroundColor: `rgba(${ROYAL_INDIGO_RGB}, 0.10)`,
    borderColor: `rgba(${ROYAL_INDIGO_RGB}, 0.50)`,
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
    color: C.accent,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.1,
  },
  reserveOptionSub: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    marginTop: 3,
  },
  /* Iter 9dq v12: extra fine-print onder pakketnaam (alleen bundle).
     Toont wat in de bundle zit zonder de pakketnaam te overschaduwen. */
  reserveOptionSubFine: {
    color: 'rgba(10,10,12,0.35)',
    fontSize: 11,
    fontFamily: BrandFonts.regular,
    marginTop: 2,
  },
  reserveOptionArrow: {
    color: C.accent,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    marginLeft: 10,
  },
  /* BEST VALUE pill — gedeeld door bundle inline. */
  bundleInlineBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.success,
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

  /* Iter v159 (2026-06-26): Get Started sectie-header — vervangt de
     'or get started' divider. Operator: 'sign up CTA om aan te kopen
     is zeer onprofessioneel — get started moet duidelijk en prominent
     onmiddellijk volgen na sign in'. */
  /* Iter v238g (2026-07-10): getStartedHeader vervangen door
     newHereDivider — subtiele lijn+label ipv eyebrow+title+subline stack.
     Reduceert visuele ruis boven de product-cards. */
  newHereDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 14,
    paddingHorizontal: 4,
    gap: 12,
  },
  newHereDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(10,10,12,0.10)',
  },
  newHereDividerText: {
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1.4,
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
    backgroundColor: C.success,
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
    backgroundColor: `rgba(${ROYAL_INDIGO_RGB},0.06)`,
    borderColor: C.accent,
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
    color: C.accent,
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
    color: C.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
  },
  earlyBirdDate: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  earlyBirdHeadline: {
    color: C.text,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  earlyBirdSub: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 17,
    marginBottom: 14,
  },
  /* Disclaimer onder de 3 product-knoppen (samengevoegd uit 2 dubbele) */
  productCardDisclaimer: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 6,
  },
  productCardDisclaimerSub: {
    color: 'rgba(10,10,12,0.40)',
    fontSize: 10,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
    lineHeight: 14,
  },
  /* Legal footer — 5 doc-links als inline link-row, altijd zichtbaar
     (ook voor guests = AVG/compliance + UX-conventie). */
  /* Iter v172 (2026-06-29): inline activate-bracelet link onder
     productcards. Sober, niet visueel zwaar — voor backers die hun
     code zoeken. Operator-feedback: was bovenaan verwarrend. */
  /* Iter v190 (2026-07-02): compacte activate-shortcut voor Account tab
     uitgelogd. Route direct naar /activate-bracelet ipv naar Bracelet tab. */
  activateBraceletShortcut: {
    marginTop: 14,
    marginBottom: 6,
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: `rgba(${ROYAL_INDIGO_RGB},0.06)`,
    borderWidth: 1,
    borderColor: `rgba(${ROYAL_INDIGO_RGB},0.22)`,
    alignItems: 'center',
  },
  activateBraceletShortcutText: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    textAlign: 'center',
    lineHeight: 18,
  },
  activateBraceletShortcutAccent: {
    color: C.accent,
    fontFamily: BrandFonts.bold,
  },
  activateBraceletInline: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activateBraceletInlineText: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    letterSpacing: 0.1,
  },
  activateBraceletInlineLink: {
    color: C.accent,
    fontFamily: BrandFonts.semibold,
  },
  /* Iter v186 (2026-07-02): duplicate activateBraceletCard styles verwijderd.
     Bestaande v149 styling (regel 1938+) hergebruikt — die was al gedesigned
     als "prominent card gelijkwaardig aan SIGN IN card. Accent border + glow
     zodat bracelet-owners het meteen vinden". Match precies mijn intent. */
  /* Iter v174 (2026-06-30): Invite-friend CTA voor guests — prominent
     boven info-links. Groen accent matched Free Picks branding (free
     sessions = entry-point voor invited users). Share2-icon links van
     label voor visuele balans. */
  /* Voor cardRow met icoon links van label — Share2-glyph naast tekst. */
  cardRowIconText: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  /* SUPPORT-sectie, herbouwd naar de mockup (operator, 11 augustus 2026):
     4 rijen met icoon + titel + onderschrift + chevron. */
  supportSectionLabel: {
    color: 'rgba(10,10,12,0.4)',
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.6,
    marginTop: 26,
    marginBottom: 10,
  },
  supportList: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10,10,12,0.08)',
    backgroundColor: 'rgba(10,10,12,0.025)',
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  supportRowSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,12,0.08)',
    marginLeft: 46,
  },
  supportRowTitle: {
    color: C.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  supportRowSub: {
    marginTop: 1,
    color: 'rgba(10,10,12,0.5)',
    fontSize: 12,
    fontFamily: BrandFonts.regular,
  },
  legalFooter: {
    marginTop: 14,
    paddingTop: 18,
    paddingBottom: 8,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10,10,12,0.06)',
  },
  legalLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 10,
  },
  legalLink: {
    color: 'rgba(10,10,12,0.55)',
    fontSize: 12,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  legalLinkSep: {
    color: 'rgba(10,10,12,0.25)',
    fontSize: 12,
  },
  legalCopy: {
    color: 'rgba(10,10,12,0.30)',
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
    color: `rgba(${ROYAL_INDIGO_RGB},0.65)`,
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
    color: C.text,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  getProductSub: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    lineHeight: 18,
    marginBottom: 14,
  },
  getProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.panel,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  getProductBtnFeatured: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  getProductBtnLeft: {
    flex: 1,
  },
  getProductBtnTitle: {
    color: C.text,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.1,
  },
  getProductBtnSub: {
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    marginTop: 2,
  },
  getProductBtnSubFeatured: {
    color: 'rgba(10,10,12,0.85)',
    fontSize: 11,
    fontFamily: BrandFonts.medium,
    marginTop: 2,
  },
  getProductBtnArrow: {
    color: C.text,
    fontSize: 18,
    fontFamily: BrandFonts.bold,
    marginLeft: 12,
  },
  /* Iter 9jj: disclaimer-tekst onder bracelet + bundle (waitlist-flow).
     "No credit card · No financial data · No purchase obligation" +
     "We only use your email to notify you before launch". */
  getProductDisclaimer: {
    color: 'rgba(10,10,12,0.45)',
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.2,
    marginTop: -4,
    marginBottom: 1,
    paddingHorizontal: 6,
    lineHeight: 14,
  },
  getProductDisclaimerSub: {
    color: 'rgba(10,10,12,0.35)',
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
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): was
     `extrabold`/letterSpacing 1, los van dezelfde rol elders in de app —
     nu uit `TypeScale.tabHeader` (bold, letterSpacing -0.3). */
  screenTitle: {
    color: C.text,
    ...TypeScale.tabHeader,
    marginTop: 12,
  },
  subtitle: {
    color: C.text,
    fontSize: 20,
    fontFamily: BrandFonts.bold,
    marginTop: 8,
  },
  optional: {
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    marginTop: 8,
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: C.panel,
    borderColor: C.border,
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
  /* Was een bijna-wit tintje (`rgba(244,244,244,0.07)`) — onzichtbaar op
     het nieuwe lichte `toggleRow`-paneel. Zelfde subtiele donkere
     highlight als de andere "actieve chip"-fixes op deze pagina. */
  toggleActive: { backgroundColor: 'rgba(10,10,12,0.06)' },
  toggleText: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  toggleTextActive: { color: C.text },
  /* Icoon + placeholder IN het veld, geen los label erboven (operator-
     mockup, 11 augustus 2026). */
  inputIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.bg,
    borderColor: 'rgba(10,10,12,0.12)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  inputWithIcon: {
    flex: 1,
    color: C.text,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    paddingVertical: 11,
  },
  msg: {
    color: C.error,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    marginTop: 14,
  },
  /* flexDirection ontbrak — tekst en pijl stonden daardoor onder elkaar
     i.p.v. naast elkaar, en de knop oogde daardoor te dik (operator, 11
     augustus 2026: "cta knop is te dik pijl moet achter sign in niet
     eronder"). */
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
  },
  primaryBtnText: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
  },
  btnDisabled: { opacity: 0.5 },

  /* "Stay signed in"-reassurance — kleine gedimde regel onder de primary
     Sign-in knop. Komt uit operator-feedback dat user wist of de session
     bewaard blijft. Bovendien mobiele-app-conventie. */
  staySignedIn: {
    color: C.textDim,
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
    backgroundColor: C.border,
  },
  dividerText: {
    color: C.textDim,
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
    borderColor: C.border,
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
    /* Zit altijd op de zwarte Apple-SSO-knop (`ssoBtn`, `#000`), niet op
       de pagina-achtergrond — blijft dus wit-tint ongeacht thema. */
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
    backgroundColor: C.panel,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginTop: 14,
  },
  label: {
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  email: {
    color: C.text,
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
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    marginTop: 4,
    lineHeight: 18,
  },
  dimText: {
    color: C.textDim,
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
    color: C.error,
    fontSize: 14,
    fontFamily: BrandFonts.bold,
  },
  legal: {
    color: C.textDim,
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
    backgroundColor: C.panel,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: 14,
  },
  linkTextWrap: { flex: 1 },
  linkTitle: {
    color: C.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  linkSub: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    marginTop: 4,
  },
  linkArrow: {
    color: 'rgba(10,10,12,0.4)',
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
    borderTopColor: 'rgba(10,10,12,0.10)',
  },
  cardCtaText: {
    color: C.accent,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
  cardCtaArrow: {
    color: C.accent,
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
    color: C.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  cardCtaSecondaryArrow: {
    color: C.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  /* Forgot Password — kleine subtiele link onder de Sign In knop. */
  forgotLink: {
    alignItems: 'flex-end',
    paddingVertical: 8,
    marginTop: 2,
  },
  forgotLinkText: {
    color: C.accent,
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
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  cardRowArrow: {
    color: 'rgba(10,10,12,0.4)',
    fontSize: 22,
    fontFamily: BrandFonts.medium,
  },
  cardRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(10,10,12,0.08)',
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
    color: C.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  accountFieldValue: {
    color: C.text,
    fontSize: 15,
    fontFamily: BrandFonts.medium,
    letterSpacing: -0.1,
  },
  /* "Change" CTA tekst in password-row — accent-blauw, naast de
     chevron. Geeft direct duidelijk dat dit interactief is. */
  accountFieldCta: {
    color: C.accent,
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
    borderColor: 'rgba(10,10,12,0.18)',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: C.text,
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
    color: C.error,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  dangerText: {
    color: C.textDim,
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
    color: C.error,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    letterSpacing: -0.1,
  },
});
