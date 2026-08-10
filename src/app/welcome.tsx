/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Welcome screen (eerste scherm, NIET-blokkerend)

   CLAUDE.md §3 + SPEC DEEL 0 (operator-beslissing 19 mei 2026):
   - Géén poort, géén keuzescherm — alleen een entree die de bezoeker een
     vertrekpunt geeft. Beide knoppen leiden naar volledig vrije tabs.
   - "Reeds ingelogd" → welkomstscherm overslaan, direct de app in.
   - Audio en Bracelet zijn GELIJKWAARDIGE productkernen (SPEC §1.1):
     beide knoppen bewust even prominent.
   - Alle zichtbare teksten op dit scherm zijn EXACT zoals door operator
     voorgeschreven. Verzin hier niets bij — overige copy = [OPERATOR].
   ─────────────────────────────────────────────────────────────────────────── */

import { AUDIO_ENABLED } from '@/constants/features';
import SplatField from '@/components/SplatField';
import { WELCOME_MAN, WELCOME_WOMAN } from '@/services/offline-assets';
import { assetUri } from '@/services/asset-cache';
import { Brand, BrandFonts } from '@/constants/theme';
import { getToken } from '@/services/auth';
import {
  awaitDevUserOverrideLoaded,
  getDevUserOverride,
} from '@/utils/dev-user-override';
import {
  AudioWaveform,
  ChevronRight,
  CircleDot,
  User,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { getSetting } from '@/utils/settings';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import PodPulse from '@/components/PodPulse';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* ────────────────────────────────────────────────────────────────
   FINETUNE-KNOPPEN voor de operator
   ──────────────────────────────────────────────────────────────── */
/* Iter 9ai (2026-05-31): Calm/Headspace-style full-bleed welcome.
   Cover + slimme crop. Foto vloeit via een lange zachte gradient over
   in Brand.bg — geen harde randen, wereldklasse-gevoel.

   Iter 9an (2026-05-31): nieuwe "zoom out zonder zwarte randen" knop —
   FOTO_HEIGHT bepaalt hoeveel SCHERMHOOGTE de foto inneemt (top-anchored,
   cover binnen die ruimte). Bij FOTO_HEIGHT < 100% is het onderdeel boven
   de buttons een rustig dark vlak dat door de bottom-gradient wordt
   opgevangen — geen randen om de foto, want links/rechts blijft 'cover'
   de wrapper netjes vullen.

   FOTO_Y: translateY-shift binnen de wrapper. Negatief = focal point
   omhoog, positief = omlaag.

   FOTO_SCALE: extra zoom binnen de wrapper. ≥1.0 garandeert geen zwarte
   randen aan zijkanten. <1.0 NIET aanraden (geeft randen). */
const FOTO_HEIGHT = 75;   // % van schermhoogte, top-anchored
const FOTO_Y = -20;        // pixels: negatief = omhoog
const FOTO_SCALE = 1.0;    // ≥1.0 om randen te vermijden

type Status = 'checking' | 'show';

export default function WelcomeScreen() {
  const [status, setStatus] = useState<Status>('checking');

  /* ── De beweging ──────────────────────────────────────────────────────
     Twee waarden, allebei doorlopend: `morph` gaat heen en weer tussen veld
     en gezichten, `spin` draait onophoudelijk. Ze staan LOS van elkaar, want
     een draaiing die stilvalt op het keerpunt maakt van een veld in de ruimte
     een plaatje dat even bevriest.

     Zeven seconden per kant. Korter en het wordt onrustig op een scherm waar
     je juist even moet landen; langer en zie je bij een kort bezoek maar één
     van de twee gedaanten. */
  const morph = useSharedValue(0);
  const turn = useSharedValue(0);
  useEffect(() => {
    /* Heen, even BLIJVEN STAAN, en dan terug (operator, 8 augustus 2026:
       "iets langer in beeld"). Met een gewone heen-en-weer beweging is het
       gezicht er maar één ogenblik — precies op het keerpunt — en dat is te
       kort om te herkennen wat je ziet. Nu staat het er twee en een halve
       seconde stil. */
    /* Sneller, en zonder stilte ertussen (operator, 8 augustus 2026: "kan het
       sneller gaan, gezicht max 1 of 2 sec in beeld en doordraaien").

       Anderhalve seconde stil op het gezicht, tweeënhalf heen en tweeënhalf
       terug: een ronde van zes en een halve seconde in plaats van veertien.
       De pauze aan het eind is weg — die was het enige moment waarop er
       werkelijk niets gebeurde, en dat is precies wat "doordraaien" uitsluit.

       Het gezicht landt nog steeds rechtop: de draaiing hangt aan de morph en
       maakt onderweg twee volle omwentelingen, hoe snel die ook lopen. */
    morph.value = withRepeat(
      withSequence(
        /* De man blijft een seconde langer staan dan de vrouw (operator,
           8 augustus 2026). Hij is het beeld waarmee het scherm opent, dus hij
           mag de rustigste van de twee zijn: tweeënhalve seconde tegen
           anderhalve. */
        withDelay(
          2500,
          withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.cubic) }),
        ),
        withDelay(
          1500,
          withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.cubic) }),
        ),
      ),
      -1,
      false,
    );
    turn.value = withRepeat(
      withTiming(1, { duration: 26000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(morph);
      cancelAnimation(turn);
    };
  }, [morph, turn]);

  /* ── Twee omwentelingen, en recht landen ──────────────────────────────
     Nu op de MAAT van SplatField in plaats van op mijn aanname. Daar geldt
     voor de hoek van elk punt:

         a = beginhoek + eindhoek·t + SWIRL·t + spin·2π

     Die `SWIRL·t` is een vaste extra draaiing die met de morph meegroeit —
     0,85 radiaal, ongeveer negenenveertig graden. Precies dat is waarom het
     gezicht scheef tot stilstand kwam: op het hoogtepunt stond de hele wolk
     een halve slag schuin, hoe de doorlopende draaiing ook liep.

     Dus geven we `spin` de tegenhanger mee. Op het hoogtepunt is de totale
     extra draaiing dan `SWIRL + (2 − SWIRL/2π)·2π = 2·2π`: twee volle
     omwentelingen, en dus rechtop. Onderweg draait hij die twee rondjes ook
     echt — het gezicht komt draaiend aan en gaat draaiend weer uiteen, en
     komt daarna in dezelfde stand terug (operator, 8 augustus 2026). */
  const SWIRL_TURNS = 0.85 / (Math.PI * 2);

  /* ── Altijd met de klok mee ───────────────────────────────────────────
     De draaiing hing rechtstreeks aan `morph`. Die loopt heen en weer, dus de
     draaiing liep op de terugweg mee terug — tegen de klok in (operator,
     8 augustus 2026). Nu tellen we de AFGELEGDE WEG op in plaats van de
     stand: die kan alleen maar groeien, dus de draaiing kan nooit omkeren.

     De maat verschilt per richting, en dat moet. In de hoekformule van
     SplatField zit `SWIRL·t`, en die telt alleen mee als er een gezicht in
     wording is. Op de heenweg (t: 0→1) staat er aan het eind SWIRL bij; op de
     terugweg valt die er weer af. Twee omwentelingen min die scheefstand
     heen, twee plus terug: bij elke aankomst staat de teller op een heel
     aantal omwentelingen, en dus staat het gezicht rechtop. */
  const travel = useSharedValue(0);
  const prev = useSharedValue(0);
  useAnimatedReaction(
    () => morph.value,
    (cur) => {
      travel.value += Math.abs(cur - prev.value);
      prev.value = cur;
    },
  );
  const spin = useDerivedValue(() => {
    const laps = Math.floor(travel.value / 2);
    const within = travel.value - laps * 2;
    const base = laps * 4;
    return within <= 1
      ? base + within * (2 - SWIRL_TURNS)
      : base + (2 - SWIRL_TURNS) + (within - 1) * (2 + SWIRL_TURNS);
  });
  void turn;

  /* De kaarten ademen, traag en licht — een schaal van 1 naar 1,03 en
     terug, elk op zijn eigen ritme zodat de twee nooit precies gelijk
     lopen (operator, 10 augustus 2026: "beweging in de cards, nu is alles
     statisch"). */
  const cardBreath1 = useSharedValue(0);
  const cardBreath2 = useSharedValue(0);
  useEffect(() => {
    cardBreath1.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    cardBreath2.value = withRepeat(
      withDelay(
        400,
        withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    return () => {
      cancelAnimation(cardBreath1);
      cancelAnimation(cardBreath2);
    };
  }, [cardBreath1, cardBreath2]);
  const breathe1 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + cardBreath1.value * 0.03 }],
  }));
  const breathe2 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + cardBreath2.value * 0.03 }],
  }));

  /* Reeds ingelogd? → welkomstscherm overslaan, direct de tabs in.
     Tijdens de check tonen we alleen de merk-achtergrondkleur (geen flits).
     Iter 9ar (2026-05-31): respecteert nu OOK de dev user-override
     'guest' — operator kan zo de welcome-flow testen zonder daadwerkelijk
     uit te loggen. We wachten eerst tot de override-cache geladen is om
     een race-conditie te vermijden waarbij de token-check eerder klaar
     is dan de override-load. In prod is awaitDevUserOverrideLoaded()
     een no-op (resolved direct). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await awaitDevUserOverrideLoaded();
      if (cancelled) return;
      const override = getDevUserOverride();
      const token = await getToken();
      if (cancelled) return;
      /* Iter 9dj (2026-05-31): override 'audio' / 'bracelet' / 'pro'
         simuleren ingelogde state → ook zonder echte token welcome
         overslaan, anders blijft welcome hangen op cold-start tests. */
      const treatAsGuest = override === 'guest';
      const treatAsSignedIn =
        override === 'audio' || override === 'bracelet' || override === 'pro';
      /* Iedereen ziet het welkomstscherm, ook wie ingelogd is (operator,
         7 augustus 2026 — dat stond al zo in de root, maar HIER sprong een
         ingelogde gebruiker alsnog weg naar `/`, en `/` is sinds 5 augustus
         de verborgen audiobibliotheek. Vandaar dat de app steeds op "Where
         Insight Becomes Identity" uitkwam.)

         De gegevens worden nog steeds opgehaald — daar hangt af wat het
         scherm aanbiedt — alleen de omleiding is weg. */
      void treatAsSignedIn;
      void treatAsGuest;
      void token;
      setStatus('show');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking') {
    return <View style={s.checking} />;
  }

  return (
    <View style={s.root}>
      {/* Iter 9ai (2026-05-31): Calm/Headspace-style full-bleed photo.
         Wrapper-View met overflow:hidden zorgt dat de cover-image netjes
         binnen het scherm valt; FOTO_Y translateY tilt de focal point.
         Iter 9al (2026-05-31): operator probeert "master-mental-clarity"
         als welcome — testen of de "arrival energy" sterker leest dan
         de vorige Sharp Focus / Beta crop. */}
      {/* Een bewegend energieveld in plaats van een foto (operator,
          8 augustus 2026). Een foto van een gezicht zegt iets over een
          persoon; dit zegt iets over wat de app doet. Zie
          Niet twee losse tekeningen die in elkaar overvloeien maar EEN wolk
          punten die twee gedaanten aanneemt: het veld WORDT het gezicht, in
          plaats van ervoor te verdwijnen. Daarom is het gezicht ook echt door
          de lichtjes gemaakt en niet een foto die opkomt (operator,
          8 augustus 2026).

          Het gezicht is de blik die tot vandaag de welkomstfoto was — dat
          beeld hoort bij dit scherm, en als puntenwolk zegt het hetzelfde
          zonder een foto te zijn. Bewust NIET de twee gezichten van de
          Breath-tab: dezelfde vorm op twee plekken maakt van een merkbeeld
          een behangetje. */}
      <View style={s.bgPhotoWrap}>
        <View style={s.fieldCenter}>
          <SplatField
            restUri={MAN}
            endUri={WOMAN}
            spin={spin}
            breath={morph}
            size={FIELD_SIZE}
            /* Wit (operator, 8 augustus 2026). Hier horen de lichtpunten
               wit: een lichtbron in de ruimte, geen kleur. Het blauw staat op
               de Breath-intro, waar de sterren al blauw zijn. */
            color="#FFFFFF"
            /* Meer punten voor een scherper gezicht (operator: "kan je
               gezicht superduidelijk maken"). Op 2600 was de omtrek er wel
               maar bleven de ogen en de mond een suggestie; het dubbele
               tekent ze uit. Het blijft één tekenopdracht via Atlas, dus de
               prijs zit in geheugen en niet in beeldjes per seconde. */
            count={5200}
            /* Halverwege valt de wolk uiteen tot een veld en komt daarna
               samen tot het volgende gezicht. Zie de toelichting bij
               `disperse` in SplatField — de Breath-tab laat hem op nul staan
               en verandert dus niet. */
            disperse={0.85}
          />

        </View>
      </View>

      {/* Top scrim — subtiele donkere fade voor status bar + wordmark.
         15% van scherm, transparant → 35% zwart. Houdt de tekst leesbaar
         tegen lichte fotozones bovenaan zonder de foto te dempen. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(10,10,10,0.55)', 'rgba(10,10,10,0)']}
        locations={[0, 1]}
        style={s.topScrim}
      />

      {/* Iter 9ao (2026-05-31): bottom-gradient afgestemd op FOTO_HEIGHT.
         Gradient bereikt 100% opacity exact bij de wrapper-onderkant
         (FOTO_HEIGHT% van scherm) zodat foto onmerkbaar in zwart over­
         vloeit. Geen "harde lijn" meer. Cubic-like curve over 8 stops
         voor maximaal zachte transitie. Gradient strekt naar boven uit
         tot 10% van scherm zodat 65% van gradient-zone benut wordt voor
         de fade — vergeleken met 50% eerder. */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(10,10,10,0)',
          'rgba(10,10,10,0.04)',
          'rgba(10,10,10,0.12)',
          'rgba(10,10,10,0.25)',
          'rgba(10,10,10,0.45)',
          'rgba(10,10,10,0.70)',
          'rgba(10,10,10,0.92)',
          Brand.bg,
          Brand.bg,
        ]}
        locations={[0, 0.15, 0.30, 0.45, 0.55, 0.63, 0.70, 0.72, 1]}
        style={s.bottomFade}
      />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.top}>
          <Image
            source={require('../../assets/vibezcore_wordmark.png')}
            style={s.wordmark}
            resizeMode="contain"
            accessibilityLabel="VIBEZCORE"
          />
        </View>

        <View style={s.middle}>
          {/* "CHANGE THE GAME..." weg (operator, 10 augustus 2026) — de kop
              zegt het al. Een ECHTE SVG-gradient over de kop (operator,
              dezelfde datum, tweede poging: "gradient blauw is niet echt
              mooi, moet professioneler") — drie losse kleurtinten op
              gewone Text lazen als stappen, geen verloop. react-native-svg
              was al een afhankelijkheid van deze app (player.tsx,
              bracelet-control.tsx); zijn <Text> accepteert een gradient
              als fill en is daarmee het juiste gereedschap. */}
          <Svg width={CONTENT_W} height={112}>
            <Defs>
              <SvgGradient id="headerGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#ffffff" />
                <Stop offset="0.55" stopColor="#bfe0ff" />
                <Stop offset="1" stopColor={SOFT_BLUE} />
              </SvgGradient>
            </Defs>
            <SvgText
              x="50%"
              y="42"
              textAnchor="middle"
              fontFamily={BrandFonts.regular}
              fontSize={36}
              letterSpacing={0.2}
              fill="url(#headerGrad)"
            >
              Control Your Vibe
            </SvgText>
            <SvgText
              x="50%"
              y="86"
              textAnchor="middle"
              fontFamily={BrandFonts.regular}
              fontSize={36}
              letterSpacing={0.2}
              fill="url(#headerGrad)"
            >
              Control Your Life
            </SvgText>
          </Svg>
        </View>

        <View style={s.bottom}>
          {/* Twee gelijkwaardige knoppen naast elkaar — halve breedte,
             identiek qua gewicht. Volgorde per BLAUWDRUK §2:
             Audio eerst, Bracelet tweede. */}
          {/* Twee gelijkwaardige knoppen zolang audio meedoet; staat die uit,
              dan zijn Breath en Bracelet de twee kernen en krijgen zij de
              volle breedte. Geen halflege rij met één knop erin — dat leest
              als een scherm waar iets van weggehaald is. */}
          {/* De bracelet is de HOOFDROL (operator, 5 augustus 2026). Twee
              even grote knoppen zeiden dat beide even belangrijk waren; dat
              was waar toen audio meedeed, en het is niet meer waar nu het
              product de bracelet is. Eén volle knop en één ondergeschikte
              regel zeggen in één oogopslag wat je hier komt doen. */}
          {/* Twee kaarten in plaats van een knop en een regel (operator-
              mockup, 8 augustus 2026). Ze zijn gelijkwaardig van vorm maar
              niet van gewicht: de bracelet draagt een foto van het product
              zelf, breathwork een teken. Dat verschil zegt genoeg zonder dat
              de tweede een bijzin wordt.

              Wat elke kaart moet doen: in twee regels vertellen wat je
              krijgt. Alleen een naam laat de bezoeker raden, en dit is het
              scherm waar iemand beslist of hij verder kijkt. */}
          <View style={s.cardRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate('/bracelet')}
              style={({ pressed }) => [s.cardCol, pressed && s.cardPressed]}
            >
              {/* Lichtbron in de kaart zelf (operator, 10 augustus 2026:
                  "binnenkant te effen, misschien gradient of een soort
                  lichtbron") — een zachte gloed die van linksboven komt,
                  zoals licht dat ergens buiten beeld vandaan schijnt. */}
              <LinearGradient
                pointerEvents="none"
                colors={[`rgba(${SOFT_BLUE_RGB},0.16)`, `rgba(${SOFT_BLUE_RGB},0)`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.8, y: 0.9 }}
                style={StyleSheet.absoluteFill}
              />
              {/* `contain`, niet `cover` (operator, 10 augustus 2026,
                  tweede correctie: "bracelet wordt links en rechts
                  afgesneden, dat mag niet") — de hele armband moet zichtbaar
                  blijven, ook als dat lege rand van het bronbestand
                  meebrengt. */}
              <Animated.View style={[s.cardVisual, breathe1]}>
                {/* `cover`, zelfde behandeling als de breathwork-foto — dit
                   bronbestand heeft al een achtergrond en is op formaat
                   aangeleverd (operator, 10 augustus 2026). */}
                <Image
                  source={{ uri: BRACELET_IMG }}
                  style={s.cardColImg}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
                {/* De haptische klop, hetzelfde kastje-effect als op de
                    onboarding-schermen. */}
                {/* originX 0.4 -> 0.47, originY 0.76 -> 0.69 (operator,
                    10 augustus 2026: "te veel naar links, 1mm naar
                    boven"). Fijnkorrectie op de meting van zonet. */}
                <PodPulse
                  width={CARD_IMG_W}
                  height={CARD_IMG_H}
                  originX={0.47}
                  originY={0.69}
                  reach={0.08}
                  intensity={3.4}
                  color={SOFT_BLUE}
                />
              </Animated.View>
              <Text style={s.cardTitle}>Smart Bead Bracelet</Text>
              <Text style={s.cardBody}>
                Instant state control through precision haptics.
              </Text>
              <View style={s.cardCta}>
                <Text style={s.cardCtaTxt}>EXPLORE</Text>
                <ChevronRight size={15} color={SOFT_BLUE} strokeWidth={2.4} />
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              /* Naar de ONBOARDING, niet rechtstreeks de vijf toestanden in
                 (operator, 8 augustus 2026). Wie hier tikt is nieuw; de
                 intro legt uit wat dit is en eindigt in de vragenlijst en
                 een volledige gratis sessie. Wie de intro al uitliep komt
                 via de Breath-tab gewoon binnen. */
              onPress={() => {
                const seen =
                  getSetting('breathOnboardingCompletedAt') !== null;
                router.navigate(
                  (seen ? '/breath' : '/breath-welcome') as never,
                );
              }}
              style={({ pressed }) => [s.cardCol, pressed && s.cardPressed]}
            >
              <LinearGradient
                pointerEvents="none"
                colors={[`rgba(${SOFT_BLUE_RGB},0.16)`, `rgba(${SOFT_BLUE_RGB},0)`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.8, y: 0.9 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Operator-foto voor deze kaart, 10 augustus 2026 — vervangt
                  het losse golficoon. */}
              <Animated.View style={[s.cardVisual, breathe2]}>
                <Image
                  source={{ uri: BREATHWORK_CARD_IMG }}
                  style={s.cardColImg}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              </Animated.View>
              <Text style={s.cardTitle}>Guided Breathwork</Text>
              <Text style={s.cardBody}>
                Recognised techniques for energy, focus and recovery.
              </Text>
              <View style={s.cardCta}>
                <Text style={s.cardCtaTxt}>START SESSION</Text>
                <ChevronRight size={15} color={SOFT_BLUE} strokeWidth={2.4} />
              </View>
            </Pressable>
          </View>

          {/* Twee regels, niet drie. "Reset in minutes" wees naar breathwork
              en dat staat nu als kaart hierboven — dezelfde bestemming twee
              keer aanbieden maakt een scherm langer, niet duidelijker. */}
          <View style={s.linksDivider} />
          <View style={s.linksGroup}>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.navigate('/activate-bracelet' as never)}
              hitSlop={10}
              style={s.linkRow}
            >
              <CircleDot size={16} color="rgba(255,255,255,0.45)" strokeWidth={2} />
              <Text style={s.linkRowText}>
                Have a bracelet? <Text style={s.linkAction}>Activate now</Text>
              </Text>
              <ChevronRight size={16} color={SOFT_BLUE} strokeWidth={2.2} />
            </Pressable>
            <View style={s.linkRowSep} />
            <Pressable
              accessibilityRole="link"
              onPress={() => router.navigate('/account')}
              hitSlop={10}
              style={s.linkRow}
            >
              <User size={16} color="rgba(255,255,255,0.45)" strokeWidth={2} />
              <Text style={s.linkRowText}>
                Already a member? <Text style={s.linkAction}>Sign in</Text>
              </Text>
              <ChevronRight size={16} color={SOFT_BLUE} strokeWidth={2.2} />
            </Pressable>
          </View>

          {/* Sluitregel (operator, 10 augustus 2026, met een referentiebeeld
              erbij): drie woorden, elk voor wat de app werkelijk is — de
              ademsessies trainen de geest, de bracelet werkt op het lichaam,
              samen is dat waar VIBEZCORE om draait. Geen aparte animatie of
              beeld zoals in de referentie: dat beeld draagt het scherm al,
              hier hoeft alleen de laatste regel te staan. */}
          <Text style={s.footTagline}>
            YOUR <Text style={{ color: SOFT_BLUE }}>MIND</Text>. YOUR{' '}
            <Text style={{ color: SOFT_BLUE }}>BODY</Text>. YOUR{' '}
            <Text style={{ color: SOFT_BLUE }}>EVOLUTION</Text>.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* De bracelet zelf, vrijstaand op zwart — dezelfde render als op de
   Bracelet-tab, zodat het product er op beide plekken gelijk uitziet. */
