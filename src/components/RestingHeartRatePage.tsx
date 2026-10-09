/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "Your Resting Heart Rate" (eerste kennismaking State Control)

   Operator, 9 okt 2026: "dat moet één van de eerste zaken zijn die iemand
   ziet … zorg dat die pagina er heel premium uitziet, ik ga dat veel
   gebruiken voor marketing". Eigen volledig scherm direct na de State
   Control-intro, zolang er nog geen keuze is gemaakt (meten / invullen /
   bewust het gemiddelde). Daarna nooit meer vanzelf — wijzigen gaat via
   het label bovenaan State Control of Profile.

   Beeld: een kloppend hart in Bio-Teal met uitdeinende ringen op een
   rustig "lub-dub" (≈60 bpm) — dezelfde hartslag-taal als de sessies zelf.
   Enkel transform/opacity op de UI-thread, geen live vervaging (zie
   memory real-glass-only-in-sheets).

   Teksten: voorstel, operator beslist (welzijnstaal, geen meet-claim).
   ───────────────────────────────────────────────────────────────────────── */

import PressScale from '@/components/PressScale';
import RhythmSheet from '@/components/RhythmSheet';
import { AudioAccent, AudioAccentLight, BrandFonts } from '@/constants/theme';
import { BraceletMode } from '@/services/ble-contract';
import { chooseAverageRestingPulse } from '@/services/resting-pulse';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BEAT_MS = 1200; // ≈50 bpm — operator 9 okt 2026: "hartslag mag rustiger"

/* Operator, 9 okt 2026 ("de ringen doen niets"): elke ring een eigen,
   onafhankelijke animatie (gedeelde teller bleef op 0 staan). Vertraging
   0 / 1 / 2 s → bij elke hartslag vertrekt een nieuwe ring. */
