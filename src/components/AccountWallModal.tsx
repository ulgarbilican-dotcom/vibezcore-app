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

import { Brand, BrandFonts } from '@/constants/theme';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/* ── Singleton-service voor open/close ──────────────────────────────── */
type Listener = (open: boolean) => void;
const listeners = new Set<Listener>();
let currentlyOpen = false;
let lastSessionTitle: string | null = null;

export function showAccountWall(sessionTitle?: string): void {
  lastSessionTitle = sessionTitle ?? null;
  if (currentlyOpen) return;
  currentlyOpen = true;
  listeners.forEach((cb) => cb(true));
}

export function hideAccountWall(): void {
  if (!currentlyOpen) return;
  currentlyOpen = false;
  listeners.forEach((cb) => cb(false));
}

/* ── Modal component (gemount in _layout.tsx als sibling van Stack) ── */
export function AccountWallModal() {
  const [open, setOpen] = useState<boolean>(currentlyOpen);
  const [opacity] = useState(() => new Animated.Value(0));

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
      {/* Backdrop — tap = dismiss */}
      <Pressable style={s.backdrop} onPress={hideAccountWall} />

      <View style={s.cardWrap} pointerEvents="box-none">
        <View style={s.card}>
          {/* Iter v157 (2026-06-26): operator-correctie. Geen 'create free
              account' pad meer — account = altijd betalend of bracelet
              owner. Promo wall pusht direct naar subscribe ipv 'free
              account' middenstap. Free tier (27 sessies) blijft zonder
              account toegankelijk. */}
          <Text style={s.eyebrow}>UNLOCK THE FULL LIBRARY</Text>
          <Text style={s.title}>Subscribe to keep going</Text>
          {lastSessionTitle ? (
            <Text style={s.subline}>
              <Text style={s.subQuote}>“{lastSessionTitle}”</Text> is just one
              of 100+ sessions in the full library.
            </Text>
          ) : (
            <Text style={s.subline}>
              You've explored the free picks. The full library has 100+ more
              sessions across every pillar.
            </Text>
          )}

          {/* Bullet-list — waarde-propositie */}
          <View style={s.bullets}>
            <Bullet text="Full library — 100+ sessions" />
            <Bullet text="Save favorites across all your devices" />
            <Bullet text="Cancel anytime in Play Store" />
          </View>

          <Pressable style={s.btnPrimary} onPress={goToAccount}>
            <Text style={s.btnPrimaryText}>See plans</Text>
          </Pressable>

          <Pressable style={s.btnSecondary} onPress={hideAccountWall}>
            <Text style={s.btnSecondaryText}>Maybe later</Text>
          </Pressable>

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
    borderColor: 'rgba(58, 143, 255, 0.32)',
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
  },
  eyebrow: {
    color: Brand.accent,
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
    backgroundColor: Brand.accent,
  },
  bulletText: {
    color: Brand.text,
    fontSize: 13,
    fontFamily: BrandFonts.medium,
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: Brand.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimaryText: {
    color: '#ffffff',
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
