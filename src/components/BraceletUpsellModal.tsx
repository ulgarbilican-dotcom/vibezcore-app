/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet upsell — SECUNDAIRE info-bar variant

   Iteratie 6 (operator-besluit 2026-05-24): bracelet moet visueel
   SECUNDAIR zijn. De primaire flow voor de luisteraar is AUDIO (Done /
   Play next op het SESSION COMPLETE-paneel). De bracelet-upsell is
   bijzaak: een dun informatief reepje onderaan dat aanwezig is zonder
   te schreeuwen.

   Voor → na:
     - Sheet-hoogte: ~340px → ~90px
     - Image: 130px-card → 56×56 thumb
     - Pulse: 3 ringen → 1 subtiele ring, slow tempo
     - CTA: full-width blauwe knop → chevron rechts (hele sheet = tap-target)
     - X-knop: weg (auto-close zodra endedPanel weg is, hardware-back werkt)

   Layout (~90px hoog):
     ┌─────────────────────────────────────────────┐
     │  ┌────┐  VIBEZCORE                          │
     │  │ img│  Smart Bead Bracelet            ›   │
     │  └────┘  Daily State Control                │
     └─────────────────────────────────────────────┘

   GEEN <Modal>-wrapper (zou native window touch-intercept hebben).
   Floating absolute <View> aan de root → touches buiten het reepje
   propageren naar player.tsx → Play next direct tikbaar.
   ─────────────────────────────────────────────────────────────────────── */

import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dismissEndedPanel } from '@/services/audio-player';
import {
  hideBraceletUpsell,
  useBraceletUpsellVisible,
} from '@/services/bracelet-upsell';

/* Color-token-set — bewust witte card-stijl (operator-besluit 2026-05-24
   iteratie 9). Card heeft brand-witte achtergrond zoals de webapp-
   pricing-cards; tekst donker zodat 't leesbaar blijft. Accent-blauw
   blijft voor brand-line + pulse + tap-ripple. */
const C = {
  bg: '#ffffff',
  border: 'rgba(0,0,0,0.08)',
  text: '#0a0a0a',
  faint: 'rgba(0,0,0,0.55)',
  accent: '#3a8fff',
  chevron: 'rgba(0,0,0,0.35)',
};

/* Bracelet productfoto — transparante PNG op Bunny CDN. Ligt direct
   op de donkere sheet (geen wit kaartje nodig). De URL bevat een spatie
   in de originele filename (URL-encoded als %20) — werkt maar oneerlijk
   lelijk in code/inspectie; overwegen later de file op Bunny te
   hernoemen naar bv. `bracelet-vzc-transparent.png` voor een clean
   pad. */
const BRACELET_IMAGE_URL =
  'https://vibezcore-audio.b-cdn.net/images/Shattudkite_vzc_fiv%20no%20bg.png';

/* ── HAPTIC PULSE POSITIE — handmatig te tunen ──────────────────────
   Positie van de pulse-ringen + dot, uitgedrukt als percentage van het
   imageWrap (156×123dp).
     - PULSE_TOP_PCT : 0% = boven, 100% = onder van het wrap
     - PULSE_LEFT_PCT: 0% = links, 100% = rechts van het wrap
   Bedoeld om de pulse exact op de zwarte HapticCore-pod te krijgen.
   Wijzig de waarden + Ctrl+M → Reload in dev-build (geen rebuild
   nodig — JS-only). Stap-grootte ~5% = ~6-8dp shift per stap. */
const PULSE_TOP_PCT = '68%' as const;
const PULSE_LEFT_PCT = '59%' as const;

/* ── BLAUWE DOT — apart te tunen van de ringen ──────────────────────
   De dot is de "haptic LED" en mag op een ander punt staan dan het
   centrum van de pulse-ringen. Default = zelfde positie als de ringen,
   maar je kan ze hieronder onafhankelijk verschuiven. Stap-grootte ~3%
   = ~4-5dp shift. DOT_SIZE in dp (6 default, 8-10 voor meer pop). */
