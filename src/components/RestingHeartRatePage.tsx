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
import { heartbeatTick, preloadHeartbeatSound, startHeartbeatSound, stopHeartbeatSound } from '@/services/heartbeat-sound';
import { hapticTap } from '@/utils/haptics';
import { useFocusEffect } from 'expo-router';
import { scheduleOnRN } from 'react-native-worklets';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { ECG_SHAPE } from '@/utils/ecg-shape';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* Lucide-hart (24×24), zelfde vorm als de iconen elders in de app. */
const HEART_D =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';
/* Geluid en tik iets vóór de "lub" starten: afspelen heeft een korte
   vertraging, zo vallen geluid, tik en beeld samen. */
const SOUND_LEAD_MS = 60;
const BEAT_MS = 1500; // ≈40 bpm — operator 9 okt 2026: "hartslag mag rustiger" (2x)

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* Eén hartslag op de lijn (P, QRS, T): [ms t.o.v. de R-piek, hoogte −1…1]. */
/* Vorm van één slag: gedeeld met het andere scherm (utils/ecg-shape). */
const PQRST = ECG_SHAPE;
/* De R-piek valt midden in de "lub" van het hart. */
const R_AT = 60;

function easeOut(x: number) {
  'worklet';
  return 1 - (1 - x) * (1 - x);
}
function easeInOut(x: number) {
  'worklet';
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
/* Lub-dub als functie van de fase (0…BEAT_MS): S1 krachtig, ~300 ms later
   een kleinere S2, dan de lange rustige vulfase. */
function beatScale(ph: number) {
  'worklet';
  if (ph < 120) return 1 + 0.07 * easeOut(ph / 120);
  if (ph < 320) return 1.07 - 0.07 * easeInOut((ph - 120) / 200);
  if (ph < 410) return 1;
  if (ph < 520) return 1 + 0.035 * easeOut((ph - 410) / 110);
  if (ph < 760) return 1.035 - 0.035 * easeInOut((ph - 520) / 240);
  return 1;
}

export default function RestingHeartRatePage({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  /* Operator, 9 okt 2026: Android-terugknop → terug naar de State Control-
     welkomstpagina. (Een open meetblad vangt de terugknop zelf eerst.) */
  useEffect(() => {
    if (!onBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  const insets = useSafeAreaInsets();
  /* Operator, 9 okt 2026 ("alle tekst op elkaar"): het beeld schaalt mee
     met de schermhoogte i.p.v. vaste 260 pt. */
  const { height, width } = useWindowDimensions();
  /* Vervolg (operator: "tekst wordt door de knop afgesneden"): het hart
     krijgt enkel de ruimte die echt overblijft (gemeten), max 280. */
  const [area, setArea] = useState(0);
  const stage = Math.round(Math.max(140, Math.min(280, height * 0.32, area > 0 ? area - 24 : 280)));
  const core = Math.round(stage * 0.6); // 9 okt 2026: volle cirkel (operator: "kleiner nu")
  const [sheet, setSheet] = useState<null | 'measure' | 'manual'>(null);

  /* Operator, 9 okt 2026 ("een kloppend hart waardoor de hartgrafiek
     loopt"): één klok voor hart én lijn — de piek gaat precies op de "lub"
     door het hart. De witte ringen en de extra ring zijn weg (te druk). */
  const clock = useSharedValue(0);
  const t0 = useSharedValue(-1);
  useFrameCallback((f) => {
    if (t0.value < 0) t0.value = f.timestamp;
    clock.value = f.timestamp - t0.value;
  });
  /* Vervolg (operator, 9 okt 2026: "je moet zien hoe de pieken vormen —
     de echte beweging"): zoals een monitor schrijft een lichtpuntje rechts
     van het hart de lijn; de piek ontstaat daar en het spoor schuift naar
     links door het hart. Het hart klopt wanneer de piek erdoor gaat. */
  const lineW = Math.round(Math.min(width - 32, stage * 1.7));
  const lineH = Math.round(core * 0.8);
  const headX = Math.round(lineW * 0.82);
  const speed = lineW / 2 / (BEAT_MS * 1.5); // px per ms (1,5× trager)
  const travelMs = (headX - lineW / 2) / speed; // van schrijfpunt tot hart
  /* Operator, 9 okt 2026 ("hartslaggeluid op deze pagina"): op elke slag
     een zachte lub-dub + een fijne tik — enkel zolang de pagina in beeld is
     (andere tab, meetblad open of app op de achtergrond → stil). */
  const live = useRef(false);
  const onBeat = useCallback(() => {
    if (!live.current) return;
    heartbeatTick();
    hapticTap();
  }, []);
  /* Eerste beeldje: enkel de huidige slag onthouden. Daarna klinkt elke
     nieuwe slag — ook de allereerste "lub" (k gaat van −1 naar 0 na
     ~1 s); die werd eerst overgeslagen (operator: "duurt 3 à 4 s"). */
  const lastBeatK = useSharedValue(0);
  const beatInit = useSharedValue(false);
  useFrameCallback(() => {
    const k = Math.floor((clock.value - travelMs + SOUND_LEAD_MS) / BEAT_MS);
    if (!beatInit.value) {
      beatInit.value = true;
      lastBeatK.value = k;
      return;
    }
    if (k !== lastBeatK.value) {
      lastBeatK.value = k;
      scheduleOnRN(onBeat);
    }
  });
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const on = focused && appActive && sheet === null;
    live.current = on;
    if (on) startHeartbeatSound();
    else stopHeartbeatSound();
  }, [focused, appActive, sheet]);
  useEffect(() => {
    preloadHeartbeatSound();
    return () => stopHeartbeatSound();
  }, []);
  const beat = useDerivedValue(() => {
    const ph = (((clock.value - travelMs) % BEAT_MS) + BEAT_MS) % BEAT_MS;
    return beatScale(ph);
  });
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));

  /* Hoogte van de lijn op het schrijfpunt, nu. */
  const headY = useDerivedValue(() => {
    const now = clock.value;
    const tk = now - ((((now - R_AT) % BEAT_MS) + BEAT_MS) % BEAT_MS);
    let dt = now - tk;
    if (dt > PQRST[PQRST.length - 1][0]) dt -= BEAT_MS;
    if (dt < PQRST[0][0] || dt > PQRST[PQRST.length - 1][0]) return 0;
    for (let j = 1; j < PQRST.length; j++) {
      if (dt <= PQRST[j][0]) {
        const [t0, a0] = PQRST[j - 1];
        const [t1, a1] = PQRST[j];
        return a0 + ((a1 - a0) * (dt - t0)) / (t1 - t0);
      }
    }
    return 0;
  });
  const lineProps = useAnimatedProps(() => {
    const mid = lineH / 2;
    const amp = (lineH / 2 - 3) * 0.95;
    const now = clock.value;
    const pts: number[][] = [];
    const kMax = Math.floor((now - R_AT) / BEAT_MS) + 1;
    const kMin = Math.floor((now - headX / speed - R_AT) / BEAT_MS) - 1;
    for (let k = kMin; k <= kMax; k++) {
      const tk = k * BEAT_MS + R_AT;
      for (let j = 0; j < PQRST.length; j++) {
        const t = tk + PQRST[j][0];
        if (t > now) break; // nog niet geschreven
        const x = headX + (t - now) * speed;
        if (x < 0) continue;
        pts.push([x, mid - PQRST[j][1] * amp]);
      }
    }
    pts.sort((m, n) => m[0] - n[0]);
    let d = `M0 ${mid}`;
    for (let i = 0; i < pts.length; i++) d += ` L${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
    d += ` L${headX} ${(mid - headY.value * amp).toFixed(1)}`;
    return { d };
  });
  const dotProps = useAnimatedProps(() => ({ cy: lineH / 2 - headY.value * (lineH / 2 - 3) * 0.95 }));
  const dotGlowProps = useAnimatedProps(() => ({ cy: lineH / 2 - headY.value * (lineH / 2 - 3) * 0.95 }));

  return (
    <View style={s.root}>
      {/* Operator, 9 okt 2026: achtergrond helemaal zwart (geen gloed). */}

      <View style={[s.content, { paddingTop: insets.top + 28 }]}>

        {/* Operator, 9 okt 2026: titel bovenaan, hart eronder. */}
        <Text style={s.title}>Your Resting{'\n'}Heart Rate</Text>
        {/* Operator, 9 okt 2026: korter — slogan i.p.v. uitlegzin. */}
        <Text style={s.body}>Your rhythm  •  Your baseline</Text>
        {/* Verborgen zolang het meetblad open is: anders schemert het groene
            hart door het glas achter de telefoon-animatie (operator, 9 okt 2026). */}
        <View style={[s.stageArea, { opacity: sheet ? 0 : 1 }]} onLayout={(e) => setArea(e.nativeEvent.layout.height)}>
        <View style={[s.stage, { width: stage, height: stage }]}>
          {/* Operator, 9 okt 2026: de cirkel staat stil — enkel het hart klopt. */}
          <View style={[s.core, { width: core, height: core, borderRadius: core / 2, zIndex: 2 }]}>
            {/* Vervolg (operator, 9 okt 2026: "de volle cirkel toch groen glas"):
                Bio-Teal tint, lichte glans bovenaan, dunne heldere rand
                (s.core). Geen echte vervaging buiten een sheet — dat crasht
                op Android (memory real-glass-only-in-sheets). */}
            <LinearGradient
              colors={['rgba(74,240,212,0.30)', 'rgba(0,163,163,0.12)']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.55 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          {/* Hartlijn tussen het glas en het hart. */}
          <Svg
            pointerEvents="none"
            width={lineW}
            height={lineH}
            style={{ position: 'absolute', left: (stage - lineW) / 2, top: (stage - lineH) / 2, zIndex: 3 }}
          >
            <Defs>
              <SvgLinearGradient id="ecgPage" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={lineW} y2="0">
                <Stop offset="0" stopColor="#4AF0D4" stopOpacity={0} />
                <Stop offset="0.3" stopColor="#4AF0D4" stopOpacity={0.8} />
                <Stop offset="0.82" stopColor="#4AF0D4" stopOpacity={1} />
                <Stop offset="1" stopColor="#4AF0D4" stopOpacity={1} />
              </SvgLinearGradient>
            </Defs>
            <AnimatedPath
              animatedProps={lineProps}
              stroke="url(#ecgPage)"
              strokeWidth={2.4}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Schrijfpunt: zachte gloed + helder puntje */}
            <AnimatedCircle cx={headX} r={7} fill="#4AF0D4" fillOpacity={0.18} animatedProps={dotGlowProps} />
            <AnimatedCircle cx={headX} r={2.8} fill="#CFFFF6" animatedProps={dotProps} />
          </Svg>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', zIndex: 4 }, heartStyle]}>
              {/* Operator, 9 okt 2026: hart in Bio-Teal als glas — één kleur
                  (doorschijnend teal), geen harde omlijning, enkel een zachte
                  glans bovenaan die wegvloeit. Zelfde vorm als het lucide-hart. */}
              <Svg width={Math.round(core * 0.6)} height={Math.round(core * 0.6)} viewBox="0 0 24 24">
                <Defs>
                  {/* Operator, 10 okt 2026 ("consistentie over heel de app"):
                      enkel de huisstijl-overgang Bio-Teal #4AF0D4 → #00A3A3
                      (theme.ts AudioAccentLight → AudioAccent), geen eigen tint. */}
                  <SvgLinearGradient id="hgFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={AudioAccentLight} />
                    <Stop offset="1" stopColor={AudioAccent} />
                  </SvgLinearGradient>
                  <SvgLinearGradient id="hgShine" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#ffffff" stopOpacity={0.3} />
                    <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
                  </SvgLinearGradient>
                </Defs>
                {/* Vervolg (operator, 9 okt 2026): groter, en steviger glas zodat de
                    hartlijn er duidelijk achter verdwijnt. */}
                <Path d={HEART_D} fill="url(#hgFill)" />
                <Path d={HEART_D} fill="url(#hgShine)" />
              </Svg>
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
          {/* Operator, 9 okt 2026: geen onderlijning, wel een subtiel pijltje. */}
          <View style={s.linkRow}>
            <Text style={s.linkTxt}>Enter Manually</Text>
            <ChevronRight size={17} color="rgba(255,255,255,0.55)" strokeWidth={2.4} />
          </View>
        </PressScale>
        <PressScale
          style={s.link}
          onPress={() => {
            chooseAverageRestingPulse();
            onDone();
          }}
          accessibilityRole="button"
        >
          <View style={s.linkRow}>
            <Text style={s.linkDim}>Use an Average for Now</Text>
            <ChevronRight size={16} color="rgba(255,255,255,0.4)" strokeWidth={2.4} />
          </View>
        </PressScale>
        <Text style={s.legal}>For wellness only, not a medical measurement.</Text>
      </View>

      <RhythmSheet
        visible={sheet !== null}
        mode={BraceletMode.Alpha}
        startAt={sheet ?? 'measure'}
        nextLabel="Let's Go"
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
    /* Operator, 9 okt 2026: "geen rand" — het glas leest enkel uit
       tint en glans. De rand blijft technisch bestaan maar transparant:
       zonder rand tekent Android deze afgeronde, geclipte laag niet. */
    borderWidth: 1,
    borderColor: 'transparent',
  },
  /* Extra ring die meeklopt op elke slag (operator, 9 okt 2026). */
  beatRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(74,240,212,0.7)',
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
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkTxt: { fontFamily: BrandFonts.semibold, fontSize: 16, color: '#ffffff' },
  linkDim: { fontFamily: BrandFonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.7)' },
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
