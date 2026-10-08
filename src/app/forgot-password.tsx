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

import { fetchWithTimeout } from '@/services/auth';
import { Brand, BrandFonts } from '@/constants/theme';
import { HeaderBackButton } from '@/components/HeaderBackButton';
/* Operator, 26 september 2026 (Huisstijl & Design Handboek v4.4):
   Brand.accent (#3a8fff, Signal Blue) is enkel voor haptic-pulse/"nu
   actief" — nooit voor CTA's. CTA-regel v4.4 op donker: witte knop-bg +
   donkere tekst. */
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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SUPABASE_KEY, SUPABASE_URL } from '@/constants/supabase';

/* Standaard press-scale-animatie (zie breath-welcome.tsx `StartCard`
   voor de referentie-implementatie) — additief, geen layout/logica-
   wijziging. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/* Redirect-URL die in de email-link verschijnt. Supabase voegt zelf
   `&token_hash=...&type=recovery` toe.

   WAAROM DE WEBAPP RESET-PAGE (en niet `vibezcoreapp://reset-password`):
   Supabase rewriet silent custom URL-schemes in email templates terug
   naar de Site URL (security-feature, niet uit te schakelen). En een
   deep-link-only oplossing zou nieuwe Audio PRO-users uitsluiten die
   net via Gumroad kochten en de app nog niet hebben geïnstalleerd —
   ZIJ moeten ook hun password kunnen instellen.

   De webapp `reset-password.html` werkt voor IEDEREEN:
     - Desktop user → form in browser
     - Mobile user mét app → form in browser, nieuw password werkt
       daarna ook in app (zelfde Supabase account)
     - Mobile user zónder app → form in browser, kan daarna app
       installeren en inloggen met nieuw password
   Operator-keuze 2026-05-29. */
/* Operator, 8 okt 2026: de webapp mag nooit meer getoond worden — de eigen
   auth-pagina op Bunny (assets/bunny-upload/auth.html) vervangt hem. */
const REDIRECT_TO = 'https://vibezcore-audio.b-cdn.net/auth.html';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* Iter 9dq v17 (2026-06-02): dynamic safe-area inset zodat Submit-knop
     niet onder iOS home-indicator of Android nav-bar valt. SafeAreaView
     dekte voorheen alleen top af; scroll-content had geen bottom-padding. */
  const insets = useSafeAreaInsets();

  /* Press-scale-animatie — één losse shared value per tappable element
     (zie breath-welcome.tsx `StartCard`). */
  const backToSignInPressScale = useSharedValue(1);
  const onBackToSignInPressIn = () => {
    backToSignInPressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onBackToSignInPressOut = () => {
    backToSignInPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const backToSignInPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backToSignInPressScale.value }],
  }));

  const submitPressScale = useSharedValue(1);
  const onSubmitPressIn = () => {
    submitPressScale.value = withTiming(0.96, { duration: 80 });
  };
  const onSubmitPressOut = () => {
    submitPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const submitPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: submitPressScale.value }],
  }));

  const onSubmit = async () => {
    setErr(null);
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErr('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    /* Diagnostic logging (operator-debug 2026-05-29) — toont in Metro
       console exact wat de app naar Supabase stuurt. Helpt vaststellen
       of redirect_to wel/niet daadwerkelijk meegestuurd wordt, want de
       email-link blijkt soms naar de Site URL te vallen ipv het deep
       link schema. Zichtbaar in `npx expo start` console. */
    if (__DEV__) {
      console.log('[forgot-password] ⇢ POST /auth/v1/recover');
      console.log('[forgot-password] body:', {
        email: trimmed,
        redirect_to: REDIRECT_TO,
      });
    }
    try {
      const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/recover`, {
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
      if (__DEV__) {
        console.log('[forgot-password] ⇠ response status:', res.status);
        const responseText = await res.clone().text();
        console.log('[forgot-password] ⇠ response body:', responseText);
      }
      /* Supabase returnt 200 ongeacht of email bestaat (privacy-feature).
         We tonen altijd dezelfde confirmation zodat user-existence niet
         lekt via timing. */
      if (res.ok || res.status === 200) {
        setSent(true);
      } else {
        /* Lees response body voor diagnose — Supabase geeft een
           hele duidelijke error_description bij common problems
           (rate-limit, redirect-niet-whitelisted, etc). */
        const data = await res.json().catch(() => ({}));
        if (__DEV__) {
          console.warn('[forgot-password] supabase error:', res.status, data);
        }
        const rawMsg =
          data?.msg ||
          data?.error_description ||
          data?.error ||
          data?.message ||
          '';

        /* Common Supabase errors mappen naar user-vriendelijke copy.
           - 429 rate-limit  : "Too many requests"
           - redirect_to     : misconfig (operator-fix in Supabase dashboard)
           - invalid email   : echte client-side fout */
        let friendly: string;
        if (res.status === 429 || /rate.?limit|too many/i.test(rawMsg)) {
          friendly =
            'Too many requests. Please wait a minute and try again.';
        } else if (/redirect/i.test(rawMsg)) {
          /* Supabase blokkeert redirect_to als 'ie niet in de Auth →
             URL Configuration → Redirect URLs whitelist staat. Operator
             moet 'vibezcoreapp://reset-password' toevoegen. */
          friendly =
            'Email service is not fully configured. Please contact support.';
        } else if (/invalid.*email/i.test(rawMsg)) {
          friendly = 'Please enter a valid email address.';
        } else {
          friendly =
            rawMsg ||
            'Could not send reset link. Please try again or contact support.';
        }
        setErr(friendly);
      }
    } catch (e) {
      if (__DEV__) console.warn('[forgot-password] network error:', e);
      setErr('Network error — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen
          options={{
            title: 'Forgot password',
            headerTitleAlign: 'center',
            headerBackVisible: false,
            headerLeft: () => <HeaderBackButton />,
          }}
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
          <AnimatedPressable
            style={[s.btnSecondary, backToSignInPressStyle]}
            onPress={() => router.replace('/account')}
            onPressIn={onBackToSignInPressIn}
            onPressOut={onBackToSignInPressOut}
            accessibilityLabel="Back to sign in"
          >
            <Text style={s.btnSecondaryText}>Back to sign in</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen
        options={{
          title: 'Forgot password',
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={[
          s.scroll,
          /* Iter 9dq v77 (2026-06-03): geharmoniseerde formule met
             floor 72 → clears Samsung 3-button nav. */
          { paddingBottom: Math.max(insets.bottom + 24, 72) },
        ]}
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

        <AnimatedPressable
          style={[s.btnPrimary, busy && s.btnDisabled, submitPressStyle]}
          onPress={onSubmit}
          onPressIn={onSubmitPressIn}
          onPressOut={onSubmitPressOut}
          disabled={busy}
          accessibilityLabel="Send reset link"
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={s.btnPrimaryText}>Send reset link</Text>
          )}
        </AnimatedPressable>

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
  /* Iter v180 (2026-07-02): CTA breder + tekst-ademruimte (systemisch). */
  btnPrimary: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 18,
  },
  btnPrimaryText: {
    color: Brand.bg,
    fontSize: 16.5,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.4,
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
