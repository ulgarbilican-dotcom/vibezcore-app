/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Welcome back Warrior greeting

   Toont een **korte, motivationele begroeting** wanneer een ingelogde
   user na een gap (>12h) de app opnieuw opent. Apart van de audio-
   resume "Welcome back" popup (die over een specifieke lopende sessie
   gaat) — deze is een algemene "blij je terug te zien"-moment.

   Triggers:
     - Cold-start (component-mount = nieuwe app-launch)
     - User is ingelogd (heeft een token)
     - Vorige active timestamp > 12h geleden (of nog niet opgeslagen)

   Subscription-relevant copy:
     - Full PRO (audio + bracelet) → "Your bracelet's ready. Your library's loaded."
     - Audio PRO only              → "Your library awaits."
     - Bracelet only               → "Your bracelet's ready."
     - Free signed-in              → "Discover what's new today."

   Operator-feedback 27 mei 2026 iter 9s: "om gebruiker te motiveren,
   en feedback-link mag erin".

   Implementatie: floating absolute View + eigen backdrop (zelfde pattern
   als WelcomeBackPopup voor compatibiliteit met tab-bar). Mount in
   _layout.tsx als sibling.
   ─────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';
import { getToken } from '@/services/auth';
import {
  awaitDevUserOverrideLoaded,
  getDevUserOverride,
  useBraceletOwner,
} from '@/utils/dev-user-override';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const LAST_ACTIVE_KEY = 'vz_last_active_at_v1';
/** Minimum gap voor de greeting (12h). Kleiner = vervelend, groter
 *  = mist daily-return moment. */
const MIN_GAP_MS = 12 * 60 * 60 * 1000;

/** Bepaal greeting-subtitle op basis van user-state. */
function getSubtitle(isPro: boolean, isOwner: boolean): string {
  if (isPro && isOwner) {
    return "Your bracelet's ready. Your library's loaded.";
  }
  if (isPro) return 'Your library awaits.';
  if (isOwner) return "Your bracelet's ready.";
  return "Discover what's new today.";
}

export function WelcomeBackWarrior() {
  const segments = useSegments();
  const { isPro } = useSubscription();
  const isOwner = useBraceletOwner();

  const [visible, setVisible] = useState(false);
  const opacity = useState(() => new Animated.Value(0))[0];

  /* Cold-start check — runt één keer per mount. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        /* Iter 9bs (2026-05-31): respecteer ook dev-override 'guest'.
           Operator-test in free env had nog een real token van een
           eerdere session → check `!token` faalde niet → greeting
           verscheen alsnog. Net als welcome.tsx en _layout.tsx
           treren we override='guest' nu als "niet ingelogd". */
        await awaitDevUserOverrideLoaded();
        if (cancelled) return;
        if (getDevUserOverride() === 'guest') return;
        const token = await getToken();
        if (cancelled || !token) return; // niet ingelogd → geen greeting
        const raw = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
        const lastAt = raw ? parseInt(raw, 10) : 0;
        const now = Date.now();
        const gap = now - lastAt;

        /* Update timestamp altijd zodat volgende session vergelijking
           accuraat is. */
        await AsyncStorage.setItem(LAST_ACTIVE_KEY, String(now));

        /* Alleen tonen wanneer:
           - gap > MIN_GAP_MS (>12h)
           - lastAt was > 0 (niet de allereerste sign-in — daar willen
             we een aparte first-time-flow voor) */
        if (!cancelled && lastAt > 0 && gap > MIN_GAP_MS) {
          setVisible(true);
        }
      } catch {
        /* swallow */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Fade-in animatie wanneer visible toggelt naar true */
  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      opacity.setValue(0);
    }
  }, [visible, opacity]);

  /* Android hardware-back sluit popup */
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setVisible(false);
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  /* Beperken tot (tabs)-area — niet over welcome/auth screens */
  const inTabs = segments[0] === '(tabs)';
  if (!visible || !inTabs) return null;

  const dismiss = () => setVisible(false);
  const onFeedback = () => {
    setVisible(false);
    router.push('/support' as never);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop tap-anywhere = dismiss */}
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityLabel="Dismiss welcome back"
        />
      </Animated.View>

      {/* Card — centered, fade in */}
      <Animated.View style={[styles.cardWrap, { opacity }]} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.title}>Warrior.</Text>
          <Text style={styles.sub}>{getSubtitle(isPro, isOwner)}</Text>

          <View style={styles.btnRow}>
            <Pressable
              style={styles.feedbackBtn}
              onPress={onFeedback}
              accessibilityLabel="Send feedback to support"
            >
              <Text style={styles.feedbackBtnText}>Send feedback</Text>
            </Pressable>
            <Pressable
              style={styles.dismissBtn}
              onPress={dismiss}
              accessibilityLabel="Continue to app"
            >
              <Text style={styles.dismissBtnText}>Continue →</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  cardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#141414',
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
  },
  eyebrow: {
    color: Brand.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2.4,
    marginBottom: 8,
  },
  title: {
    color: Brand.text,
    fontSize: 28,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  sub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    lineHeight: 22,
    marginBottom: 22,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  feedbackBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  feedbackBtnText: {
    color: Brand.text,
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.5,
  },
  dismissBtn: {
    flex: 1.4,
    backgroundColor: Brand.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.3,
  },
});