/* Nieuwe operator-foto (10 augustus 2026): armband MET achtergrond, zelfde
   formaat als de Guided Breathwork-foto — dus dezelfde `cover`-behandeling
   in plaats van het `contain` van de vorige, vrijstaande versie. */
const BRACELET_IMG =
  'https://vibezcore-audio.b-cdn.net/images/welcoma%20screen%20app%20bracelet%20with%20background%202.png';
/* Operator-foto voor de Guided Breathwork-kaart, 10 augustus 2026. */
const BREATHWORK_CARD_IMG =
  'https://vibezcore-audio.b-cdn.net/images/welcome%20app%20screen%20duo.png';
/* Maten van het beeldvak in de kaart — PodPulse rekent zijn kloppunt op
   deze afmetingen, dus ze moeten gelijk zijn aan `cardColImg` hieronder.
   Rechtstreeks uit Dimensions en niet uit SCREEN_W: die constante staat
   verderop in dit bestand en zou hier nog niet bestaan (module-volgorde). */
const CARD_IMG_W = Math.round(
  (Dimensions.get('window').width - 48 - 10) / 2 - 28,
);
const CARD_IMG_H = 92;

/* Het veld vult de bovenste helft; daaronder loopt het via de bestaande
   gradient in het zwart over. */
const SCREEN_W = Dimensions.get('window').width;
/* Breedte van het SVG-vlak voor de kop: schermbreedte min de zijmarge van
   `safe` (paddingHorizontal:24 aan beide kanten). */
