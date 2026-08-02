/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Breath-tab · CHOOSE YOUR MODE

   Deze tab KIEST, en ademt niet. Dat is de hele wijziging (operator,
   2 augustus 2026).

   Wat hier stond was een tweede sessiescherm: een cirkel die meeademde, een
   rondeteller, START/STOP, VIBE- en VOICE-knoppen, een felicitatie achteraf.
   Datzelfde staat sinds 1 augustus in `breath-session.tsx`, met de echte
   illustraties, duurkeuze en het ademritme in beeld. Twee schermen die
   hetzelfde doen lopen onvermijdelijk uit elkaar — en dat deden ze ook: de
   modi heetten hier anders en hadden andere kleuren dan in de sessie.

   Dus: kiezen gebeurt hier, ademen gebeurt daar. Eén illustratie groot in
   beeld, de naam van de modus, wat hij doet, en één knop. Vegen of de pijlen
   gebruiken wisselt van modus; de rij van vijf onderaan laat zien waar je
   bent en springt er direct heen.

   Alles wat per modus verschilt — naam, figuur, kleur, verloop, patroon —
   komt uit `data/breath-states.ts`. Ook de knop hieronder: die draagt het
   verloop van de gekozen modus, niet een vaste huisstijlkleur. Zo kán de
   kleur op de keuzepagina niet meer afwijken van die in de sessie, want het
   is dezelfde regel.

   De eerste keer opent nog steeds de onboarding (`breath-welcome`); die
   eindigt in een volledige gratis sessie.
   ───────────────────────────────────────────────────────────────────────── */

import SessionArt, {
  SESSION_ART,
  prefetchSessionArt,
} from '@/components/SessionArt';
import Starfield from '@/components/Starfield';
import { Brand, BrandFonts } from '@/constants/theme';
import {
  BREATH_STATES,
  cycleSeconds,
  type BreathStateKey,
} from '@/data/breath-states';
import { useBreathHistory } from '@/utils/breath-history';
import { useSetting } from '@/utils/settings';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

/* Dezelfde volgorde als overal elders: van meest activerend naar meest
   kalmerend. Dat is ook de nummering van de bracelet-modi (CLAUDE.md §5),
   dus hij hoort niet per scherm te verschillen. */
const ORDER: BreathStateKey[] = ['boost', 'focus', 'calm', 'clarity', 'rest'];

/* CALM CONTROL staat vooraan geselecteerd: dat is de toestand van de
   onboarding en van de gratis sessie, dus wie hier voor het eerst komt ziet
   wat hij net gedaan heeft. */
const DEFAULT_INDEX = ORDER.indexOf('calm');

/* Het beeldvak. VASTE hoogte, want de tekst eronder mag niet verspringen
   zodra een illustratie groter of kleiner staat — daarvoor bestaat
   `artScale` per toestand. */
const BOX_H = Math.min(Math.round(SCREEN_H * 0.3), 260);
const ART_W = SCREEN_W * 0.92;

