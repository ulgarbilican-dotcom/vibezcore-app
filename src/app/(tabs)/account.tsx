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
import {
  cancelSubscription,
  gumroadManageUrl,
} from '@/services/subscription-actions';
import { clearSignedUrlCache } from '@/utils/audio-url';
import { clearLastPlayed } from '@/utils/last-played';
import { requestScrollTo } from '@/utils/scroll-intent';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    clearSession,
    getLastLoginEmail,
    getToken,
    getUserEmail,
    login,
    signup,
} from '../../services/auth';

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
  console.log('[VIBEZCORE] account openExternal →', url);
  try {
    const result = await WebBrowser.openBrowserAsync(url);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      console.log('[VIBEZCORE] WebBrowser cancelled — fallback Linking');
      await Linking.openURL(url);
    }
  } catch (e) {
    console.log('[VIBEZCORE] WebBrowser threw — fallback Linking:', e);
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
    gumroadSubscriberId,
    isLoading,
  } = useSubscription();

  let bigText: string;
  let bigColor: string;
  let subText: string;

  if (isLoading) {
    bigText = 'Checking…';
    bigColor = Brand.textDim;
    subText = '';
  } else if (!isPro) {
    bigText = 'Free account';
    bigColor = Brand.text;
    subText = 'Upgrade for full library access';
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
    bigText = tierLabel ? `PRO — ${tierLabel}` : 'PRO';
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

  /* Drie CTA-paden afhankelijk van state:
       - Loading             → geen CTA (anders flicker)
       - Non-pro signed-in   → "Upgrade to full library" → Library pricing
       - Pro met subscriber  → "Manage billing" → Gumroad customer portal
       - Pro zonder subscriber-id → geen CTA tonen (data nog incomplete) */
  const showUpgrade = !isLoading && !isPro;
  const showManageBilling = !isLoading && isPro && !!gumroadSubscriberId;

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
          accessibilityLabel="Upgrade to full library access"
        >
          <Text style={s.cardCtaText}>Upgrade to full library</Text>
          <Text style={s.cardCtaArrow}>→</Text>
        </Pressable>
      )}
      {showManageBilling && gumroadSubscriberId && (
        <Pressable
          style={s.cardCta}
          onPress={() => openExternal(gumroadManageUrl(gumroadSubscriberId))}
          accessibilityLabel="Manage billing on Gumroad"
        >
          <Text style={s.cardCtaText}>Manage billing</Text>
          <Text style={s.cardCtaArrow}>→</Text>
        </Pressable>
      )}
    </View>
  );
}

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

  const [mode, setMode] = useState<Mode>('login');
  const [emailInput, setEmailInput] = useState('');
  const [pwInput, setPwInput] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /* useSubscription() bovenaan voor twee redenen:
       1. Cancel-button alleen tonen voor pro users (`isProForActions`)
       2. Fallback voor manage_url als backend 'm niet meegeeft */
  const {
    gumroadSubscriberId: gumroadSubscriberIdFromHook,
    isPro: isProForActions,
  } = useSubscription();

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

        /* ── Post-login routing ────────────────────────────────────────
           Operator-spec 2026-05-25:
             - Audio PRO          → /(tabs)/        (Audio Library)
             - Bracelet eigenaar  → bracelet-active (TODO — page nog te
                                   bouwen, backend nog geen has_bracelet
                                   veld)
             - Geen van beide     → /(tabs)/        (Library als default)

           Bracelet-ownership-detectie vereist:
             1. Backend: /api/subscription-status uitbreiden met bv.
                `has_bracelet: true` zodra activatie-code is gekoppeld
             2. App: nieuwe route /bracelet-active met activatie-UI +
                modus-control. Tot dan: alle ingelogde users → Library.

           Wanneer beide klaar zijn, vervangen door:
              const dest = sub?.has_bracelet ? '/bracelet-active' : '/';
              router.replace(dest);

           setTimeout 50ms zodat React eerst de state-updates van
           setEmail/setPwInput commit; voorkomt edge-cases waar de
           component-rerender met de oude (login-form) view nog draait
           wanneer de nav fired. router.replace ipv navigate: clear de
           account-tab-stack zodat back-knop niet terug naar het login-
           formulier gaat. */
        setTimeout(() => router.replace('/'), 50);
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
            setEmail(null);
            setEmailInput('');
            setPwInput('');
            /* Token weg → refreshSubscription detecteert no-token, wist
               persisted cache en notifiet alle consumers {active:false}. */
            refreshSubscription();
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

  /* ── Cancel Subscription ──
     Operator-besluit 2026-05-26: cancellatie loopt via Gumroad's customer
     portal (backend kan niet zelfstandig cancellen — Gumroad API ondersteunt
     dat niet meer voor creators). Flow:
       1. Confirmation Alert
       2. POST /api/cancel-subscription → backend markeert pending + returnt manage_url
       3. Open manage_url in WebBrowser → user bevestigt definitief op Gumroad
       4. Gumroad webhook reconcilieert onze DB (status='cancelled')
       5. refreshSubscription() bij volgende app-open ziet de update */
  const onCancelSubscription = () => {
    Alert.alert(
      'Cancel subscription?',
      'You will keep full library access until the end of your current billing period. To finalize, confirm on Gumroad in the next step.',
      [
        { text: 'Keep subscription', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: async () => {
            const result = await cancelSubscription();
            if (!result.ok) {
              Alert.alert(
                result.noGumroadId ? 'Manual cancellation needed' : 'Could not cancel',
                result.error,
                [
                  { text: 'OK', style: 'cancel' },
                  ...(result.noGumroadId
                    ? [
                        {
                          text: 'Contact support',
                          onPress: () => openExternal(SUPPORT_URL),
                        },
                      ]
                    : []),
                ],
              );
              return;
            }
            if (result.alreadyCancelled) {
              Alert.alert(
                'Already cancelled',
                'Your subscription is already set to cancel. You keep access until the end of the period.',
              );
              refreshSubscription();
              return;
            }
            /* Open Gumroad portal voor definitieve bevestiging.
               manage_url komt rechtstreeks van backend; fallback op
               client-computed URL als 'ie ontbreekt. */
            const url =
              result.manageUrl ||
              (gumroadSubscriberIdFromHook
                ? gumroadManageUrl(gumroadSubscriberIdFromHook)
                : null);
            if (url) await openExternal(url);
            /* Geforceerde refresh — backend heeft mogelijk al will_renew=false
               gezet. UI updatet zodat Cancel-button verdwijnt. */
            refreshSubscription();
          },
        },
      ],
    );
  };

  /* ── Change Password ──
     Routeert door naar de webapp forgot-password flow (Supabase recovery
     email → reset-password.html → opnieuw in app inloggen met nieuw
     password). Webapp handelt het volledige proces af; native app is
     alleen de launcher. */
  const onChangePassword = () => {
    Alert.alert(
      'Change password',
      'We will open the password reset flow in your browser. You will receive an email with a link to set a new password.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => router.navigate('/forgot-password' as never),
        },
      ],
    );
  };

  /* ── Delete Account ──
     Account-deletion gebeurt manueel via support (operator-besluit
     2026-05-26: te gevoelig + GDPR-verplichtingen voor verifiable deletion
     workflow). Opent het support-formulier op de webapp. */
  const onDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'Deleting your account is permanent. Your listening history, favorites, and subscription data will be removed. We will open our support form so you can confirm the request.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => openExternal(SUPPORT_URL),
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[s.root, s.center]}>
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
      <SafeAreaView edges={['top']} style={s.root}>
        <KeyboardAwareScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          extraScrollHeight={20}
          enableAutomaticScroll={true}
        >
          <Text style={s.screenTitle}>Account</Text>
          <View style={s.card}>
            <Text style={s.label}>Signed in as</Text>
            <Text style={s.email}>{email}</Text>
          </View>
          <SubscriptionCard />
          <View style={s.card}>
            <Text style={s.label}>Bracelet</Text>
            <Text style={s.dimText}>
              Bracelet activation (enter your code) opens after the
              Kickstarter launch on 1 August 2026.
            </Text>
            {/* Reserve-CTA voor users die nog geen bracelet hebben
                (per operator-feedback 2026-05-26: bracelet-cross-sell ook
                bereikbaar maken vanaf Account, niet alleen via de
                Bracelet-tab). vibezcore.com/shop covered zowel
                Kickstarter-reservering als reguliere purchase. */}
            <Pressable
              style={s.cardCta}
              onPress={() => openExternal(BRACELET_SHOP_URL)}
              accessibilityLabel="Reserve your bracelet on the VIBEZCORE shop"
            >
              <Text style={s.cardCtaText}>Reserve your bracelet</Text>
              <Text style={s.cardCtaArrow}>→</Text>
            </Pressable>
          </View>
          <LibrarySettingsLink />

          {/* ── Account Actions (Settings, Change Password, Support) ──
              Structuur matched account.html van de webapp. Sign Out blijft
              z'n eigen prominente rode knop onderaan, niet in deze
              "actions"-card — operator-besluit 2026-05-25: Sign Out moet
              visueel onmiskenbaar zijn. */}
          <View style={s.card}>
            <Text style={s.label}>Account</Text>
            <Pressable
              style={s.cardRow}
              onPress={() => router.navigate('/settings')}
              accessibilityLabel="Open settings"
            >
              <Text style={s.cardRowText}>Settings</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
            <View style={s.cardRowDivider} />
            <Pressable
              style={s.cardRow}
              onPress={onChangePassword}
              accessibilityLabel="Change your password"
            >
              <Text style={s.cardRowText}>Change password</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
            <View style={s.cardRowDivider} />
            <Pressable
              style={s.cardRow}
              onPress={() => openExternal(SUPPORT_URL)}
              accessibilityLabel="Contact VIBEZCORE support"
            >
              <Text style={s.cardRowText}>Contact support</Text>
              <Text style={s.cardRowArrow}>›</Text>
            </Pressable>
          </View>

          {/* Cancel Subscription — alleen voor active pro users. Aparte
              card buiten Account Actions zodat 'm zichtbaar destructief
              voelt (zoals webapp's "Cancel Subscription" knop in red). */}
          {isProForActions && (
            <Pressable
              style={s.cancelBtn}
              onPress={onCancelSubscription}
              accessibilityLabel="Cancel your subscription"
            >
              <Text style={s.cancelBtnText}>Cancel subscription</Text>
            </Pressable>
          )}

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
              accessibilityLabel="Read Terms of Service"
            >
              <Text style={s.cardRowText}>Terms of Service</Text>
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
                  params: { doc: 'refund' } as never,
                })
              }
              accessibilityLabel="Read Refund Policy"
            >
              <Text style={s.cardRowText}>Refund Policy</Text>
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
              accessibilityLabel="Read Health and Safety"
            >
              <Text style={s.cardRowText}>Health & Safety</Text>
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
    <SafeAreaView edges={['top']} style={s.root}>
      <KeyboardAwareScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
        enableAutomaticScroll={true}
      >
        <Text style={s.subtitle}>
          {mode === 'login' ? 'Welcome back.' : 'Create your account.'}
        </Text>
        <Text style={s.optional}>
          You don’t need an account to explore. Sign in for the full audio
          library or to activate a bracelet.
        </Text>

        <View style={s.toggleRow}>
          <Pressable
            style={[s.toggle, mode === 'login' && s.toggleActive]}
            onPress={() => {
              setMode('login');
              setMsg(null);
            }}
          >
            <Text
              style={[
                s.toggleText,
                mode === 'login' && s.toggleTextActive,
              ]}
            >
              Sign in
            </Text>
          </Pressable>
          <Pressable
            style={[s.toggle, mode === 'signup' && s.toggleActive]}
            onPress={() => {
              setMode('signup');
              setMsg(null);
            }}
          >
            <Text
              style={[
                s.toggleText,
                mode === 'signup' && s.toggleTextActive,
              ]}
            >
              Create account
            </Text>
          </Pressable>
        </View>

        <Text style={s.inputLabel}>Email</Text>
        <TextInput
          style={s.input}
          value={emailInput}
          onChangeText={setEmailInput}
          placeholder="you@example.com"
          placeholderTextColor={Brand.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          /* ── OS Password Manager hints ─────────────────────────────────
             autoComplete (Android, Google Password Manager) +
             textContentType (iOS, iCloud Keychain). Met deze hints biedt
             het OS automatisch een "save credentials?"-prompt aan na een
             succesvolle login, en op latere sessies kan het de inputs
             auto-fillen met één tap. Combineert met LAST_EMAIL_KEY-prefill
             zodat ingelogde-met-saved-creds-users letterlijk niets meer
             hoeven te typen. (Geadresseerd 2026-05-25 — user-frustratie:
             "POR USEZE ZOU NIET ELKE KEER OPNIEUW MOETEN INLOGGEN".)
             ────────────────────────────────────────────────────────── */
          autoComplete="email"
          textContentType="emailAddress"
        />

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
            /* Password autofill: dynamisch per mode — 'login' → bestaande
               opgeslagen creds aanbieden; 'signup' → nieuwe-wachtwoord-flow
               (OS biedt automatisch een suggested-strong-password aan). */
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            textContentType={mode === 'login' ? 'password' : 'newPassword'}
            /* Submit via keyboard "Go" → trigger login direct ipv user
               moet eerst keyboard sluiten + Sign-in-knop tappen. Eén tap
               minder, vooral fijn na autofill. */
            returnKeyType={mode === 'login' ? 'go' : 'done'}
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
            <Text style={s.primaryBtnText}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        {/* Forgot Password link — alleen tonen in sign-in modus (niet
            tijdens create-account). Routeert door naar webapp forgot-
            password.html waar Supabase recovery-email getriggerd wordt. */}
        {mode === 'login' && (
          <Pressable
            style={s.forgotLink}
            onPress={() => router.navigate('/forgot-password' as never)}
            accessibilityLabel="Reset your password"
          >
            <Text style={s.forgotLinkText}>Forgot password?</Text>
          </Pressable>
        )}

        {/* Reassurance — mobile-app conventie is dat de user ingelogd
            blijft tussen app-launches. We tonen die boodschap expliciet
            zodat nieuwe gebruikers niet bang zijn telkens opnieuw te
            moeten inloggen. */}
        <Text style={s.staySignedIn}>
          You'll stay signed in on this device
        </Text>

        {/* ─── OR divider ─────────────────────────────────────────────── */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>OR</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Apple "Coming soon" — placeholder button die signaleert dat
            SSO op de roadmap staat zonder dat we nu de full Apple-
            Developer-Program + OAuth-config moeten doen (vóór launch
            niet haalbaar). Disabled state met "Soon"-badge maakt duidelijk
            dat 't nog niet werkt — geen verkeerd-klik-frustratie.
            Operator-besluit 2026-05-25: Apple eerst, Google later. */}
        <Pressable
          style={[s.ssoBtn, s.ssoBtnDisabled]}
          disabled
          accessibilityRole="button"
          accessibilityLabel="Sign in with Apple — coming soon"
        >
          <Text style={s.ssoBtnApple}> </Text>
          <Text style={s.ssoBtnText}>Continue with Apple</Text>
          <View style={s.soonBadge}>
            <Text style={s.soonBadgeText}>SOON</Text>
          </View>
        </Pressable>

        <LibrarySettingsLink />

        <Text style={s.legal}>
          [OPERATOR] Terms / Privacy text from the web app to be placed here
          before launch.
        </Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 48 },
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
