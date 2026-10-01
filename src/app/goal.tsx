/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Your goal

   Eigen pagina in plaats van een uitschuifvenster (operator, 6 augustus
   2026). Een doel stuurt wat de app voorstelt en hoe je dagplan eruitziet;
   dat verdient een scherm waar ook uitgelegd staat wát het doet, niet een
   lijstje dat over je scherm schuift.

   Acht doelen (uitgebreid van vier, operator 13 augustus 2026,
   protocol-systeem) — allemaal TOESTANDEN waar één sessie iets aan kan
   doen. Zelfvertrouwen en zelfbeheersing staan er bewust niet bij — dat
   zijn eigenschappen, en die verander je niet in vijf minuten.

   PRIMAIR + OPTIONEEL SECUNDAIR i.p.v. "tik tot 2 aan" (operator, 13
   augustus 2026): `goalRank` keek toch al alleen naar de eerste twee, dus
   deze schermlogica brengt de UI eindelijk gelijk met wat al die tijd al
   telde. Tik 1 → primair. Tik op een ander doel → secundair. Nog eens op
   primair tikken → allebei weg (een plan zonder primair doel is geen
   plan). Nog eens op secundair tikken → alleen secundair weg. Een DERDE
   doel aantikken vervangt het secundaire — er zijn maar twee plekken.

   Operator, 21 september 2026 (volledige "Bento/Glassmorphic"-herbouw,
   letterlijke brief overgenomen): dit vervangt de vorige, rustigere
   icoon-lijst-bento (19 september) volledig.
   - Layout: de TOP 2 doelen (sleep/stress) zijn grote, vierkantere
     tegels met het icoon groot en gecentreerd, tekst eronder. De overige
     6 zijn compacter — icoon links, titel direct ernaast — drie rijen
     van twee.
   - Kaarten: echte BlurView-matglas (al zo sinds de vorige ronde), de
     `AuroraGlow` erachter schijnt er zacht doorheen.
   - Selectie: ongeselecteerd is het icoon gedimd/monochroom; geselecteerd
     vult de hele kaart met een rijke, levendige 2-kleuren-gradiënt uit
     `Goal.gradient` (data/goals.ts) en licht het icoon fel wit op.
   - De cursieve tagline-regel is weg — de kaarten spreken voor zich.
   - Elke kaart toont nu een info-icoontje + korte subtekst, ook de 6 die
     dat voorheen niet hadden.
   - De CTA zit weer gewoon onderaan de scroll-inhoud (niet meer zwevend),
     is een hoogglanzende capsule, transparant/gedimd zonder keuze en
     licht fel op in de merk-indigo zodra er iets gekozen is. */

import { BrandDark, BrandLight, BrandFonts, TypeScale, CTA } from '@/constants/theme';
import { StepIndicator } from '@/components/StepIndicator';
import { GOALS, type Goal } from '@/data/goals';
import { setSetting, useSetting } from '@/utils/settings';
import { router, Stack } from 'expo-router';
import { ChevronLeft, Info } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AuroraGlow from '@/components/AuroraGlow';
import { AMBIENT } from '@/components/ambient-tokens';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Dit scherm blijft ALTIJD donker, ongeacht het app-brede thema — zelfde
   afspraak als build-choice.tsx/build-your-day.tsx/plan-review.tsx. */
const light = false;
const C = light ? BrandLight : BrandDark;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/* Operator, 21 september 2026 ("cta onderaan moet zoals de andere ctas"):
   de eigen transparant/indigo-gradiënt-capsule van hierboven is terug-
   gedraaid — dezelfde gedeelde `CTA`-token (vaste witte pil) als
   build-choice.tsx/build-your-day.tsx/plan-review.tsx/intensity.tsx,
   met dezelfde vloeiende fade-in/schaal-animatie tussen `CTA.disabled`
   en actief die dit scherm al had. */