function Ring({ delay, size, from }: { delay: number; size: number; from: number }) {
  /* Start op 1 (= onzichtbaar): een ring die nog moet vertrekken, mag niet
     als witte lijn op de cirkel blijven hangen (operator, 9 okt 2026). */
  const p = useSharedValue(1);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withSequence(
        withTiming(0, { duration: 0 }),
      /* Vervolg ("animatie buitenste ringen klopt niet"): een rimpeling per
         slag — leeft 2 slagen, dus max 2 ringen tegelijk. */
      /* Drukgolf: vertrekt vlot op de "lub", vertraagt dan zacht. */
      /* Vervolg ("meer ringen aan de buitenkant"): elke ring leeft 4
         slagen → 4 ringen tegelijk onderweg, één nieuwe per slag. */
      withRepeat(withTiming(1, { duration: BEAT_MS * 4, easing: Easing.bezier(0.16, 1, 0.3, 1) }), -1, false),
      ),
    );
    return () => cancelAnimation(p);
  }, [delay, p, from]);
  /* Vervolg ("geheel moet mooi samenwerken"): start exact op de rand van
     de gevulde cirkel (`from`), deint uit tot de buitenrand, vervaagt. */
  const style = useAnimatedStyle(() => ({
    /* Vervolg ("buitenste ringen niet zichtbaar"): vervaagt pas op het
       einde. */
    /* Vervolg ("deint te ver uit, moet beter"): blijft binnen de eigen
       ruimte (tot 1×), zachter vervagen. */
    opacity: 0.55 * (1 - p.value),
    transform: [{ scale: from + p.value * (1 - from) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[s.ring, { width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}

export default function RestingHeartRatePage({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  /* Operator, 9 okt 2026 ("alle tekst op elkaar"): het beeld schaalt mee
     met de schermhoogte i.p.v. vaste 260 pt. */
  const { height } = useWindowDimensions();
  /* Vervolg (operator: "tekst wordt door de knop afgesneden"): het hart
     krijgt enkel de ruimte die echt overblijft (gemeten), max 280. */
  const [area, setArea] = useState(0);
  const stage = Math.round(Math.max(140, Math.min(280, height * 0.32, area > 0 ? area - 24 : 280)));
  const core = Math.round(stage * 0.6); // 9 okt 2026: volle cirkel (operator: "kleiner nu")
  const [sheet, setSheet] = useState<null | 'measure' | 'manual'>(null);

  /* Lub-dub op het hart, ringen deinen continu uit. */
  const beat = useSharedValue(1);
  useEffect(() => {
    beat.value = withRepeat(
      withSequence(
        /* Operator, 9 okt 2026 ("kan je echte hartslag nabootsen"): de
           hartcyclus — "lub" (S1, kamers trekken krachtig en snel samen),
           ~300 ms later een kleinere "dub" (S2, kleppen sluiten), dan de
           lange, rustige vulfase. 1200 ms ≈ 50 bpm. */
        withTiming(1.1, { duration: 90, easing: Easing.bezier(0.2, 0.9, 0.3, 1) }),
        withTiming(1.0, { duration: 140, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
        withDelay(70, withTiming(1.05, { duration: 80, easing: Easing.bezier(0.2, 0.9, 0.3, 1) })),
        withTiming(1, { duration: 180, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
        withDelay(640, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [beat]);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  /* Vervolg ("de grote volle cirkel moet ook meebewegen"): klopt mee,
     half zo sterk als het hart — één kloppend geheel. */
  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (beat.value - 1) * 0.5 }] }));
  /* Vervolg ("achter de volle cirkel een lichtbron"): zachte gloed die
     meeklopt. */
  /* Vervolg ("lichtbron mag gloeien en verzachten"): groter, zachter
     verloop, en een trage eigen gloei (≈2 hartslagen in, 2 uit) bovenop
     een lichte reactie op elke slag. */
  const glowBreath = useSharedValue(0);
  useEffect(() => {
    glowBreath.value = withRepeat(
      withTiming(1, { duration: BEAT_MS * 2, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(glowBreath);
  }, [glowBreath]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + glowBreath.value * 0.4 + (beat.value - 1) * 1.5,
    transform: [{ scale: 0.96 + glowBreath.value * 0.06 + (beat.value - 1) * 0.4 }],
  }));

  return (
    <View style={s.root}>
      {/* Operator, 9 okt 2026: achtergrond helemaal zwart (geen gloed). */}

      <View style={[s.content, { paddingTop: insets.top + 28 }]}>

        {/* Operator, 9 okt 2026: titel bovenaan, hart eronder. */}
        <Text style={s.title}>Your Resting{'\n'}Heart Rate</Text>
        {/* Operator, 9 okt 2026: korter — slogan i.p.v. uitlegzin. */}
        <Text style={s.body}>Your rhythm  •  Your baseline</Text>
        <View style={s.stageArea} onLayout={(e) => setArea(e.nativeEvent.layout.height)}>
        <View style={[s.stage, { width: stage, height: stage }]}>
          {[0, 1, 2, 3].map((k) => (
            <Ring key={`r${k}-${stage}`} delay={BEAT_MS * k} size={stage} from={core / stage} />
          ))}
          <Animated.View style={[s.core, { width: core, height: core, borderRadius: core / 2, zIndex: 2, elevation: 2 }, coreStyle]}>
            {/* Operator, 9 okt 2026: doorschijnend witte, gevulde cirkel rond
                het hart (geen losse lichtbron). */}
            <LinearGradient
              colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.05)']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View style={heartStyle}>
              <Heart size={Math.round(core * 0.42)} color="#ffffff" fill="#ffffff" strokeWidth={1.4} />
            </Animated.View>
          </Animated.View>
        </View>
        </View>


      </View>

      {/* Verborgen zolang het meetblad open is: anders schemert de witte
          knop als grijze band door het glas achter de meetring. */}
      <View style={[s.actions, { paddingBottom: Math.max(insets.bottom, 12) + 4, opacity: sheet ? 0 : 1 }]}>
        <PressScale style={s.cta} haptic scaleTo={0.97} onPress={() => setSheet('measure')} accessibilityRole="button">
          <Text style={s.ctaTxt}>Measure Now</Text>
        </PressScale>
        {/* Operator, 9 okt 2026 ("zweven een beetje"): tweede keuze als
            omlijnde knop, direct onder de hoofdknop — één blok. */}
        <PressScale style={s.linkFirst} onPress={() => setSheet('manual')} accessibilityRole="button">
          <Text style={s.linkTxt}>Enter Manually</Text>
        </PressScale>
        <PressScale
          style={s.link}
          onPress={() => {
            chooseAverageRestingPulse();
            onDone();
          }}
          accessibilityRole="button"
        >
          <Text style={s.linkDim}>Use an Average for Now</Text>
        </PressScale>
        <Text style={s.legal}>For wellness only, not a medical measurement.</Text>
      </View>

      <RhythmSheet
        visible={sheet !== null}
        mode={BraceletMode.Alpha}
        startAt={sheet ?? 'measure'}
        onClose={() => setSheet(null)}
        onDone={() => {
          setSheet(null);
          onDone();
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 520 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 28 },
  eyebrow: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.6)',
  },
  stageArea: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 160 },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.2,
    borderColor: '#ffffff', // 9 okt 2026: ringen wit (geheel in wit)
  },
  /* Operator, 9 okt 2026: geen gevulde cirkel meer — enkel het hart met de
     lichtbron erachter. (Container blijft voor de maat.) */
  core: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  title: {
    marginTop: 8,
    fontFamily: BrandFonts.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
    color: '#ffffff',
    textAlign: 'center',
  },
  body: {
    marginTop: 18,
    marginBottom: 14,
    maxWidth: 320,
    fontFamily: BrandFonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
  },
  /* Accent enkel in het beeld (hart/ringen) — tekst wit/grijs, Apple-stijl. */
  facts: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26, marginBottom: 12 },
  fact: { fontFamily: BrandFonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.5)' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.3)' },
  actions: { paddingHorizontal: 24, paddingTop: 24 },
  cta: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#1D1D1F' },
  /* Vervolg ("omlijning niet mooi"): iOS' grijze knop — zachte vulling,
     geen rand. */
  secondaryBtn: {
    marginTop: 10,
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Vervolg ("kan dat zonder knop?"): twee tekstlinks, dicht onder de
     hoofdknop zodat het één groep blijft. */
  linkFirst: { height: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  link: { height: 40, alignItems: 'center', justifyContent: 'center' },
  /* Operator, 9 okt 2026: onderstreept, zodat meteen duidelijk is dat het
     tikbaar is. */
  linkTxt: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#ffffff', textDecorationLine: 'underline' },
  linkDim: { fontFamily: BrandFonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.7)', textDecorationLine: 'underline' },
  /* Voetnoot zoals Apple's kleine lettertjes: ~12–13 pt, grijs, helemaal
     onderaan met wat afstand tot de knoppen. */
  legal: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.42)',
  },
});