const THUMB = 54;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function BreathScreen() {
  const [index, setIndex] = useState(DEFAULT_INDEX);
  const st = BREATH_STATES[ORDER[index]];

  const pagerRef = useRef<ScrollView | null>(null);
  const didPlace = useRef(false);
  const pagerReady = useRef(false);
  const history = useBreathHistory();

  /* ── Eerste keer: naar de onboarding ────────────────────────────────
     Ongewijzigd overgenomen van de vorige versie van dit scherm. De vlag is
     null zolang iemand de intro nooit uitliep; wie al ademsessies heeft
     staan is een bestaande gebruiker van vóór die vlag en hoort er niet
     alsnog doorheen. De halve seconde geeft AsyncStorage de tijd om beide te
     laden — beslissen op nog lege data stuurt een bestaande gebruiker
     onterecht naar de intro. */
  const [onboardingDoneAt] = useSetting('breathOnboardingCompletedAt');
  const flagRef = useRef(onboardingDoneAt);
  flagRef.current = onboardingDoneAt;
  const historyLenRef = useRef(history.length);
  historyLenRef.current = history.length;

  useEffect(() => {
    const id = setTimeout(() => {
      if (flagRef.current !== null) return;
      if (historyLenRef.current > 0) return;
      router.replace('/breath-welcome');
    }, 700);
    return () => clearTimeout(id);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  /* De figuur ademt ook hier, rustig en zonder patroon. Dit is een
     keuzepagina: de beweging laat zien dát het beeld leeft, ze begeleidt nog
     niets. Het echte ritme begint pas in de sessie. */
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath]);

  useEffect(() => {
    prefetchSessionArt();
  }, []);

  /* Wisselen van modus vervangt het hele blok in beeld. Een harde knip leest
     als een storing, dus het beeld dooft en komt terug — kort genoeg om niet
     op te wachten, lang genoeg om te zien dát er iets veranderde. */
  const fade = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + fade.value * 0.75,
    transform: [{ scale: 0.965 + fade.value * 0.035 }],
  }));

  const goTo = useCallback(
    (next: number, scrollPager = true) => {
      const clamped = Math.max(0, Math.min(ORDER.length - 1, next));
      setIndex((prev) => {
        if (prev === clamped) return prev;
        Haptics.selectionAsync();
        fade.value = 0;
        fade.value = withTiming(1, {
          duration: 320,
          easing: Easing.out(Easing.cubic),
        });
        return clamped;
      });
      if (scrollPager) {
        pagerRef.current?.scrollTo({ x: clamped * SCREEN_W, animated: true });
      }
    },
    [fade],
  );

  /* Vegen gebeurt over een DOORZICHTIGE pager boven het beeld, niet over
     vijf echte pagina's met elk hun eigen illustratie. Dat scheelt vier
     Skia-canvassen die je nooit tegelijk ziet, en de figuur zelf bestaat
     maar één keer — dat is wat de overgang zacht houdt. */
  const onPagerEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      /* Zolang de pager zichzelf nog op zijn beginplek zet is elke melding
         van hem geen keuze van de gebruiker. Zonder deze regel meldde hij
         bij het opbouwen positie nul, en stond de pagina op BOOST terwijl de
         rij en de tekst CALM CONTROL hoorden te tonen. */
      if (!pagerReady.current) return;
      goTo(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W), false);
    },
    [goTo],
  );

  const open = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/breath-session', params: { state: st.key } });
  }, [st.key]);

  /* De aanbevolen lengte staat op de regel boven de knop, niet als keuze.
     Wie nog niets gekozen heeft wil weten waar hij aan begint; de vier
     lengtes staan een scherm verder. */
  const suggested =
    st.durations.find((d) => d.recommended) ?? st.durations[st.defaultDuration];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.stars} pointerEvents="none">
        <Starfield
          width={SCREEN_W}
          height={SCREEN_H}
          count={70}
          color="#C9A7FF"
        />
      </View>

      <View style={s.header}>
        <Text style={s.kicker}>CHOOSE YOUR MODE</Text>
        <Text style={s.lead}>Five states. One breath at a time.</Text>
      </View>

      {/* Alles onder de kop staat als ÉÉN blok gecentreerd in wat er
          overblijft. Stond de praktijkregel onderaan vastgeprikt, dan viel
          er tussen de rij van vijf en die regel een leeg vlak van een derde
          scherm — en een keuzepagina die halfleeg staat leest als een pagina
          waar nog iets bij moet. */}
      <View style={s.body}>
      {/* ── Het beeld, met de veeglaag eroverheen ── */}
      <View style={s.stage}>
        <Animated.View style={[s.artWrap, fadeStyle]} pointerEvents="none">
          <SessionArt
            size={ART_W * (st.artScale ?? 1)}
            art={st.art}
            breath={breath}
            glow={st.glow}
            boxHeight={BOX_H}
            focusY={st.focusY}
          />
        </Animated.View>

        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPagerEnd}
          /* De pager begint op de standaardmodus, anders klopt zijn positie
             niet met de rij eronder. Via `onLayout` en niet via
             `contentOffset`: dat laatste is op Android geen prop maar
             decoratie — het doet daar niets. Pas als hij staat gaan zijn
             meldingen tellen; zie `onPagerEnd`. */
          onLayout={() => {
            if (didPlace.current) return;
            didPlace.current = true;
            pagerRef.current?.scrollTo({
              x: DEFAULT_INDEX * SCREEN_W,
              animated: false,
            });
            setTimeout(() => {
              pagerReady.current = true;
            }, 120);
          }}
          style={StyleSheet.absoluteFill}
        >
          {ORDER.map((k) => (
            <View key={k} style={{ width: SCREEN_W }} />
          ))}
        </ScrollView>

        {/* De pijlen staan ná de pager, dus ze vangen hun eigen tik. Aan de
            uiteinden verdwijnen ze in plaats van grijs te worden: een pijl
            die er staat maar niets doet is erger dan geen pijl. */}
        {index > 0 && (
          <Pressable
            onPress={() => goTo(index - 1)}
            hitSlop={16}
            style={[s.arrow, s.arrowLeft]}
            accessibilityLabel="Previous mode"
          >
            <ChevronLeft
              size={22}
              color="rgba(255,255,255,0.8)"
              strokeWidth={2.4}
            />
          </Pressable>
        )}
        {index < ORDER.length - 1 && (
          <Pressable
            onPress={() => goTo(index + 1)}
            hitSlop={16}
            style={[s.arrow, s.arrowRight]}
            accessibilityLabel="Next mode"
          >
            <ChevronRight
              size={22}
              color="rgba(255,255,255,0.8)"
              strokeWidth={2.4}
            />
          </Pressable>
        )}
      </View>

      {/* ── Wie dit is ── */}
      <Animated.View style={[s.copy, fadeStyle]}>
        <Text style={[s.mode, { color: st.accent }]}>{st.eyebrow}</Text>
        <Text style={s.figure}>{st.title}</Text>
        <Text style={s.tagline}>{st.tagline}</Text>
        <Text style={s.spec}>
          {st.technique} · {fmt(suggested.rounds * cycleSeconds(st))}
        </Text>
      </Animated.View>

      {/* ── De knop draagt de kleur van de modus ── */}
      <Pressable onPress={open} style={s.ctaWrap}>
        <LinearGradient
          colors={st.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.cta}
        >
          <Text style={s.ctaTxt}>SELECT MODE</Text>
        </LinearGradient>
      </Pressable>

      {/* ── De vijf, altijd zichtbaar ── */}
      <View style={s.thumbs}>
        {ORDER.map((k, i) => {
          const t = BREATH_STATES[k];
          const on = i === index;
          return (
            <Pressable
              key={k}
              onPress={() => goTo(i)}
              style={[
                s.thumb,
                on && { borderColor: t.accent, backgroundColor: t.accentSoft },
              ]}
              accessibilityLabel={t.eyebrow}
            >
              <Image
                source={{ uri: SESSION_ART[t.art] }}
                style={[s.thumbImg, !on && s.thumbImgOff]}
                resizeMode="contain"
              />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push('/breath-history')}
        hitSlop={10}
        style={s.historyWrap}
      >
        <Text style={s.historyTxt}>
          {history.length > 0
            ? `YOUR PRACTICE · ${history.length} SESSION${
                history.length === 1 ? '' : 'S'
              }`
            : 'YOUR PRACTICE'}
        </Text>
      </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  stars: { ...StyleSheet.absoluteFillObject },

  header: { alignItems: 'center', marginTop: 10 },
  kicker: {
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    letterSpacing: 4.4,
    color: '#ffffff',
  },
  lead: {
    marginTop: 6,
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.5)',
  },

  body: { flex: 1, justifyContent: 'center', paddingBottom: 8 },

  stage: {
    width: SCREEN_W,
    height: BOX_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artWrap: { alignItems: 'center', justifyContent: 'center' },
  /* Buiten de illustratie, tegen de schermrand. Binnen het beeld zouden ze
     over de figuur liggen, en die figuur is waar het scherm om draait. */
  arrow: {
    position: 'absolute',
    top: BOX_H / 2 - 21,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: { left: 10 },
  arrowRight: { right: 10 },

  copy: { alignItems: 'center', marginTop: 20, paddingHorizontal: 24 },
  mode: {
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    letterSpacing: 3.6,
  },
  figure: {
    marginTop: 8,
    fontFamily: BrandFonts.extrabold,
    fontSize: 30,
    letterSpacing: -0.7,
    color: '#ffffff',
    textAlign: 'center',
  },
  tagline: {
    marginTop: 6,
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.66)',
    textAlign: 'center',
  },
  spec: {
    marginTop: 10,
    fontFamily: BrandFonts.semibold,
    fontSize: 11.5,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.42)',
  },

  ctaWrap: { marginTop: 24, marginHorizontal: 22, borderRadius: 15 },
  cta: {
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 13.5,
    letterSpacing: 2.4,
    color: '#ffffff',
  },

  thumbs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 22,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: THUMB * 0.82, height: THUMB * 0.82 },
  /* De niet-gekozen vier zakken terug, maar niet weg: ze moeten leesbaar
     blijven als rij, anders is het geen keuze meer maar een versiering. */
  thumbImgOff: { opacity: 0.42 },

  historyWrap: { alignSelf: 'center', marginTop: 26, paddingVertical: 8 },
  historyTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.42)',
  },
});