const DOT_TOP_PCT = '59%' as const;
const DOT_LEFT_PCT = '51%' as const;
const DOT_SIZE = 4;

/* ── HapticPulse ─────────────────────────────────────────────────────────
   3 expanderende ringen + center dot op de HapticCore-positie. Gestaggerd
   start (0/800/1600ms) zodat er altijd één ring zichtbaar is = vloeiend
   continu pulsen. Originele spec van operator. Initial delay buiten de
   loop via setTimeout zodat loop-iteraties op vast 2400ms tempo blijven
   (geen drift). */

function Ring({ delay, active }: { delay: number; active: boolean }) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (!active) {
      scale.stopAnimation();
      opacity.stopAnimation();
      scale.setValue(0.3);
      opacity.setValue(0.9);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 2400,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 2400,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0.3,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.9,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    const timer = setTimeout(() => animation.start(), delay);
    return () => {
      clearTimeout(timer);
      animation.stop();
    };
  }, [active, delay, scale, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[ps.ring, { transform: [{ scale }], opacity }]}
    />
  );
}

function SubtleHapticPulse({ active }: { active: boolean }) {
  return (
    <>
      {/* Ringen — gecentreerd op PULSE_TOP_PCT / PULSE_LEFT_PCT */}
      <View style={ps.wrap} pointerEvents="none">
        <Ring delay={0} active={active} />
        <Ring delay={800} active={active} />
        <Ring delay={1600} active={active} />
      </View>
      {/* Dot — gecentreerd op DOT_TOP_PCT / DOT_LEFT_PCT (apart) */}
      <View style={ps.dotWrap} pointerEvents="none">
        <View style={ps.dot} />
      </View>
    </>
  );
}

