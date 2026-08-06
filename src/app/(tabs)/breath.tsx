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
import { SlideIntro } from '@/app/breath-welcome';
import { assetUri } from '@/services/asset-cache';
import { Brand, BrandFonts } from '@/constants/theme';
import {
  BREATH_STATES,
  cycleSeconds,
  type BreathStateKey,
} from '@/data/breath-states';
import { useBreathHistory } from '@/utils/breath-history';
import { suggestBreath } from '@/utils/breath-suggestion';
import { useSetting } from '@/utils/settings';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowRight,
  ChartNoAxesColumn,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
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

/* Waar de pagina op opent als er nog niets te suggereren valt: CALM CONTROL,
   de toestand van de onboarding en van de gratis sessie. Zodra er historiek
   is neemt de suggestie het over — zie `suggestion` hieronder. */
const FALLBACK_INDEX = ORDER.indexOf('calm');

/* Het beeldvak. VASTE hoogte, want de tekst eronder mag niet verspringen
   zodra een illustratie groter of kleiner staat — daarvoor bestaat
   `artScale` per toestand. */
/* Het beeldvak levert hoogte in aan de rij eronder: die draagt nu twee
   leesbare regels per toestand in plaats van één onleesbare. */
const BOX_H = Math.min(Math.round(SCREEN_H * 0.28), 252);
/* 20% kleiner (operator, 3 augustus 2026): op een smaller toestel dan de
   emulator liepen de illustraties tot tegen de kop en de naam eronder aan.
   Tekst hoort vrij te staan, dus de figuur wijkt — niet andersom. */
const ART_W = SCREEN_W * 0.82;

/* Vijf naast elkaar binnen de schermbreedte, met naam en ondertitel eronder.
   De kolombreedte staat vast zodat de langste naam — CALM CONTROL — de rij
   niet scheeftrekt. */
/* De kier is bewust klein en de zijmarge ook: elke punt die hier overblijft
   gaat naar de KOLOM, en de kolombreedte bepaalt hoe groot de naam eronder
   mag staan. Op 6 punt kier bleef er 73 over en paste CALM CONTROL alleen op
   zeven en een halve punt — onleesbaar. */
const THUMB_GAP = 4;
const THUMB_COL = Math.floor((SCREEN_W - 8 - THUMB_GAP * 4) / 5);
/* Iets smaller dan de kolom: de lichtkrans steekt buiten het beeld uit en
   moet niet in die van de buren lopen. */
const THUMB = Math.min(THUMB_COL - 12, 62);

/* Even groot IN BEELD, niet even groot als bestand.
   Elke illustratie heeft een andere lege rand: de zon en de lotus staan
   klein in hun eigen bestand, de flower of life en het kristal vullen het
   hunne bijna helemaal. Tekende de rij alle vijf op dezelfde maat, dan
   stonden zon en lotus zichtbaar kleiner dan de rest — en dat is precies
   wat de operator zag.
   Diezelfde ongelijkheid is bij het grote beeld al gemeten en staat als
   `artScale` per toestand. Hier wordt hij hergebruikt in plaats van
   overgeschreven: één getal per illustratie, twee plekken die het volgen.
   0.72 is de ijkwaarde (FOCUS) — die stond al goed, dus die blijft 1×. */