function CtaButton({ active, onPress }: { active: boolean; onPress: () => void }) {
  const t = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    t.value = withTiming(active ? 1 : 0, { duration: 220 });
  }, [active, t]);
  /* Press-scale — zelfde recept als StartCard in breath-welcome.tsx.
     Enkele full-width primaire CTA, dus 0.96. */
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.96, { duration: 80 });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  /* Operator ("kijk alle CTA's na"): opacity-kanaal was al bezet door de
     active/inactive-fade — press-dim (huisstijl §5, .85 bij indrukken)
     nu vermenigvuldigd in i.p.v. overschreven, en de haptic-tik zat
     alleen op tegel-taps, niet op deze CTA zelf. */
  const style = useAnimatedStyle(() => ({
    opacity: (0.35 + t.value * 0.65) * (1 - (1 - pressScale.value) * 3.75),
    transform: [{ scale: (0.98 + t.value * 0.02) * pressScale.value }],
  }));
  return (
    <AnimatedPressable
      style={[s.cta, style]}
      disabled={!active}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Text style={s.ctaTxt}>Continue</Text>
    </AnimatedPressable>
  );
}

/* Eigen component (niet inline in de `.map()`) omdat elke tegel zijn
   EIGEN animated shared values nodig heeft — die kunnen niet in een lus
   met `useSharedValue` aangemaakt worden (Rules of Hooks: vast aantal
   hooks, niet variabel per render).
   Operator, 21 september 2026 ("kaarten reageren vertraagd op
   aanklikken"): `memo()`'d — een tegel her-rendert (en her-blurt zijn
   echte BlurView) nu pas als zijn EIGEN `rank` verandert, niet meer bij
   ELKE tik ergens in de rij. `onTap` (i.p.v. een kant-en-klare `onPress`)
   + `g.key` zodat de aanroeper (goal.tsx) één stabiele functie kan
   doorgeven i.p.v. 8 nieuwe closures per render — zie de toelichting bij
   `tap` in goal.tsx voor de stabiliteits-kant hiervan. */