const ps = StyleSheet.create({
  /* Pulse-positie: leest uit de PULSE_TOP_PCT / PULSE_LEFT_PCT
     constants bovenin het bestand — operator kan die zelf tunen
     zonder dit style-block aan te raken. */
  wrap: {
    position: 'absolute',
    top: PULSE_TOP_PCT,
    left: PULSE_LEFT_PCT,
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Ring + dot in verhouding gehalveerd ten opzichte van originele
     85/8 — past beter op de 123×123 bracelet. 3 ringen op staggered
     800ms tempo blijven = vloeiend continu pulsen. */
  ring: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(0,170,255,0.8)',
    marginLeft: -25,
    marginTop: -25,
  },
  /* DotWrap — eigen 0×0 anker-punt apart van de ring-wrap zodat de
     blauwe LED-dot onafhankelijk gepositioneerd kan worden via
     DOT_TOP_PCT / DOT_LEFT_PCT. */
  dotWrap: {
    position: 'absolute',
    top: DOT_TOP_PCT,
    left: DOT_LEFT_PCT,
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Dot maat door DOT_SIZE bestuurd (default 6). Integer margins via
     Math.round zodat het op halve-pixel waarden niet off-center valt
     (Android rondt fractionele dp af → kan tot 0.5dp afwijken). */
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#00aaff',
    marginLeft: -Math.round(DOT_SIZE / 2),
    marginTop: -Math.round(DOT_SIZE / 2),
    shadowColor: '#00aaff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
});

export function BraceletUpsellModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const visible = useBraceletUpsellVisible();

  /* Android hardware-back: zonder native <Modal> moeten we de back-knop
     zelf afvangen. Listener alleen registreren wanneer bar zichtbaar is. */
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      hideBraceletUpsell();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  if (!visible) return null;

  const onTap = () => {
    /* Dismiss BOTH de bar EN het SESSION COMPLETE-paneel. Zonder de
       dismiss zou de useEffect in (tabs)/index.tsx (die endedPanel
       watcht) de bar opnieuw triggeren zodra we naar /bracelet
       navigeren — dan zou de user op de bracelet-tab landen met de
       upsell-bar weer zichtbaar onderaan. Niet wat we willen: de tap
       is een bewuste "ja ik wil naar bracelet"-keuze, dus de bar is
       klaar. */
    dismissEndedPanel();
    hideBraceletUpsell();
    setTimeout(() => router.push('/(tabs)/bracelet'), 150);
  };

  return (
    <View style={s.overlay} pointerEvents="box-none">
      <Pressable
        style={[
          s.bar,
          /* marginBottom met safe-area-inset + extra 12px → card zweeft
             duidelijk boven de Android nav-bar / iPhone home-indicator
             (was eerder een bottom-sheet die tegen de rand zat). */
          { marginBottom: Math.max(14, insets.bottom + 12) },
        ]}
        onPress={onTap}
        android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
      >
        <View style={s.row}>
          <View style={s.imageWrap}>
            <Image
              source={{ uri: BRACELET_IMAGE_URL }}
              style={s.image}
              resizeMode="contain"
            />
            <SubtleHapticPulse active={visible} />
          </View>

          <View style={s.textCol}>
            <Text style={s.eyebrow}>VIBEZCORE</Text>
            <Text style={s.title}>Smart Bead Bracelet</Text>
            <Text style={s.subtitle}>Daily State Control</Text>
          </View>

          <Text style={s.chevron}>›</Text>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  /* Floating overlay frame — pointerEvents="box-none" zorgt dat alleen
     de bar zelf taps vangt; alles erbuiten propageert naar de screen
     eronder (SESSION COMPLETE-paneel, Play next, etc.).

     paddingHorizontal: 24 + alignItems: 'center' matcht player.tsx's
     modalOverlay-structuur exact (regel 877-883). Daardoor renderen
     beide cards op identieke breedte (maxWidth 360, width 100%,
     gecentreerd) → verticaal volledig uitgelijnd. */
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  /* Bar = floating card (alle 4 hoeken rond, horizontale margin links/
     rechts, marginBottom inline met safe-area). Niet meer aan de rand
     vast → duidelijke "secondary card" leesbaarheid + ruimte onder de
     OS nav-chrome. paddingBottom kleiner dan vroeger omdat de
     safe-zone via marginBottom wordt afgehandeld. */
  /* Match SESSION COMPLETE-paneel exact: maxWidth 360 + width 100%.
     Overlay's alignItems:'center' + paddingHorizontal:24 handelen
     centering + margin af. Beide cards renderen identiek 360 wide. */
  bar: {
    backgroundColor: C.bg,
    borderRadius: 16,
    borderColor: C.border,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    maxWidth: 360,
    width: '100%',
    /* marginBottom wordt inline gezet met safe-area-inset (boven). */
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  /* Image-wrap 156×123 met negatieve verticale margins (-14 top/bottom).
     Bracelet-render-grootte blijft 123×123 (zelfde visuele bracelet),
     maar in de flex-row neemt de wrap effectief slechts 95px hoogte
     in (123 - 28 = 95). Card-hoogte krimpt daardoor ~20% zonder de
     bracelet te verkleinen — operator-besluit "card minder hoogte,
     bracelet ongewijzigd".

     Side-effect: bracelet steekt ~2px boven en onder de card uit (123
     vs row-toegestane 95 = 14 elk kant; minus paddingTop/Bottom van 12
     = 2px bracelet-overhang per kant). Visueel onmerkbaar. */
  imageWrap: {
    width: 156,
    height: 123,
    marginTop: -14,
    marginBottom: -14,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textCol: {
    flex: 1,
    justifyContent: 'center',
  },
  /* Text iets compacter dan eerder (eyebrow 10→9, title 15→14, subtitle
     12→11) zodat de tekst-kolom past naast de 2× grotere image-wrap. */
  eyebrow: {
    color: C.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 2,
  },
  title: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  subtitle: {
    color: C.faint,
    fontSize: 11,
    fontWeight: '500',
  },
  chevron: {
    color: C.chevron,
    fontSize: 28,
    marginLeft: 8,
    lineHeight: 28,
  },
});
