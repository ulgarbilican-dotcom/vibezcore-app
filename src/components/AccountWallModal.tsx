/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — AccountWallModal

   Verschijnt wanneer een niet-ingelogde gast op een 'account'-tier sessie
   tikt. Toont een uitleg + CTA om gratis een account aan te maken, met
   weergave van WAT precies wordt unlocked (de 9 account-gated openers).

   Patroon volgt BraceletUpsellModal: floating overlay als sibling van de
   Stack in _layout.tsx — geen native Modal (vermijdt Android touch-
   intercept-issue). Visibility-controle via een singleton-service.

   Iter 9dq v59 (2026-06-03, operator-besluit access-tier model).
   ─────────────────────────────────────────────────────────────────────── */

import { AudioAccent, Brand, BrandFonts } from '@/constants/theme';
import { SESSIONS } from '@/data/audio-library-data';
import { getEffectiveTier } from '@/utils/access-tier';
import { useIAP } from '@/hooks/useIAP';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
/* Reanimated onder eigen naam geïmporteerd — dit bestand gebruikt al RN's
   `Animated` voor de open/close-fade, dus press-scale (Reanimated) krijgt
   een eigen alias om de twee niet te laten botsen (zie CLAUDE.md-taak
   "standardized press-scale"). */
import ReanimatedDefault, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = ReanimatedDefault.createAnimatedComponent(Pressable);

/* Operator, 26 september 2026 ("moeten we het totaal van de free sessions
   vermelden?", vervolg — operator-correctie: "gebruiker denkt nu ik doe
   7 days free trial en ik krijg full library dat is niet zo"):
   copy hieronder gebruikte een hardcoded "100+ sessions" als beloning voor
   "Subscribe"/de trial — dat klopte dubbel niet. (1) De catalogus is
   intussen 144, niet 100+. (2) Belangrijker: de 7-dagen-trial ontgrendelt
   NIET de volledige bibliotheek — enkel de 'account'-tier content (27 =
   10 public + 17 account) + Breathwork (zie resolveAccess() in
   access-tier.ts en project-free-tier-facts-memory). Pas een ECHT betaald
   abonnement (na de trial, of meteen als user 'm niet annuleert) geeft
   toegang tot alle 144. Deze modal verschijnt trouwens al bij tier
   'account' (resolveAccess: needs-account), dus de sessie die de trigger
   was zit binnen die 27 — niet pas bij de volledige 144. Copy hieronder
   noemt daarom expliciet BEIDE getallen (trial-scope vs. na-trial-scope)
   i.p.v. één opgeblazen "full library"-belofte. Alle drie afgeleid uit de
   echte databron (SESSIONS + getEffectiveTier), blijft kloppen als de
   catalogus groeit. */
const TOTAL_SESSION_COUNT = SESSIONS.length;
const FREE_SESSION_COUNT = SESSIONS.filter(
  (s) => getEffectiveTier(s) === 'public',
).length;
const TRIAL_SESSION_COUNT = SESSIONS.filter((s) => {
  const tier = getEffectiveTier(s);
  return tier === 'public' || tier === 'account';
}).length;

/* ── Singleton-service voor open/close ──────────────────────────────── */
type Listener = (open: boolean) => void;
const listeners = new Set<Listener>();
let currentlyOpen = false;
let lastSessionTitle: string | null = null;

export function showAccountWall(sessionTitle?: string): void {
  lastSessionTitle = sessionTitle ?? null;
  if (currentlyOpen) return;
  currentlyOpen = true;
  setTimeout(() => { listeners.forEach((cb) => cb(true)); }, 0);
}

export function hideAccountWall(): void {
  if (!currentlyOpen) return;
  currentlyOpen = false;
  setTimeout(() => { listeners.forEach((cb) => cb(false)); }, 0);
}

