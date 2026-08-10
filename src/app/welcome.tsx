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
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { getSetting } from '@/utils/settings';
import {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
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
          {/* Operator-mockup, 8 augustus 2026. */}
          <Text style={s.header} numberOfLines={1}>
            Control Your Vibe
          </Text>
          <Text style={s.header} numberOfLines={1}>
            Control Your Life
          </Text>
          {/* Accent-streepje tussen hoofdregel en caps-ondertekst (#3a8fff). */}
          <View style={s.accentBar} />
          <Text style={s.subheader}>
            CHANGE THE GAME · UNLOCK YOUR FULL POTENTIAL
          </Text>
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
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/bracelet')}
            style={({ pressed }) => [s.card, pressed && s.cardPressed]}
          >
            <Image
              source={{ uri: BRACELET_IMG }}
              style={s.cardImg}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <View style={s.cardTxt}>
              <Text style={s.cardTitle}>Smart Bead Bracelet</Text>
              <Text style={s.cardBody}>
                Instant state control through precision haptics.
              </Text>
            </View>
            <ChevronRight size={20} color={Brand.accent} strokeWidth={2.2} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            /* Naar de ONBOARDING, niet rechtstreeks de vijf toestanden in
               (operator, 8 augustus 2026). Wie hier tikt is nieuw; de intro
               legt uit wat dit is en eindigt in de vragenlijst en een
               volledige gratis sessie. Wie de intro al uitliep komt via de
               Breath-tab gewoon binnen. */
            onPress={() => {
              /* Wie de intro al uitliep (of al sessies draaide) komt direct
                 op de keuzepagina — de onboarding nog eens afdwingen is
                 iemand de weg versperren die hem al kent (operator,
                 8 augustus 2026). Alleen wie hier echt nieuw is krijgt de
                 uitleg eerst. */
              const seen =
                getSetting('breathOnboardingCompletedAt') !== null;
              router.navigate((seen ? '/breath' : '/breath-welcome') as never);
            }}
            style={({ pressed }) => [s.card, pressed && s.cardPressed]}
          >
            <View style={s.cardGlyph}>
              <AudioWaveform size={26} color={Brand.accent} strokeWidth={2} />
            </View>
            <View style={s.cardTxt}>
              <Text style={s.cardTitle}>Guided Breathwork</Text>
              <Text style={s.cardBody}>
                Recognised techniques for energy, focus and recovery.
              </Text>
            </View>
            <ChevronRight size={20} color={Brand.accent} strokeWidth={2.2} />
          </Pressable>

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
              <ChevronRight size={16} color={Brand.accent} strokeWidth={2.2} />
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
              <ChevronRight size={16} color={Brand.accent} strokeWidth={2.2} />
            </Pressable>
          </View>

          {/* Sluitregel (operator, 10 augustus 2026, met een referentiebeeld
              erbij): drie woorden, elk voor wat de app werkelijk is — de
              ademsessies trainen de geest, de bracelet werkt op het lichaam,
              samen is dat waar VIBEZCORE om draait. Geen aparte animatie of
              beeld zoals in de referentie: dat beeld draagt het scherm al,
              hier hoeft alleen de laatste regel te staan. */}
          <Text style={s.footTagline}>
            YOUR <Text style={{ color: Brand.accent }}>MIND</Text>. YOUR{' '}
            <Text style={{ color: Brand.accent }}>BODY</Text>. YOUR{' '}
            <Text style={{ color: Brand.accent }}>EVOLUTION</Text>.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* De bracelet zelf, vrijstaand op zwart — dezelfde render als op de
   Bracelet-tab, zodat het product er op beide plekken gelijk uitziet. */
const BRACELET_IMG =
  'https://vibezcore-audio.b-cdn.net/images/vzc-bracelet%20no%20bg.png';

/* Het veld vult de bovenste helft; daaronder loopt het via de bestaande
   gradient in het zwart over. */
const SCREEN_W = Dimensions.get('window').width;
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
    /* Onder de wordmark, boven de kop. */
    top: 54,
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
  accentBar: {
    width: 34,
    height: 3,
    backgroundColor: Brand.accent,
    alignSelf: 'center',
    marginTop: 22,
    marginBottom: 16,
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
  subheader: {
    /* Iter 9ao (2026-05-31): kleur naar wit (was Brand.textDim #8a8a8a).
       Door de zachtere gradient is de fotozone op die hoogte te druk
       voor de gedimde grijs-tekst — wit met text-shadow leest altijd. */
    color: Brand.text,
    fontFamily: BrandFonts.medium,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 2.4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  bottom: {
    gap: 10,
  },
  /* ── De twee kaarten ── */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.28)',
    backgroundColor: 'rgba(12,24,44,0.72)',
  },
  cardPressed: {
    borderColor: 'rgba(58,143,255,0.55)',
    backgroundColor: 'rgba(16,32,58,0.85)',
  },
  cardImg: { width: 62, height: 62 },
  /* Zelfde vak als de foto, zodat de twee kaarten even hoog beginnen en de
     titels op één lijn staan. */
  cardGlyph: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: 'rgba(58,143,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTxt: { flex: 1 },
  cardTitle: {
    fontFamily: BrandFonts.semibold,
    fontSize: 18,
    color: Brand.text,
    letterSpacing: -0.2,
  },
  cardBody: {
    marginTop: 4,
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.62)',
  },
  linkAction: { color: Brand.accent, fontFamily: BrandFonts.semibold },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnHalf: {
    flex: 1,
    paddingHorizontal: 8,
  },
  btn: {
    /* Halftransparante accentkleur: bracelet schijnt er onderdoor heen.
       Brand.accent = #3a8fff = rgb(58,143,255), 0.55 alpha. Lichte rand
       houdt de knop-vorm helder tegen de foto. */
    backgroundColor: 'rgba(58,143,255,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    /* Brand.accentHover = #2a7fee = rgb(42,127,238), iets minder transparant
       voor duidelijke pressed-feedback. */
    backgroundColor: 'rgba(42,127,238,0.78)',
  },
  btnLabel: {
    color: Brand.text,
    fontFamily: BrandFonts.bold,
    fontSize: 16,
    letterSpacing: 0.2,
    textAlign: 'center',
    /* Tekstschaduw voor leesbaarheid over zowel donkere als lichte fotozones. */
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  /* Iter v237f (2026-07-09): 3 links in nette grouped card met dividers.
     Voorheen was 't 3 losse text-links wat te druk oogde. Nu: 1 pill met
     3 rijen gescheiden door hairline dividers — leest als een menu-lijstje. */
  secondaryBtn: { alignSelf: 'center', paddingVertical: 14 },
  secondaryLabel: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    letterSpacing: 0.2,
  },
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