const CONTENT_W = SCREEN_W - 48;
/* Zachter en lichter dan SOFT_BLUE (#3a8fff) — alleen voor dit scherm
   (operator, 10 augustus 2026: "accentblauw nu overal is redelijk hard").
   Minder verzadigd, meer wit erin, blijft leesbaar blauw op zwart zonder
   te schreeuwen. */
/* #7EB8FF (eerste poging) las nog te bleek en pastel aan (operator, 10
   augustus 2026, tweede correctie: "moderner kiezen"). #4F8FFF is
   verzadigder — de blauwtoon die de meeste hedendaagse SaaS-merken
   gebruiken — zonder terug te vallen op het hardere #3a8fff van
   daarvoor. */
const SOFT_BLUE = '#4F8FFF';
const SOFT_BLUE_RGB = '79,143,255';
const FIELD_H = Math.round(Dimensions.get('window').height * (FOTO_HEIGHT / 100));
/* Vierkant, want de wolk rekent in een vierkante ruimte. Breder dan het scherm
   zodat de buitenrand van het veld doorloopt tot voorbij de zijkanten. */
/* Precies binnen de schermbreedte, met een marge (operator, 8 augustus 2026:
   "de animatie moet zich altijd in het beeld afspelen"). Stond op 1,25 maal
   de breedte met een negatieve marge erboven: mooi als achtergrond, maar de
   buitenrand van het veld en de bovenkant van het gezicht liepen het scherm
   uit. Een gezicht dat half buiten beeld ontstaat is geen gezicht. */
