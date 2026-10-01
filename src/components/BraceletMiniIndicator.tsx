/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet mini indicator (globale sticky pill)

   Analoog aan MiniPlayer voor audio. Toont een compacte "Bracelet · Calm
   Control · 14:51" pill op elke tab wanneer een bracelet-sessie draait.
   Geen mini-controls (Pause/End) want die zijn onbeschikbaar buiten
   bracelet-control zonder de BLE-scope te importeren — user tikt de pill,
   komt op het active-scherm, gebruikt daar de knoppen.

   Operator, 16 september 2026 ("wij hadden hier die functie eerder al
   toegevoegd, kan dat?... onmiddellijk terugvinden waar de sessie loopt
   als gebruiker andere sites/apps bekijkt"): teruggehaald uit `master`
   (iter v238b, 9 juli 2026) — bestond niet op deze rollback-branch. Zie
   `(tabs)/_layout.tsx` voor de mount. Bewust ALLEEN de pill zelf
   teruggehaald, niet de v238i tab-bar-hide-subscribe die destijds SAMEN
   met deze pill een crash-on-launch veroorzaakte (v239, 10 juli 2026,
   nooit met zekerheid geïsoleerd welke van de twee de oorzaak was) — dit
   component alleen leest éénmalig de huidige snapshot + subscribet, geen
   navigatie-/tabBar-mutaties, dus een kleiner risico-oppervlak.

   Operator, 16 september 2026 (vervolg — "vanuit minimize moet ik terug
   kunnen naar de bracelet active pagina"): tikken navigeerde naar
   `/bracelet` (de tab) — voor owners toont dat meteen de inline active-
   view (prima), maar voor niet-eigenaars/preview toont die tab enkel de
   marketing-etalage met een CTA, dus nog een extra tik nodig. Nu direct
   naar `/bracelet-control` voor niet-eigenaars — de BLE-verbinding blijft
   intact (module-singleton), dus dat scherm herkent de lopende sessie
   meteen en toont ActiveSessionScreen, geen connect/reconnect-stap. */

import { Brand, BrandFonts } from '@/constants/theme';
import {
  getBraceletSessionSnapshot,
  subscribeBraceletSession,
  type BraceletSessionSnapshot,
} from '@/services/bracelet-session-state';
import { useBraceletOwner } from '@/utils/dev-user-override';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

/* Standaardiseerde press-scale (2026-09-23) — zelfde curve als StartCard
   in breath-welcome.tsx. Vervangt de vorige `pressed && {opacity:0.8}`
   render-prop-dip door dezelfde scale+opacity-microinteractie als de
   rest van de app. */
const AnimatedPressable = ReanimatedAnimated.createAnimatedComponent(Pressable);

function fmtMMSS(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function BraceletMiniIndicator() {
  const [snap, setSnap] = useState<BraceletSessionSnapshot>(
    getBraceletSessionSnapshot(),
  );
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isBraceletOwner = useBraceletOwner();

  useEffect(() => {
    const unsub = subscribeBraceletSession((next) => setSnap(next));
    return unsub;
  }, []);

  /* Verberg op bracelet-control zelf (dan is er al een active-view) en
     op welcome. Anders altijd zichtbaar wanneer active.
     Operator, 16 september 2026 ("na minimize kom ik op welcome bracelet
     scherm, daar moet de minimize knop ook al zichtbaar zijn"): de
     /bracelet-tab was hier ALTIJD verborgen, met de aanname dat daar al
     een active-view staat — klopt voor owners (BraceletControl inline),
     maar niet voor niet-eigenaars/preview: die zien op /bracelet enkel
     de marketing-etalage, geen active-view. Daar juist de pill tonen
     zodat er een directe weg terug is i.p.v. eerst de CTA moeten
     opzoeken. */
  if (!snap.active) return null;
  if (pathname === '/bracelet-control') return null;
  if (pathname === '/bracelet' && isBraceletOwner) return null;
  if (pathname === '/welcome') return null;

  const topY = insets.top + 8;

  return <ActiveSessionPill topY={topY} snap={snap} isBraceletOwner={isBraceletOwner} />;
}

function ActiveSessionPill({
  topY,
  snap,
  isBraceletOwner,
}: {
  topY: number;
  snap: BraceletSessionSnapshot;
  isBraceletOwner: boolean;
}) {
  const scale = useSharedValue(1);
  const onPressIn = () => {
    scale.value = withTiming(0.96, { duration: 80 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[s.wrap, { top: topY }]} pointerEvents="box-none">
      <AnimatedPressable
        style={[
          s.pill,
          {
            borderColor: snap.modeColor + '55',
            backgroundColor: snap.modeColor + '18',
          },
          pressStyle,
        ]}
        onPress={() => {
          if (isBraceletOwner) router.navigate('/bracelet');
          else router.navigate('/bracelet-control' as never);
        }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={`Open active ${snap.modeName} bracelet session`}
      >
        <View style={[s.dot, { backgroundColor: snap.modeColor }]} />
        <Text style={s.label} numberOfLines={1}>
          Bracelet · {snap.modeName}
        </Text>
        <Text style={[s.time, { color: snap.modeColor }]}>
          {fmtMMSS(snap.remainingSec)}
        </Text>
      </AnimatedPressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
    elevation: 40,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '90%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  label: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  time: {
    marginLeft: 10,
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