const GoalTile = memo(function GoalTile({
  g,
  rank,
  big,
  onTap,
}: {
  g: Goal;
  rank: number;
  big: boolean;
  onTap: (key: string) => void;
}) {
  const Icon = g.Icon;
  const on = rank > 0;

  const pressScale = useSharedValue(1);
  const tileStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const iconScale = useSharedValue(1);
  const wasOn = useRef(on);
  useEffect(() => {
    if (on && !wasOn.current) {
      iconScale.value = withSequence(
        withTiming(1.2, { duration: 130, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 7, stiffness: 170 }),
      );
    }
    wasOn.current = on;
  }, [on, iconScale]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  /* Operator, 21 september 2026 ("de iconen mogen overal even groot maar
     kaarten mogen variëren"): ÉÉN vaste iconmaat voor alle 8 tegels,
     los van `big` — enkel de KAART zelf (`tileBig`/`tileCompact`)
     varieert nog in afmeting.
     Operator, zelfde dag (vervolg, "icoon sleep better mag beetje
     groter" → "nog beetje groter zonder tekst te verplaatsen" →
     "icoon recovery moet groter" → correctie: "icoon recovery beetje
     kleiner terug, tekst moet mooi uitgelijnd met tekst in kaart
     ernaast" → "kan icoon beetje groter zonder tekst te verplaatsen"):
     recovery's grotere BADGE (64) zette zijn titel lager dan zijn
     buurtegel (peak performance, badge 56) in dezelfde rij, dus die
     bleef op 56. Nu enkel `iconSize` weer omhoog, exact dezelfde truc
     als `sleep` eerder kreeg: het beeld steekt gewoon ietsje buiten zijn
     eigen (ongewijzigde) vak uit — de titel eronder schuift niet mee,
     dus de rij-uitlijning met peak performance blijft intact. */
  const badgeSize = g.key === 'sleep' ? 64 : 56;
  const iconSize = g.key === 'sleep' ? 62 : g.key === 'recovery' ? 53 : 46;
  const badgeStyle = [
    s.tileIconBadge,
    { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 },
  ];

  const iconNode = g.image ? (
    <Image
      source={{ uri: g.image }}
      style={{ width: iconSize, height: iconSize, tintColor: '#ffffff' }}
      resizeMode="contain"
    />
  ) : (
    <Icon size={iconSize} color="#ffffff" strokeWidth={2} />
  );

  /* Operator, 21 september 2026 ("de info moet onder i-knop zitten en
     niet zichtbaar op de kaarten" → "i overal op dezelfde plaats"): de
     hint-tekst staat niet standaard op de kaart — een tik op het
     info-icoontje klapt 'm open, tot je nog eens tikt. Het knopje zelf
     staat nu VAST rechtsboven op elke tegel (`tileInfoBtn`, absoluut
     gepositioneerd) i.p.v. inline naast de titel — die plek verschilde
     voorheen per kaart (en per titel-lengte). Eigen `Pressable` (genest
     in de kaart se eigen `Pressable`) — RN geeft de tik dan aan de
     binnenste handler, de kaart-selectie zelf reageert niet mee. */
  const [showInfo, setShowInfo] = useState(false);

  /* Press-scale — zelfde recept als StartCard in breath-welcome.tsx.
     Klein icoon-knopje, dus 0.92. Los van `pressScale` hierboven (die
     bedient de hele kaart, dit knopje heeft zijn eigen tik-doel). */
  const infoPressScale = useSharedValue(1);
  const onInfoPressIn = () => {
    infoPressScale.value = withTiming(0.92, { duration: 80 });
  };
  const onInfoPressOut = () => {
    infoPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const infoPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: infoPressScale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        pressScale.value = withTiming(0.97, { duration: 80 });
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
      }}
      onPress={() => onTap(g.key)}
      style={[
        s.tile,
        big ? s.tileBig : s.tileCompact,
        tileStyle,
        on && {
          borderColor: 'rgba(255,255,255,0.4)',
          shadowColor: g.gradient[0],
          shadowOpacity: 0.6,
          elevation: 8,
        },
      ]}
    >
      {/* Matglas-basis — altijd aanwezig, ook geselecteerd (de gradiënt
         hieronder komt er getint bovenop, geen platte dekkende vulling). */}
      <BlurView
        intensity={40}
        tint="dark"
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
      {/* Operator ("de saaie achtergrond verandert in een rijke, levendige
         gradiënt die past bij het doel — sleep better kleurt naar diep
         koningsblauw met paars, peak performance explodeert in feloranje
         met neon-roze"): `Goal.gradient`, enkel zichtbaar bij selectie. */}
      {on && (
        <ExpoGradient
          colors={g.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {on && (
        <View style={[s.tileRank, { backgroundColor: '#ffffff' }]}>
          <Text style={[s.tileRankTxt, { color: g.gradient[0] }]}>{rank}</Text>
        </View>
      )}
      {/* Vaste plek op ELKE tegel, los van `big`/`on` — linksboven, zodat
         hij nooit met de rangnummer-badge (rechtsboven) botst. */}
      <Pressable
        hitSlop={10}
        onPress={() => setShowInfo((v) => !v)}
        style={s.tileInfoBtn}
      >
        <Info size={13} color="rgba(255,255,255,0.55)" strokeWidth={2.2} />
      </Pressable>

      {big ? (
        /* Top 2: icoon groot en gecentreerd, titel eronder — geen
           `numberOfLines`-cap meer (langere namen mogen wrappen i.p.v.
           afkappen). */
        <View style={s.tileBigContent}>
          <Animated.View style={[...badgeStyle, iconStyle]}>{iconNode}</Animated.View>
          <Text style={[s.tileName, s.tileNameBig]}>{g.name}</Text>
          {showInfo && (
            <Text style={s.tileHint} numberOfLines={2}>
              {g.hint}
            </Text>
          )}
        </View>
      ) : (
        /* Icoon boven de titel, gecentreerd — zelfde kolom-opbouw als de
           grote tegels, enkel kleiner. */
        <View style={s.tileCompactCol}>
          <Animated.View style={[...badgeStyle, iconStyle]}>{iconNode}</Animated.View>
          <Text style={s.tileName}>{g.name}</Text>
          {showInfo && (
            <Text style={s.tileHintCompact} numberOfLines={2}>
              {g.hint}
            </Text>
          )}
        </View>
      )}
    </AnimatedPressable>
  );
});

export default function GoalScreen() {
  /* De navigatiebalk van het toestel hoort NIET over de laatste knop te
     vallen (operator, 7 augustus 2026: "see your plan staat half zichtbaar").
     Een vaste marge onderaan werkt niet — die is op het ene toestel te klein
     en op het andere een gat. */
  const insets = useSafeAreaInsets();

  const [goals] = useSetting('goals');
  const primary = goals[0] ?? null;
  const secondary = goals[1] ?? null;

  /* Operator, 17 september 2026 ("direct na knop set your goal moeten er
     eerst 2 kaarten... als gebruiker zelf wil bouwen moet venster met set
     your state overgeslagen worden"): de premium-proefronde-gate en de
     Pad A/Pad B-vork verhuisden VOOR dit scherm naar build-choice.tsx —
     wie hier binnenkomt, koos daar al expliciet "Let VIBEZCORE build it"
     en is dus al voorbij de gate. Dit scherm hoeft dat niet nog eens te
     checken. */
  const buildProtocol = () => {
    if (!primary) return;
    /* Operator, 21 september 2026 ("intro-pagina als step 3 na set your
       state"): nieuwe rustige overgangspagina vóór de tegel-pagina —
       zie routine-intro.tsx. */
    router.push('/routine-intro' as never);
  };

  /* Operator, 21 september 2026 ("set your state kaarten reageren
     vertraagd op aanklikken"): elke tik veranderde `goals` → `primary`/
     `secondary` → een volledige her-render van alle 8 `GoalTile`'s, elk
     met een ECHTE native BlurView (`dimezisBlurViewSdk31Plus`) — acht
     tegelijk opnieuw blurren op één tik is precies wat trage input geeft
     op Android. Twee losse fixes samen:
     1. `GoalTile` hieronder is nu `memo()`'d, dus een tegel her-rendert
        pas als zijn EIGEN `rank` echt verandert.
     2. Dat memo werkt alleen als de `onTap`-prop referentieel stabiel
        blijft — vroeger `() => tap(g.key)` inline in de `.map()`, een
        NIEUWE closure per tegel per render, wat memo altijd zou breken.
        `tap` leest `primary`/`secondary` nu via refs i.p.v. een closure
        (dus `useCallback(..., [])`, permanent stabiel) en schrijft
        rechtstreeks via het geëxporteerde, stabiele `setSetting` i.p.v.
        de per-render-nieuwe `setGoals`-wrapper van `useSetting`. */
  const primaryRef = useRef(primary);
  const secondaryRef = useRef(secondary);
  useEffect(() => {
    primaryRef.current = primary;
    secondaryRef.current = secondary;
  }, [primary, secondary]);

  const tap = useCallback((key: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const p = primaryRef.current;
    const sec = secondaryRef.current;
    if (key === p) {
      void setSetting('goals', []);
      return;
    }
    if (key === sec) {
      void setSetting('goals', p ? [p] : []);
      return;
    }
    if (!p) {
      void setSetting('goals', [key]);
      return;
    }
    void setSetting('goals', [p, key]);
  }, []);

  /* Aurora-gloed draagt de accentkleur van het geselecteerde hoofddoel —
     zonder keuze een neutrale, gedempte terugval (AmbientGlow's eigen
     koele blauw-wit, `AMBIENT.volume`, i.p.v. iets fels te verzinnen). */
  const primaryGoal = GOALS.find((g) => g.key === primary);
  const auroraColor = primaryGoal?.accent ?? AMBIENT.volume;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Schermvullend, ACHTER alles — de tegels zelf zijn echte
         BlurView-matglas (zie GoalTile) zodat deze gloed er zacht
         doorheen schijnt. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <AuroraGlow color={auroraColor} width={SCREEN_W} height={SCREEN_H} />
      </View>

      <View style={s.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </Pressable>
        {/* Operator, 21 september 2026 ("balk is storend zo laag, zet 'm
           naast de pijl"): terug in de knoppenrij, na een korte poging
           eronder (Apple HIG-full-width) — zie StepIndicator.tsx. */}
        <StepIndicator step={2} total={5} color="#ffffff" />
        <View style={s.back} />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          /* Operator, 21 september 2026 ("cta moet sticky"): terug een
             vaste, zwevende laag BUITEN de ScrollView — ruimte houden
             zodat de laatste rij tegels er niet half achter wegschuift. */
          { paddingBottom: Math.max(insets.bottom, 12) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.header}>Set your state</Text>
        <Text style={s.lead}>Choose what you want to shift.</Text>

        {/* Operator, 21 september 2026: TOP 2 = grote, vierkantere tegels
           (icoon gecentreerd), de overige (compact) = kleinere tegels.
           Zelfde `grid`-rooster voor beide — `big`/normale breedte bepaalt
           de vorm, geen aparte lay-out nodig. Aantal compacte tegels volgt
           gewoon `GOALS.length - 2` (22 september 2026: 6→4 na het
           schrappen van Peak performance/Calm the mind, geen code hier
           hoefde daarvoor te veranderen). */}
        <View style={s.grid}>
          {GOALS.map((g, i) => {
            const rank = g.key === primary ? 1 : g.key === secondary ? 2 : 0;
            return <GoalTile key={g.key} g={g} rank={rank} big={i < 2} onTap={tap} />;
          })}
        </View>
      </ScrollView>

      {/* Operator, 21 september 2026 ("cta moet sticky"): zelfde patroon
         als build-choice.tsx/build-your-day.tsx/plan-review.tsx — vaste
         laag onderaan, los van de ScrollView. Gradient (transparant →
         C.bg) laat content die eronder doorscrolt zacht wegvloeien. */}
      <View
        style={[s.ctaFloat, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}
        pointerEvents="box-none"
      >
        <ExpoGradient
          colors={['transparent', C.bg]}
          locations={[0, 0.4]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <CtaButton active={!!primary} onPress={buildProtocol} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 11 },
  header: {
    marginTop: 4,
    ...TypeScale.pageHeader,
    textAlign: 'left',
    color: C.text,
  },
  lead: {
    marginTop: 8,
    marginBottom: 22,
    ...TypeScale.pageSubhead,
    textAlign: 'left',
    color: 'rgba(255,255,255,0.55)',
  },

  /* Bento-grid: 2 kolommen, `gap` lijnt zowel rijen als kolommen uit —
     zowel de 2 grote als de 6 compacte tegels gebruiken dezelfde
     48%-breedte, enkel hun interne opbouw en hoogte verschillen. */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  /* Tegel zelf blijft TRANSPARANT — de echte `BlurView` in de JSX draagt
     het matglas-effect zodat de `AuroraGlow` erachter erdoorheen schijnt. */
  tile: {
    width: '48%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    padding: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    shadowOpacity: 0,
  },
  /* Top 2 — groter en vierkanter. */
  tileBig: { minHeight: 172, justifyContent: 'center' },
  tileBigContent: { alignItems: 'center', gap: 8 },
  /* Overige 6 — compacter, rij-opbouw. */
  tileCompact: { minHeight: 84, justifyContent: 'center' },
  /* Operator, 21 september 2026 ("iconen boven de tekst" → "centreer
     iconen"): was een rij (icoon links, titel rechts) — nu een kolom,
     icoon boven de titel, alles gecentreerd zoals de grote tegels. */
  tileCompactCol: { alignItems: 'center', gap: 8 },

  tileRank: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileRankTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
  },
  /* Ronde badge draagt het icoon — transparant met een witte rand, geen
     kleur-getinte vulling. */
  /* Operator, 21 september 2026 ("verwijder ook de cirkels rond de
     iconen"): geen rand/vulling meer — enkel de maat/uitlijning blijft,
     het icoon staat nu kaal op de kaart. */
  /* Operator, 21 september 2026: maat/afronding komt nu inline uit
     GoalTile (`badgeSize`/`imgSize`) i.p.v. vaste Big/Compact-varianten
     — nodig zodra `calmMind` z'n eigen ×1.3-schaal kreeg ("ik bedoelde
     enkel calm the mind icoon 30% groter, zet de rest terug"), anders
     had die ene tegel een derde, losse stijl-variant nodig gehad. */
  tileIconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Operator, 21 september 2026 ("de tekst more energy... mag niet
     afgekapt zijn"): geen `numberOfLines`-cap meer op de JSX — de naam
     mag wrappen i.p.v. af te breken met "…". */
  /* Operator, 21 september 2026 ("i moet wel volledig binnen de kaarten
     vallen"): zonder `flexShrink` duwde een lange naam (bv. "Recovery &
     relaxation") het info-knopje ernaast over de kaartrand — `s.tile`'s
     `overflow:'hidden'` sneed 'm dan gewoon af i.p.v. te laten wrappen.
     `flexShrink:1` laat de tekst nu wrappen/krimpen, het knopje blijft
     op een vaste plek binnen de rij. */
  /* Operator, 21 september 2026 ("ook tekst centreren onderaan"): geldt
     nu voor beide maten, niet enkel de grote tegels (`tileNameBig` had
     'm al). */
  /* Operator, 21 september 2026 ("tekst laatste kaart recover & relax"):
     "Recovery & relaxation" liep nog af — in een gecentreerde kolom
     (`alignItems:'center'`) meet een `Text` zonder eigen breedte eerst
     zijn ONGEWRAPTE breedte, en overschrijdt zo de kaart. `alignSelf:
     'stretch'` dwingt 'm op de volle kolombreedte, `textAlign:'center'`
     houdt 'm daarbinnen visueel gecentreerd — nu wrapt hij altijd binnen
     de kaart i.p.v. eroverheen te lopen. */
  tileName: {
    ...TypeScale.cardHeadline,
    fontSize: 15,
    color: '#ffffff',
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  tileNameBig: { fontSize: 17 },

  /* Operator, 21 september 2026 ("de info moet onder i-knop zitten en
     niet zichtbaar op de kaarten" → "i overal op dezelfde plaats"): was
     een altijd-zichtbare info-icoon + tekst-regel, daarna inline naast de
     titel (plek verschilde per kaart) — nu een vast, absoluut
     gepositioneerd knopje linksboven op ELKE tegel. De tekst klapt pas
     open bij een tik (zie `showInfo` in GoalTile). */
  tileInfoBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    padding: 4,
    zIndex: 1,
  },
  tileHint: {
    marginTop: 4,
    textAlign: 'center',
    fontFamily: BrandFonts.regular,
    fontSize: 11.5,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.6)',
  },
  tileHintCompact: {
    marginTop: 2,
    textAlign: 'center',
    fontFamily: BrandFonts.regular,
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.55)',
  },

  /* Operator, 21 september 2026 ("cta onderaan moet zoals de andere
     ctas"): dezelfde gedeelde `CTA`-token als de rest van de flow. */
  cta: { ...CTA.container },
  ctaTxt: CTA.label,
  /* Operator, 21 september 2026 ("cta moet sticky"): vaste laag onderaan,
     los van de ScrollView — zelfde patroon als build-your-day.tsx/
     plan-review.tsx. */
  ctaFloat: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 11,
    paddingTop: 26,
  },
});