/* ── Modal component (gemount in _layout.tsx als sibling van Stack) ── */
export function AccountWallModal() {
  const [open, setOpen] = useState<boolean>(currentlyOpen);
  const [opacity] = useState(() => new Animated.Value(0));
  /* Operator, 7 okt 2026 (account-audit): de proefperiode komt uit de
     store (WYSIWYG) — geen vaste "7-day" meer die op iOS of na een
     store-wijziging niet klopt. */
  const { getProduct } = useIAP();
  const trialDays = getProduct('yearly')?.freeTrialDays ?? 0;
  const trialName = trialDays > 0 ? `${trialDays}-day trial` : 'trial';
  const storeName = Platform.OS === 'ios' ? 'the App Store' : 'Google Play';

  const primaryPressScale = useSharedValue(1);
  const onPrimaryPressIn = () => {
    primaryPressScale.value = withTiming(0.96, { duration: 80 });
  };
  const onPrimaryPressOut = () => {
    primaryPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const primaryPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: primaryPressScale.value }],
  }));

  const secondaryPressScale = useSharedValue(1);
  const onSecondaryPressIn = () => {
    secondaryPressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onSecondaryPressOut = () => {
    secondaryPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const secondaryPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: secondaryPressScale.value }],
  }));

  useEffect(() => {
    const listener: Listener = (next) => setOpen(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, opacity]);

  if (!open) return null;

  const goToAccount = () => {
    hideAccountWall();
    /* Iter v157 (2026-06-26): wall pusht nu naar Subscribe ipv Account.
       Operator-flow: free omgeving voor iedereen → wall toont subscribe
       prompt → klik = direct naar plan-keuze (yearly default = best
       deal). Account-creatie gebeurt PAS na verified purchase op de
       subscribe-flow. */
    router.navigate('/subscribe?tier=yearly' as never);
  };

  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { opacity }]}
    >
      {/* Backdrop — tap = dismiss. Full-screen invisible dismiss overlay:
         geen press-scale hier, scalen van de hele achtergrond zou raar
         ogen (operator-taak "press-scale overal" — expliciete uitzondering
         voor full-screen backdrops). */}
      <Pressable style={s.backdrop} onPress={hideAccountWall} />

      <View style={s.cardWrap} pointerEvents="box-none">
        <View style={s.card}>
          {/* Iter v157 (2026-06-26): operator-correctie. Geen 'create free
              account' pad meer — account = altijd betalend of bracelet
              owner. Promo wall pusht direct naar subscribe ipv 'free
              account' middenstap. Free tier (27 sessies) blijft zonder
              account toegankelijk. */}
          <Text style={s.eyebrow}>UNLOCK MORE SESSIONS</Text>
          <Text style={s.title}>Subscribe to keep going</Text>
          {lastSessionTitle ? (
            <Text style={s.subline}>
              <Text style={s.subQuote}>“{lastSessionTitle}”</Text> unlocks
              with your {trialName}, along with {TRIAL_SESSION_COUNT}{' '}
              sessions total. Stay subscribed after the trial to unlock the
              full {TOTAL_SESSION_COUNT}-session library.
            </Text>
          ) : (
            <Text style={s.subline}>
              You've explored all {FREE_SESSION_COUNT} free sessions. Your{' '}
              {trialName} unlocks {TRIAL_SESSION_COUNT} sessions + Breathwork
              — stay subscribed after the trial to unlock the full{' '}
              {TOTAL_SESSION_COUNT}-session library.
            </Text>
          )}

          {/* Bullet-list — waarde-propositie. Twee losse bullets voor
              trial-scope vs. na-trial-scope, i.p.v. één bullet die de volle
              144 als directe trial-beloning suggereert. */}
          <View style={s.bullets}>
            <Bullet
              text={`${trialDays > 0 ? `${trialDays}-day trial` : 'Trial'} — ${TRIAL_SESSION_COUNT} sessions + Breathwork`}
            />
            <Bullet
              text={`Then the full library — ${TOTAL_SESSION_COUNT} sessions`}
            />
            <Bullet text={`Cancel anytime in ${storeName}`} />
          </View>

          <AnimatedPressable
            style={[s.btnPrimary, primaryPressStyle]}
            onPress={goToAccount}
            onPressIn={onPrimaryPressIn}
            onPressOut={onPrimaryPressOut}
          >
            <Text style={s.btnPrimaryText}>See plans</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={[s.btnSecondary, secondaryPressStyle]}
            onPress={hideAccountWall}
            onPressIn={onSecondaryPressIn}
            onPressOut={onSecondaryPressOut}
          >
            <Text style={s.btnSecondaryText}>Maybe later</Text>
          </AnimatedPressable>

          <Text style={s.legal}>
            By creating an account you agree to our Terms and Privacy
            Policy. No credit card. Cancel anytime.
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={s.bulletRow}>
      <View style={s.bulletDot} />
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

/* ── Hook variant (handig voor test/inline gebruik) ──────────────────── */
export function useAccountWallOpen(): boolean {
  const [open, setOpen] = useState<boolean>(currentlyOpen);
  useEffect(() => {
    const listener: Listener = (next) => setOpen(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return open;
}

/* ── Styles ──────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  cardWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: Brand.panel,
    borderColor: 'rgba(110, 133, 196, 0.32)',
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
  },
  /* Operator, 26 september 2026 (accentkleur-wissel, audio): eyebrow +
     bullet-dot gebruiken nu AudioAccent (Bio-Teal) i.p.v. AccentTextOnDark
     — zelfde patroon als player.tsx. Brand.accent (#3a8fff, Signal Blue)
     blijft enkel voor haptic-pulse/"nu actief", nooit tekst/knoppen. */
  eyebrow: {
    color: AudioAccent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  title: {
    color: Brand.text,
    fontSize: 24,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subline: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 20,
    marginBottom: 18,
  },
  subQuote: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
  },
  bullets: {
    marginBottom: 22,
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AudioAccent,
  },
  bulletText: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    flex: 1,
  },
  /* v4.4 CTA-regel: donkere ondergrond → witte knop, donkere tekst
     (geen Signal Blue, geen Royal Indigo op knoppen). */
  btnPrimary: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimaryText: {
    color: '#0a0a0a',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  btnSecondary: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.semibold,
  },
  legal: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.regular,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 14,
  },
});
