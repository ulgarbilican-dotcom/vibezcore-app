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
import { MINI_PLAYER_HEIGHT } from '@/components/MiniPlayer';
import VibezGlass from '@/components/VibezGlass';
import { getBreathHost, subscribeBreathHost } from '@/services/breath-session-host';
import StateGlyph from '@/components/StateGlyph';
import { usePlayerState } from '@/services/audio-player';
import { LinearGradient } from 'expo-linear-gradient';
import { assetUri } from '@/services/asset-cache';
import { STATE_PHOTOS } from '@/services/offline-assets';
import { Brand, BrandFonts } from '@/constants/theme';
import {
  BREATH_STATES,
  cycleSeconds,
  type BreathState,
  type BreathStateKey,
} from '@/data/breath-states';
import { useBreathHistory } from '@/utils/breath-history';
import { useSetting } from '@/utils/settings';
import {
  consumeBreathIntroSkip,
  consumeBreathOnboardingRedirectSkip,
} from '@/utils/breath-entry';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Info } from 'lucide-react-native';
import { useActivePlan } from '@/utils/plan-store';
import { techniqueIcon } from '@/utils/technique-copy';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { type ViewStyle } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/* Halve breedte van de CTA-knop is genoeg zwaai voor de shimmer-strook om
   volledig van links naar rechts te vegen (de strook zelf is smal en
   gedraaid, dus hoeft niet de volle breedte te reizen). */
const CTA_SHIMMER_RANGE = 170;

const INTRO_BG_IMG =
  'https://vibezcore-audio.b-cdn.net/images/pic%20hero%20breathwork%20welcome%203.png';
/* Operator, 8 september 2026: "Choose your session" naar de eerste
   mockup-foto — volle achtergrondfoto i.p.v. zwart. Het oude
   `STATES_BG_IMG`-bestand ("pic background app breathwork.png") bleek bij
   controle een lichte, wazige abstracte textuur uit de LICHTE periode van
   de app, geen scènefoto — vandaar de eerdere "grijs"/"mistig"-klachten,
   niet de overlay.
   Operator, zelfde dag (vervolg): "kijk kleine cirkels na, daar staan
   andere foto's in nu" — de achtergrond had EVEN een eigen, losse fotolijst
   die uit de pas liep met de miniaturen (`STATE_PHOTOS`). Die losse lijst is
   weer weg; de achtergrond leest nu rechtstreeks uit `STATE_PHOTOS`, exact
   dezelfde bron als de rij van vijf onderaan — kán niet meer uiteenlopen. */
const stateBgFor = (key: BreathStateKey) => STATE_PHOTOS[key] ?? INTRO_BG_IMG;

/* Operator, 9 september 2026: "info in popup is beetje te belerend en ziet
   er saai en veel uit... users lezen niet graag veel" — de RHYTHMS-lijst was
   drie volle alinea's tekst. Vervangen door een scanbare rij per techniek:
   vorm-icoon (zelfde set als `breath-setup.tsx`), het cijferpatroon
   rechtstreeks uit `phases` (geen tekst, meteen duidelijk), en één korte
   "hook"-zin i.p.v. de volle `explain`. Geen nieuwe copy nodig: elke
   `explain` in breath-states.ts volgt al het patroon "[timing] — [hook].
   [evt. extra zin]" — het stuk na de streep IS al de pakkende zin. */

/* Per-foto kadrering bovenop `cover` (zie toelichting bij de <Image> zelf).
   Omrekening 1cm ≈ 63dp op dit toestel (450dpi, 1dp ≈ 1/160 inch).

   Operator, 8 september 2026: "niet waar, je hebt beide foto's naar
   beneden geplaatst" — terecht. EERDERE (foute) redenering: een positieve
   `translateY` toont meer van de BOVENKANT van de brontfoto, dus leek
   "hoger gekaderd" logisch. Maar "meer bovenkant tonen" duwt het bestaande
   onderwerp juist LAGER het zichtbare venster in (er komt extra beeld
   BOVEN het onderwerp bij, dus het onderwerp zelf zakt naar beneden in
   het venster) — het tegenovergestelde van wat "naar boven" bedoelt.
   Teken nu omgedraaid: NEGATIEF = onderwerp hoger in beeld.

   Operator, 15 september 2026: "calm control foto nog meer uitzomen" —
   `cover` op scale 1 is al het MAXIMUM uitgezoomd dat kan zonder een
   lege rand (het crop-venster ligt vast op de layout-maat, VÓÓR
   transform; scale < 1 verkleint enkel diezelfde vaste crop, toont nooit
   meer bronbeeld — zie de toelichting bij `calm` hieronder). Verder
   uitzoomen dan dat kan alleen door de HELE foto te tonen i.p.v. 'm te
   vullen: optionele `mode: 'contain'` per state, met een subtiele
   achtergrondkleur (`C.bg`) op de plekken die dan open blijven. */
type BgCrop = {
  scale: number;
  translateY: number;
  translateX?: number;
  mode?: 'cover' | 'contain';
};
const NO_CROP: BgCrop = { scale: 1, translateY: 0 };

/* Operator, 8 september 2026 (2e ronde): "wat doe jij? foto boost sharp
   focus stond al goed" — de algemene basiswaarde die hier stond
   (toegepast op ALLE vijf, ook de twee die al prima stonden) is terug
   weg. Terug naar: kaal `cover` (= geen aanpassing) tenzij een toestand
   hier expliciet een eigen override heeft, precies zoals vóór de
   "consistentie"-poging — die poging loste niets op en brak juist twee
   foto's die al goed stonden. */
const STATE_BG_CROP: Partial<Record<BreathStateKey, BgCrop>> = {
  /* "clarity nu veel te hoog" — de -189 was getuned op een oudere foto
     (deze staat nu op de 3e vervanging, "pic clarity app 3.png"), nooit
     hierop gecontroleerd. Terug naar kaal `cover` tot hier iets specifieks
     over gevraagd wordt. */
  /* "rest moet ook 2cm zakken" (-150 → -24), toen "1cm hoger" (-24 → -87).
     Operator, 15 september 2026: "rest foto moet ook volledig op scherm
     staan, wordt nu afgesneden" — eerst `mode: 'contain'` (toont 'm
     volledig, met eventuele lege rand). Operator daarna, samen met de
     `calm`-correctie hierboven: "moet zoals bij boost en sharp focus
     mooi in heel scherm" — terug naar kale `cover` (geen lege rand,
     wél een beetje crop — zelfde afweging als bij `calm`). Bescheiden
     inzoom + positieve `translateY` beschermt de bovenkant, net als bij
     `calm` hierboven. Operator daarna: "beetje naar links" — nieuw
     `translateX`-veld op `BgCrop` (bestond nog niet, enkel scale/
     translateY); negatief = naar links. */
  rest: { scale: 1.3, translateX: -20, translateY: 30 },
  /* Operator, 15 september 2026: "pic calm control app 5.png" — twee
     mensen naast elkaar, beide met een opgeheven arm. Bronfoto (923×1343)
     is breder dan een telefoonscherm, dus `cover` snijdt van nature de
     zijkanten af.

     Twee mislukte pogingen om de vrouw rechts (vuist dicht bij de
     rechterrand) meer ruimte te geven door steeds harder in te zoomen +
     te verschuiven (tot scale 1.55) sneden uiteindelijk BEIDE figuren
     "langs alle kanten af" (operator) — véél te agressief. Een bescheiden
     zoom (1.05) hielp ook niet: haar hand staat zo dicht bij de rand dat
     ZELFS de minimale `cover`-crop 'm al raakt — met `cover` is er geen
     scale/translateY-combinatie die haar hand toont zonder ergens anders
     iets af te snijden, want `cover` snijdt per definitie altijd iets af.
     `mode: 'contain'` toont de HELE foto, gegarandeerd, ongeacht
     schermformaat — enige manier om zeker te weten dat haar hand nooit
     meer wegvalt. Operator daarna: "foto naar boven, heb liever zwarte
     rand aan onderkant" — bij `contain` op scale 1 staat de lege ruimte
     standaard verdeeld boven én onder; negatieve `translateY` schuift de
     volledige foto omhoog, dus de rand verzamelt zich nu onderaan i.p.v.
     verspreid. */
  calm: { scale: 1, translateX: 0, translateY: -60, mode: 'contain' },
};

const bgCropFor = (key: BreathStateKey): BgCrop =>
  STATE_BG_CROP[key] ?? NO_CROP;

/* Dezelfde volgorde als overal elders: van meest activerend naar meest
   kalmerend. Dat is ook de nummering van de bracelet-modi (CLAUDE.md §5),
   dus hij hoort niet per scherm te verschillen. */
const ORDER: BreathStateKey[] = ['boost', 'focus', 'calm', 'clarity', 'rest'];