const FIELD_SIZE = Math.round(SCREEN_W * 0.94);
/* Via de cache en niet rechtstreeks van het net: `useImage` levert een leeg
   beeld terug zolang de download loopt, en dan blijft het veld draaien zonder
   ooit een gezicht te worden. */
/* Van de man naar de vrouw en terug (operator, 8 augustus 2026). Twee
   portretten in plaats van een veld dat een gezicht wordt: het veld is nu wat
   je ONDERWEG ziet — duizenden punten die van de ene kop naar de andere
   reizen. Dat is hetzelfde beeld, maar met een reden erachter.

   Via de cache en niet rechtstreeks van het net: `useImage` levert een leeg
   beeld zolang de download loopt. */
const MAN = assetUri(WELCOME_MAN);
const WOMAN = assetUri(WELCOME_WOMAN);

const s = StyleSheet.create({
  checking: { flex: 1, backgroundColor: Brand.bg },
  root: { flex: 1, backgroundColor: Brand.bg },
  /* Iter 9an (2026-05-31): wrapper is TOP-anchored met FOTO_HEIGHT%.
     Foto vult de wrapper (cover, geen randen aan zijkanten). Onder de
     wrapper is Brand.bg, naadloos opgepakt door de bottom-gradient. */
  bgPhotoWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: `${FOTO_HEIGHT}%`,
    overflow: 'hidden',
    backgroundColor: Brand.bg,
  },
  /* Het vierkante veld gecentreerd in het vak erboven. */
  fieldCenter: {
    position: 'absolute',
    /* 54 -> 30 (operator, 10 augustus 2026: "animatie zelf mag iets
       hoger"). */
    top: 30,
    left: Math.round((SCREEN_W - SCREEN_W * 0.94) / 2),
    width: Math.round(SCREEN_W * 0.94),
    height: Math.round(SCREEN_W * 0.94),
  },
  bgPhoto: {
    width: '100%',
    height: '100%',
    transform: [{ scale: FOTO_SCALE }, { translateY: FOTO_Y }],
  },
  /* Top scrim — 15% van scherm. Subtiel zwart-fade voor status bar +
     wordmark leesbaarheid, dempt de foto niet onnodig. */
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '15%',
  },
  /* Iter 9ao (2026-05-31): bottom-fade strekt nu 90% van schermhoogte
     (was 68%). Maakt de fade veel gradueler én laat de gradient 100%
     opacity bereiken precies op de foto-wrapper onderkant (FOTO_HEIGHT).
     Resultaat: foto en zwart vlak vloeien onmerkbaar in elkaar over. */
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '90%',
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 18,
  },
  top: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  wordmark: {
    width: 220,
    height: 36,
    /* Wordmark is een PNG — textShadow werkt niet op een Image, dus iOS-shadow
       props + Android-elevation voor leesbaarheid op de foto. */
    shadowColor: '#000',
    shadowOpacity: 0.85,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  middle: {
    flex: 1,
    paddingHorizontal: 8,
    /* Naar BOVEN in plaats van naar beneden (operator, 8 augustus 2026:
       "hoger zetten"). De kop stond 38 punten omlaag om de foto lucht te
       geven; nu de twee kaarten eronder staan is die ruimte juist nodig
       onderaan. De kop klimt het beeld in, waar hij op de mockup ook staat. */
    justifyContent: 'flex-end',
    /* Hoger (operator, 8 augustus 2026). Meer ruimte onder de kop duwt hem
       omhoog het veld in, waar hij op de mockup ook staat. */
    paddingBottom: 54,
  },
  header: {
    /* Hoofdregel = visuele baas. Inter 900 + lichte negatieve letter-spacing
       voor strakke koppen. fontSize gekozen zodat "Start Directing." (de
       langste regel) op telefoon-breedtes op één regel past;
       numberOfLines={1} + adjustsFontSizeToFit op de <Text> beschermt
       extra-smalle toestellen tegen wrap. */
    color: Brand.text,
    /* Inter in een LICHT gewicht, zoals op de mockup (operator, 8 augustus
       2026). Dit wijkt af van MERK_ANKER, dat grote vette koppen voorschrijft
       — bewust, en op verzoek. Op een veld dat zelf al beweegt en licht geeft
       leest een zware kop als een balk eroverheen; een dunne laat het beeld
       doorlopen. */
    fontFamily: BrandFonts.regular,
    /* 42 → 34. "Control Your Vibe" is langer dan "Stop Drifting." en werd op
       42 afgekapt tot "Control Your …" (gezien op het toestel, 8 augustus
       2026). Op 34 past de langste regel met marge, ook op smallere
       toestellen. */
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: 0.2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  /* De twee extra tinten van het verloop — zie de toelichting bij de
     kop hierboven. */
  headerMid: { color: '#9FC6FF' },
  headerAccent: { color: SOFT_BLUE },
  bottom: {
    gap: 10,
  },
  /* ── De twee kaarten, naast elkaar (operator, 10 augustus 2026,
     referentiebeeld erbij: "cards moet verticaal en naast elkaar") ── */
  cardRow: { flexDirection: 'row', gap: 10 },
  cardCol: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: `rgba(${SOFT_BLUE_RGB},0.28)`,
    backgroundColor: 'rgba(12,24,44,0.72)',
    /* De lichtbron-gradient (StyleSheet.absoluteFill) mag nooit voorbij
       de ronde hoeken van de kaart uitsteken. */
    overflow: 'hidden',
  },
  cardPressed: {
    borderColor: `rgba(${SOFT_BLUE_RGB},0.55)`,
    backgroundColor: 'rgba(16,32,58,0.85)',
  },
  /* Het beeld boven, over de volle kolombreedte — `cover` snijdt de lege
     rand van het bronbestand weg in plaats van hem mee te schalen. */
  /* De wrapper draagt de marge en de vaste plaats voor PodPulse (die zich
     absoluut positioneert op zijn eigen ouder); `cardColImg` zelf is nu
     puur de afbeelding. */
  cardVisual: {
    width: '100%',
    height: 92,
    marginBottom: 12,
  },
  cardColImg: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardColGlyph: {
    width: '100%',
    height: 92,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `rgba(${SOFT_BLUE_RGB},0.35)`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    color: Brand.text,
    letterSpacing: -0.2,
  },
  cardBody: {
    marginTop: 4,
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.62)',
  },
  cardCta: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardCtaTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 11.5,
    letterSpacing: 0.8,
    color: SOFT_BLUE,
  },
  linkAction: { color: SOFT_BLUE, fontFamily: BrandFonts.semibold },
  /* Iter v237f (2026-07-09): 3 links in nette grouped card met dividers.
     Voorheen was 't 3 losse text-links wat te druk oogde. Nu: 1 pill met
     3 rijen gescheiden door hairline dividers — leest als een menu-lijstje. */
  linksDivider: {
    height: 1,
    marginTop: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  linksGroup: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  footTagline: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.5)',
  },
  /* Icoon, tekst en pijl op ÉÉN regel. Zonder richting stapelde React Native
     ze onder elkaar en werd van twee regels een blok van zes. */
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  linkRowText: {
    flex: 1,
    color: 'rgba(255,255,255,0.72)',
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    letterSpacing: 0.1,
  },
  linkRowSub: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 11,
    marginTop: 1,
    letterSpacing: 0.15,
    opacity: 0.75,
  },
  linkRowSep: {
    height: 1,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  /* Legacy — nog gerefereerd door oude code paths, houd voor safety. */
  signinHit: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 2,
  },
  signinText: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