const THUMB_REF = 0.72;
const thumbSize = (artScale?: number) =>
  THUMB * Math.min(1.7, (artScale ?? 1) / THUMB_REF);

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function BreathScreen() {
  /* De suggestie bepaalt waar de pagina op OPENT. Bewust geen extra balk of
     kaart erbij: het scherm ziet er precies hetzelfde uit, hij staat alleen
     al op de juiste deur. Dat is de rustigste vorm die een aanbeveling kan
     hebben — je hoeft hem niet weg te klikken als je iets anders wil, je
     veegt gewoon door.
     Eén keer bepaald bij het openen; hem laten meebewegen met de klok zou
     de pagina onder je handen laten verspringen. */
  const history = useBreathHistory();
  /* MOET boven de suggestie staan: die leest hem. Stond hij eronder, dan is
     de waarde er nog niet op het moment dat de berekening loopt. */
  const [goal] = useSetting('goal');
  const suggestion = useMemo(
    () =>
      history.length > 0 ? suggestBreath(history, new Date(), goal) : null,
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [history.length > 0],
  );
  const startIndex = suggestion
    ? ORDER.indexOf(suggestion.state)
    : FALLBACK_INDEX;

  const [index, setIndex] = useState(FALLBACK_INDEX);
  const [infoOpen, setInfoOpen] = useState(false);

  /* ── Het welkomstbeeld gaat vooraf ──────────────────────────────────
     Wie op de Breath-tab tikt ziet eerst de gezichten die in de mandala
     overgaan, en klikt dan door naar de vijf toestanden (operator, 5 augustus
     2026). Het is het mooiste beeld dat de app heeft en het stond alleen in
     de onboarding, die je één keer ziet en daarna nooit meer.

     Terug naar dit beeld bij ELKE keer dat de tab de aandacht krijgt — ook
     als je van een sessie terugkomt. Dat is de bedoeling: het is een drempel
     die je even laat landen, geen scherm dat je één keer wegklikt. */
  const [intro, setIntro] = useState(true);
  /* De teller dwingt een VERSE opbouw van het beeld bij elke terugkeer. Zonder
     dat blijft het onderdeel staan waar het stond — op de mandala — en zie je
     de gezichten nooit meer terug. Nu begint de reeks elke keer opnieuw bij de
     foto (operator, 5 augustus 2026). */
  const [introRun, setIntroRun] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setIntro(true);
      setIntroRun((n) => n + 1);
    }, []),
  );

  /* Twee getallen uit de historiek. Berekend en niet opgeslagen: een streak
     die als getal wordt bewaard loopt uit de pas zodra iemand een dag mist en
     de app die dag niet opent. */
  const practice = useMemo(() => {
    const now = new Date();
    const weekAgo = now.getTime() - 7 * 864e5;
    const weekMin = Math.round(
      history
        .filter((e) => e.ts >= weekAgo)
        .reduce((sum, e) => sum + e.durSec, 0) / 60,
    );

    /* Aaneengesloten dagen terug vanaf vandaag. Vandaag nog niets gedaan
       breekt de reeks NIET — de dag is nog niet voorbij. */
    const days = new Set(
      history.map((e) => new Date(e.ts).toDateString()),
    );
    let streak = 0;
    const d = new Date(now);
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
    while (days.has(d.toDateString())) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    }
    return { weekMin, streak };
  }, [history]);
  const st = BREATH_STATES[ORDER[index]];

  const pagerRef = useRef<ScrollView | null>(null);
  const didPlace = useRef(false);
  const pagerReady = useRef(false);

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

  /* ── Een halve centimeter lager ─────────────────────────────────────────
     Vier van de vijf figuren hingen te hoog in hun vak (operator, 3 augustus
     2026); alleen de lotus stond goed. Dat is geen toeval: die heeft als
     enige `focusY 0.43` en zit dus al lager, precies omdat het onderwerp
     anders in zijn bestand staat dan bij de andere vier.

     De correctie gebeurt HIER en niet in de gegevens, want `focusY` zegt waar
     het onderwerp in het bestand zit — dat is een eigenschap van het beeld en
     die verandert niet omdat één scherm anders is ingedeeld. Het sessiescherm
     heeft een ander vak en moet ongemoeid blijven.

     Omgerekend via de beeldmaat, zodat elke figuur exact evenveel zakt: op
     een scherm van 160 punten per inch is een halve centimeter ruim dertig
     punten, en `translateY` in SessionArt is (0.5 − focusY) × maat. */
  const artSize = ART_W * (st.artScale ?? 1);
  const drop = st.key === 'calm' ? 0 : 31 / artSize;

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

      {/* Alleen de naam van de toestand (operator, 4 augustus 2026).
          "CHOOSE YOUR MODE" en "Select your state" stonden hier als kop en
          onderkop, samen zo'n zestig punten hoog, en ze vertelden niets wat
          het scherm niet al laat zien: er staan vijf beelden en je veegt
          ertussen. Die hoogte gaat naar de illustratie, want daar kijk je
          naar. De naam staat nu bovenaan in plaats van eronder — dan weet je
          wat je ziet vóór je het ziet. */}
      {intro ? (
        <View style={s.introWrap}>
          <SlideIntro key={introRun} onTapOrb={() => {}} />
          <Pressable
            onPress={() => setIntro(false)}
            /* Wit en VOL, niet omlijnd in de kleur van de toestand (operator,
               5 augustus 2026). Dit is het enige wat je hier kunt doen, en op
               een scherm dat verder uit één lichtgevend beeld op zwart bestaat
               is wit het enige dat harder spreekt dan die figuur. Verderop, bij
               de vijf toestanden, blijven de knoppen omlijnd — daar concurreert
               de kleur van de toestand niet met een enkel beeld maar draagt ze
               betekenis. */
            style={[s.cta, s.ctaSolid, { marginTop: 28 }]}
            android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
          >
            <Text style={[s.ctaTxt, { color: '#0a0a0a' }]}>
              CHOOSE YOUR MODE
            </Text>
            <ArrowRight size={17} color="#0a0a0a" strokeWidth={2.4} />
          </Pressable>
        </View>
      ) : (
        <>
      {/* Een ZICHTBARE ingang naar de historiek (operator, 5 augustus 2026:
          "waar staat die history, ik zie geen knop"). Hij stond alleen als
          gedimde tekstregel onderaan, en dat leest niet als een knop — zeker
          niet op een scherm waar de rest van de aandacht naar de figuur gaat.
          Linksboven, tegenover niets, zodat hij nooit met de kop botst. */}
      <Pressable
        onPress={() => router.push('/breath-history')}
        hitSlop={14}
        style={s.histBtn}
        accessibilityLabel="Your practice"
      >
        <ChartNoAxesColumn size={19} color="rgba(255,255,255,0.55)" strokeWidth={2.2} />
      </Pressable>

      <Animated.View style={[s.header, fadeStyle]}>
        {/* Eén regel, altijd. "CALM CONTROL" brak op twee regels doordat de
            letterafstand hem breder maakte dan de ruimte tussen de marges —
            en een kop die afbreekt op een woordgrens die niets betekent leest
            als een fout. Krimpt liever een fractie dan te breken. */}
        <Text
          style={[s.mode, { color: st.accent }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {st.eyebrow}
        </Text>
      </Animated.View>

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
            size={artSize}
            art={st.art}
            breath={breath}
            glow={st.glow}
            boxHeight={BOX_H}
            focusY={st.focusY - drop}
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
              x: startIndex * SCREEN_W,
              animated: false,
            });
            setIndex(startIndex);
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

        {/* De pijlen staan ná de pager, dus ze vangen hun eigen tik. Kale
            haken tegen de schermrand, geen knopjes: het beeld is het
            onderwerp, en een omcirkelde pijl ernaast wordt vanzelf een
            tweede. Aan de uiteinden verdwijnen ze — een pijl die er staat
            maar niets doet is erger dan geen pijl. */}
        {index > 0 && (
          <Pressable
            onPress={() => goTo(index - 1)}
            hitSlop={20}
            style={[s.arrow, s.arrowLeft]}
            accessibilityLabel="Previous mode"
          >
            <ChevronLeft
              size={30}
              color="rgba(255,255,255,0.55)"
              strokeWidth={1.5}
            />
          </Pressable>
        )}
        {index < ORDER.length - 1 && (
          <Pressable
            onPress={() => goTo(index + 1)}
            hitSlop={20}
            style={[s.arrow, s.arrowRight]}
            accessibilityLabel="Next mode"
          >
            <ChevronRight
              size={30}
              color="rgba(255,255,255,0.55)"
              strokeWidth={1.5}
            />
          </Pressable>
        )}
      </View>

      {/* ── Wie dit is ──
          Modus en figuur dragen béíde de kleur van de toestand, met een kort
          streepje ertussen en de omschrijving eronder in wit. Niet de naam
          wit en de rest gekleurd: de kleur IS hier de modus, dus die hoort
          bij zijn naam te staan. */}
      <Animated.View style={[s.copy, fadeStyle]}>
        <View style={[s.rule, { backgroundColor: st.accent }]} />
        <Text style={s.desc}>{st.description}</Text>
        <Pressable onPress={() => setInfoOpen(true)} hitSlop={10}>
          <Text style={[s.spec, { color: st.accent }]}>
            {st.technique} · What is this?
          </Text>
        </Pressable>
      </Animated.View>

      {/* ── De knop draagt de kleur van de modus ──
          Omlijnd en niet gevuld: op een scherm dat verder uit één lichtgevend
          beeld op zwart bestaat, is een vol vlak het zwaarste element in
          beeld — en dat hoort de illustratie te zijn. */}
      <Animated.View style={fadeStyle}>
        <Pressable
          onPress={open}
          style={[s.cta, { borderColor: st.accent }]}
          android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
        >
          <Text style={[s.ctaTxt, { color: st.accent }]}>SELECT MODE</Text>
          <ArrowRight size={17} color={st.accent} strokeWidth={2} />
        </Pressable>
      </Animated.View>

      {/* ── Wat deze toestand is ─────────────────────────────────────────
           "Coherent 5-5" of "Resonant 6-6" zegt niets tegen wie de term niet
           kent, en dat is vrijwel iedereen (operator, 4 augustus 2026). Hier
           staat per toestand wat hij doet én wat elk van zijn ritmes is, in
           één zin per stuk. Niet op het scherm zelf: wie het al weet hoeft
           het niet elke keer te lezen. */}
      <Modal
        visible={infoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoOpen(false)}
      >
        <Pressable style={s.infoBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={s.infoCard} onPress={() => {}}>
            <Text style={[s.infoEyebrow, { color: st.accent }]}>
              {st.eyebrow}
            </Text>
            <Text style={s.infoTitle}>{st.title}</Text>
            <Text style={s.infoBody}>{st.description}</Text>

            <Text style={[s.infoSection, { color: st.accent }]}>
              RHYTHMS
            </Text>
            {st.techniques.map((t) => (
              <View key={t.key} style={s.infoTech}>
                <Text style={s.infoTechName}>{t.name}</Text>
                <Text style={s.infoTechBody}>{t.explain}</Text>
              </View>
            ))}

            <Pressable
              style={[s.infoBtn, { borderColor: st.accent }]}
              onPress={() => setInfoOpen(false)}
            >
              <Text style={[s.infoBtnTxt, { color: st.accent }]}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── De vijf, altijd zichtbaar ──
          Op volle kleur, niet weggedimd. Ze zijn hier geen knopjes maar de
          vijf beelden zelf; wat de keuze aanwijst is de ring en de naam
          eronder, niet dat de andere vier uitgaan. */}
      <View style={s.thumbs}>
        {ORDER.map((k, i) => {
          const t = BREATH_STATES[k];
          const on = i === index;
          return (
            <Pressable
              key={k}
              onPress={() => goTo(i)}
              style={s.thumbCol}
              accessibilityLabel={t.eyebrow}
            >
              <View style={s.thumb}>
                {/* De lichtkrans. Drie cirkels in de kleur van de toestand,
                    van groot en bijna doorzichtig naar klein en sterker —
                    samen lezen ze als één zachte gloed. Zonder dit liggen de
                    beelden dof op het zwart terwijl ze in de referentie
                    lichtgeven. Bewust géén Skia: vijf verlooptekeningen naast
                    elkaar voor iets van zeventig punten is verspilling. */}
                <View
                  style={[
                    s.halo,
                    s.haloOuter,
                    { backgroundColor: t.accent, opacity: on ? 0.07 : 0.03 },
                  ]}
                />
                <View
                  style={[
                    s.halo,
                    s.haloMid,
                    { backgroundColor: t.accent, opacity: on ? 0.09 : 0.04 },
                  ]}
                />
                <View
                  style={[
                    s.halo,
                    s.haloInner,
                    { backgroundColor: t.accent, opacity: on ? 0.13 : 0.06 },
                  ]}
                />
                {on && <View style={[s.thumbRing, { borderColor: t.accent }]} />}
                <Image
                  source={{ uri: assetUri(SESSION_ART[t.art]) }}
                  style={{
                    width: thumbSize(t.artScale),
                    height: thumbSize(t.artScale),
                  }}
                  resizeMode="contain"
                />
              </View>
              {/* Twee regels toegestaan, en dát is wat de letter groot maakt.
                  Op één regel moest "CALM CONTROL" binnen 79 punt passen en
                  kwam de tekst niet boven de tien punt uit — onleesbaar. Over
                  twee regels is "CONTROL" de langste eenheid, en die past
                  ruim op dertien. */}
              <Text
                style={[
                  s.thumbName,
                  { color: on ? t.accent : 'rgba(255,255,255,0.8)' },
                ]}
                numberOfLines={2}
              >
                {t.eyebrow}
              </Text>
              {/* Twee regels toegestaan: "Balance & Composure" past niet op
                  één kolombreedte, en afkappen met een puntje maakt van een
                  naam een raadsel. */}
              <Text style={s.thumbSub} numberOfLines={2}>
                {t.subtitle}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Waar je bent in de rij van vijf, in de kleur van waar je staat. */}
      <View style={s.dots}>
        {ORDER.map((k, i) => (
          <View
            key={k}
            style={[
              s.dot,
              i === index && { width: 18, backgroundColor: st.accent },
            ]}
          />
        ))}
      </View>

      {/* ── Wat je gedaan hebt ───────────────────────────────────────────
           Hier stond alleen "YOUR PRACTICE (4)" — een teller die niets zegt.
           Vier sessies kunnen vier dagen op rij zijn of vier keer in maart.
           Nu staat er wat iemand daadwerkelijk wil weten: hoe lang de reeks
           is en hoeveel er deze week in zit. Beide leeg? Dan blijft het bij
           de uitnodiging, want een streak van nul tonen ontmoedigt.

           Bewust één regel en geen kaart: dit is de laatste regel van een
           keuzescherm, niet het onderwerp ervan. */}
      <Pressable
        onPress={() => router.push('/breath-history')}
        hitSlop={10}
        style={s.footRow}
      >
        {practice.streak > 0 && (
          <>
            <Text style={[s.statNum, { color: st.accent }]}>
              {practice.streak}
            </Text>
            <Text style={s.statLbl}>
              DAY{practice.streak === 1 ? '' : 'S'}
            </Text>
            <Text style={s.footSep}>·</Text>
          </>
        )}
        {practice.weekMin > 0 && (
          <>
            <Text style={[s.statNum, { color: st.accent }]}>
              {practice.weekMin}
            </Text>
            <Text style={s.statLbl}>MIN THIS WEEK</Text>
            <Text style={s.footSep}>·</Text>
          </>
        )}
        <Text style={s.historyTxt}>
          {history.length > 0 ? 'YOUR PRACTICE' : 'START YOUR PRACTICE'}
        </Text>
      </Pressable>
      </View>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  stars: { ...StyleSheet.absoluteFillObject },

  /* De zijmarge is niet cosmetisch: rechtsboven zweeft het instellingen-
     icoon van de app over élk scherm heen, en zonder deze marge liep de
     laatste letter van de kop eronder door. */
  header: { alignItems: 'center', marginTop: 6, paddingHorizontal: 30 },
  ctaSolid: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  introWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  histBtn: {
    position: 'absolute',
    left: 10,
    top: 4,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  /* Licht gewicht met veel letterafstand, zoals de koppen in de onboarding.
     Het gewicht doet niets, de ruimte doet alles. */
  kicker: {
    fontFamily: BrandFonts.regular,
    fontSize: 16.5,
    letterSpacing: 4.2,
    color: '#ffffff',
  },
  lead: {
    marginTop: 7,
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.52)',
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
    top: BOX_H / 2 - 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: { left: 4 },
  arrowRight: { right: 4 },

  copy: { alignItems: 'center', marginTop: 14, paddingHorizontal: 26 },
  mode: {
    fontFamily: BrandFonts.regular,
    fontSize: 23,
    letterSpacing: 4.5,
    textAlign: 'center',
  },
  figure: {
    marginTop: 9,
    fontFamily: BrandFonts.medium,
    fontSize: 18,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  /* Het streepje scheidt de naam van de omschrijving. Kort, in de kleur van
     de toestand — zonder dat lopen naam en tekst als één blok in elkaar. */
  rule: { width: 34, height: 1.5, borderRadius: 1, marginTop: 12, opacity: 0.8 },
  desc: {
    marginTop: 12,
    maxWidth: 320,
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  spec: {
    marginTop: 9,
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.36)',
  },

  /* ── De uitleg-popup ── */
  infoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  infoCard: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: '#141018',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 22,
  },
  infoEyebrow: { fontFamily: BrandFonts.bold, fontSize: 11, letterSpacing: 3 },
  infoTitle: {
    marginTop: 6,
    fontFamily: BrandFonts.extrabold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: '#ffffff',
  },
  infoBody: {
    marginTop: 10,
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.78)',
  },
  infoSection: {
    marginTop: 20,
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 2.4,
  },
  infoTech: { marginTop: 10 },
  infoTechName: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13.5,
    color: '#ffffff',
  },
  infoTechBody: {
    marginTop: 2,
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.55)',
  },
  infoBtn: {
    marginTop: 22,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnTxt: { fontFamily: BrandFonts.bold, fontSize: 13, letterSpacing: 1.8 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'center',
    marginTop: 20,
    paddingHorizontal: 30,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
  },
  ctaTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13.5,
    letterSpacing: 2.2,
  },

  thumbs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: THUMB_GAP,
    marginTop: 22,
    alignItems: 'flex-start',
  },
  thumbCol: { width: THUMB_COL, alignItems: 'center' },
  /* Geen kader om de vier die je niet gekozen hebt, en géén `overflow:
     hidden`: de zonnestralen en de punten van het kristal steken buiten hun
     cirkel uit, en afgesneden stralen zijn precies wat een illustratie tot
     een pictogram maakt. Alleen de gekozen krijgt zijn ring.
     De vier andere staan op VOLLE kleur — wegdimmen maakte er grijze knopjes
     van, en dan verdwijnt waar deze rij voor bestaat: zien wat ze zíjn. */
  thumb: {
    width: THUMB,
    height: THUMB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: { position: 'absolute', borderRadius: THUMB },
  haloOuter: { width: THUMB * 1.28, height: THUMB * 1.28 },
  haloMid: { width: THUMB * 1.04, height: THUMB * 1.04 },
  haloInner: { width: THUMB * 0.7, height: THUMB * 0.7 },
  thumbRing: {
    position: 'absolute',
    width: THUMB * 1.26,
    height: THUMB * 1.26,
    borderRadius: THUMB,
    borderWidth: 1,
    opacity: 0.9,
  },
  /* Vaste hoogte van twee regels, ook voor de namen die er één nodig hebben.
     Anders begint de ondertitel per kolom op een andere hoogte en golft de
     hele rij. */
  thumbName: {
    marginTop: 8,
    height: 30,
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    lineHeight: 15,
    letterSpacing: 0,
    textAlign: 'center',
  },
  thumbSub: {
    marginTop: 3,
    fontFamily: BrandFonts.regular,
    fontSize: 10.5,
    lineHeight: 13,
    color: 'rgba(255,255,255,0.58)',
    textAlign: 'center',
  },

  dots: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
  },
  dot: {
    width: 5,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
  },
  statNum: {
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    letterSpacing: -0.2,
  },
  statLbl: {
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.42)',
  },
  footSep: { fontSize: 9, color: 'rgba(255,255,255,0.22)' },
  historyTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.42)',
  },
});