/* Waar de pagina ALTIJD op opent bij een verse binnenkomst vanaf een andere
   pagina: CALM CONTROL — mooiste kleur, middelste positie in de rij van
   vijf (operator, 13 augustus 2026). Geen gepersonaliseerde suggestie meer
   op dit scherm; die zit nu in het protocol/agenda (utils/protocol.ts). */
const FALLBACK_INDEX = ORDER.indexOf('calm');

/* Het beeldvak. VASTE hoogte, want de tekst eronder mag niet verspringen
   zodra een illustratie groter of kleiner staat — daarvoor bestaat
   `artScale` per toestand. */
/* Het beeldvak levert hoogte in aan de rij eronder: die draagt nu twee
   leesbare regels per toestand in plaats van één onleesbare. */
/* Operator, 7 september 2026 (productkritiek): "de foto is té dominant,
   voelt als een banner — maak 'm iets kleiner, ruimte voor een sterkere
   typografische hiërarchie" — 0.28/252 → 0.22/200. */
/* Operator, 7 september 2026: "foto moet iets groter in de hoogte" —
   0.22 → 0.25, cap 200 → 226. */
const BOX_H = Math.min(Math.round(SCREEN_H * 0.25), 226);
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

/* Operator, 7 september 2026 (terug naar donker): wit-op-zwart is precies
   het contrast dat je wil, dus deze vervangkleur-logica is een no-op.
   Functie blijft bestaan (i.p.v. alle aanroepen weg te halen) zodat een
   eventuele latere lichte variant van dit scherm 'm zo kan terugzetten.
   Verplaatst naar module-scope (21 september 2026) zodat `StateThumb`
   'm ook kan gebruiken zonder een closure-prop nodig te hebben. */
const accentTextFor = (hex: string) => hex;

/* Operator, 7 september 2026 (productkritiek): "Apple gebruikt sentence
   case, niet overal caps" — de NAAM zelf verandert niet, enkel de
   schrijfwijze op dit scherm. Verplaatst naar module-scope, zelfde reden
   als `accentTextFor` hierboven. */
const sentenceCase = (v: string) =>
  v
    .toLowerCase()
    .split(' ')
    .map((w) => (w === '&' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

/* Eigen component (niet inline in de `.map()`) — elke cirkel heeft zijn
   EIGEN animated shared value nodig, dat kan niet in een lus met
   `useSharedValue` (Rules of Hooks: vast aantal hooks per render).
   Operator, 21 september 2026 ("choose your state buttons ook zelfde
   animatie geven"): was RN's ingebouwde `pressed`-state (instant scale
   0.95, geen terugveer) — nu dezelfde reanimated spring-press als de CTA
   op dit scherm (`ctaPressStyle`, zie hieronder in `BreathScreen`). */
function StateThumb({
  k,
  t,
  on,
  onPress,
  onInfoPress,
  thumbPulseStyle,
}: {
  k: BreathStateKey;
  t: BreathState;
  on: boolean;
  onPress: () => void;
  /* Operator, 2 okt 2026 ("cta moet gecentreerd blijven, zet de i boven
     de state-cirkel"): "How it works" hoort bij de GESELECTEERDE staat,
     dus hier, niet naast de CTA (die blijft nu weer gewoon gecentreerd,
     ongewijzigd). Enkel getoond op de actieve cirkel (`on`). */
  onInfoPress: () => void;
  thumbPulseStyle: AnimatedStyle<ViewStyle>;
}) {
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        pressScale.value = withTiming(0.95, { duration: 80 });
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
      }}
      style={[s.thumbCol, pressStyle]}
      accessibilityLabel={t.eyebrow}
    >
      {/* Operator, 2 okt 2026: losse, geneste tikzone boven de cirkel —
         binnenste responder wint de touch (zelfde patroon als elders in
         de app), dus geen interferentie met `onPress` (staat kiezen)
         hierboven. Enkel op de geselecteerde cirkel, anders 5× dezelfde
         knop tonen voor steeds dezelfde "How it works"-popup. */}
      {/* Operator, 2 okt 2026 ("cirkel niet heel wit maar grijs, en naar
         boven laten gaan samen met de i"): dezelfde `translateY` als
         `thumbSelected` hieronder, zodat de knop mee omhoog schuift met
         de cirkel i.p.v. een losse sibling die blijft staan. */}
      {on && (
        <Pressable
          onPress={onInfoPress}
          hitSlop={10}
          style={[s.thumbInfoBtn, { transform: [{ translateY: -6 }] }]}
        >
          <Info size={13} color="rgba(255,255,255,0.6)" strokeWidth={2.2} />
        </Pressable>
      )}
      <View style={[s.thumb, on && s.thumbSelected]}>
        {/* Operator, 5 okt 2026 (voorbeeldpagina VIBEZCORE-glas, Apple's
           Liquid Glass als referentie, geen rand): elk bolletje is een
           glazen schijf; bij selectie kleurt het glas licht in de eigen
           toestandskleur. Vervangt de halo's en de omlijning. */}
        <VibezGlass
          radius={THUMB / 2}
          tint={on ? t.accent : undefined}
          level={on ? 'raised' : 'subtle'}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={on ? thumbPulseStyle : undefined}>
          <StateGlyph
            stateKey={t.key}
            size={THUMB * 0.5}
            /* Operator, 24 september 2026, vervolg ("dimmen nog steeds niet
               echt merkbaar bij aantikken"): 0.32 → 0.22, nog duidelijker
               contrast met het actieve icoon.
               Operator, 2 okt 2026 ("niet heel wit maar grijs"): zelfde
               `#AEAEB2` als de rand hierboven, icoon en rand nu één
               consistente grijstint bij selectie. */
            color={on ? '#ffffff' : 'rgba(255,255,255,0.55)'}
            strokeWidth={1.8}
          />
        </Animated.View>
      </View>
      {/* Operator, 21 september 2026 ("tekst Sharp Focus... onder de
         knoppen en de lijn daaronder wit highlighten"): naam + lijntje
         droegen de statekleur (`accentTextFor(t.accent)`) bij selectie —
         nu gewoon wit, zelfde "kleur zit al op de cirkel/ring, niet
         nogmaals herhalen"-principe als elders in de app. */}
      <Text
        style={[
          s.thumbName,
          on
            ? { fontFamily: BrandFonts.semibold, color: '#ffffff' }
            : { fontFamily: BrandFonts.medium, color: 'rgba(255,255,255,0.45)' },
        ]}
        numberOfLines={2}
      >
        {sentenceCase(t.eyebrow)}
      </Text>
      {/* Operator, 24 september 2026 ("streep bij aanklikken moet ander"):
         het onderstreepje onder de naam van de geselecteerde staat weg —
         ring + schaalvergroting + wit-vs-gedimde tekst dragen de selectie
         al, dit was een vierde, overbodig signaal bovenop. */}
    </AnimatedPressable>
  );
}

function GoalButton({ onPress }: { onPress: () => void }) {
  /* Zelfde middellijn als de Premium-knop (PremiumPill: insets.top + 8,
     ~32 hoog) — op elk toestel, ongeacht de hoogte van de statusbalk
     (7 okt 2026: op de Samsung stond hij 13dp lager). 52 = eigen hoogte. */
  const insets = useSafeAreaInsets();
  const alignTop = insets.top + 8 + 16 - 26;
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  /* Operator, 2 okt 2026 ("hoe zou Apple dit doen?" — onderzocht: HIG
     raadt icoon+tekstlabel in een header-zone expliciet af, "crowds the
     header bar" — en max één extra control naast titel/terugknop.
     Tekstlabel ("Goal"/"Plan") weg, zelfde icoon-only behandeling als
     `histBtn` (het symmetrische geschiedenis-icoon links). Vervolg
     ("knop moet duidelijk wit"): zonder het label moet het icoon zelf nu
     het signaal dragen — 0.5 opaciteit (gedeeld met histBtn) was prima
     MET een label erbij, maar te vaag als enige aanwijzing. Nu 0.85. */
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={10}
      style={[s.goalBtn, { top: alignTop }, pressStyle]}
      accessibilityLabel="Your goal and daily plan"
    >
      {/* Altijd de kalender (operator, 7 okt 2026): het slot las als een
          winkelmandje en gaf de knop een andere betekenis. Dat het plan
          Premium is, ziet een gratis gebruiker in "Choose your path" zelf. */}
      <CalendarDays size={20} color="rgba(255,255,255,0.85)" strokeWidth={2} />
    </AnimatedPressable>
  );
}

export default function BreathScreen() {
  /* Operator, 26 september 2026 ("cta niet bereikbaar, mini-player staat
     erover op de welcome-pagina van breath"): nodig voor `introWrap`
     hieronder om ruimte te reserveren voor de mini-player. */
  const playerState = usePlayerState();
  /* De suggestie bepaalt waar de pagina op OPENT. Bewust geen extra balk of
     kaart erbij: het scherm ziet er precies hetzelfde uit, hij staat alleen
     al op de juiste deur. Dat is de rustigste vorm die een aanbeveling kan
     hebben — je hoeft hem niet weg te klikken als je iets anders wil, je
     veegt gewoon door.
     Eén keer bepaald bij het openen; hem laten meebewegen met de klok zou
     de pagina onder je handen laten verspringen. */
  const history = useBreathHistory();
  /* Voor de doel/dagplan-knop hieronder — zelfde "slimme bestemming"-logica
     als de "Your daily plan"-rij op Activity. */
  const { plan } = useActivePlan();
  /* Operator, 2 okt 2026: "Instant Reset" vaste knoptekst voor iedereen —
     overschrijft de eerdere free/Premium-wisseling (Try it now/Feel
     better now). Vervolg ("onduidelijk, beter Instant Sessions"): tekst
     herdoopt, zelfde vaste-tekst-voor-iedereen-principe. De onderliggende
     30s-preview-met-zachte-fade voor niet-Premium-gebruikers (zie
     breath-session.tsx, `instant=1` — teruggedraaid naar de standaard
     30s, zie daar) blijft ongewijzigd, enkel de knoptekst zelf wisselt
     niet meer mee. */

  const [index, setIndex] = useState(FALLBACK_INDEX);
  const [infoOpen, setInfoOpen] = useState(false);
  const insets = useSafeAreaInsets();

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

  /* Operator, 8 september 2026 ("wereldniveau"-kritiek): "de foto zou heel
     langzaam moeten in-zoomen (Ken Burns-effect) om diepte te creëren" —
     traag heen-en-weer tussen 1.0 en 1.06 (yoyo via `withRepeat(...,
     true)`), zodat de lus naadloos doorloopt zonder ooit terug te
     springen. 18 sec per richting is bewust traag — moet nauwelijks
     betrapt worden ALS beweging, enkel als "waarom voelt dit levend aan". */
  /* Operator, 8 september 2026: de pan-drift die hier stond ("dynamischer
     maken") duwde de gezichten soms deels uit beeld — op een scherm dat
     iemand maar een paar seconden ziet, moet meteen duidelijk zijn wat er
     staat; dat weegt zwaarder dan extra beweging. Terug naar enkel de
     zoom, in het bereik dat al goed stond vóór de pan erbij kwam. */
  const kenBurns = useSharedValue(1);
  useEffect(() => {
    kenBurns.value = withRepeat(
      withTiming(1.06, { duration: 18000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [kenBurns]);
  const kenBurnsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: kenBurns.value }],
  }));

  /* Operator, 8 september 2026: "de foto's zijn nu heel statisch, kunnen
     we daar iets aan doen?" — EERSTE poging (eigen `useAnimatedStyle` die
     `STATE_BG_CROP[st.key]` in de worklet opzocht) veroorzaakte een
     Reanimated-crash ("animated style op non-animated component" /
     "Should not already be working") zodra dit scherm geopend werd — de
     precieze oorzaak (vermoedelijk het dynamisch opzoeken van een object
     per key ÍN de worklet, i.p.v. een simpele shared-value-lezing) is niet
     verder uitgezocht; teruggedraaid naar stabiel. Dit blijft dus nog
     open — zie eerstvolgende, voorzichtigere poging. */

  /* Operator, 8 september 2026: "breathe/build/become om de beurt laten
     zien, telkens een reveal van een woord" — daarna: "moet smoother, een
     vlotte overgang, nu is het gewoon om de beurt." De eerste versie liet
     elk woord VOLLEDIG wegdoezelen vóór het volgende begon (harde
     estafette); nu start het volgende woord al terwijl het vorige nog
     bezig is met wegdoezelen — een echte overlappende crossfade (700ms
     overlap), plus een tikje schaal erbij naast opacity/optillen voor een
     rijker gevoel. TURN (tijd tussen de STARTS van opeenvolgende woorden)
     is korter dan de actieve duur van één woord — dát overlap is het hele
     verschil tussen "estafette" en "vloeiend". */
  /* Operator, 8 september 2026: een oneindig herhalende carrousel — steeds
     maar één woord zichtbaar, dan weer weg — is precies het patroon van een
     goedkope website-hero-slider en dát is waarom het "amateuristisch" oogt,
     los van hoe soepel de easing is. De techniek die high-end merken hier
     wél gebruiken (Apple/Stripe/Linear-stijl) is een STAGGERED ENTRANCE:
     de woorden komen één keer na elkaar op, met een korte vertraging
     ertussen, en BLIJVEN staan. Geen lus — zelfverzekerd i.p.v. onrustig,
     en goedkoper op batterij/GPU (geen animatie die voor altijd doorloopt). */
  const WORD_STAGGER_MS = 220;
  const WORD_RISE_MS = 620;
  const wordReveal = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  useEffect(() => {
    wordReveal.forEach((v, i) => {
      v.value = withDelay(
        300 + i * WORD_STAGGER_MS,
        withTiming(1, { duration: WORD_RISE_MS, easing: Easing.out(Easing.cubic) }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Drie losse `useAnimatedStyle`-aanroepen i.p.v. een helper-functie die
     de hook aanroept — hooks horen rechtstreeks in het component te staan,
     niet achter een gewone functie verstopt.
     Operator, 8 september 2026: "haperend" — `scale` erbij (naast opacity/
     translateY) was één GPU-bewerking te veel op dit toestel (budget-
     Android); weg, enkel opacity+translateY blijft over. Vloeiender op
     zwakkere hardware weegt hier zwaarder dan het extra tikkeltje "rijk".
     Nu geen lus meer (zie boven) dus dit is bovendien een eenmalige, niet
     een continue GPU-belasting. */
  const wordStyle1 = useAnimatedStyle(() => ({
    opacity: wordReveal[0].value,
    transform: [{ translateY: 10 * (1 - wordReveal[0].value) }],
  }));
  const wordStyle2 = useAnimatedStyle(() => ({
    opacity: wordReveal[1].value,
    transform: [{ translateY: 10 * (1 - wordReveal[1].value) }],
  }));
  const wordStyle3 = useAnimatedStyle(() => ({
    opacity: wordReveal[2].value,
    transform: [{ translateY: 10 * (1 - wordReveal[2].value) }],
  }));

  /* Operator, 8 september 2026 ("wereldniveau"-kritiek): "de knop mist
     vibe... een subtiele interne lichtgloed die over de letters beweegt,
     of reageert met een vering als je vinger hem nadert" — beide: een
     dunne lichtstrook die om de ~3 sec over de knop veegt (shimmer), plus
     een echte spring-schaal bij aanraken (niet enkel de Android-ripple). */
  const ctaScale = useSharedValue(1);
  const ctaPressStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));
  const shimmer = useSharedValue(-1);
  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 0 }),
        withDelay(2600, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })),
        withDelay(1200, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [shimmer]);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * CTA_SHIMMER_RANGE }, { rotate: '18deg' }],
  }));

  /* Eén uitzondering op "altijd eerst het beeld": je komt hier via een
     herinnering (operator, 7 augustus 2026). Dan heb je de vraag al gelezen op
     je vergrendelscherm en is een tweede drempel er één te veel — je komt
     meteen bij de vijf toestanden uit, staand op wat er voorgesteld wordt.
     Eenmalig: veeg je hem weg en kom je later terug, dan is het beeld er
     gewoon weer. */
  const entry = useLocalSearchParams<{ from?: string }>();
  const skipIntroRef = useRef(
    entry.from === 'reminder' || entry.from === 'shortcut',
  );
  /* Of deze tab nu gefocust is — zie het sessie-laag-effect hieronder. */
  const focusedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      /* Altijd terug naar CALM CONTROL bij een verse binnenkomst vanaf een
         andere pagina (operator, 13 augustus 2026: "mooie kleur en
         centraal") — geen gepersonaliseerde suggestie meer hier; die leeft
         nu in het protocol/agenda. `didPlace` resetten laat de pager, zodra
         hij (opnieuw) mount, via `onLayout` naar CALM scrollen; bestaat de
         pager al (het intro-scherm wordt overgeslagen), dan scrollt deze
         regel er meteen zelf heen. */
      didPlace.current = false;
      setIndex(FALLBACK_INDEX);
      pagerRef.current?.scrollTo({ x: FALLBACK_INDEX * SCREEN_W, animated: false });

      /* Terug uit een sessie: geen beeld. Zie utils/breath-entry.ts. */
      if (skipIntroRef.current || consumeBreathIntroSkip()) {
        skipIntroRef.current = false;
        setIntro(false);
        return;
      }
      setIntro(true);
      setIntroRun((n) => n + 1);
      focusedRef.current = true;
      return () => {
        focusedRef.current = false;
      };
    }, []),
  );

  /* Operator, 5 okt 2026 ("end session gaat naar welcome breathwork"): de
     ademsessie is een laag boven de app (services/breath-session-host.ts),
     geen navigatiescherm meer. Startte je ze vanaf deze tab zelf (bv. de
     Instant Sessions op het welkomstbeeld), dan blijft deze tab gefocust en
     draait het focus-effect hierboven bij het sluiten nooit opnieuw — de
     intro bleef dan gewoon staan. Daarom hier ook luisteren naar het sluiten
     van de laag. Niet gefocust (er staat nog een scherm boven, bv.
     breath-setup)? Dan laten we de vlag voor het focus-effect liggen. */
  useEffect(() => {
    let wasOpen = getBreathHost() !== null;
    return subscribeBreathHost(() => {
      const open = getBreathHost() !== null;
      if (wasOpen && !open && focusedRef.current && consumeBreathIntroSkip()) {
        setIntro(false);
      }
      wasOpen = open;
    });
  }, []);

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
  const accentText = accentTextFor(st.accent);

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
    /* "Maybe later" zet deze vlag vlak vóór de navigatie hierheen
       (operator, 11 augustus 2026: "maybe later gaat nu terug naar
       welcome breathwork"). Synchroon, geen AsyncStorage, dus geen race
       met de vlag hieronder mogelijk — wie hier met deze vlag aankomt mag
       nooit terug de intro in, punt uit. */
    if (consumeBreathOnboardingRedirectSkip()) return;
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

  /* Operator, 18 september 2026 ("het geselecteerde icoon moet niet
     statisch zijn, maar heel langzaam en subtiel groter/kleiner worden op
     het ritme van een rustige ademhaling" — Apple's SF Symbols
     `.breathe`-animatie): hergebruikt gewoon de al bestaande `breath`
     shared value hierboven (dezelfde 4.2s in-/uitademing die de grote
     illustratie ook al gebruikt) i.p.v. een tweede, eigen loop te
     starten — vanzelf al perfect gesynchroniseerd. */
  const thumbPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.08 }],
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
    if (__DEV__) console.log('[breath] CTA tapped at', Date.now());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    /* Operator, 7 september 2026: "mockup klopt" — CONTINUE gaat nu naar
       het nieuwe lichte setup-scherm (ritme + duur kiezen), niet meer
       rechtstreeks naar de donkere sessie. `claimFreeSessionParam()`
       verhuisde mee naar dat scherm se ECHTE "Start session"-tik — enkel
       browsen naar setup mag de ene gratis sessie nog niet verbruiken. */
    router.push({
      pathname: '/breath-setup',
      params: { state: st.key },
    });
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
    <SafeAreaView style={[s.root, s.rootLight]} edges={['top']}>
      {/* Operator, 6 september 2026: het intro-scherm (WELCOME + mandala)
         krijgt de lichte achtergrondfoto i.p.v. het sterrenveld.
         Operator, 7 september 2026: "dat wordt licht modus" — de rest van
         de tab (vijf-toestanden-carrousel) is nu OOK licht, dus het
         sterrenveld (bedoeld voor een zwarte achtergrond) verdwijnt
         volledig i.p.v. enkel tijdens intro uit te staan. */}
      {intro ? (
        <>
          {/* Operator, 8 september 2026: "laat de foto tot helemaal beneden
             en boven lopen" — volle-scherm i.p.v. een vast blok met een
             `top`-offset. Ken Burns-zoom blijft op de foto zelf zitten. */}
          <Animated.View style={[StyleSheet.absoluteFill, kenBurnsStyle]}>
            <Image
              source={{ uri: INTRO_BG_IMG }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </Animated.View>
          {/* Operator, 8 september 2026: "ook de zwarte banden weg" — de
             twee opaque vlakken (boven-dekkend, onder-dekkend) zijn weg.
             Wat overblijft is ÉÉN zachte, geleidelijke sluiervervaging
             onderaan (fotografische vignet, geen harde band) — enkel genoeg
             om de tekst/CTA erboven leesbaar te houden, de foto zelf loopt
             ongebroken door tot de randen. */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.55)', Brand.bg]}
            locations={[0.4, 0.78, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <>
          {/* Operator, 8 september 2026: per-foto bijstelling bovenop
             `cover` — niet elke foto staat van nature goed gekaderd.
             `scale` > 1 zoomt in, < 1 zoomt uit (kan dunne randen tonen,
             vangt de vignet-gradiënt hieronder grotendeels op); NEGATIEVE
             `translateY` toont het onderwerp hoger in het vaste kader
             (positief zou extra beeld boven het onderwerp tonen en het
             onderwerp zelf dus juist lager duwen — zie `STATE_BG_CROP`
             hierboven voor de om-de-tuin-geleide eerste poging). Eén
             object i.p.v. losse per-state checks, want dit groeit met
             elke foto-vraag.

             De continue "ademende" zoom bovenop deze kadrering (verzoek:
             "de foto's zijn heel statisch") is teruggedraaid — gaf een
             Reanimated-crash op dit scherm. Zie de toelichting bij
             `bgZoom` hierboven. */}
          <Image
            key={st.key}
            source={{ uri: assetUri(stateBgFor(st.key)) }}
            style={[
              StyleSheet.absoluteFill,
              /* `contain` (zie `calm`) laat boven/onder open — die krijgen
                 de pagina-achtergrondkleur i.p.v. zwart/transparant. */
              bgCropFor(st.key).mode === 'contain' && { backgroundColor: Brand.bg },
              {
                transform: [
                  { scale: bgCropFor(st.key).scale },
                  { translateX: bgCropFor(st.key).translateX ?? 0 },
                  { translateY: bgCropFor(st.key).translateY },
                ],
              },
            ]}
            resizeMode={bgCropFor(st.key).mode ?? 'cover'}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(10,10,10,0.15)', 'rgba(10,10,10,0.6)', Brand.bg]}
            locations={[0.3, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}

      {/* Alleen de naam van de toestand (operator, 4 augustus 2026).
          "CHOOSE YOUR MODE" en "Select your state" stonden hier als kop en
          onderkop, samen zo'n zestig punten hoog, en ze vertelden niets wat
          het scherm niet al laat zien: er staan vijf beelden en je veegt
          ertussen. Die hoogte gaat naar de illustratie, want daar kijk je
          naar. De naam staat nu bovenaan in plaats van eronder — dan weet je
          wat je ziet vóór je het ziet. */}
      {intro ? (
        <View
          style={[
            s.introWrap,
            playerState.session && { paddingBottom: 34 + MINI_PLAYER_HEIGHT + 12 },
          ]}
        >
          {/* Operator, 8 september 2026: "verwijder mandala... tekst breathe
             moet verschillende groottes en onder elkaar. al de rest welcome
             en voice weg" — `SlideIntro` (WELCOME-label, de morphende
             cirkel-figuur, de Voice/Haptics/Silent-rij) is hier volledig
             weg; dit scherm heeft nu enkel nog de foto, deze drie regels en
             de knop. De ECHTE onboarding-aanroep van `SlideIntro` elders in
             breath-welcome.tsx blijft volledig ongemoeid — dit component
             wordt daar nog steeds op precies dezelfde manier gebruikt. */}
          <View style={s.stackTitle}>
            <Animated.Text style={[s.stackWord1, wordStyle1]}>Breathe</Animated.Text>
            <Animated.Text style={[s.stackWord2, wordStyle2]}>Build</Animated.Text>
            <Animated.Text style={[s.stackWord3, wordStyle3]}>Become</Animated.Text>
          </View>
          {/* Operator, 22 september 2026 ("control the input... op
             breathwork welcome scherm onderaan in de app?"): dezelfde
             tagline als onboarding's `SlideIntro` (breath-welcome.tsx) —
             dat scherm had 'm al, deze (losse, gedupliceerde) versie hier
             nog niet, wat onnodig kaler aanvoelde voor exact hetzelfde
             merkbeeld. */}
          <Text style={s.introSub}>Control the input. Change the output</Text>
          {/* Operator, 24 september 2026 ("cta op welcome scherm van alle
             3 [Breath/Bracelet/Library] moet zelfde kleur, animatie en
             breedte hebben — vindt de witte mooier"): deze knop was op 19
             september omgezet naar donker matglas (zie de oude toelichting
             hieronder, nu verwijderd) en week daarmee af van de witte
             `introCta`-knop op (tabs)/index.tsx ("Explore Audio Library")
             en (tabs)/bracelet.tsx ("Explore Bracelet"). Terug naar wit/
             donkere tekst, EN content-brede pil i.p.v. volle breedte —
             exact dezelfde afmetingen/kleuren/animatie als die twee. */}
          <Animated.View style={[{ marginTop: 28, alignSelf: 'stretch' }, ctaPressStyle]}>
            <Pressable
              onPress={() => setIntro(false)}
              onPressIn={() => {
                ctaScale.value = withTiming(0.96, { duration: 80 });
              }}
              onPressOut={() => {
                ctaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
              }}
              style={s.introCtaMatch}
              android_ripple={{ color: 'rgba(0,0,0,0.12)' }}
            >
              <Text style={[s.ctaTxt, { color: '#1D1D1F' }]}>
                Explore modes
              </Text>
              <Animated.View style={[s.ctaShimmer, shimmerStyle]} pointerEvents="none">
                <LinearGradient
                  colors={['#ffffff00', '#ffffff9a', '#ffffff00']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </Pressable>
          </Animated.View>

          {/* Operator, 2 okt 2026 ("de knop moet op de pagina komen die
             gebruiker ziet bij openen app... hij moet niet verder naar
             andere pagina"): de instant-ingang staat hier, op de intro-
             overlay zelf — het eerste scherm van deze tab, geen navigatie
             nodig om 'm te bereiken. Vervangt de oude "How do you want to
             feel?"-swipe-deur volledig (feel-now.tsx is herbouwd rond
             "How do you feel?" — huidige toestand, niet doel-toestand).
             Prominente, transparante ghost-pil direct onder de hoofd-CTA
             (pasted Apple-referentie: "straalt uit dat je met één tik uit
             de waan van de dag kan stappen"). Vaste tekst "Instant
             Sessions" voor iedereen (vervolg, "Instant Reset" →
             "onduidelijk, beter Instant Sessions") — zie de toelichting
             bij `protocolLocked` hierboven voor waarom dit NIET meer
             free/Premium wisselt. De onderliggende 30s-preview-met-
             zachte-fade voor niet-Premium-gebruikers (`instant=1`, zie
             breath-session.tsx) blijft wel bestaan, enkel de knoptekst
             zelf wisselt niet meer mee. */}
          <Pressable
            onPress={() => router.push('/feel-now' as never)}
            hitSlop={8}
            style={({ pressed }) => [s.feelNowLink, pressed && { opacity: 0.85 }]}
          >
            {/* VIBEZCORE-glas i.p.v. de witte omlijning (5 okt 2026). */}
            <VibezGlass radius={14} style={StyleSheet.absoluteFill} />
            <Text style={s.feelNowLinkTxt}>Instant Sessions</Text>
          </Pressable>
        </View>
      ) : (
        <>
      {/* Operator, 6 okt 2026: de "Your practice"-knop linksboven is weg —
          de Activity-tab opent dezelfde historiek (Apple: elk tabblad één
          taak, linksboven is de plek voor "terug"). */}

      {/* Operator, 11 september 2026: "set your goal en daily plan een
         eigen plaats geven, ook in de breath-tab" — stonden tot nu toe
         enkel als rijen op Activity. Zelfde symmetrische plek als de
         historiek-knop hierboven (links), nu rechts: één icoon, dezelfde
         "slimme bestemming" als de "Your daily plan"-rij op Activity
         (bestaat er al een protocol, dan rechtstreeks naar de agenda;
         anders eerst naar de doel-keuze) — geen twee aparte knoppen nodig
         voor wat in de kern één doorlopende flow is. */}
      {/* Operator, 11 september 2026 (2e ronde): "zichtbaar maar
         nietszeggend" — terecht, een los kruisje-icoon zegt niemand iets
         (anders dan het grafiek-icoon links, dat tenminste conventioneel
         "statistieken" uitstraalt). Tekstlabel eronder erbij, zelfde
         patroon als een tabblad-icoon met caption. */}
      <GoalButton
        onPress={() => router.push((plan ? '/agenda' : '/build-choice') as never)}
      />

      {/* Operator, 8 september 2026 (3e ronde): "waar moet die header dan
         staan? nu is dat gewoon platte tekst ergens" — terecht: de kop zat
         BINNEN het gecentreerde `body`-blok (foto/thumbs/cta), dus zijn
         positie was toeval — bij Boost viel hij letterlijk op het gezicht
         van het model. Nu een vaste plek los van die groep: direct onder
         de instellingen-/historiek-iconen, met een eigen sluier ERACHTER
         (niet de vage vignet van de foto zelf, die dekt bovenaan bewust
         bijna niets af) plus een tekstschaduw — zo blijft de kop leesbaar
         ongeacht welke van de vijf foto's eronder staat. */}
      {/* Operator, 8 september 2026 (5e ronde): "step 1 of 2 verwijderen en
         choose your state in grijs kleine hoofdletters boven de cirkels
         zetten centreel" — de vaste kop bovenaan (met sluier/schaduw/
         stapindicator) is helemaal weg; "Choose your state" verhuist naar
         vlak boven de rij van vijf, zie daar. */}

      {/* Alles staat als ÉÉN blok gecentreerd in wat er
          overblijft. Stond de praktijkregel onderaan vastgeprikt, dan viel
          er tussen de rij van vijf en die regel een leeg vlak van een derde
          scherm — en een keuzepagina die halfleeg staat leest als een pagina
          waar nog iets bij moet. */}
      <View style={s.body}>
      {/* ── Onzichtbare veeglaag ── Operator, 8 september 2026 (mockup 1):
          de grote afgeronde foto-kaart die hier stond is weg — de
          achtergrondfoto draagt het beeld nu, en de mockup toont hier geen
          los kaartje meer. De swipe-pager zelf blijft: vegen om van
          toestand te wisselen werkt nog exact zoals voorheen, enkel zonder
          zichtbare inhoud — hij is nu een onzichtbare gebaar-laag boven de
          achtergrond. */}
      <View style={s.stage}>
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
              x: FALLBACK_INDEX * SCREEN_W,
              animated: false,
            });
            setIndex(FALLBACK_INDEX);
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

        {/* Operator, 7 september 2026: "pijltjes rechts en links van de
           grote fotos wegdoen" — swipen op de pager (hierboven) blijft de
           manier om te wisselen, net als de rij van vijf onderaan. */}
      </View>

      {/* ── Wat deze toestand is ─────────────────────────────────────────
           "Coherent 5-5" of "Resonant 6-6" zegt niets tegen wie de term niet
           kent, en dat is vrijwel iedereen (operator, 4 augustus 2026). Hier
           staat per toestand wat hij doet én wat elk van zijn ritmes is, in
           één zin per stuk. Niet op het scherm zelf: wie het al weet hoeft
           het niet elke keer te lezen. */}
      {/* Operator, 2 okt 2026 ("ook hier de popup aanpassen van onder en
         done, achtergrond dimmen"): zelfde ombouw als feel-now.tsx en
         breath-setup.tsx se duur-infosheet — was een gecentreerde
         fade-kaart met "Got it" onderaan, nu een vanonder opschuivend vel
         (`animationType="slide"`) met gedimde backdrop, tikbare grip, en
         "Done" rechtsboven i.p.v. een losse knop onderaan. */}
      <Modal
        visible={infoOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoOpen(false)}
      >
        <Pressable style={s.infoBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable
            style={[s.infoCard, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}
            onPress={() => {}}
          >
            {/* Operator, 5 okt 2026 (Apple-referentie): het paneel is van
                VIBEZCORE-glas — de foto schemert zacht door. */}
            <VibezGlass
              radius={24}
              level="sheet"
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <Pressable
              onPress={() => setInfoOpen(false)}
              hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }}
            >
              <View style={s.infoGrip} />
            </Pressable>
            <View style={s.infoHeader}>
              <View style={s.infoHeaderLeft}>
                {/* Zelfde glazen toestandsicoon als in "Set your plan". */}
                <View style={s.infoStateBadge}>
                  <VibezGlass radius={18} tint={st.accent} level="raised" style={StyleSheet.absoluteFill} />
                  <StateGlyph stateKey={st.key} size={18} color="#ffffff" strokeWidth={1.9} />
                </View>
                {/* Wit i.p.v. de toestandskleur (operator, 5 okt 2026: "anders
                    te veel kleur") — de kleur zit al in het icoon. */}
                <Text style={[s.infoEyebrow, { color: '#ffffff' }]}>
                  {sentenceCase(st.eyebrow)}
                </Text>
              </View>
              <Pressable onPress={() => setInfoOpen(false)} hitSlop={10}>
                <Text style={[s.infoDoneTxt, { color: '#ffffff' }]}>Done</Text>
              </Pressable>
            </View>
            {/* Operator, 10 september 2026: "moet tonen wat de ademtechniek
               doet en varieert van de andere 2... niet als je niet verder
               kan lezen" — daarna expliciet: "popup scrollbaar niet, gewoon
               zo kort mogelijk en duidelijk beschreven". Geen ScrollView
               dus — de inhoud moet vanzelf passen. Het cijferpatroon
               ("4-4") hoort hier niet — dat is iets om MEE TE STELLEN, niet
               om een STAAT op te kiezen; staat nu op het duur+techniek-
               scherm (breath-setup.tsx). In de plaats het NIVEAU (Beginner/
               Intermediate/Advanced): zegt net wél hoe de 3 van elkaar
               verschillen — oplopende complexiteit, niet enkel andere
               cijfers. Naam en hook zonder `numberOfLines`-afkap: de hook
               is al kort (eerste zin na de streep uit `explain`), dus dat
               past zonder scroll. */}
            <Text style={s.infoTitle}>{st.title}</Text>
            <Text style={s.infoBody}>{st.description}</Text>

            <Text style={[s.infoSection, { color: 'rgba(255,255,255,0.55)' }]}>
              RHYTHMS
            </Text>
            {st.techniques.map((t) => {
              const Icon = techniqueIcon(t.key);
              return (
                /* Elk ritme in een eigen glaskaart; het niveau als zachte
                   capsule in de toestandskleur met witte tekst (geen eigen
                   kleur per niveau — dat zou botsen met de 5 toestands-
                   kleuren). */
                <View key={t.key} style={s.infoTechRow}>
                  <VibezGlass radius={16} level="subtle" style={StyleSheet.absoluteFill} />
                  <View style={[s.infoTechIcon, { backgroundColor: `${st.accent}22` }]}>
                    <Icon size={16} color={accentText} strokeWidth={2.2} />
                  </View>
                  <View style={s.infoTechCopy}>
                    <View style={s.infoTechTop}>
                      <Text style={s.infoTechName}>{t.name}</Text>
                      <View style={[s.infoTechLevelPill, { backgroundColor: `${st.accent}38` }]}>
                        <Text style={s.infoTechLevel}>{t.level}</Text>
                      </View>
                    </View>
                    <Text style={s.infoTechHook}>{t.effect}</Text>
                  </View>
                </View>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Operator, 2 okt 2026 ("choose your state boven de i knop moet
         weg"): botste met de nieuwe "i"-knop die nu boven de
         geselecteerde cirkel zweeft (`thumbInfoBtn`, top:-24) — te dicht
         op elkaar. Label weg, de cirkels + namen eronder zijn zelf al
         duidelijk genoeg wat ze zijn, geen aparte kop meer nodig. */}

      {/* ── De vijf, altijd zichtbaar ──
          Op volle kleur, niet weggedimd. Ze zijn hier geen knopjes maar de
          vijf beelden zelf; wat de keuze aanwijst is de ring en de naam
          eronder, niet dat de andere vier uitgaan.

          Operator, 11 september 2026: geprobeerd om hier een EIGEN,
          tweede gradient achter de cirkels te zetten — bovenop het al
          bestaande volledig-scherm vignet (regel ~626-631). Twee
          overlappende verlopen met een andere curve gaven precies waar
          ze uit elkaar liepen een zichtbare naad/rand ("het wordt weer
          gepruts, de rand is zichtbaarder geworden"). Volledig
          teruggedraaid — het ene bestaande vignet regelt dit al, geen
          tweede laag meer nodig. */}
      <View style={s.thumbs}>
        {ORDER.map((k, i) => (
          <StateThumb
            key={k}
            k={k}
            t={BREATH_STATES[k]}
            on={i === index}
            onPress={() => goTo(i)}
            onInfoPress={() => setInfoOpen(true)}
            thumbPulseStyle={thumbPulseStyle}
          />
        ))}
      </View>

      {/* ── De knop, nu ÉÉN vaste kleur — 3e ronde, operator 8 september
          2026: "wat is beter om 1 kleur voor alle knoppen?" Terecht — de
          achtergrondfoto én de ring om de geselecteerde miniatuur dragen de
          statekleur al; de knop diezelfde kleur nogmaals geven was drie
          keer hetzelfde signaal. Wit, zelfde knop-chrome als het
          welkomstscherm — één herkenbare primaire-actie-stijl door de app
          heen i.p.v. per scherm anders. */}
      {/* Operator, 8 september 2026: "we hadden ook een animatie voor de cta
         voorzien?" — klopt, dit was de voorgestelde app-brede standaard
         (spring-press bij indrukken, zoals op het welkomstscherm) die nog
         niet overal stond. Hier nu toegepast — `fadeStyle` (bestaand,
         faseert in/uit bij statewissel) en `ctaPressStyle` (nieuw, spring
         bij indrukken) samen in ÉÉN array op ÉÉN Animated.View, niet
         genest — twee losse geneste Animated.View's bleken op dit
         Reanimated-versie een "animated style op non-animated component"
         crash te geven zodra beide tegelijk actief waren. */}
      {/* Operator, 21 september 2026 ("cta continue knop transparant blur
         maar zachtjes de kleur van de state"): was vlak wit (operator, 8
         september 2026, "1 kleur voor alle knoppen" — dat bleef zo lang
         de knop zelf geen kleur droeg). Nu matglas i.p.v. massief wit,
         met `st.accent` als zachte tint — zelfde `dimezisBlurViewSdk31Plus`-
         recept als de rest van de app, tekst wit voor contrast op de
         donkere blur i.p.v. het vorige zwart-op-wit. */}
      <Animated.View style={[fadeStyle, ctaPressStyle]}>
        <Pressable
          onPress={open}
          onPressIn={() => {
            ctaScale.value = withTiming(0.96, { duration: 80 });
          }}
          onPressOut={() => {
            ctaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
          }}
          style={[s.cta, { overflow: 'hidden', backgroundColor: '#ffffff' }]}
          android_ripple={{ color: 'rgba(10,10,12,0.08)' }}
        >
          {/* Operator, 25 september 2026 ("groen van de choose cta niet
             mooi/modern, kleur per state of 1 vaste kleur?"): was
             blur + `st.accent`-tint — een knop die van kleur wisselt per
             staat (paars/blauw/groen/...) is precies wat Apple vermijdt
             voor een primaire actie; die blijft app-breed één herkenbare
             kleur. Nu de vaste witte CTA-chrome, zelfde protocol als
             overal elders vandaag al doorgevoerd (paywall, onboarding,
             Audio & Haptics). */}
          {/* Operator, 24 september 2026 (pasted Apple-referentie,
             "Information Foraging Theory": een statische "Continue" laat
             de gebruiker gissen wat er verandert; tekst die meebeweegt met
             de gekozen staat kost geen actie-onzekerheid meer): dynamisch
             i.p.v. vast "Continue". */}
          <Text style={[s.ctaTxt, { color: '#1D1D1F' }]}>
            Set {sentenceCase(st.eyebrow)} Session
          </Text>
        </Pressable>
      </Animated.View>

      {/* Operator, 2 okt 2026, vervolg ("terug uit een sessie land je hier
         zonder pad naar het intro-scherm, verwarrend"): i.p.v. een pad
         terug naar de intro-overlay te herstellen (die skip-na-sessie-
         logica is zelf ook bewust zo gebouwd — zie breath-entry.ts),
         staat de instant-ingang nu OOK hier, zelfde plek/stijl als op de
         intro-overlay. Overal beschikbaar i.p.v. navigatie-acrobatiek om
         er te raken — zo zou Apple dit oplossen. */}
      <Pressable
        onPress={() => router.push('/feel-now' as never)}
        hitSlop={8}
        style={({ pressed }) => [s.feelNowLink, pressed && { opacity: 0.85 }]}
      >
        {/* VIBEZCORE-glas i.p.v. de witte omlijning (5 okt 2026). */}
        <VibezGlass radius={14} style={StyleSheet.absoluteFill} />
        <Text style={s.feelNowLinkTxt}>Instant Sessions</Text>
      </Pressable>

      {/* Operator, 8 september 2026 (2e ronde): "verwijder more than
         breathwork" — sluitregel weer weg. */}

      {/* Operator, 7 september 2026: "staat te laag nu, plakt tegen balk
         onderaan" — dit scherm gebruikt bewust `edges={['top']}` (geen
         automatische safe-area onderaan). */}
      <View style={{ height: 24 }} />

      </View>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  /* Operator, 6 september 2026: intro-scherm licht i.p.v. donker — de
     achtergrondfoto zelf dekt bijna alles af, maar de rand/statusbalk-zone
     erboven moet ook al licht zijn, niet even opflitsen zwart. */
  /* Operator, 8 september 2026: "we gaan terug naar dark mode" — Fase 1 van
     de strategie ("Depth over breadth"). Naam `rootLight` blijft staan
     (minder-invasieve diff dan overal hernoemen); de waarde is nu donker. */
  rootLight: { backgroundColor: Brand.bg },

  /* De zijmarge is niet cosmetisch: rechtsboven zweeft het instellingen-
     icoon van de app over élk scherm heen, en zonder deze marge liep de
     laatste letter van de kop eronder door. */
  header: { alignItems: 'center', marginTop: 6, paddingHorizontal: 30 },
  /* Operator, 19 september 2026 ("matglas i.p.v. massief wit, zodat de
     foto de ruimte krijgt"): keert de "moet wit zijn"-beslissing van 7
     september bewust om — zelfde bewezen rgba-glasreceptuur als elders
     in de app (geen `expo-blur`/BlurView, die werkt pas na een native
     rebuild). */
  /* Operator, 24 september 2026: zelfde kleuren/animatie als
     (tabs)/index.tsx se `introCta` en (tabs)/bracelet.tsx se `introCta`
     ("Explore Audio Library"/"Explore Bracelet"). Vervolg, zelfde dag
     ("ctas moeten langer, Apple gebruikt een vaste zijmarge voor een
     primaire hero-cta i.p.v. een content-brede pil"): `paddingHorizontal`
     → `marginHorizontal`, de knop rekt nu uit tot een vaste zijmarge i.p.v.
     rond de tekst te plooien — zelfde wijziging in de andere twee
     bestanden. Eigen naam (niet hernoemd naar `introCta`) om niet per
     ongeluk de bestaande `s.cta`-gebruikers in dit bestand (elders, andere
     schermtoestand) te raken. */
  introCtaMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    marginHorizontal: 26,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D2D2D7',
    overflow: 'hidden',
  },
  /* Operator, 8 september 2026: "foto tot boven en beneden laten lopen" —
     nu de foto het hele scherm vult i.p.v. enkel het bovenste stuk, hoort
     de tekst+knop onderaan te zitten (over het zachte vignet), niet meer
     verticaal gecentreerd over het midden van de foto heen. */
  /* Operator, 8 september 2026: "zet breathe build become in midden" —
     terug van links (7-september-keuze, "sluit aan bij het natuurlijke
     gewicht van de foto") naar gecentreerd. De CTA eronder had al zijn
     eigen `alignSelf:'center'`, dus die verandert hier niet mee. */
  /* Operator, 24 september 2026 ("moet de plaatsing exact zelfde zijn?"):
     `paddingBottom` stond hier op 40, terwijl `(tabs)/index.tsx` se
     `introTextWrap` en `(tabs)/bracelet.tsx` se `introTextWrap` (zelfde
     rol, andere naam) allebei op 34 stonden — geen vastgelegde reden voor
     het verschil gevonden. Gelijkgetrokken naar 34 zodat de CTA op alle 3
     exact even ver van de onderrand staat. */
  introWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 26,
    paddingBottom: 34,
  },
  /* Operator, 8 september 2026 — 3e ronde: "Breathe/Build gelijk, Become
     super groot" oogde als een fout i.p.v. een keuze — de sprong tussen
     laag 2 en 3 was te groot/plotseling. Nu een gegradueerde 3-traps
     hiërarchie (geen 2 gelijk + 1 uitschieter): elke regel iets groter
     én iets zwaarder én iets witter dan de vorige — een opbouw die
     bedoeld aanvoelt, met strakke tracking op alle drie. */
  /* Operator, 11 september 2026: "zetten we breathe build become in het
     midden of beter links?" — links geprobeerd, operator koos alsnog voor
     gecentreerd. Terug naar `center`. */
  stackTitle: { alignItems: 'center' },
  /* Tagline onder "Breathe Build Become" — zelfde stijl als onboarding's
     `introSubLight` (breath-welcome.tsx). */
  introSub: {
    marginTop: 4,
    width: SCREEN_W - 64,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.65)',
    fontFamily: BrandFonts.regular,
    fontSize: 16,
  },
  stackWord1: {
    fontFamily: BrandFonts.medium,
    fontSize: 28,
    letterSpacing: -0.2,
    lineHeight: 32,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
  },
  /* Operator, 11 september 2026: "Build moet visueel breder zijn dan
     Breathe en smaller dan Become" — bij 38px lag "Build" (5 letters) qua
     GERENDERDE BREEDTE zo goed als gelijk met "Breathe" (7 letters, maar
     kleiner lettertype): het kortere woord haalde de brede het bijna
     helemaal in.
     Operator (3e correctie, definitief): na `semibold` op meerdere
     formaten geprobeerd te hebben bleef het "te bold" ogen — ook al is
     600 letterlijk het gewicht tussen Breathe (500) en Become (700).
     Terug naar `medium`, ZELFDE gewicht als Breathe: de breedte-volgorde
     (Breathe < Build < Become) komt nu volledig uit fontSize (48px) en
     letterSpacing, niet uit een zwaarder lettergewicht. */
  stackWord2: {
    fontFamily: BrandFonts.medium,
    fontSize: 48,
    letterSpacing: 0,
    lineHeight: 52,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 2,
  },
  stackWord3: {
    fontFamily: BrandFonts.bold,
    fontSize: 50,
    letterSpacing: -1.2,
    lineHeight: 52,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 2,
  },
  histBtn: {
    position: 'absolute',
    left: 10,
    top: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  /* Symmetrisch met `histBtn`, rechts i.p.v. links. Operator, 11 september
     2026: "1 cm lager" — ~40dp extra t.o.v. `histBtn`, niet meer op
     dezelfde hoogte. Breder + hoger dan `histBtn` sinds het tekstlabel
     erbij kwam ("zichtbaar maar nietszeggend"). */
  /* Operator, 24 september 2026 (pasted Apple-referentie): "How it
     works"-tekstlink onder de CTA verhuisd naar een klein info-icoontje in
     een hoek. Letterlijk rechtsboven zat al vol (systeem-instellingen-
     icoon + `goalBtn` hieronder) — linksboven, onder `histBtn`, is de
     eerstvolgende vrije hoek en behoudt dezelfde bedoeling: een rustig
     hoekicoontje, niet meer een tekstlink die de aandacht van de CTA
     wegtrekt. */
  /* Operator, 2 okt 2026 ("i-knop moet bij de knop zelf staan, nu niet
     duidelijk wat dat is"): was `position:absolute, left:10, top:56` —
     helemaal in de linkerbovenhoek, los van de CTA die hij uitlegt. Nu
     gewoon een sibling IN `ctaRow` naast de CTA (zie JSX), zelfde
     `iconBtn`-chrome (cirkel, dunne rand) als andere icoon-knoppen
     elders in de app, zodat 'ie leest als "bij deze knop hoort uitleg"
     i.p.v. een losstaand element. */
  howItWorksBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Operator, 2 okt 2026, vervolg ("groter/kleiner/even groot als Explore
     modes?"): kleiner EN smaller dan de hoofd-CTA (die blijft 50px/volle
     breedte) — een gecentreerde pil i.p.v. edge-to-edge, zodat dit
     duidelijk de secundaire actie blijft, geen gelijkwaardig alternatief. */
  /* Operator, 2 okt 2026 ("klopt de vorm t.o.v. de cta erboven?"): radius
     19 (= helft van de hoogte) was een volledige pil-vorm — een andere
     vorm-taal dan de hoofd-CTA, die app-breed vast op `borderRadius:14`
     staat (zie `cta` hierboven). Apple onderscheidt primair/secundair via
     vulling en gewicht, nooit via een andere hoekvorm — nu gelijkgetrokken. */
  /* Operator, 2 okt 2026 ("instant sessions even groot maken als explore
     modes en set calm control..."): was een kleinere pil (38px, auto-
     breedte) — nu dezelfde maat als de hoofd-CTA's (`introCtaMatch`/
     `cta`: 50px hoog, volle breedte via `marginHorizontal:26`). Blijft
     wel de ghost-stijl (transparant, enkel een rand) — enkel de
     AFMETING matcht, niet de vulling, zodat het duidelijk de secundaire
     actie blijft. */
  feelNowLink: {
    marginTop: 14,
    height: 50,
    marginHorizontal: 26,
    alignSelf: 'stretch',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feelNowLinkTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    letterSpacing: 0.1,
    color: '#ffffff',
  },
  goalBtn: {
    position: 'absolute',
    right: 10,
    top: 48,
    width: 52,
    height: 52,
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

  body: { flex: 1, justifyContent: 'center' },

  /* Operator, 8 september 2026: "cirkels en cta moeten zakken" — extra
     hoogte op deze (onzichtbare) tussenlaag duwt alles eronder (rij van
     vijf + knop) verder omlaag, zonder de kop erboven te raken. */
  stage: {
    width: SCREEN_W,
    /* "nog 1cm" (2e ronde) bovenop de eerdere +70 — 63dp erbij ≈ 1cm op dit
       toestel.
       Operator, 11 september 2026 (3e ronde): "nu de cta en de cirkels
       laten zakken" — nog eens ~1cm erbij (63dp, zelfde maat als de 2e
       ronde hierboven). */
    height: BOX_H + 196,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Operator, 7 september 2026 (productkritiek): "sterke headline...
     Train your state. Structured breathwork for calm, focus, energy and
     recovery." Eén productstatement per scherm, niet per toestand — staat
     daarom BOVEN de foto, los van `copy` (dat blijft per-toestand). */
  /* Operator, 7 september 2026: "mandala toevoegen op achtergrond
     header/subheader" — `minHeight`+`overflow:hidden` begrenst de mandala
     tot dit blok, exact hetzelfde patroon als breath-welcome.tsx (zonder
     die begrenzing centreert de mandala zich op de HELE pagina i.p.v.
     achter de kop — bekende bug uit die flow). */
  spec: {
    marginTop: 12,
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.36)',
    textAlign: 'center',
  },
  /* De vraag eronder, een tikje stiller: hij hoort bij de regel erboven en
     mag die niet overstemmen. */
  /* Operator, 11 september 2026: exacte specificatie — 14px (was 12px). */
  specAsk: {
    marginTop: 6,
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    letterSpacing: 0.1,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },

  /* ── De uitleg-popup ── Operator, 2 okt 2026 ("popup aanpassen van
     onder en done, achtergrond dimmen"): van gecentreerde fade-kaart naar
     vanonder-opschuivend vel — zelfde patroon als feel-now.tsx/
     breath-setup.tsx se duur-infosheet. */
  infoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'flex-end',
  },
  infoCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  infoGrip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 10,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoStateBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoDoneTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
  },
  /* Operator, 7 september 2026 (typografie-feedback): "vrij veel bold —
     high-end interfaces gebruiken contrast tussen regular/medium/semibold
     i.p.v. alles zwaar te maken." Extrabold → bold, minder letter-spacing
     op de eyebrow. */
  infoEyebrow: { fontFamily: BrandFonts.semibold, fontSize: 11, letterSpacing: 1.5 },
  infoTitle: {
    marginTop: 16,
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: '#ffffff',
  },
  infoBody: {
    marginTop: 10,
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.6)',
  },
  infoSection: {
    marginTop: 28,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    letterSpacing: 0,
  },
  /* Meer ademruimte (operator, 5 okt 2026: "kaarten te dicht opeen"). */
  infoTechRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
  infoTechIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTechCopy: { flex: 1 },
  infoTechTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoTechName: {
    flexShrink: 1,
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    color: '#ffffff',
  },
  /* Vaste breedte: Beginner, Intermediate en Advanced even groot
     (operator, 5 okt 2026) — breed genoeg voor "Intermediate". */
  infoTechLevelPill: {
    width: 92,
    alignItems: 'center',
    paddingVertical: 3,
    borderRadius: 999,
  },
  infoTechLevel: {
    fontFamily: BrandFonts.semibold,
    fontSize: 10.5,
    letterSpacing: 0.3,
    color: '#ffffff',
  },
  infoTechHook: {
    marginTop: 5,
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.5)',
  },

  /* Operator, 11 september 2026: "cta hier is beetje klein, is dat
     professioneel en zou apple dat zo doen?" — nee: dit was een
     content-brede pil (`alignSelf:'center'` + `paddingHorizontal:30`),
     terwijl `breath-setup.tsx`'s eigen CTA al edge-to-edge breed staat
     (geen `alignSelf`, dus stretcht vol). Apple's HIG-patroon voor de ENE
     primaire actie op een scherm is precies dat: breed en prominent, geen
     kleine pil. `marginHorizontal` i.p.v. `alignSelf:'center'` zodat hij
     nu ook stretcht — zelfde breedte-taal als het setup-scherm. */
  /* Operator, 2 okt 2026 ("i bij de cta" → vervolg "cta moet gecentreerd
     blijven, zet de i boven de state-cirkel"): de rij-variant (CTA +
     info-knop naast elkaar) is terug uitgedraaid — de "i" hoort nu bij
     de staat-cirkel, niet bij de CTA. `cta` weer de oorspronkelijke,
     volle-breedte/gecentreerde marges. */
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 26,
    marginTop: 34,
    height: 50,
    /* Operator, zelfde dag: "vorm van de cta is anders dan onboarding, is
       dat professioneel?" — was een volle pil (25 = height/2), onboarding
       gebruikt overal `borderRadius:14`. Zelfde vorm nu, app-breed één
       herkenbare primaire-knop-chrome i.p.v. twee verschillende. */
    borderRadius: 14,
  },
  /* Operator, 7 september 2026 (typografie-feedback): "letter-spacing in
     de CTA is wat overdreven" — 2.2 → 0.8. Semibold bleef al staan (matcht
     de aanbevolen CTA-hiërarchie: Medium/Semibold + beperkte spacing). */
  /* Operator, 7 september 2026 (productkritiek): "letter-spacing voelt als
     een marketingwebsite-knop, sterk verminderen." */
  /* Operator, 11 september 2026: exacte specificatie — 16px (was 14px). */
  ctaTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    letterSpacing: 0.1,
  },
  /* Operator, 8 september 2026 (mockup 1): "How it works" verhuisde van
     naast de statenaam naar hier, direct onder de CTA — `alignSelf` nodig
     want de omringende `Animated.View` stretcht niet vanzelf. */
  specAskWrap: { alignSelf: 'center', marginTop: 10, padding: 4 },
  /* Sluitregel onderaan, uit dezelfde mockup — bewust stil, geen actie. */
  /* Operator, 8 september 2026: smalle, gedraaide lichtstrook die om de
     ~3 sec over de knop veegt — vast op de knop-hoogte, breder dan hoog
     zodat de rotatie 'm niet buiten de randen laat pieken. */
  ctaShimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 46,
  },

  /* Operator, 7 september 2026: "kaarten moeten iets hoger, zodat het
     aansluit bij subheader" — 22 → 12. */
  thumbs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: THUMB_GAP,
    marginTop: 12,
    alignItems: 'flex-start',
  },
  thumbCol: { width: THUMB_COL, alignItems: 'center' },
  /* Boven de cirkel, gecentreerd binnen de kolom — `thumbCol` is al
     `alignItems:'center'`, dus `width:'100%'` + `alignItems:'center'`
     hier volstaat om de knop te centreren zonder de cirkel se eigen
     breedte te hoeven kennen. */
  thumbInfoBtn: {
    position: 'absolute',
    top: -24,
    width: '100%',
    alignItems: 'center',
    paddingVertical: 4,
    zIndex: 2,
  },
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
  /* Operator, 2 okt 2026 ("cirkel naar boven laten gaan, samen met de i"):
     translateY toegevoegd naast de bestaande schaal — zelfde -6 als de
     "i"-knop hierboven (`thumbInfoBtn`'s inline transform), zodat beide
     als één geheel omhoog schuiven bij selectie. */
  thumbSelected: { transform: [{ scale: 1.1 }, { translateY: -6 }] },
  /* Operator, 18 september 2026 ("geen kleur, cirkels hebben omlijning"):
     dunne cirkelrand i.p.v. een gevulde schijf ÉN i.p.v. de vorige, apart
     uitvergrote `thumbRing` — doorzichtig middenvlak, enkel de rand
     verandert (dikte + kleur) bij selectie. */
  thumbOutline: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
  halo: { position: 'absolute', borderRadius: THUMB },
  haloInner: { width: THUMB * 0.7, height: THUMB * 0.7 },
  /* Vaste hoogte van twee regels, ook voor de namen die er één nodig hebben.
     Anders begint de ondertitel per kolom op een andere hoogte en golft de
     hele rij.
     Operator, 7 september 2026 (typografie-feedback): "BOOST/FOCUS/CALM
     CONTROL zijn vrij zwaar" — bold → semibold, zodat de naam en de
     ondertitel eronder (al regular) niet even zwaar ogen. */
  /* Operator, 11 september 2026: exacte specificatie — 14px (was 13px);
     `fontFamily` komt nu per selectie-status van de call-site (semibold
     geselecteerd, medium niet). */
  thumbName: {
    marginTop: 8,
    height: 30,
    fontSize: 14,
    lineHeight: 16,
    letterSpacing: 0,
    textAlign: 'center',
  },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
  },
  statNum: {
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    letterSpacing: -0.2,
  },
  statLbl: {
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    letterSpacing: 0,
    color: 'rgba(255,255,255,0.42)',
  },
  footSep: { fontSize: 9, color: 'rgba(255,255,255,0.22)' },
  historyTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11.5,
    letterSpacing: 0,
    color: 'rgba(255,255,255,0.42)',
  },
});
