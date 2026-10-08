/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Sessiescherm (CALM · Lotus)

   Namen, teksten en kleur volgens de operator, 1 augustus 2026; de
   modusnamen op 2 augustus gelijkgetrokken met de keuzepagina:

     BOOST         Radiating Sun    Amber / goud
     FOCUS         Flower of Life   Electric blue
     CALM CONTROL  Lotus            Violet          ← dit scherm
     CLARITY       Crystal          Wit
     SLEEP         Tree of Life     Groen

   "Crystal Grid" verving "Hexagonal Grid" — dat laatste klonk als een
   wiskundeterm en niet als een toestand.

   Vier dingen die deze versie anders doet dan de vorige:

     GEEN VOICE/HAPTICS VOORAF
       Die stonden op de startpagina terwijl er nog niets liep. Ze horen
       bij het luisteren, niet bij het kiezen. Op de startpagina staat nu
       het ademritme zelf — inclusief door welke opening je ademt, want dat
       was nergens af te lezen

     GEEN BRACELET TIJDENS DE SESSIE
       Wie ademt moet niet naar een product kijken. De kaart staat alleen
       vooraf

     DUUR MET UITLEG
       Elke lengte heeft een naam en een reden. Tikken op een keuze
       selecteert hem; tikken op de gekozen keuze opent waarom die lengte
       bestaat. Geen enkele duur is "de juiste" — dat staat er ook

     ADEMRITME ZICHTBAAR
       Vier fasen naast elkaar met hun seconden en hun opening. Tijdens de
       sessie licht de fase op waar je in zit

   Rondes zijn leidend, minuten zijn het label: een cyclus van zestien
   seconden past niet in zestig, dus alleen twintig minuten landt precies.
   Daarom staat de exacte tijd erbij.
   ───────────────────────────────────────────────────────────────────────── */

import { GlassSheet } from '@/components/GlassSheetHost';
import { rootBlurRef } from '@/utils/root-blur';
import SessionArt, { prefetchSessionArt } from '@/components/SessionArt';
import BreathPacer from '@/components/BreathPacer';
import LotusPacer from '@/components/LotusPacer';
import Starfield from '@/components/Starfield';
import { Brand, BrandFonts } from '@/constants/theme';
import {
  BREATH_STATES,
  cycleSeconds,
  roundsFor,
  nextPhase,
  phaseAt,
  type BreathState,
  type BreathStateKey,
  type PhaseDef,
  type PhaseKey,
  patternOf,
} from '@/data/breath-states';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumPaywallModal from '@/components/PremiumPaywallModal';
import VibezGlass from '@/components/VibezGlass';
import { goToTab } from '@/utils/state-control-ui';
import { useKeepAwake } from 'expo-keep-awake';
import { endLiveSession, onLiveToggle, pauseLiveSession, resumeLiveSession, showLiveSession } from '../../modules/live-activity';
import {
  ensureAudioModeSet,
  startSessionKeepAlive,
  stopSessionKeepAlive,
} from '@/services/session-keepalive';
import { phaseHapticPattern, playPhaseHaptic } from '@/services/breath-haptics';
import { ensurePermission as ensureNotificationPermission } from '@/services/reminders';
import { addBreathSession, useBreathHistory } from '@/utils/breath-history';
import { getSetting, useSetting } from '@/utils/settings';
import {
  skipBreathIntroOnce,
  skipBreathOnboardingRedirectOnce,
} from '@/utils/breath-entry';
import { recordInstantFeedback, type InstantFeedback } from '@/utils/instant-feel';
import {
  FREE_SOUNDSCAPES,
  GROUP_ORDER,
  GROUP_TINT,
  SOUNDSCAPES,
  soundscapeByKey,
} from '@/data/soundscapes';
import {
  playScape,
  setScapeLevel,
  stopScape,
  type ScapeLevel,
} from '@/services/soundscape';
import {
  claimVoiceSource,
  playBreathCue,
  playCompletionCue,
  preloadCompletionCue,
  playUjjayiStartCue,
  preloadBreathCues,
  releaseVoiceSource,
  resolveCueUris,
  setVoiceEnabled,
  setVoiceGenderOverride,
  stopVoice,
  type BreathKey,
} from '@/services/breath-voice';
import { assetUri } from '@/services/asset-cache';
import {
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
  startBackgroundBreathSession,
  stopBackgroundBreathSession,
} from '../../modules/breath-background';
import {
  onWatchAction as onAppleWatchAction,
  pauseBreathSessionOnWatch,
  sendBreathSessionToWatch,
  stopBreathSessionOnWatch,
} from '../../modules/watch-breath';
import {
  onWatchAction as onWearWatchAction,
  pauseBreathSessionOnWatch as pauseBreathSessionOnWear,
  sendBreathSessionToWatch as sendBreathSessionToWear,
  stopBreathSessionOnWatch as stopBreathSessionOnWear,
} from '../../modules/wear-breath';
import { showVibezAlert } from '@/components/VibezAlert';
import {
  BlurMask,
  Canvas,
  Circle,
  LinearGradient,
  Path,
  RadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router, Stack, useLocalSearchParams, usePathname } from 'expo-router';
import { useBraceletNudge, openBraceletWebsite } from '@/services/bracelet-upsell';
import { useBreathHost, useBreathParams } from '@/components/breath-host-context';
import {
  closeBreathSession,
  minimizeBreathSession,
  openBreathSession,
  getBreathHost,
  restoreBreathSession,
} from '@/services/breath-session-host';
import {
  ChevronDown,
  BatteryWarning,
  ChevronRight,
  Crown,
  Gem,
  Pause,
  Play,
  Settings,
  SlidersHorizontal,
  VolumeX,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { levelForTechnique, recommendedForLevel, techniqueForLevel, type UserLevel } from '@/utils/breath-level';
import {
  AppState,
  BackHandler,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  Vibration,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/* Gedeelde druk-schaal-animatie voor ELK tikbaar element op dit scherm
   (kaarten, CTA's, icoon-only knoppen) — zelfde recept als `StartCard` in
   breath-welcome.tsx, hier als herbruikbare hook i.p.v. 30+ keer dezelfde
   drie regels te herhalen. `scale` = 0.96 voor één volle-breedte primaire
   CTA, 0.95 voor kaarten/rijen, 0.92-0.94 voor kleine icoon-only knoppen. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
function usePressScale(scale = 0.95) {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(scale, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return { onPressIn, onPressOut, style };
}

const SCREEN_W = Dimensions.get('window').width;

/* De kleur van een toestand als losse getallen, zodat een worklet ermee kan
   rekenen. Reanimated draait op de UI-draad en kan daar geen hex omzetten. */
function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n =
    h.length === 3
      ? h.split('').map((c) => parseInt(c + c, 16))
      : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return [n[0], n[1], n[2]];
}

/* Operator, 11-12 september 2026 (25e ronde): "ook hier nu light mode
   bouwen" — zelfde togglebare `DARK`/`LIGHT`/`C`-patroon als breath-
   setup.tsx: `light` blijft de enige schakelaar, alle donkere waarden
   blijven exact staan in `DARK` zodat terugschakelen later geen herbouw
   is. Dit scherm gebruikte tot nu toe bijna uitsluitend losse
   `rgba(255,255,255,X)`-tinten i.p.v. het gedeelde `Brand`-object; de
   tokens hieronder volgen dezelfde alpha-curve, enkel op `rgba(10,10,12,X)`
   i.p.v. wit, plus een paar losse achtergrondkleuren (kaarten, vellen,
   backdrops). */
/* Operator, 13 september 2026: "session active altijd dark, licht of
   dark mode maakt niet uit" — dit scherm volgt NIET het licht/donker-
   thema van de rest van de app (breath-setup.tsx blijft wel light).
   Vaste `false` i.p.v. gekoppeld aan een instelling. */
const light = false;
const DARK = {
  bg: '#0a0a0a',
  iconBorder: 'rgba(255,255,255,0.13)',
  text: '#ffffff',
  textSoft: '#f4f4f4',
  dim90: 'rgba(255,255,255,0.9)',
  dim85: 'rgba(255,255,255,0.85)',
  dim78: 'rgba(255,255,255,0.78)',
  dim72: 'rgba(255,255,255,0.72)',
  dim58: 'rgba(255,255,255,0.58)',
  dim55: 'rgba(255,255,255,0.55)',
  dim50: 'rgba(255,255,255,0.5)',
  dim44: 'rgba(255,255,255,0.44)',
  dim42: 'rgba(255,255,255,0.42)',
  dim38: 'rgba(255,255,255,0.38)',
  dim30: 'rgba(255,255,255,0.3)',
  dim28: 'rgba(255,255,255,0.28)',
  dim26: 'rgba(255,255,255,0.26)',
  dim18: 'rgba(255,255,255,0.18)',
  dim12: 'rgba(255,255,255,0.12)',
  dim10: 'rgba(255,255,255,0.10)',
  dim04: 'rgba(255,255,255,0.04)',
  dim06: 'rgba(255,255,255,0.06)',
  dim45: 'rgba(255,255,255,0.45)',
  dim03: 'rgba(255,255,255,0.03)',
  dim70: 'rgba(255,255,255,0.7)',
  dim40: 'rgba(255,255,255,0.4)',
  cardBg: '#141018',
  /* Operator, 13 september 2026: "gebruik deze nieuwe layout volledig,
     maar dan dark mode" — het widget-vlak achter de kanalen-rij (zie
     `channelRow`) is nu voor BEIDE thema's actief, niet enkel light.
     Een subtiele, lichte tint op zwart i.p.v. een apart hardcoded grijs. */
  channelCardBg: 'rgba(255,255,255,0.05)',
  /* Operator, 25 september 2026 ("kaart zweeft, backdrop moet donkerder"):
     0.78 → 0.86, zelfde waarde als het protocol (PremiumPaywallModal). */
  modalBackdrop: 'rgba(0,0,0,0.86)',
  sheetBackdrop: 'rgba(0,0,0,0.72)',
  starColor: '#C9A7FF',
  neutralAccent: '#0a0a0a', // st.accent is nooit wit in dark, dus onbereikt
  arcTrack: 'rgba(255,255,255,0.10)',
};
const LIGHT = {
  bg: '#F5F5F7',
  iconBorder: 'rgba(10,10,12,0.13)',
  text: '#0a0a0c',
  textSoft: '#1c1c1e',
  dim90: 'rgba(10,10,12,0.9)',
  dim85: 'rgba(10,10,12,0.85)',
  dim78: 'rgba(10,10,12,0.78)',
  dim72: 'rgba(10,10,12,0.72)',
  dim58: 'rgba(10,10,12,0.58)',
  dim55: 'rgba(10,10,12,0.55)',
  dim50: 'rgba(10,10,12,0.5)',
  dim44: 'rgba(10,10,12,0.44)',
  dim42: 'rgba(10,10,12,0.42)',
  dim38: 'rgba(10,10,12,0.38)',
  dim30: 'rgba(10,10,12,0.3)',
  dim28: 'rgba(10,10,12,0.28)',
  dim26: 'rgba(10,10,12,0.26)',
  dim18: 'rgba(10,10,12,0.18)',
  dim12: 'rgba(10,10,12,0.12)',
  dim10: 'rgba(10,10,12,0.10)',
  dim04: 'rgba(10,10,12,0.04)',
  dim06: 'rgba(10,10,12,0.06)',
  dim45: 'rgba(10,10,12,0.45)',
  dim03: 'rgba(10,10,12,0.03)',
  dim70: 'rgba(10,10,12,0.7)',
  dim40: 'rgba(10,10,12,0.4)',
  cardBg: '#ffffff',
  channelCardBg: '#EDEDF2',
  /* Operator, 25 september 2026: zelfde verdonkering als het dark-thema
     hierboven — evenredig sterker, niet naar 0.86 (dat zou een lichte
     kaart op een bijna-zwarte achtergrond te hard laten contrasteren). */
  modalBackdrop: 'rgba(10,10,12,0.58)',
  sheetBackdrop: 'rgba(10,10,12,0.45)',
  starColor: '#B9A2E0',
  /* Operator, 11 september 2026 (Clarity/wit-accent-fallback, zie
     breath-setup.tsx): Clarity's `st.accent` is letterlijk `#FFFFFF` —
     onbruikbaar als tekst/rand/glow-kleur op deze lichte achtergrond.
     Zelfde donkere vervangkleur als breath-setup.tsx. */
  neutralAccent: '#2C2C2E',
  arcTrack: '#E5E5EA',
};
const C = light ? LIGHT : DARK;

/* Vaste maten van het uitlegvlak. Los van makeStyles, want die hangt aan de
   toestand en hier komen de kleuren uit de animatie. */
const staticStyles = StyleSheet.create({
  /* Ook zonder rand — zie de toelichting bij `patternCard`. De kleur van de
     toestand zit al in de achtergrond, en dat is genoeg om te tonen dat deze
     tekst bij de keuze erboven hoort. */
  explainWrap: {
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
});

/* ── De uitleg onder het ritme ───────────────────────────────────────────
   Wie op "Power 5-3" tikt ziet de tekst eronder veranderen, maar niet DAT hij
   verandert — het is grijze tekst op zwart, twintig punten onder je vinger
   (operator, 7 augustus 2026).

   Eerst probeerde ik een kort oplichten. Te vlak: "het beweegt een beetje en
   dat is het". Wat ontbrak is DIEPTE — het gevoel dat de tekst van het scherm
   loskomt en naar je toe schuift.

   Drie dingen tegelijk, en juist de combinatie maakt het:
   · hij begint kleiner en verder weg (0.9) en veert naar zijn plek, met een
     lichte doorschieter voorbij 1 — dat doorschieten IS het naar-voren-komen;
     een beweging die netjes op 1 stopt leest als schuiven, niet als komen;
   · het vlak eronder kleurt op in de toestandskleur en zakt terug naar een
     rustige verhoging, zodat de tekst ook daarna niet meer plat op de pagina
     ligt maar op iets staat;
   · de tekst zelf wordt witter op het hoogtepunt, want dat is wat je leest.

   Bij het openen van het scherm gebeurt er niets: dan heb je niets aangetikt
   en hoort er dus ook niets te bewegen. */
function TechniqueExplain({
  text,
  accent,
  step,
  style,
}: {
  text: string;
  accent: string;
  /** Verandert bij elke keuze; dat is het startsein. */
  step: number;
  style: object;
}) {
  const flash = useSharedValue(0);
  const enter = useSharedValue(1);
  const first = useRef(true);
  const [r, g, b] = useMemo(() => rgbOf(accent), [accent]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    enter.value = 0;
    /* Een veer en geen tijdlijn. Een veer heeft massa, en dat is precies het
       verschil tussen "iets verschuift" en "iets komt naar voren". */
    enter.value = withSpring(1, {
      damping: 11,
      stiffness: 170,
      mass: 0.75,
      overshootClamping: false,
    });
    flash.value = withSequence(
      withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 340 }),
      withTiming(0, { duration: 820, easing: Easing.inOut(Easing.quad) }),
    );
  }, [step, enter, flash]);

  const wrap = useAnimatedStyle(() => {
    const f = flash.value;
    /* Van een rustige verhoging (wit, nauwelijks zichtbaar) naar de kleur van
       de toestand. Handmatig mengen: een worklet kent geen kleurnamen. */
    const mix = (base: number) => Math.round(255 + (base - 255) * f);
    return {
      backgroundColor: `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${0.05 + 0.17 * f})`,
      borderColor: `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${0.1 + 0.7 * f})`,
      transform: [
        { translateY: (1 - enter.value) * 18 },
        { scale: 0.9 + enter.value * 0.1 },
      ],
      opacity: 0.45 + Math.min(1, enter.value) * 0.55,
    };
  });

  const txt = useAnimatedStyle(() => ({
    color: `rgba(255, 255, 255, ${0.58 + 0.4 * flash.value})`,
  }));

  return (
    <Animated.View style={[staticStyles.explainWrap, wrap]}>
      <Animated.Text style={[style, txt]}>{text}</Animated.Text>
    </Animated.View>
  );
}
const SCREEN_H = Dimensions.get('window').height;

/* Het BEELD is breder dan het scherm. De aangeleverde PNG's hebben een
   royale lege rand — bij de lotus vult de bloem maar zo'n tweederde van de
   breedte en veertig procent van de hoogte. Door het beeld ruim over de
   schermbreedte heen te schalen en het zichtbare vlak eromheen smal te
   houden, vult het ONDERWERP het scherm in plaats van de rand.
   Tijdens de sessie mag hij groter: de titeltekst is dan weg. */
/* Vooraf kleiner dan tijdens de sessie: daar staan nog de duurkeuze,
   het ritmeblok en de bracelet-kaart onder. */
/* Operator, 7 september 2026 (productkritiek): "de visual neemt enorm veel
   ruimte in beslag, Apple zou 'm behandelen als functional visualization,
   niet als decoratie" — vooraf (setup) kleiner, zodat de ECHTE keuzes
   (ritme, duur) sneller op het scherm komen. Tijdens de sessie zelf
   ongewijzigd (`ART_RUN`) — daar is de illustratie wél het onderwerp. */
const ART_IDLE = SCREEN_W * 0.56;
const ART_RUN = SCREEN_W * 0.98;

/* VASTE hoogte van het beeldvak, gelijk voor alle vijf de toestanden.
   Hing die aan de beeldbreedte, dan verschoof alles eronder zodra een
   illustratie groter of kleiner stond — en dan staat geen enkele pagina op
   dezelfde plek. Nu ligt de indeling vast en regelt `artScale` per toestand
   alleen hoe groot de illustratie BINNEN dat vak is. */
/* 208 → 176 (operator, 7 augustus 2026: "er moet nog een beetje gescrold
   worden"). Het beeldvak was de grootste post op een scherm waar de inhoud
   eronder juist compleet moet zijn; de illustratie heeft die twee-endertig
   punten niet nodig om te dragen. */
const BOX_IDLE = 118;
const BOX_RUN = 268;

/* Hoogte van de knop onderaan. De scroll houdt precies dit plus de
   toestel-inzet vrij, zodat de laatste kaart nooit onder de knop verdwijnt
   en er ook geen willekeurig gat overblijft. */
const BTN_H = 50;
const FOOTER_H = BTN_H + 6;
/* Operator, 11 september 2026 (16e ronde): "alles is opgekropt" — de
   lopende-sessie-voet (grote PAUSE-cirkel + END SESSION eronder, zie
   `runningBtnRow`) is veel hoger dan de oude ene knop van `BTN_H`, maar de
   ScrollView hield nog altijd maar `FOOTER_H` vrij — de vaste voet
   overlapte dus het laatste stuk scroll-inhoud (het kanalen-rijtje). Een
   eigen, hogere reservering specifiek voor de lopende sessie. */
/* Operator, 12 september 2026 (3e correctie): "grotere cirkels" bracht de
   kanalen-rij van 38px naar 60px hoge iconen — zonder meer gereserveerde
   ruimte hier overlapte de vaste PAUSE/END SESSION-voet nu de labels
   eronder (Phone/OFF verdween half achter de PLAY-knop). 148 → 178,
   ruwweg de extra 22px hoogte per cirkel plus wat lucht. */
const RUNNING_FOOTER_H = 178;
/* Waar de bloem verticaal in haar eigen bestand staat. Niet in het midden. */


/* ── Kleur van deze toestand ─────────────────────────────────────────────
   Let op: CLAUDE.md §5 geeft de bracelet-modus Calm Control blauw
   (#0A84FF). De ademsessie draait vanaf nu violet, op verzoek van de
   operator. Die twee lopen dus uiteen terwijl ze dezelfde naam dragen —
   bewust, en te herzien als de bracelet mee moet. */
/* Kleuren, teksten en patronen komen uit breath-states.ts. Dit scherm kent
   zijn eigen inhoud niet — het krijgt `?state=` mee en tekent wat daar
   staat. Zonder sleutel valt het terug op CALM, want dat is de toestand
   die de onboarding en de gratis sessie gebruiken. */

type Phase = PhaseKey;

const BRACELET_IMG =
  'https://vibezcore-audio.b-cdn.net/images/Shattudkite_vzc_fiv%20no%20bg.png';

/* Dezelfde figuur die de bracelet-sessie afsluit. Eén beeld voor beide, want
   het is hetzelfde moment. */
const BUDDHA_IMG = 'https://vibezcore-audio.b-cdn.net/images/buddha%20.png';

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ── De boog in het ritmeblok ────────────────────────────────────────── */
/* Operator, 11 september 2026 (14e ronde): "boog moet zelfs groter, zie
   bijlage mockup" — hoger (meer ruimte onder de boog voor het getal) en
   breder aangeroepen (zie de `PhaseArc`-aanroep bij `rhythmCenter`).
   Operator, 11 september 2026 (15e ronde): "boog mag hoger" — nog verder
   opgehoogd.
   Operator, 11 september 2026 (16e ronde): "boog moet hoger, desnoods de
   uitdeinende ringen weg" — nogmaals opgehoogd. De vaste voet-overlap die
   "opgekropt" aanvoelde is intussen apart opgelost (`RUNNING_FOOTER_H`),
   dus dit is puur nog groter. De uitdeinende RINGEN (los van de boog, de
   twee ovalen rond de figuur zelf in `SessionArt`) zijn hieronder bij de
   aanroep uitgezet — de bestaande gloed-lichtbron achter de figuur (al
   ingebouwd in `SessionArt.tsx`, "een gekleurde lichtbron erachter die
   verder uitdijt dan het beeld zelf") blijft als enige ademcue rond de
   figuur, precies wat er gevraagd werd.
   Operator, 11 september 2026 (18e ronde): "boog veel te groot, verklein
   20%" — 190 → 152 (×0,8). Bleek ook de oorzaak van de overlap onderaan:
   met de figuur + deze boog samen was de totale inhoud hoger dan het
   scherm, dus schoof het kanalen-rijtje onder de vaste voet i.p.v. erboven
   te stoppen. */
/* Operator, 12 september 2026 (3e correctie): "tekst onder cirkels mag
   play button niet raken" — de kanalen-cirkels groeiden van 38 naar 60px
   ("grotere cirkels, zelfde als session selectie pagina"), maar de vaste
   PAUSE/END SESSION-voet (absoluut gepositioneerd) schoof niet mee — de
   extra 22px per cirkel liet de labels eronder achter de voet
   verdwijnen. `RUNNING_FOOTER_H` optrekken loste dit niet op (dat
   reserveert enkel scroll-ruimte, verplaatst geen vaste inhoud); de
   boog zelf iets lager maken geeft de ruimte écht terug. 152 → 134. */
/* Operator, 12 september 2026 (5e correctie, weer teruggedraaid in de
   6e): een tussentijdse kolom-layout voor PAUSE/END SESSION bleek zelf
   hoger dan de rij en overlapte de kanalen-rij erboven — 134 → 114 was
   de compensatie daarvoor. De 6e correctie ging terug naar de gewone
   rij (die bij 134 al correct paste, zie de 3e correctie), dus deze
   waarde ook terug: 114 → 134. */
/* Operator, 12 september 2026 (9e correctie): "card en play button nog
   altijd overlap... desnoods cirkels kleiner, alles moet kunnen ademen"
   — een échte pixel-meting wees op ~100dp overlap. Eerste poging (134 →
   84) sneed te diep: `ARC_H` is niet enkel lege marge maar de Skia-
   canvashoogte van de boog ZELF (`cy = ARC_H - 6` is het middelpunt, de
   straal `r` kan tot 138 oplopen) — bij 84 viel de bovenkant van de boog
   buiten het canvas en klipte hij zichtbaar af. 120 is de kleinste
   waarde die de boog nog intact laat (`cy - r >= 0`); de rest van de
   besparing komt van kleinere kanalen-cirkels/play-knop/padding
   hieronder, niet van de boog zelf. */
/* Operator, 12 september 2026 (10e ronde): de labels onder de kanalen-
   cirkels zijn weg ("teksten mogen weg... geeft meer ademruimte"), wat
   de kanalen-rij zelf een flink stuk lager maakt. Die teruggewonnen
   ruimte gaat naar een iets grotere, mooiere boog i.p.v. ongebruikt te
   blijven liggen: 120 → 140. */
const ARC_H = 140;

function PhaseArc({
  width,
  progress,
  accent,
  gradient,
}: {
  width: number;
  progress: SharedValue<number>;
  accent: string;
  gradient: [string, string, string];
}) {
  const cx = width / 2;
  /* Ruim genoeg zodat het getal ERIN past en niet erover. Plafond
     meegeschaald met `ARC_H` (18e ronde, "boog 20% kleiner"). */
  const r = Math.min(width * 0.46, 138);
  const cy = ARC_H - 6;

  const track = useMemo(() => {
    const p = Skia.Path.Make();
    p.addArc(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2), 180, 180);
    return p;
  }, [cx, cy, r]);

  const dotX = useDerivedValue(() => {
    const a = ((180 + 180 * progress.value) * Math.PI) / 180;
    return cx + Math.cos(a) * r;
  });
  const dotY = useDerivedValue(() => {
    const a = ((180 + 180 * progress.value) * Math.PI) / 180;
    return cy + Math.sin(a) * r;
  });
  const end = useDerivedValue(() => Math.max(0.0001, progress.value));

  return (
    <Canvas style={{ width, height: ARC_H }} pointerEvents="none">
      {/* Operator, 12 september 2026: "boog iets dikker, gedeelte al
         volgelopen fel paars, rest zacht egaal grijs" — dunne 2px op 10%-
         zwart-alpha oogde te broos in light; een vlakke, iets stevigere
         grijstint (`#E5E5EA`, dezelfde grijs als de niet-actieve
         techniek-pillen op breath-setup.tsx) geeft de rest-boog nu body.
         Dark blijft de bestaande, dunnere witte 10%-lijn. */}
      <Path
        path={track}
        style="stroke"
        strokeWidth={3}
        strokeCap="round"
        color={C.arcTrack}
      />
      <Path
        path={track}
        style="stroke"
        strokeWidth={3.6}
        strokeCap="round"
        start={0}
        end={end}
      >
        <LinearGradient
          start={vec(cx - r, cy)}
          end={vec(cx + r, cy)}
          colors={gradient}
        />
      </Path>
      <Circle cx={dotX} cy={dotY} r={7} color={accent} opacity={0.5}>
        <BlurMask blur={7} style="normal" />
      </Circle>
      <Circle cx={dotX} cy={dotY} r={3.6} color={C.text} />
    </Canvas>
  );
}

/* Operator, 11 september 2026 (21e ronde): "de lichtbron vanachter de
   animatie is niet zichtbaar bij expand... ik bedoel rondom de animatie" —
   `SessionArt`'s eigen ingebouwde gloed zit IN hetzelfde `overflow:hidden`-
   vlak als de figuur zelf (bewust, staat toegelicht in dat bestand: "moet
   uitgedoofd zijn vóór de rand van de uitsnede"), dus kan nooit zichtbaar
   BUITEN de figuur uitdijen zonder afgesneden te worden. Deze losse laag
   zit er los van, ÁCHTER `visualWrap` maar in een wrapper ZONDER
   `overflow:hidden`, dus mag wél groter worden dan het beeldvak — dat is
   precies het "rondom de animatie"-effect. Puur decoratief (geen
   svg/tekst), dus geen impact op de al uitgebreid geteste sessielogica in
   `SessionArt.tsx`. */
function FigureGlow({
  breath,
  color,
  topOffset,
}: {
  breath: SharedValue<number>;
  color: string;
  /* Operator, 2 okt 2026 ("zwarte band snijdt de glow af"): deze gloed
     stond als KIND van de `ScrollView` met `figureStage` — een ScrollView
     knipt zijn inhoud altijd af aan zijn eigen zichtbare rand (standaard
     scroll-gedrag, los van `overflow`-styles), dus de -120px bleed naar
     boven werd daar hard afgesneden, exact de "band". De gloed is nu een
     sibling van de ScrollView, buiten die knip-grens — `topOffset` geeft
     hem de absolute positie die `figureStage`'s top-rand zou hebben, zodat
     hij er nog steeds exact achter/rond de figuur uitziet. */
  topOffset: number;
}) {
  const size = BOX_RUN * 1.9;
  const r = size / 2;
  const style = useAnimatedStyle(() => ({
    opacity: 0.16 + breath.value * 0.4,
    transform: [{ scale: 0.72 + breath.value * 0.38 }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          top: topOffset + (BOX_RUN - size) / 2,
          left: (SCREEN_W - size) / 2,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={r} cy={r} r={r}>
          <RadialGradient
            c={vec(r, r)}
            r={r}
            colors={[color, color, '#00000000']}
            positions={[0, 0.22, 1]}
          />
        </Circle>
      </Canvas>
    </Animated.View>
  );
}

/* Operator, 11 september 2026 (22e ronde): "enjoy your session pagina weg"
   — de rustige Buddha-intro-overlay die vroeger hier stond (`SessionIntro`,
   `countdownStyles`, getriggerd door `beginCountdown()`) is verwijderd.
   De sessie start voortaan pas na een bewuste tik op START/TRY (zie de
   verwijderde auto-start bij `BreathSessionScreen` verderop) — die tik
   IS het rustmoment, een aparte ceremoniële tussenpagina erna voegde
   niets meer toe. */

/* ── Scherm ──────────────────────────────────────────────────────────── */

/* Operator, 5 okt 2026 (minimaliseren): de sessie leeft in de laag boven
   de app (components/BreathSessionHost) i.p.v. als navigatiescherm — zie
   services/breath-session-host.ts. Parameters komen uit die laag. */
export function BreathSession() {
  const { minimized } = useBreathHost();
  /* De onderrand komt van het TOESTEL, niet van een gok. SafeAreaView deed
     de onderkant eerder zelf, maar een vastgezette voet valt buiten die
     opvulling — vandaar dat de knop tegen de home-balk aan lag. Nu rekenen
     we de inzet expliciet mee, op de enige plek waar hij telt. */
  const insets = useSafeAreaInsets();

  const params = useBreathParams<{
    state?: string;
    /** Zelfde rol als `state`, maar URL-VEILIG. `state` is intern een
        gereserveerd woord in de router: bij navigatie via een URL —
        deeplink, snelkoppeling, de startknop na de vragenlijst — werd
        ?state=boost stilletjes weggegooid terwijl ?quick=1 gewoon doorkwam,
        en viel elke sessie terug op CALM (audit, 8 augustus 2026). Dit was
        de bug die de operator zag als "start opent een willekeurige modus".
        Object-pushes binnen de app geven `state` wél door; die blijven. */
    mode?: string;
    from?: string;
    /** '1' = binnengekomen via de snelkoppeling op het beginscherm. Dan de
        KORTSTE duur, niet de gebruikelijke: wie van buiten de app binnenvalt
        heeft geen twintig minuten, die heeft nu iets nodig. */
    quick?: string;
    /* '1' = direct de paywall tonen bij binnenkomst, zonder eerst een sessie
       te starten (operator, 13 augustus 2026: "go premium moet de popup
       openen met uitleg, niet direct naar checkout"). Gebruikt door de
       "Go Premium"-tag op het welkomstscherm. */
    paywall?: string;
    /* Duur die het PROTOCOL voor dit moment koos (operator, 13 augustus
       2026: "alles moet mee logisch aangepast en weergegeven worden") —
       meegegeven door plan.tsx/agenda.tsx zodat een sessie die je vanuit je
       dagplan start ook echt de duur draait die daar staat, niet de
       algemene standaard van de toestand. */
    minutes?: string;
    /* Operator, 7 september 2026: nieuw licht setup-scherm (`breath-setup.tsx`)
       laat de gebruiker vooraf een ritme kiezen — dat moet hier aankomen,
       anders wint altijd de standaard (index 0). Sleutel i.p.v. index: een
       index zou breken als de volgorde van `techniques` ooit verandert. */
    technique?: string;
    /** Ervaringsniveau met deze techniek (utils/breath-level.ts). */
    level?: string;
    /* '1' = kwam van `breath-setup.tsx`, dus mode/ritme/duur staan al vast —
       start meteen, toon niet nog eens het (nu overbodige) keuzescherm
       hieronder. */
    autostart?: string;
    /* Operator, 10 september 2026: '1' = `minutes` komt van de Custom-
       stepper op breath-setup.tsx, geen preset — zie toelichting bij
       `chosen` hieronder voor waarom dat een aparte tak nodig heeft. */
    customDuration?: string;
    /* Operator, 11 september 2026: "bij stoppen zie ik enkele seconden
       het oude set session pagina" — breath-setup.tsx zet dit wanneer
       HIJ de pusher was. `router.back()` popt anders terug naar dat
       scherm (het staat echt op de stack) vóór we hier verder navigeren.
       Zie `leaveSession` hieronder. */
    fromSetup?: string;
    /* '1' = gestart vanuit het dagplan (agenda.tsx: "Tap to start" of een
       bolletje). "End session" gaat dan terug naar het plan i.p.v. naar de
       keuzepagina — terug naar waar je vandaan kwam (operator, 5 okt 2026). */
    fromPlan?: string;
    /* '1' = gestart via feel-now.tsx se "How do you feel?"-knop (operator,
       2 okt 2026). Verlengt de preview van 30s naar 60s met een zachte
       fade i.p.v. harde cut (zie `endPreview`), en toont de niet-
       blokkerende feedback-regel op het "Well done"-scherm. */
    instant?: string;
  }>();
  const st: BreathState =
    BREATH_STATES[
      ((params.state ?? params.mode) as BreathStateKey) ?? 'calm'
    ] ?? BREATH_STATES.calm;
  /* Operator, 11 september 2026 (Clarity/wit-accent-fallback): zelfde
     reden als breath-setup.tsx — Clarity's `st.accent` is letterlijk
     `#FFFFFF`, onbruikbaar als tekst/rand/glow-kleur op de nieuwe lichte
     achtergrond. `st.accent`/`st.accentSoft` zelf blijven ongewijzigd
     (bracelet/data blijven de echte statekleur kennen); `accent`/
     `accentSoft` hieronder zijn de render-laag-vervangers, overal in dit
     bestand gebruikt waar de kleur zichtbaar moet blijven. */
  const isNeutralAccent = light && st.accent.toUpperCase() === '#FFFFFF';
  const accent = isNeutralAccent ? C.neutralAccent : st.accent;
  const accentSoft = isNeutralAccent ? `${C.neutralAccent}22` : st.accentSoft;
  /* Operator, 14 september 2026: "play en cirkels binnenkant volledig wit,
     iconen onzichtbaar" — Clarity's accent is `#FFFFFF` (spec §5); dit
     scherm staat nu vast op dark, dus een wit-gevulde cirkel (Play-knop,
     actieve kanaal-cirkels) is prima zichtbaar tegen de zwarte achtergrond,
     maar een wit icoon DAAROP was onzichtbaar. Icoon-kleur op een gevulde
     accent-cirkel moet dus contrasteren met de accentkleur zelf, niet met
     de achtergrond.
     Operator, 2 okt 2026 ("play-knop van Clarity & Relax moet witter"):
     die aanname klopt niet meer voor de Play/Pause-knop zelf — die is
     intussen een doorschijnende donkere blur met slechts een lichte
     kleurwas (`pauseMainTint`, 20% opacity), geen vol-gevulde cirkel
     meer. Voor Clarity (wit accent) werd het icoon daardoor bijna zwart
     (`#0a0a0c`) op een overwegend donkere achtergrond — bijna onzichtbaar,
     het omgekeerde probleem. Altijd wit, past bij elke accentkleur op
     deze donkere, doorschijnende knop. */
  const activeIconColor = '#ffffff';
  const s = useMemo(() => makeStyles(st, accent, accentSoft), [st, accent, accentSoft]);
  /* Welk ritme binnen deze toestand. De eerste is de standaard; wie niets
     kiest merkt van deze laag niets. Alles hieronder rekent vanaf `tech` en
     niet meer vanaf `st` — dat is het hele verschil tussen "een toestand
     heeft een ritme" en "een toestand heeft ritmes". */
  const [techIdx, setTechIdx] = useState(() => {
    if (!params.technique) return 0;
    const i = st.techniques.findIndex((t) => t.key === params.technique);
    return i === -1 ? 0 : i;
  });
  /* Operator, 6 okt 2026: het ritme volgt de ervaring van de gebruiker met
     deze techniek (utils/breath-level.ts). Het setup-scherm geeft het niveau
     mee; elders (plan, melding, deeplink) rekenen we het zelf uit, zodat het
     ritme overal hetzelfde is. Eén keer vastgezet bij het openen — het
     niveau mag niet halverwege een sessie veranderen. */
  const baseTech = st.techniques[techIdx] ?? st.techniques[0];
  const levelFromSetup =
    params.level === 'beginner' || params.level === 'intermediate' || params.level === 'advanced'
      ? params.level
      : null;
  const [sessionLevel, setSessionLevel] = useState<UserLevel>(
    () => levelFromSetup ?? levelForTechnique(st.key, baseTech.key),
  );
  /* Opent de sessie vóór de opgeslagen geschiedenis geladen is (bv. een tik
     op een herinnering terwijl de app dicht was), dan rekende hij met een
     lege geschiedenis en startte hij op het beginniveau. Zodra de
     geschiedenis binnen is: opnieuw bepalen — maar enkel zolang de sessie
     nog niet loopt (6 okt 2026, "alles wat we beweren moet kloppen"). */
  const breathHistory = useBreathHistory();
  useEffect(() => {
    if (levelFromSetup) return;
    if (runningRef.current || startingRef.current) return;
    const next = levelForTechnique(st.key, baseTech.key, breathHistory);
    if (next !== sessionLevel) setSessionLevel(next);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [breathHistory]);
  const tech = useMemo(
    () => techniqueForLevel(st.key, baseTech, sessionLevel),
    [st.key, baseTech, sessionLevel],
  );

  /* ── Het gekozen ritme, ook nog tijdens de sessie ────────────────────────
     De fase-loop is bewust ÉÉN keer opgebouwd: hij roept zichzelf aan vanuit
     een timer, dus hij mag niet opnieuw gemaakt worden terwijl hij draait —
     anders praten er twee lussen door elkaar. De prijs daarvan is dat alles
     wat hij aanraakt bevroren is op het moment van opbouwen, en dat was het
     eerste ritme.

     Gevolg (operator, 7 augustus 2026): je koos Power 3-3, het scherm toonde
     keurig 3-3, en de sessie ademde 2-2. Bij CLARITY draaide Extended 4-8 als
     4-2-6. De keuze werd wél getoond en nooit gebruikt — in alle vijf de
     toestanden.

     Een ref lost precies dit op: de lus leest hem op het moment dat hij hem
     nodig heeft, in plaats van een kopie mee te dragen uit het verleden. */
  const techRef = useRef(tech);
  useEffect(() => {
    techRef.current = tech;
  }, [tech]);

  /* Het achtergrondgeluid. Per TOESTAND onthouden: wie voor slapen Deep wil
     en voor focus Rain, hoort dat niet elke keer opnieuw te kiezen. */
  /* Soundscape wordt NIET onthouden (operator, 4 augustus 2026). Anders dan
     stem en begeleiding is dit geen instelling maar een keuze van het moment:
     elke sessie begint stil, en wie iets wil zet het aan. Daarom ook geen
     vraag om het als standaard te bewaren. */
  /* Geen `??` met een standaard: ontbreekt de sleutel, dan is er bewust GEEN
     geluid. Een achtergrondgeluid dat vanzelf begint is een verrassing, en
     een sessie hoort niet te verrassen. */
  const [scapeKey, setScapeKey] = useState<string | null>(null);
  const scape = soundscapeByKey(scapeKey);
  const [scapeOpen, setScapeOpen] = useState(false);
  const [scapeLevel, setScapeLevelLocal] = useState<ScapeLevel>('medium');

  /* ── Waar de begeleiding vandaan komt ───────────────────────────────
     De haptiek die er stond is die van de TELEFOON. De bracelet is een ander
     kanaal, en privé is dat kanaal zonder scherm en zonder geluid.
     Zolang er geen bracelet verbonden is, valt alles terug op de telefoon —
     stil falen zou hier betekenen dat iemand een sessie start die niets doet. */
  /* Geen kanaal-KEUZE meer maar twee losse schakelaars (operator, 5 augustus
     2026). Een keuzemenu achter één knop verstopte wat er te kiezen valt; nu
     staat alles wat aan of uit kan in dezelfde rij. Privé is daarmee geen
     aparte stand meer maar wat je krijgt als je de bracelet aanzet en de stem
     uit — precies zoals het in het echt werkt. */
  const [braceletOn, setBraceletOn] = useState(false);
  const braceletReady = false; /* [HARDWARE] Fall 2026 — nog geen verbinding. */

  /* Wat er gevraagd wordt zodra iets afwijkt van de opgeslagen stand.
     Operator, 25 september 2026 ("bij sluiten via kruisje mag er in
     principe niets veranderen, user beslist om alles te behouden"): `revert`
     is optioneel — zet de LOKALE/sessie-wijziging terug naar wat hij was
     vóór deze tik, apart van `apply` (die de OPGESLAGEN standaard raakt).
     Kruisje/backdrop roepen 'm aan, "Just this time" bewust niet — dat
     knop-tekst zegt letterlijk dat de wijziging WEL voor deze sessie
     geldt, enkel niet als nieuwe standaard. */
  const [askDefault, setAskDefault] = useState<null | {
    apply: (scope: 'all' | 'state') => void;
    revert?: () => void;
    what: string;
  }>(null);
  /* Operator, 20 september 2026 ("eerst moet er een vraag gesteld worden
     just this session, dan is dat alleen voor dit. als gebruiker remember
     aanklikt dan moet de vraag nog eens... enkel deze [state] of alle"):
     TWEE stappen i.p.v. één plat scherm met 3 knoppen — wie gewoon
     "just this time" wil is met ÉÉN tik klaar (geen scope-vraag die voor
     hem toch niets betekent); wie WEL wil onthouden krijgt DAN pas de
     scope-vraag, want die is alleen relevant zodra er ook echt iets
     blijvends gebeurt. Minder wrijving voor het meest gekozen pad, meer
     duidelijkheid op het pad waar het ertoe doet. */
  const [askScopeStep, setAskScopeStep] = useState(false);
  const closeAskDefault = useCallback(() => {
    setAskDefault(null);
    setAskScopeStep(false);
  }, []);
  /* Kruisje/backdrop — "ik veranderde van gedachte" — zet ook de zonet
     gemaakte sessie-wijziging terug, niet enkel de opgeslagen standaard. */
  const cancelAskDefault = useCallback(() => {
    setAskDefault((cur) => {
      cur?.revert?.();
      return null;
    });
    setAskScopeStep(false);
  }, []);


  const pickScape = useCallback(
    (k: string | null) => {
      Haptics.selectionAsync();
      setScapeKey(k);
      /* Meteen laten horen wat je kiest — ook vóór de sessie. Anders kies je
         blind en merk je pas halverwege dat het niet is wat je wilde. */
      void playScape(k);
    },
    [],
  );

  const CYCLE_S = useMemo(() => cycleSeconds(tech), [tech]);
  /* Via de ref, en dus zonder afhankelijkheden: deze twee worden vanuit de
     fase-loop aangeroepen en moeten daarom stabiel zijn én actueel. */
  const byKey = useCallback((k: Phase) => phaseAt(techRef.current, k), []);
  const nextOf = useCallback((k: Phase) => nextPhase(techRef.current, k), []);
  /* Het ritme mag zijn eigen duren dragen; anders die van de toestand. */
  const DURATIONS = tech.durations ?? st.durations;

  const [durationIdx, setDurationIdx] = useState<number>(() => {
    if (params.quick === '1') return 0;
    const wanted = params.minutes ? Number(params.minutes) : null;
    if (wanted && !Number.isNaN(wanted)) {
      /* Dichtst-bij-match, niet exact — een ritme kan zijn eigen duren
         dragen die niet 1-op-1 overeenkomen met wat het protocol koos. */
      let idx = DURATIONS.reduce(
        (bestIdx, d, i) =>
          Math.abs(d.minutes - wanted) < Math.abs(DURATIONS[bestIdx].minutes - wanted)
            ? i
            : bestIdx,
        0,
      );
      /* Audit 8 okt 2026: ritmes in cycli (4-7-8) nooit boven wat dit niveau
         toelaat (Weil: eerst een maand 4 cycli) — ook niet als een plan of
         link meer minuten vraagt. */
      const cyc = DURATIONS[idx]?.cycles;
      if (cyc != null) {
        const cap = recommendedForLevel(st.key, tech.key, levelForTechnique(st.key, tech.key));
        if (cap != null && cyc > cap) {
          const allowed = DURATIONS.map((d, i) => ({ d, i })).filter(
            ({ d }) => d.cycles != null && d.cycles <= cap,
          );
          if (allowed.length) idx = allowed[allowed.length - 1].i;
        }
      }
      return idx;
    }
    return st.defaultDuration;
  });
  /* Operator, 14 september 2026: "end session/backknop gaat nog altijd naar
     welcome pagina" — de vlag pas bij het VERLATEN zetten (in `leaveSession`
     hieronder) kwam te laat: (tabs)/breath.tsx's eigen redirect-check draait
     ÉÉN keer bij zijn mount, niet bij focus (zie utils/breath-entry.ts), dus
     of de vlag op tijd staat hangt af van onvoorspelbare mount-volgorde
     tussen dit scherm en dat scherm. Door de vlag meteen bij het BETREDEN
     van een sessie te zetten — ruim voordat er ooit teruggenavigeerd wordt —
     ligt hij altijd al klaar, ongeacht welke route (X, END SESSION,
     hardware-terugknop, Done-popup) je gebruikt om weer weg te gaan. */
  useEffect(() => {
    skipBreathOnboardingRedirectOnce();
  }, []);
  const [infoIdx, setInfoIdx] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  /* Operator, 4 okt 2026 (smoothness-audit: "betrouwbaarheid bij
     aantikken, geen freeze"): de START-knop had geen enkele dubbeltik-
     bescherming — `running` (React state) update niet synchroon, dus een
     snelle tweede tik vóór de eerste re-render kon `start()` opnieuw
     aanroepen (dubbele haptic, dubbele audio/native-bridge-aanroepen).
     Een `ref` is wél synchroon leesbaar/schrijfbaar binnen dezelfde JS-
     tick — zelfde patroon als bracelet-control.tsx's `busy`/`isWorking`-
     guards, hier als ref omdat de render zelf niet opnieuw hoeft op basis
     hiervan (het bestaande `running`-state doet dat al voor de UI). */
  const startingRef = useRef(false);
  /* Operator, 8 september 2026: "wij zouden moeten kunnen pauzeren ook". */
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  /* Het scherm mag niet in slaap vallen zolang dit scherm open staat.
     Een ademsessie is het enige moment waarop iemand mínutenlang naar een
     telefoon kijkt zonder hem aan te raken — precies wat een toestel als
     "niet in gebruik" leest. Zonder dit dooft het beeld midden in een
     inademing, en dan moet je hem wakker tikken terwijl je juist niets
     hoort te doen. Het is de meest zichtbare fout in een sessie en hij kost
     één regel. Wordt automatisch opgeheven zodra je het scherm verlaat. */
  /* Het scherm blijft aan tijdens élke sessie, ook in privé.
     Ik had privé eerst als "scherm uit" gebouwd en dat was fout (operator,
     4 augustus 2026): het beeld blijft gewoon meelopen. Het verschil is dat
     je er niet naar hóéft te kijken en de telefoon niet hoeft vast te houden
     — kijk je toch, dan staat het er. Een scherm dat halverwege uitvalt zou
     dat juist onmogelijk maken. */
  useKeepAwake('breath-session');

  const sub = useSubscription();
  const isPro = sub.isPro;
  /* Operator, 7 september 2026: "mag maar 1 keer werken" — bleef ondanks
     twee eerdere pogingen fout gaan zolang de check+markering in DIT
     scherm zaten (`useState`/`useEffect`-timing bij mount, gevoelig voor
     hoe Expo Router een scherm wel/niet hermonteert bij `replace`). De
     check+markering staan nu in `breath-welcome.tsx`, op het moment van
     de knop-tik zelf — een gewone functie-aanroep, geen component-
     levenscyclus, dus geen enkele timing-onzekerheid meer. Dit scherm
     vertrouwt nu simpelweg de URL: `from=onboarding` staat er ALLEEN nog
     in als breath-welcome.tsx net vastgesteld heeft dat de gratis sessie
     nog niet gebruikt was. */
  /* Operator, 8 okt 2026 (audit): de URL alleen is niet genoeg — een deep
     link of een oud scherm kon `from=onboarding` meegeven en zo onbeperkt
     gratis Premium-sessies openen. Enkel geldig als de gratis sessie
     zonet (≤ 15 min) is geclaimd; één keer bepaald bij het openen, zodat
     een lange sessie niet halverwege op slot gaat. */
  const [isFreeOnboardingSession] = useState(() => {
    if (params.from !== 'onboarding') return false;
    const claimedAt = getSetting('breathFreeSessionUsedAt');
    return typeof claimedAt === 'number' && Date.now() - claimedAt < 15 * 60 * 1000;
  });
  /* Alleen na de gratis kennismakingssessie, en alleen als er nog iets te
     kopen valt. */
  const askPremium = isFreeOnboardingSession && !isPro;
  /* Bracelet als upgrade (operator, 7 okt 2026): één rustige regel op het
     "Well done"-scherm — niet waar de Premium-vraag staat (die gaat voor),
     max. 1×/dag, niet voor wie al een bracelet heeft. Breathwork op de
     bracelet volgt nog → "coming"-formulering, geen belofte van nu. */
  /* Geen uitzondering voor eigenaars: die bestaan nog niet (7 okt 2026). */
  const showBraceletLink = useBraceletNudge('breathwork', done && !askPremium);
  /* Operator, 2 okt 2026 ("Apple-level polish... niet hard-cutten"): sessies
     gestart via feel-now.tsx se "How do you feel?"-knop dragen `instant=1`.
     Twee dingen wisselen dan, enkel voor DIT pad: de preview duurt 60s i.p.v.
     30s (zie PREVIEW_SECONDS hieronder), en de overgang naar de paywall
     vervaagt de achtergrondscape (`stopScape(false)`, bestaande 1,5s-fade uit
     soundscape.ts) i.p.v. de instant harde stop (`stopScape(true)`) die de
     rest van de app hier gebruikt. Zie `endPreview()` hieronder. */
  const isInstantSession = params.instant === '1';

  /* De Voice-knop op dit scherm ÍS de instelling, niet een tweede knop die
     er toevallig op lijkt (3 augustus 2026). Hier stond een eigen
     useState(true), en dat was de bron van alle ellende: het scherm zei
     "Voice ON" terwijl de app op stil stond, de cues moesten met een
     force-vlag langs die instelling heen, en de root-layout zette 'm
     ondertussen weer terug. Twee waarheden over één ding leveren altijd een
     verliezer op, en dat was de gebruiker.
     bracelet-control.tsx doet dit al zo; nu de ademkant ook. */
  /* ── De autostoel ───────────────────────────────────────────────────
     Stem en begeleiding hebben een OPGESLAGEN stand en een stand voor DEZE
     sessie. Je stapt in met je eigen instelling; verzet je iets, dan vraagt
     de app één keer of dat voortaan zo moet. Zeg je nee, dan geldt het alleen
     nu — en pas als je het ooit wéér verzet komt de vraag opnieuw.

     Vandaar twee waarden naast elkaar. Schreef een tik meteen door naar de
     instelling, dan was elke tijdelijke aanpassing meteen permanent en had de
     vraag geen betekenis meer. */
  /* ── Voorkeur per toestand ──────────────────────────────────────────
     Iemand wil bij CALM CONTROL de stem aan en bij SLEEP alleen
     trilling (operator, 5 augustus 2026). De opgeslagen stand is daarom niet
     één waarde voor de hele app maar één per toestand, met de algemene stand
     als terugval. Wie nooit iets per toestand instelt merkt van deze laag
     niets. */
  const [prefs, setPrefs] = useSetting('breathPrefs');
  const [voiceGlobal, setVoiceGlobal] = useSetting('voiceCues');
  const [hapticGlobal, setHapticGlobal] = useSetting('hapticsPhone');
  const [voiceGenderSetting, setVoiceGenderSetting] = useSetting('voiceGender');
  const pref = prefs[st.key] ?? {};
  const voiceDefault = pref.voice ?? voiceGlobal;
  const hapticDefault = pref.haptics ?? hapticGlobal;
  const voiceGenderDefault = pref.voiceGender ?? voiceGenderSetting;
  /* Mens-leesbare naam voor de "Just for …"-knop in het onthoud-scherm
     hieronder — `st.eyebrow` is de bestaande toestandsnaam, maar staat
     overal in HOOFDLETTERS (een eyebrow-label); midden in een knoptekst
     leest dat als schreeuwen. */
  const stateLabel = st.eyebrow.charAt(0) + st.eyebrow.slice(1).toLowerCase();
  /* Operator, 20 september 2026 ("moet user niet de keuze krijgen om enkel
     voor deze state of voor alle states te setten?"): 11 september had dit
     bewust vereenvoudigd tot ENKEL globaal ("gewoon bij 1 keuze overal de
     keuze doorvoeren") — de per-toestand-laag (5 augustus: Calm Control met
     stem, Rest & Reset stil) bleef in de data bestaan maar werd nooit meer
     geschreven. Nu terug een echte keuze: `scope:'all'` doet exact wat 11
     september deed (globale stand + alle per-toestand-uitzonderingen
     wissen, zodat de nieuwe globale stand nergens meer overschaduwd
     wordt); `scope:'state'` schrijft ENKEL de override voor DEZE toestand,
     de globale stand en andere toestanden blijven onaangeroerd. */
  const remember = useCallback(
    (
      patch: { voice?: boolean; haptics?: boolean; voiceGender?: 'female' | 'male' },
      scope: 'all' | 'state',
    ) => {
      if (scope === 'all') {
        if (typeof patch.voice === 'boolean') void setVoiceGlobal(patch.voice);
        if (typeof patch.haptics === 'boolean') void setHapticGlobal(patch.haptics);
        if (patch.voiceGender) void setVoiceGenderSetting(patch.voiceGender);
        void setPrefs({});
      } else {
        void setPrefs({ ...prefs, [st.key]: { ...prefs[st.key], ...patch } });
      }
    },
    [setVoiceGlobal, setHapticGlobal, setVoiceGenderSetting, setPrefs, prefs, st.key],
  );
  const [voiceOn, setVoiceOnLocal] = useState(voiceDefault);
  /* Één keer overnemen zodra de opgeslagen waarde binnen is; daarna niet meer,
     anders overschrijft een late lading je keuze van dit moment. */
  const tookVoice = useRef(false);
  useEffect(() => {
    if (tookVoice.current) return;
    tookVoice.current = true;
    setVoiceOnLocal(voiceDefault);
  }, [voiceDefault]);
  /* Telefoon-trilling: opgeslagen stand plus die van deze sessie, net als de
     stem. Zelfde autostoel-regel. */
  const [hapticsOn, setHapticsOn] = useState(hapticDefault);
  const tookHaptic = useRef(false);
  useEffect(() => {
    if (tookHaptic.current) return;
    tookHaptic.current = true;
    setHapticsOn(hapticDefault);
  }, [hapticDefault]);

  /* Operator, 11 september 2026: "stempicker mag niet weggestopt zitten,
     user moet keuze hebben om als default OF eenmalig te kiezen" — de
     globale Settings-keuze (Eli/Benjamin) blijft bestaan, maar dit scherm
     krijgt nu ZELF ook de keuze, zelfde autostoel-principe als Voice
     AAN/UIT hierboven: een sessie-stand die de opgeslagen stand mag
     overstemmen zonder 'm aan te raken, tenzij je expliciet "onthouden"
     kiest via het bestaande `askDefault`-scherm. */
  const [voiceGenderLocal, setVoiceGenderLocal] = useState(voiceGenderDefault);
  const tookVoiceGender = useRef(false);
  useEffect(() => {
    if (tookVoiceGender.current) return;
    tookVoiceGender.current = true;
    setVoiceGenderLocal(voiceGenderDefault);
  }, [voiceGenderDefault]);
  /* De sessie-override in breath-voice.ts volgt DEZE lokale stand, niet de
     opgeslagen instelling — en wordt bij het verlaten van dit scherm weer
     gewist, zodat "eenmalig" ook echt eenmalig is. */
  useEffect(() => {
    setVoiceGenderOverride(voiceGenderLocal);
    return () => setVoiceGenderOverride(null);
  }, [voiceGenderLocal]);
  /* Operator, 19 september 2026 ("de balk met vier losse iconen weg —
     één brede 'Audio & Haptics'-capsule, vel eronder, wegfaden zodra
     Play gedrukt wordt"): de vier losse kanaal-knoppen (Voice/
     Soundscape/Phone/Bracelet) stonden voorheen bovendien ENKEL binnen
     `running &&` — dus onzichtbaar in de wachtstand vóór Play, precies
     tegenovergesteld aan wat hier gevraagd wordt. Nu één gedeelde vlag:
     zichtbaar in de wachtstand ÉN tijdens pauze, onzichtbaar tijdens het
     actieve ademen zelf. */
  const [avSheetOpen, setAvSheetOpen] = useState(false);
  const audioHapticsVisible = useSharedValue(1);
  useEffect(() => {
    const shouldShow = !running || paused;
    audioHapticsVisible.value = withTiming(shouldShow ? 1 : 0, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });
  }, [running, paused, audioHapticsVisible]);
  const audioHapticsStyle = useAnimatedStyle(() => ({
    opacity: audioHapticsVisible.value,
  }));

  const [phase, setPhase] = useState<Phase>('inhale');
  /* Operator, 24 september 2026 ("Equal 3/3 begint met 4, Faster ook"):
     stond hier vast op `st.techniques[0]` — de EERSTE techniek van de
     toestand (voor Boost dus altijd Diaphragmatic, 4 sec), ongeacht welke
     techniek daadwerkelijk gekozen was. Bij een sessie die op pauze start
     (`startPaused`) wordt deze waarde als `resumeAt` aan de allereerste
     `runPhase()`-aanroep doorgegeven (via `resumeSession()`) en
     overschreef zo de correcte, techniek-specifieke duur. Nu vanaf de
     WERKELIJK geselecteerde `tech` (zie `techIdx` hierboven). */
  const [secsLeft, setSecsLeft] = useState(tech.phases[0].secs);
  const [round, setRound] = useState(1);

  /* Operator, 10 september 2026: custom-duur van breath-setup.tsx. Zonder
     deze tak zou `durationIdx` hierboven `minutes` naar de DICHTSTBIJZIJNDE
     preset afronden (zijn normale gedrag) en de custom-waarde stilletjes
     negeren — de hele Custom-stepper zou dan niets doen. */
  const customMinutesParam =
    params.customDuration === '1' && params.minutes
      ? Number(params.minutes)
      : null;

  /* Binnen de grenzen blijven. 4-7-8 heeft twee duren, de andere ritmes drie
     of vier. Stond je op de derde en wisselde je van ritme, dan wees de index
     naar niets en viel de app om op de eerstvolgende regel. Terugvallen op de
     laatste die er WEL is, is hier het juiste antwoord: je koos de langste, en
     dat blijft de langste. */
  const chosen =
    customMinutesParam != null
      ? {
          minutes: customMinutesParam,
          rounds: roundsFor(tech, customMinutesParam),
          name: 'Custom',
          why: '',
        }
      : (DURATIONS[Math.min(durationIdx, DURATIONS.length - 1)] ?? DURATIONS[0]);
  /* Berekend uit het gekozen ritme, niet meer uit een vast getal per
     toestand: twintig minuten van een cyclus van tien seconden is nu eenmaal
     een ander aantal rondes dan van een cyclus van zestien. */
  /* Een vast aantal ademhalingen gaat vóór een aantal minuten. */
  const rounds = chosen.cycles ?? roundsFor(tech, chosen.minutes);
  const totalSec = rounds * CYCLE_S;

  /* De fase-loop draait buiten React om, dus de actuele instellingen komen
     uit refs. Anders leest een lopende sessie de waarden van de render
     waarin hij begon. */
  const voiceRef = useRef(voiceOn);
  /* Uitgestelde stop van het achtergrond-anker na een afgemaakte sessie
     (zie finish). Bij verlaten van dit scherm meteen opruimen. */
  const keepAliveStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (keepAliveStopRef.current) {
        clearTimeout(keepAliveStopRef.current);
        keepAliveStopRef.current = null;
        stopSessionKeepAlive();
      }
    },
    [],
  );
  const hapticRef = useRef(hapticsOn);
  const roundsRef = useRef(rounds);
  /* Het WERKELIJKE aantal rondes voor DEZE run — normaal gelijk aan
     roundsRef, maar bij een preview-sessie (zie `locked`/PREVIEW_ROUNDS
     verderop) tijdelijk verlaagd. De fase-lus rekent tegen dit getal, niet
     tegen roundsRef, zodat een preview netjes na ~30 seconden stopt i.p.v.
     na de volle gekozen duur. */
  const effectiveRoundsRef = useRef(rounds);
  /* True zolang de lopende run een preview is (zie `locked` verderop: elke
     sessie na de gratis kennismakingssessie mag ~30 seconden proeven voor
     de paywall komt — operator 10 augustus 2026: "na onboarding elke
     sessie 1 of 2 cycli laten doen en dan stoppen", operator 7 september
     2026: omgezet naar een vaste tijdsduur i.p.v. een vast rondeaantal,
     zodat elke toestand evenveel proeftijd krijgt). */
  const previewRef = useRef(false);
  /* De knop schrijft nu wél door naar de voorkeur — dat is het punt van één
     waarheid. Zet je hier de stem uit, dan is hij ook uit in de onboarding,
     bij de bracelet en in Settings. Dat is geen bijwerking maar precies wat
     iemand bedoelt die op een luidsprekertje met een streep tikt.
     De root-layout dient diezelfde waarde uit; die twee vechten dus niet
     meer, en de force-vlag die dat gevecht moest omzeilen is weg. */
  useEffect(() => {
    voiceRef.current = voiceOn;
    /* De dienst volgt de stand van DEZE toestand, niet de algemene. Anders
       zou "stem uit bij REST" ook de stem bij CALM blokkeren, want de poort
       in breath-voice.ts kent maar één vlag. Bij het verlaten van het scherm
       gaat hij terug naar de algemene stand — zie de opruiming hieronder. */
    setVoiceEnabled(voiceOn);
    if (!voiceOn) stopVoice();
  }, [voiceOn]);
  useEffect(() => {
    hapticRef.current = hapticsOn;
  }, [hapticsOn]);
  useEffect(() => {
    roundsRef.current = rounds;
    if (!previewRef.current) effectiveRoundsRef.current = rounds;
  }, [rounds]);

  /* Hoeveel seconden er ECHT geademd is. Bijgehouden in de fase-lus zelf en
     niet afgeleid uit de render-waarden: die zijn in een callback verouderd,
     en dan schrijf je de duur van een paar tellen geleden weg. */
  const elapsedRef = useRef(0);
  /* Wanneer de sessie ECHT begon, voor de wandklok-correctie hierboven. */
  const startWallRef = useRef(0);
  /* Operator, 11 september 2026: onderscheidt "nog nooit gestart" van "al
     gestart en nu gestopt/gepauzeerd" — zie `awaitingAutostart` verderop
     voor waarom dit nodig is (zonder dit gat verdween het hele scherm na
     pauzeren+stoppen van een autostart-sessie). Gezet in `start()`
     hieronder, nooit teruggezet — een sessie die ooit liep, liep ooit. */
  const hasStartedOnceRef = useRef(false);
  /* Operator, 19 september 2026 ("na END SESSION zie ik heel even een
     scherm dat niet meer mag bestaan — lijkt op het oude set-session
     scherm"): dat was dit scherm se EIGEN "START SESSION"/"TRY 30
     SECONDS FREE"-knop hieronder — die rendert zodra `running` false
     wordt, dus al VOOR de paywall-modal dichtgaat en `leaveSession()`
     de navigatie start. In de fractie van een seconde tussen het
     sluiten van de modal en het voltooien van die navigatie stond die
     knop dus weer gewoon zichtbaar. `sessionEnded` blokkeert 'm
     onvoorwaardelijk zodra `requestStop()` ooit gevuurd is — ongeacht
     `running`/`awaitingAutostart`, en ongeacht hoe lang de navigatie
     nog duurt. */
  const [sessionEnded, setSessionEnded] = useState(false);
  /* Operator, 8 september 2026 (pauzeren): de wandklok-correcties hierboven
     (zowel de achtergrond-bewapening als de inhaalslag bij terugkeer) meten
     vanaf `startWallRef`, dus zonder correctie zou een pauze meetellen als
     "stilgevallen tijd" en de sessie bij hervatten laten springen alsof er
     niets gebeurd was. `pausedMsRef` houdt de TOTALE gepauzeerde tijd deze
     sessie bij; `pausedAtWallRef` is het moment waarop de huidige pauze
     begon (0 = niet gepauzeerd). Beide overal waar `Date.now() -
     startWallRef.current` een duur berekent, mee aftrekken. */
  const pausedMsRef = useRef(0);
  const pausedAtWallRef = useRef(0);
  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  /* De drie cue-bestanden voor DEZE sessie, klaargezet in start() maar pas
     gebruikt als de app naar de achtergrond gaat — zie de AppState-listener
     verderop. `null` = geen sessie bezig / native mag niet bewapend worden. */
  const pendingCueUrisRef = useRef<{
    inhale: string;
    hold: string;
    exhale: string;
  } | null>(null);
  const roundRef = useRef(1);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* De vooruitlopende stemcue heeft een eigen wekker: hij vuurt vóór het
     einde van de lopende fase en mag dus niet aan de fase-wissel hangen. */
  const preRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Operator, 24 september 2026 (10de melding — nu écht bevestigd via
     live logcat): de ECHTE oorzaak van "geen stem in de eerste fase" was
     nooit audio-laadtijd, caching of audiofocus. `start(preview, true)`
     (de "start op pauze"-flow, 11 september 2026, 25e ronde) zet de
     sessie op pauze en `return`t vóórdat `speak()` ooit voor de eerste
     fase is aangeroepen — dat hoort de PLAY-tik (`resumeSession()`) te
     doen. Maar `runPhase()` spreekt nooit zijn EIGEN fase uit, enkel de
     ophanden zijnde volgende (`CUE_LEAD_MS`-mechanisme) — dus de fase
     waarmee je resumet werd nooit gesproken. Deze vlag onthoudt dat er nog
     geen enkele cue geklonken heeft; `resumeSession()` spreekt in dat
     geval alsnog de HUIDIGE fase uit vóór hij `runPhase()` aanroept. */
  const firstSpeakPendingRef = useRef(false);

  /* Hoeveel eerder het geluidsbestand start dan de fase waar het bij hoort.
     Ruim genoeg om de trage aanzet van de opnames op te vangen, kort genoeg
     om niet vóór de vorige fase uit te lopen. */
  const CUE_LEAD_MS = 400;

  const speak = useCallback(
    (p: { key: PhaseKey; via: PhaseDef['via'] }) => {
      if (!voiceRef.current) return;
      /* Was hard `'calm'` voor elke niet-boost toestand (gevonden bij
         audit, operator, 11 augustus 2026: "haptics en stem nakijken voor
         alle modi"). Onschuldig zolang alleen Boost eigen opnames heeft —
         playBreathCue() vertakt alleen op 'boost' — maar zou Focus/Clarity/
         Rest ooit hun eigen opnames krijgen (zoals Boost al heeft), dan
         had deze regel ze stilzwijgend naar de calm-tak blijven sturen.
         Geen tempo-aanpassing (operator, 11 augustus 2026, terugdraai van
         een eerdere poging): elke cue speelt op zijn natuurlijke tempo,
         alleen het STARTMOMENT is afgestemd op de fase (CUE_LEAD_MS). */
      /* Operator, 11 september 2026: 5e argument `p.via` erbij — nu
         Alternate Nostril Breathing en Physiological Sigh hun eigen cues
         hebben (nostril-richting, "Extra inhale") i.p.v. het gewone
         inhale/exhale-bestand te hergebruiken. Zie `urlForPhase()` in
         `breath-voice.ts`. */
      playBreathCue(
        p.key,
        p.via === 'Mouth' ? 'mouth' : 'nose',
        st.key,
        'breath',
        p.via,
      );
    },
    [st.key],
  );

  /* Eén ademwaarde stuurt de hele figuur. Vóór de start loopt hij rustig
     rond zodat het scherm leeft; bij de start neemt het echte patroon het
     over. Dat is dezelfde waarde, dus de overgang is naadloos. */
  const breath = useSharedValue(0);
  const arc = useSharedValue(0);

  const idleBreathing = useCallback(() => {
    cancelAnimation(breath);
    breath.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breath]);

  useEffect(() => {
    idleBreathing();
    prefetchSessionArt();
    /* Operator, 24 september 2026 ("eerste ronde zegt de stem niets, pas
       vanaf 2de ronde"): `playBreathCue()`'s eigen documentatie legt het
       exact uit — een speler voor een REMOTE bestand moet eerst laden,
       `play()` op een nog-niets-geladen speler levert stilte op. Dit
       scherm riep `preloadBreathCues()` nooit aan (enkel breath-welcome.tsx
       deed dat al, voor de onboarding-demo) — dus de EERSTE keer dat elk
       van de 3 cue-bestanden (inhale/hold/exhale) nodig was, klonk er
       niets, en dat gebeurt voor alle 3 tijdens ronde 1 zelf (inhale bij
       start, hold/exhale via de vooruitlopende cue). Tegen ronde 2 hebben
       alle 3 al een laadpoging gehad en werken ze stil verder. Preloaden
       bij het MOUNTEN van dit scherm (ruim vóór de gebruiker op start
       tikt) geeft de bestanden de meeste tijd om te laden. */
    preloadBreathCues();
  }, [idleBreathing]);

  const clearTimers = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (nextRef.current) clearTimeout(nextRef.current);
    if (preRef.current) clearTimeout(preRef.current);
    tickRef.current = null;
    nextRef.current = null;
    preRef.current = null;
  }, []);

  const stopAll = useCallback(() => {
    clearTimers();
    Vibration.cancel();
    stopVoice();
    cancelAnimation(arc);
    arc.value = 0;
    /* Geen sessie meer bezig — de AppState-listener mag native niet meer
       bewapenen met data van een sessie die al voorbij is. */
    pendingCueUrisRef.current = null;
  }, [arc, clearTimers]);

  /* Staat bewust vóór runPhase: de laatste ronde roept dit aan.
     `completed` onderscheidt uitgelopen van afgebroken — alleen een
     afgemaakte sessie verdient een afsluitscherm. */
  const finish = useCallback((completed = false) => {
    stopAll();
    stopScape(true);
    stopBreathSessionOnWear();
    stopBreathSessionOnWatch();
    /* `stopScape()` stopt het geluid maar liet de UI-state ongemoeid — de
       gekozen chip (bv. "RAIN") bleef dus visueel actief staan terwijl er
       niets meer speelde (operator, 11 augustus 2026: "soundscape button
       moet na einde sessie ook niet actief staan, staat nu wel visueel
       actief maar sound zelf is niet actief"). */
    setScapeKey(null);

    /* ── De sessie WEGSCHRIJVEN ──────────────────────────────────────────
       Dit ontbrak volledig (hersteld 6 augustus 2026). De oude inline-sessie
       op de Breath-tab schreef elke sessie weg; die tab is op 2 augustus
       vervangen door het keuzescherm, en de aanroep verhuisde niet mee. Sinds
       die dag is er geen enkele ademsessie opgeslagen — en alles wat daarna op
       die historiek gebouwd is (de suggestie, de praktijkregel, het hele
       Activity-tabblad) las dus een lege lijst.

       Ook een afgebroken sessie telt mee, met de tijd die je wél gedaan hebt.
       Wie na drie van de tien minuten stopt heeft drie minuten geademd, en die
       niet meetellen maakt de cijfers een beloning voor doorzetten in plaats
       van een verslag van wat er gebeurd is. Onder de tien seconden slaan we
       niets op: dat is een vergissing, geen sessie. */
    /* Operator, 8 okt 2026: bij een afgemaakte sessie met stem het
       achtergrond-anker nog even vasthouden, anders legt Android de app
       (scherm vergrendeld) stil vóór de afsluitzin klinkt. Wegtikken van
       het afsluitscherm (dismissDone) stopt het meteen. */
    if (completed && voiceRef.current) {
      if (keepAliveStopRef.current) clearTimeout(keepAliveStopRef.current);
      keepAliveStopRef.current = setTimeout(() => {
        keepAliveStopRef.current = null;
        stopSessionKeepAlive();
      }, 75_000);
    } else {
      stopSessionKeepAlive();
    }
    endLiveSession();
    /* De EERLIJKE duur: de wandklok, niet de getikte seconden. Wordt de app
       ooit toch even bevroren (agressieve batterijstand), dan lopen de tikken
       achter op de werkelijkheid — de historiek hoort de echte tijd te
       krijgen, begrensd op wat er gepland stond. */
    /* Operator, 8 september 2026 (pauzeren): gepauzeerde tijd telt niet mee
       als "geademd" — anders zou een sessie die je 5 minuten gepauzeerd
       liet staan 5 minuten te lang in de historiek belanden. */
    /* Een lopende pauze telt ook niet mee (audit 8 okt 2026). */
    const openPauseMs =
      pausedAtWallRef.current > 0 ? Date.now() - pausedAtWallRef.current : 0;
    const wallSec =
      startWallRef.current > 0
        ? (Date.now() - startWallRef.current - pausedMsRef.current - openPauseMs) / 1000
        : elapsedRef.current;
    const doneSec = Math.round(
      Math.min(Math.max(elapsedRef.current, wallSec), chosen.minutes * 60),
    );
    if (doneSec >= 10) {
      void addBreathSession({
        key: st.key,
        name: st.eyebrow,
        techniqueKey: tech.key,
        durSec: doneSec,
        rounds: completed ? roundsRef.current : Math.max(1, roundRef.current),
        completed,
      });
    }
    elapsedRef.current = 0;
    previewRef.current = false;
    pausedMsRef.current = 0;
    pausedAtWallRef.current = 0;
    setPaused(false);

    if (completed) setDone(true);
    setRunning(false);
    /* Reset de dubbeltik-guard (zie `startingRef`'s toelichting hierboven)
       — zonder dit zou een gestopte sessie nooit meer opnieuw kunnen
       starten (preview→paywall, retry na END SESSION, enz.). */
    startingRef.current = false;
    setRound(1);
    setPhase('inhale');
    setSecsLeft(techRef.current.phases[0].secs);
    idleBreathing();
    releaseVoiceSource('breath');
  }, [idleBreathing, stopAll]);

  /* ── De fase-loop ──────────────────────────────────────────────────── */
  const runPhase = useCallback(
    /* Operator, 8 september 2026 (pauzeren): `resumeAt` is nieuw en puur
       ADDITIEF — elke bestaande aanroep (nieuwe fase, nieuwe ronde, de
       inhaalslag) laat 'm weg en krijgt exact het oude gedrag (volledige
       faseduur). Enkel `resumeSession` hieronder geeft 'm mee: de resterende
       seconden van de fase zoals die stond toen er gepauzeerd werd, zodat
       hervatten verdergaat waar je gebleven was i.p.v. de fase te herstarten. */
    (k: Phase, r: number, resumeAt?: number) => {
      const def = byKey(k);
      const startLeft = resumeAt ?? def.secs;
      setPhase(k);
      setSecsLeft(startLeft);

      /* Bij bracelet en privé zwijgt de telefoon: het ritme zit dan op de
         pols en twee bronnen tegelijk is geen begeleiding maar ruis. */
      if (hapticRef.current) {
        /* De trilling draagt de HELE fase, niet alleen de overgang: een tik
           aan het begin zegt niets over de vier seconden erna. In- en
           uitademen krijgen een reeks die respectievelijk aanzwelt en
           uitdooft, vasthouden drie tikjes en dan stilte. Zie
           breath-haptics.ts — de duur bepaalt de vorm, dus die gaat mee.
           Bij hervatten na pauze: enkel het RESTERENDE stuk, geen volledige
           herhaling van een patroon dat al half gevoeld is. */
        playPhaseHaptic(k, startLeft);
      }
      /* ── De stem loopt vóór ─────────────────────────────────────────────
         De cue van de VOLGENDE fase wordt een fractie vóór de overgang
         ingezet, niet op het moment zelf.

         Reden (operator, 3 augustus 2026): de opnames zetten traag in. Startte
         het bestand precies op de overgang, dan was er al bijna een seconde
         voorbij voordat het eerste woord klonk — en dan loopt de instructie
         achter de beweging aan in plaats van hem aan te kondigen. Er zit geen
         stilte in de bestanden die weggeknipt kan worden; het is de aanzet
         van de stem zelf.

         Vandaar de voorsprong: het bestand begint eerder, zodat het eerste
         WOORD op de overgang valt. Dat is waar de gebruiker op reageert. */
      const upcoming = nextOf(k);
      if (preRef.current) clearTimeout(preRef.current);
      preRef.current = setTimeout(
        () => speak(upcoming),
        Math.max(0, startLeft * 1000 - CUE_LEAD_MS),
      );

      /* Beeld: alleen in- en uitademen bewegen. Tijdens het vasthouden
         blijft de vorm staan waar hij staat — dat is wat vasthouden ís.

         `Easing.out(Easing.sin)` i.p.v. `inOut` (operator, 13 augustus
         2026: "de animatie gaat net iets te traag tov de stem en cyclus...
         beginnen inhale en exhale altijd net te laat als je de animatie
         volgt"). `inOut` bouwt aan het BEGIN van elke fase heel langzaam op
         — bij een korte fase (Fast Equal Breathing, 2 sec) is dat bijna een
         halve seconde nauwelijks-zichtbare beweging vóór de figuur echt in
         actie komt, terwijl de fase op de klok al loopt. `out` beweegt
         meteen zichtbaar bij de overgang en remt pas af richting het
         hoogste/laagste punt — dat volgt het moment waarop de fase
         WERKELIJK begint, in plaats van er een fractie achteraan te lopen. */
      if (k === 'inhale' || k === 'exhale') {
        /* Bij hervatten staat `breath` al bevroren op zijn tussenwaarde
           (pauzeSession annuleert de animatie zonder te resetten) —
           `withTiming` bouwt vanaf die HUIDIGE waarde verder naar hetzelfde
           doel, dus dit blijft naadloos zonder een aparte tussenwaarde te
           moeten uitrekenen. */
        breath.value = withTiming(k === 'inhale' ? 1 : 0, {
          duration: startLeft * 1000,
          easing: Easing.out(Easing.sin),
        });
      }

      /* Bij een NIEUWE fase begint de boog vanaf 0; bij hervatten staat hij
         al bevroren op zijn tussenwaarde (zelfde redenering als `breath`
         hierboven) en mag dat niet worden overschreven. */
      if (resumeAt === undefined) {
        arc.value = 0;
      }
      arc.value = withTiming(1, {
        duration: startLeft * 1000,
        easing: Easing.linear,
      });

      let left = startLeft;
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        left -= 1;
        elapsedRef.current += 1;
        setSecsLeft(left);
        if (left <= 0) {
          if (tickRef.current) clearInterval(tickRef.current);
          tickRef.current = null;
          /* Nul laten renderen vóór de fase wisselt, anders blijft "1"
             even hangen op de overgang. */
          nextRef.current = setTimeout(() => {
            /* Een ronde is voorbij zodra de LAATSTE fase van deze toestand
               is afgelopen — welke fase dat ook is.

               Hier stond `k === 'hold-out'`, en dat gold maar voor één van de
               vijf: alleen CALM heeft een tweede vasthoudmoment. BOOST, FOCUS,
               CLARITY en REST eindigen op uitademen, dus daar telde de ronde
               NOOIT op. Die sessies bleven eeuwig in ronde één hangen: de
               teller sprong elke paar seconden terug naar het begin, de tijd
               liep niet door en de sessie kon niet aflopen. Precies wat de
               operator zag.

               Nu wordt het einde van de ronde afgeleid uit de fasenlijst
               zelf, dus het klopt ook voor een toestand die er later bijkomt
               met een heel ander ritme. */
            const phases = techRef.current.phases;
            const idx = phases.findIndex((p) => p.key === k);
            const lastOfRound = idx === phases.length - 1;
            if (lastOfRound) {
              const n = r + 1;
              if (n > effectiveRoundsRef.current) {
                /* Preview op (locked, geen onboarding-uitzondering): 2
                   volledige cycli geademd, nu de zachte overgang naar de
                   paywall — geen afsluitscherm, dat is voor een echt
                   afgemaakte sessie (operator, 10 augustus 2026). */
                if (previewRef.current) {
                  endPreview();
                  return;
                }
                finish(true);
                return;
              }
              setRound(n);
              roundRef.current = n;
              runPhase(techRef.current.phases[0].key, n);
            } else {
              runPhase(nextOf(k).key, r);
            }
          }, 0);
        }
      }, 1000);
    },
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [arc, breath, finish],
  );

  /* ── Pauzeren ──────────────────────────────────────────────────────
     Operator, 8 september 2026: "wij zouden moeten kunnen pauzeren ook."
     Bewust NIET via `finish`/`stop` — dat schrijft de sessie weg en reset
     alles. Pauzeren bevriest gewoon alles ter plekke (timers, stem,
     trilling, de boog/ademfiguur op hun HUIDIGE waarde) en onthoudt hoeveel
     tijd er in de lopende fase nog over was, zodat `resumeSession` daar
     exact kan verdergaan via `runPhase`'s nieuwe `resumeAt`-parameter. */
  const pauseSession = useCallback(() => {
    if (!runningRef.current || pausedRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearTimers();
    Vibration.cancel();
    stopVoice();
    /* Annuleren, niet resetten: `breath`/`arc` blijven op hun huidige
       tussenwaarde staan, zodat `runPhase` er bij hervatten naadloos vanaf
       verder kan animeren (zie de commentaren daar). */
    cancelAnimation(breath);
    cancelAnimation(arc);
    pausedAtWallRef.current = Date.now();
    setPaused(true);
    pauseLiveSession();
    /* Eén sessie, twee bedieningen (6 okt 2026): de pols pauzeert mee. */
    pauseBreathSessionOnWear();
    pauseBreathSessionOnWatch();
  }, [arc, breath, clearTimers]);

  const resumeSession = useCallback(() => {
    if (!runningRef.current || !pausedRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pausedAtWallRef.current > 0) {
      pausedMsRef.current += Date.now() - pausedAtWallRef.current;
      pausedAtWallRef.current = 0;
    }
    setPaused(false);
    resumeLiveSession();
    /* De pols gaat verder op exact dezelfde plek: zelfde ronde, zelfde fase,
       met wat er van die fase nog over is (6 okt 2026). */
    relayBreathToWatches({
      startRound: round,
      startPhase: Math.max(0, techRef.current.phases.findIndex((p) => p.key === phase)),
      phaseRemainingMs: Math.round(secsLeft * 1000),
    });
    /* Operator, 24 september 2026 (10de melding, de echte oorzaak): bij de
       ALLEREERSTE hervatting (na `start(preview, startPaused=true)`) is de
       huidige fase nog nooit gesproken — `runPhase()` hieronder kondigt
       enkel de VOLGENDE fase vooruit aan, nooit zijn eigen. Zonder deze
       inhaalslag bleef de openingsfase van elke sessie stom. Bij een
       gewone pauze MIDDEN in een sessie is dit gewoon `false` (die fase
       werd al gesproken vóór de pauze), dus dan gebeurt hier niets nieuws. */
    if (firstSpeakPendingRef.current) {
      firstSpeakPendingRef.current = false;
      speak(byKey(phase));
    }
    /* `secsLeft`/`phase`/`round` zijn hier de state van de HUIDIGE render —
       deze functie wordt rechtstreeks vanuit een tik aangeroepen (geen
       verouderde timer-closure), dus vers genoeg om zonder refs te lezen. */
    runPhase(phase, round, secsLeft);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [phase, round, secsLeft, runPhase, speak, byKey]);

  /* iPhone: de pauze/hervat-knop in de Live Activity (vergrendelscherm en
     Dynamic Island, iOS 17+) bedient deze sessie zoals de knop hier. */
  useEffect(
    () =>
      onLiveToggle('breath', () => {
        if (!runningRef.current) return;
        if (pausedRef.current) resumeSession();
        else pauseSession();
      }),
    [pauseSession, resumeSession],
  );

  /* ── De inhaalslag ─────────────────────────────────────────────────
     Het vangnet ONDER het audio-anker. Houdt Android het proces toch tegen
     (agressieve batterijstand, anker geweigerd), dan loopt de getikte klok
     achter op de werkelijkheid. Bij terugkeer naar de voorgrond wordt de
     sessie hier naar de wandklok gezet: klaar als de tijd om is, anders
     springen ronde en fase naar waar ze hóren te staan. De historiek
     schreef al wandklok (zie finish); nu klopt ook wat je ZIET na het
     ontgrendelen. */
  const runningRef = useRef(false);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  const cycleRef = useRef(CYCLE_S);
  useEffect(() => {
    cycleRef.current = CYCLE_S;
  }, [CYCLE_S]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st2) => {
      if (st2 !== 'active') {
        /* ── Scherm gaat op slot / app naar achtergrond ────────────────
           Pas HIER de native achtergrond-lus bewapenen — niet al bij
           start() (operator, 13 augustus 2026: "dubbele stem... kijk dit
           voor alle modi na"). De native cyclus liep voorheen ONVOORWAARDELIJK
           vanaf sessie-start náást de JS-lus, dus zolang het scherm AAN
           stond speelden allebei elke cue — de dubbele stem was dat, elke
           keer, elke toestand. Nu start native pas zodra JS zelf dreigt te
           bevriezen, en stopt weer zodra JS het overneemt (zie de 'active'-
           tak hieronder) — nooit meer dan één bron tegelijk. */
        /* Operator, 8 september 2026 (pauzeren): tijdens een pauze mag hier
           NIETS gebeuren — geen native bewapening, geen wandklok-meting.
           Pauzeren betekent per definitie "er gebeurt niets", ongeacht of
           het scherm ondertussen ook nog naar de achtergrond gaat. */
        if (!runningRef.current || pausedRef.current || startWallRef.current <= 0) return;
        const bgUris = pendingCueUrisRef.current;
        if (!bgUris) return;
        const cycle = Math.max(1, cycleRef.current);
        const elapsedNow =
          (Date.now() - startWallRef.current - pausedMsRef.current) / 1000;
        const off0 = elapsedNow % cycle;
        const phases = techRef.current.phases;
        let off = off0;
        let idx = 0;
        while (idx < phases.length - 1 && off >= phases[idx].secs) {
          off -= phases[idx].secs;
          idx += 1;
        }
        const remainingSec = Math.max(0, phases[idx].secs - off);
        const roundNow = Math.min(
          effectiveRoundsRef.current,
          Math.floor(elapsedNow / cycle) + 1,
        );
        const totalMs = effectiveRoundsRef.current * cycle * 1000;
        const sessionRemainingMs = Math.max(0, totalMs - elapsedNow * 1000);
        startBackgroundBreathSession({
          /* 'inhale-2'/'exhale-2' (Physiological Sigh, Alternate Nostril
             Breathing) bestaan niet in de native background-bridge — die
             zou een echte Kotlin/Swift-uitbreiding vergen (nieuwe build),
             wat de operator voor deze V1-protocolset expliciet niet wilde.
             Ze hebben toch al hetzelfde haptiek-/stempatroon als hun eerste
             helft (zie breath-haptics.ts/breath-voice.ts), dus platslaan
             naar 'inhale'/'exhale' hier verliest niets voor de achtergrond-
             sessie — enkel de voorgrond-UI (die WEL de echte key gebruikt
             voor tekst/labels) ziet het verschil. */
          phases: phases.map((p) => ({
            key:
              p.key === 'inhale-2'
                ? ('inhale' as const)
                : p.key === 'exhale-2'
                  ? ('exhale' as const)
                  : p.key,
            secs: p.secs,
          })),
          rounds: effectiveRoundsRef.current,
          inhaleCueUri: bgUris.inhale,
          holdCueUri: bgUris.hold,
          exhaleCueUri: bgUris.exhale,
          cueLeadMs: CUE_LEAD_MS,
          startPhaseIdx: idx,
          startRound: roundNow,
          startRemainingMs: Math.round(remainingSec * 1000),
          modeName: st.eyebrow,
          totalDurationMs: totalMs,
          sessionRemainingMs: Math.round(sessionRemainingMs),
        });
        return;
      }
      /* Terug in de voorgrond: native mag stil vallen, JS neemt het weer
         over — anders kan een net geplande native wekker vlak na deze
         catch-up alsnog afgaan en opnieuw een dubbele cue geven. */
      stopBackgroundBreathSession();
      /* Idem: tijdens een pauze geen inhaalslag — die zou de gepauzeerde
         tijd aanzien voor een bevroren klok en de sessie laten "inhalen"
         wat er net bewust stilgelegd is. */
      if (!runningRef.current || pausedRef.current || startWallRef.current <= 0) return;
      const trueElapsed =
        (Date.now() - startWallRef.current - pausedMsRef.current) / 1000;
      /* Kleine afwijking is gewoon jitter; pas vanaf drie seconden is het
         een bevroren klok geweest. */
      if (trueElapsed - elapsedRef.current < 3) return;
      const cycle = Math.max(1, cycleRef.current);
      /* effectiveRoundsRef, niet roundsRef: bij een preview (zie runPhase
         hierboven) is dit de verlaagde 2-cycli-grens, anders identiek aan
         roundsRef. */
      const total = effectiveRoundsRef.current * cycle;
      if (trueElapsed >= total) {
        if (previewRef.current) {
          endPreview();
          return;
        }
        finish(true);
        return;
      }
      if (tickRef.current) clearInterval(tickRef.current);
      if (nextRef.current) clearTimeout(nextRef.current);
      if (preRef.current) clearTimeout(preRef.current);
      elapsedRef.current = Math.floor(trueElapsed);
      const newRound = Math.min(
        effectiveRoundsRef.current,
        Math.floor(trueElapsed / cycle) + 1,
      );
      roundRef.current = newRound;
      setRound(newRound);
      /* De fase waarin dit moment valt. De rest van de fase loopt gewoon af
         — hoogstens een paar tellen verschil, en dan tikt alles weer. */
      let off = trueElapsed % cycle;
      const phases = techRef.current.phases;
      let i = 0;
      while (i < phases.length - 1 && off >= phases[i].secs) {
        off -= phases[i].secs;
        i += 1;
      }
      runPhase(phases[i].key, newRound);
    });
    return () => sub.remove();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [finish, runPhase]);

  /* ── De poort ──────────────────────────────────────────────────────
     Sessies zijn premium (operator, 8 augustus 2026: "de breathe in de app
     pas unlocked na premium"). Premium = het abonnement, punt — niet de
     bracelet. Hier stond "bracelet-koper heeft de sessies gratis, dat is
     de afspraak", en dat was nooit een afspraak: mijn eigen aanname van
     8 augustus, teruggedraaid op 9 augustus ("breathwork zal niet gratis
     zijn bij aankoop bracelet").

     De poort staat op STARTEN, niet op kijken: iedereen mag alle vijf de
     toestanden en ritmes zien, dat is de etalage. En de popup is WEGKLIKBAAR
     (operator wees naar Breathwrk): een muur die je niet kunt sluiten voelt
     als gijzeling, eentje mét kruisje als een aanbod.

     Eén uitzondering: de kennismakingssessie uit de onboarding
     (`from=onboarding`) — wie de intro uitloopt, verdient één echte sessie
     voor er ooit om geld gevraagd wordt.

     Tweede laag (operator, 10 augustus 2026: "na onboarding elke sessie 1
     of 2 cycli laten doen en dan stoppen, zo kan iedereen elke sessie
     ervaren"): STARTEN op een geblokkeerde sessie opent niet langer meteen
     de paywall, maar een ECHTE preview — PREVIEW_ROUNDS volledige cycli,
     met stem/haptiek/beeld precies zoals een betaalde sessie. Pas ná die
     cycli komt de paywall, als een zachte overgang i.p.v. een muur vooraf.
     Wie liever meteen wil betalen zonder eerst te proeven heeft de aparte
     "Unlock all sessions"-link naast de startknop — die opent de paywall
     rechtstreeks (operator: "wat als user onmiddellijk wil kopen zonder
     eerst de cycles te doen?").

     De bracelet ontgrendelt hier BEWUST niets meer (operator, 9 augustus
     2026: "breathwork zal niet gratis zijn bij aankoop bracelet"). Eerder
     stond hier `sub.isPro || sub.hasBracelet` — dat was een eigen aanname
     van mij, nooit een afspraak, en precies verkeerd: Premium is het enige
     wat de sessies ontgrendelt, de bracelet doet dat niet vanzelf mee. */
  /* Operator, 7 september 2026: "2 cycles verwijderen, 30 sec preview per
     state" — een vast rondeaantal (2) gaf een heel ANDERE preview-lengte
     per toestand (2x BOOST ≈ 4-6s, 2x REST ≈ 20s). Nu voor elke toestand
     hetzelfde: zoveel rondes als in ~30 seconden passen, met minstens 1
     zodat een trage toestand (bv. REST, 10s/ronde) niet op nul uitkomt. */
  /* Operator, 2 okt 2026 ("sessie hier via instant reset moet ook locken
     na 30 sec"): instant-sessies kregen hier een uitzondering (60s i.p.v.
     de standaard 30s preview) — teruggedraaid, zelfde 30s-grens als elke
     andere preview-sessie in de app. De zachte fade-overgang (`endPreview`
     hieronder) blijft wel instant-specifiek bestaan. */
  const PREVIEW_SECONDS = 30;
  const PREVIEW_ROUNDS = Math.max(1, Math.round(PREVIEW_SECONDS / CYCLE_S));
  /* Zachte overgang i.p.v. harde cut (enkel instant-pad, zie hierboven):
     laat de achtergrondscape uitvervagen (bestaande 1,5s-fade) vóór de
     paywall verschijnt, in plaats van `finish()`'s eigen `stopScape(true)`
     (instant stil). Niet-instant preview-sessies blijven ongewijzigd. */
  /* Operator, 8 okt 2026 ("die foute lotus in een vierkante kaart"): na de
     30 s NIET meer stoppen maar PAUZEREN, net als bij vroegtijdig stoppen
     (requestStop). Gestopt tekende dit scherm meteen zijn oude startweergave
     (lotus in een kaart, "ENJOY YOUR SESSION") achter het betaalscherm, en
     die bleef na Done even staan. Gepauzeerd blijft het echte sessiebeeld
     achter het glas; echt gestopt wordt bij het sluiten (onClose). */
  const endPreview = useCallback(() => {
    if (isInstantSession) {
      stopScape(false);
      setTimeout(() => {
        pauseSession();
        setPaywall(true);
      }, 1500);
      return;
    }
    pauseSession();
    stopScape(false);
    setPaywall(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInstantSession, pauseSession]);
  const [paywall, setPaywall] = useState(false);
  /* Soundscapes: Rain + Canopy gratis, rest Premium (8 okt 2026). Eigen
     paywall-staat: sluiten laat de sessie gewoon doorlopen (de sessie-
     paywall hierboven beëindigt de sessie bij sluiten). */
  const [scapePaywall, setScapePaywall] = useState(false);
  const scapeLocked = (k: string) => !isPro && !FREE_SOUNDSCAPES.has(k);
  const pickScapeGated = (k: string | null) => {
    if (k && scapeLocked(k)) {
      Haptics.selectionAsync();
      setAvSheetOpen(false);
      setScapePaywall(true);
      return;
    }
    pickScape(k);
  };
  /* Operator, 8 okt 2026 ("ik wil die foute lotus in een vierkante kaart
     nooit meer zien"): tussen stoppen en het verdwijnen van de sessielaag
     tekende dit scherm één moment zijn rusttoestand. Zodra we vertrekken,
     ligt er een effen vlak over — wat eronder verandert, is niet te zien. */
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (params.paywall === '1') setPaywall(true);
  }, [params.paywall]);
  /* Operator, 7 september 2026: "als gebruiker het deels heeft gezien en
     bewust aanklikt [stoppen], misschien popup met 'end trial'?" — de
     eenmalige gratis kennismakingssessie mag niet stilletjes verdampen op
     een misklik. Verschijnt ALLEEN voor deze ene kostbare sessie, niet bij
     elke gewone stop — anders is het een irritante extra tik voor iedereen
     die gewoon een normale sessie afbreekt. */
  const [endTrialConfirm, setEndTrialConfirm] = useState(false);
  /* Operator, 2 okt 2026: niet-blokkerende feedback na een instant-
     gestarte, volledig afgeronde sessie — "Worked"/"Too hard"/"Too long"
     past de gedeelde `experienceLevel`/`instantDurationBias`-instellingen
     aan (zie utils/instant-feel.ts), app-breed, niet enkel voor dit pad.
     Geen popup: een kleine tekstregel op het bestaande "Well done"-scherm,
     genegeerd kan worden zonder enige actie. */
  const [instantFeedbackGiven, setInstantFeedbackGiven] = useState(false);
  const onInstantFeedback = useCallback((fb: InstantFeedback) => {
    setInstantFeedbackGiven(true);
    void recordInstantFeedback(fb);
  }, []);
  /* De audiosessie die deze toestand verdiept — één per toestand, gratis. */
  /* Testschakelaar in Settings (operator, 13 augustus 2026: "ik wil
     permanent om regelmatig te kunnen testen") — zelfde bypass als de
     from=onboarding-deeplink, maar dan zonder telkens een URL te moeten
     intikken. Puur lokaal/dev-gebruik, geen echte entitlement. */
  const [testFullSessions] = useSetting('testFullSessions');
  const locked = !isPro && !isFreeOnboardingSession && !(__DEV__ && testFullSessions);
  /* Eenmalige, proactieve uitleg over scherm-op-slot (operator, 14
     augustus 2026: "iemand die gewoon breathwork begint gaat nooit weten
     dat het hierdoor komt... iedereen gaat denken het werkt niet") — dit
     zat eerst alleen verstopt in Settings, wat niemand toevallig
     tegenkomt vlak vóór het probleem zich voordoet. Nu toont START zelf
     de uitleg, precies op het moment dat hij ertoe doet. */
  const [hasSeenBatteryPrompt, setHasSeenBatteryPrompt] = useSetting(
    'hasSeenBatteryPrompt',
  );
  /* Blijvende banner i.p.v. eenmalige popup (operator, 14 augustus 2026:
     "hoe weet user dat dit daar staat? hij moet al de link maken dat het
     iets met batterij te maken heeft") — een popup die je maar één keer
     ziet lost niets op voor wie toen "Not now" tikte en het probleem pas
     ÉCHT tegenkomt op een LATERE, willekeurige sessie, ver van waar de
     uitleg ooit stond. Dit staat gewoon zichtbaar op het startscherm,
     elke keer, zolang het probleem er is — niets om te hoeven onthouden.
     Herchecked bij elke focus (niet alleen mount), zodat 'm oplossen via
     de knop en teruggaan de banner meteen laat verdwijnen. */
  const [batteryRestricted, setBatteryRestricted] = useState(false);
  /* Geen navigatiescherm meer (sessie-laag): bij openen en telkens de app
     terug op de voorgrond komt opnieuw kijken. */
  useEffect(() => {
    const check = () => {
      if (Platform.OS === 'android') {
        setBatteryRestricted(!isIgnoringBatteryOptimizations());
      }
    };
    check();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') check();
    });
    return () => sub.remove();
  }, []);

  /* Operator, 11 september 2026 (25e ronde): "breathwork active pagina
     moet op pauze starten, user moet zelf op play drukken" — anders dan
     de 22e/24e ronde hierboven (die een apart "wacht op tik"-SCHERM
     bouwden, ondertussen weer teruggedraaid): dit is nu letterlijk het
     bestaande pauzeren-mechanisme, één keer aan het begin. `startPaused`
     laat alles wat normaal bij START gebeurt gewoon gebeuren (achtergrond-
     scape, keepalive-anker, native cue-voorbereiding — precies zoals een
     gewone pauze MIDDEN in een sessie die dingen ook niet stopt), maar
     slaat de allereerste stem-cue en `runPhase` (dus de countdown/
     ademanimatie) over en zet METEEN `paused=true` i.p.v. `false`. De
     bestaande PAUSE/PLAY-knop (`paused ? resumeSession : pauseSession`)
     toont dan al bij aankomst het play-icoon; `resumeSession()` doet de
     rest — dezelfde functie die ook een echte pauze MIDDEN in een sessie
     hervat, hier voor het eerst aangeroepen vanaf de volle faseduur
     (`phase`/`secsLeft`/`round` staan hier nog op hun initiële waarden). */
  /* ── Horloge-begeleiding (Wear OS + Apple Watch) ───────────────────────
     ÉÉN bericht met de volledige sessie — geen tik per fase over Bluetooth.
     `at` = waar het horloge verder moet na een pauze (ronde, fase, wat er
     van die fase nog over is). Faalt stil: geen horloge, of het andere OS. */
  const relayBreathToWatches = useCallback(
    (at?: { startRound: number; startPhase: number; phaseRemainingMs: number }) => {
      try {
        const phases = techRef.current.phases;
        /* Zelfde naam en kleur als in de app ("Calm Control", Sleep in het
           lichte teal), voor de cirkel op het horloge (6 okt 2026). */
        const name = st.eyebrow.charAt(0) + st.eyebrow.slice(1).toLowerCase().replace(/ (\w)/g, (m) => m.toUpperCase());
        const colorHex = st.key === 'rest' ? '#4AF0D4' : st.accent;
        sendBreathSessionToWear({
          phases: phases.map((p) => ({
            key: p.key,
            secs: p.secs,
            pattern: phaseHapticPattern(p.key, p.secs),
          })),
          rounds: effectiveRoundsRef.current,
          modeName: name,
          colorHex,
          ...(at ?? {}),
        });
        sendBreathSessionToWatch({
          phases: phases.map((p) => ({ key: p.key, secs: p.secs })),
          rounds: effectiveRoundsRef.current,
          modeName: name,
          colorHex,
          ...(at ?? {}),
        });
      } catch {
        /* stil */
      }
    },
    [st.eyebrow, st.key, st.accent],
  );

  const start = useCallback((preview = false, startPaused = false) => {
    if (startingRef.current) return;
    startingRef.current = true;
    previewRef.current = preview;
    effectiveRoundsRef.current = preview
      ? Math.min(roundsRef.current, PREVIEW_ROUNDS)
      : roundsRef.current;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    /* Fire-and-forget: zet `doNotMix` zodra de native bridge het toelaat.
       Geen await/`.then()`-wrapping meer rond de audio-aanroepen verderop
       (operator, 24 september 2026, 9de melding) — dat bleek de
       allereerste `speak()`-aanroep te laten verdwijnen (zie daar). De
       retry-lus in `playUrl()` vangt op als de modus nog niet actief was. */
    ensureAudioModeSet();
    /* Het audio-anker: een lus van stilte die het proces levend houdt als
       het scherm op slot gaat (operator, 8 augustus 2026: "als ik scherm
       lock moet het ook verder gaan"). Alléén nog op iOS (operator, 15
       augustus 2026: "de visuals tijdens lockscreen lijken nu audio
       sessies... juiste informatie geven?"). Op Android droeg dit anker
       zelf een mediasessie met de modusnaam als titel maar een
       voortgangsbalk van de 1-seconde-stilte-lus (00:00/00:01) — los van
       de echte sessieduur. Nu de native BreathSessionService de hele
       achtergrond-cyclus zelfstandig draagt, met een eigen, correcte
       melding (chronometer + voortgangsbalk op de echte sessieduur — zie
       BreathSessionService.kt), is dit anker op Android overbodig én de
       bron van de verwarrende dubbele/foutieve lockscreen-widget. iOS
       heeft nog geen eigen achtergrond-cyclus (geen wake lock-equivalent
       hier), dus blijft op dit anker leunen. */
    if (Platform.OS !== 'android') {
      /* iPhone: de ademsessie als Live Activity op het vergrendelscherm en in
         het Dynamic Island (6 okt 2026). Begint gepauzeerd als de sessie op
         Play wacht; hervatten/pauzeren werken hem bij. */
      const liveTotal = Math.round(effectiveRoundsRef.current * cycleRef.current);
      showLiveSession({
        kind: 'breath',
        title: st.eyebrow.charAt(0) + st.eyebrow.slice(1).toLowerCase().replace(/ (\w)/g, (m) => m.toUpperCase()),
        subtitle: tech.name,
        colorHex: st.key === 'rest' ? '#4AF0D4' : st.accent,
        remainingSec: liveTotal,
        totalSec: liveTotal,
        paused: startPaused,
      });
      try {
        /* Uitgestelde stop van een vorige sessie mag deze niet raken. */
        if (keepAliveStopRef.current) {
          clearTimeout(keepAliveStopRef.current);
          keepAliveStopRef.current = null;
        }
        startSessionKeepAlive({ title: st.eyebrow, subtitle: tech.name });
        if (voiceRef.current) preloadCompletionCue(st.key as BreathKey);
      } catch {
        /* Zelfde reden als de try/catch verderop in deze functie: het
           achtergrond-anker mag START nooit blokkeren. */
      }
    } else {
      /* Android 13+ toont GEEN enkele melding — ook niet de
         achtergrond-sessie-melding hierboven — zonder de aparte
         POST_NOTIFICATIONS-toestemming (operator, 15 augustus 2026: "boost
         in lock lijkt te werken maar helemaal geen visuals in lockscreen").
         De sessie zelf loopt gewoon door zonder deze toestemming (audio/
         haptiek zijn niet afhankelijk van een melding) — dit is puur voor
         het vergrendelscherm-venster erop, dus mag START nooit blokkeren.
         Hergebruikt dezelfde ensurePermission() als de agenda-herinneringen
         — één plek voor de expo-notifications-aanvraag, geen eigen kopie. */
      void ensureNotificationPermission();
    }
    /* ── De native achtergrond-loop: alleen VOORBEREID, niet gestart ────
       Android's Doze-modus bevriest de JS-thread — waar de hele fase-loop
       hierboven op draait — ongeacht of er audio speelt (empirisch
       gemeten, 13-14 augustus 2026). Native (modules/breath-background)
       herhaalt dezelfde cyclus buiten JS om, MAAR mag pas echt draaien
       zodra het scherm op slot gaat/de app naar de achtergrond gaat — zie
       de AppState-listener verderop. Hier alleen de drie cue-bestanden
       ÉÉNMALIG oplossen (dezelfde resolveCueUris() als playBreathCue(),
       één bron van waarheid) en klaarzetten in een ref; start()
       NIET onvoorwaardelijk native bewapenen naast de altijd-actieve
       JS-lus (operator, 13 augustus 2026: "dubbele stem" — dat was precies
       hierdoor: beide liepen tegelijk zolang het scherm aan stond). */
    try {
      const exhalePhase = techRef.current.phases.find(
        (p) => p.key === 'exhale',
      );
      const uris = resolveCueUris(
        st.key as BreathKey,
        exhalePhase?.via === 'Mouth' ? 'mouth' : 'nose',
      );
      pendingCueUrisRef.current = {
        inhale: assetUri(uris.inhale),
        hold: assetUri(uris.hold),
        exhale: assetUri(uris.exhale),
      };
    } catch {
      /* De achtergrond-voorbereiding mag START NOOIT blokkeren — zonder
         deze try/catch stopte een fout hier de hele sessie voor ze ooit
         begon (operator, 13 augustus 2026: "Start Session doet niets").
         Zonder pendingCueUrisRef bewapent de AppState-listener native
         straks gewoon niet; de sessie draait dan zoals vóór deze module
         bestond. */
      pendingCueUrisRef.current = null;
    }
    /* Horloge-begeleiding (Wear OS + Apple Watch): ÉÉN bericht met de
       volledige sessie, net als de achtergrond-voorbereiding hierboven —
       geen tik per fase over Bluetooth. Elk platform negeert zijn eigen
       no-op stil (geen horloge gekoppeld, of het andere OS) — zie de
       try/catch-regel in wear-breath/watch-breath index.ts. Mag START
       nooit blokkeren, dus altijd in een eigen try/catch. */
    /* 6 okt 2026: enkel als de sessie echt loopt. Wacht ze nog op Play
       (startPaused), dan gaat ze pas bij de eerste hervatting naar het
       horloge — anders liep de pols al terwijl de telefoon stilstond. */
    if (!startPaused) relayBreathToWatches();
    startWallRef.current = Date.now();
    claimVoiceSource('breath');
    /* Het achtergrondgeluid hoort bij de sessie, niet bij het scherm: het komt
       op met START en gaat weg met END.
       Operator, 24 september 2026 (9de melding, teruggedraaid): zelfde
       reden als bij `speak()` hieronder — een `audioModeReady.then()`-
       wrapping bleek de aanroep te laten verdwijnen. Terug naar direct. */
    void playScape(scapeKey);
    setRunning(true);
    hasStartedOnceRef.current = true;
    setRound(1);
    roundRef.current = 1;
    elapsedRef.current = 0;
    /* Defensieve reset (pauzeren, 8 september 2026): hoort altijd al 0 te
       zijn hier, `finish()` ruimt zelf op — maar een nieuwe sessie mag nooit
       toevallig de pauze-boekhouding van een vorige erven. */
    pausedMsRef.current = 0;
    pausedAtWallRef.current = 0;
    cancelAnimation(breath);
    breath.value = 0;
    if (startPaused) {
      /* `phase`/`secsLeft` staan al op hun initiële waarden (`useState`
         hierboven: 'inhale', eerste fase se volle duur) — precies wat een
         nooit-gestarte sessie moet tonen. `pausedAtWallRef` blijft op 0
         (geen "reeds verstreken pauzetijd" af te trekken bij de eerste
         echte hervatting). Geen `speak`/`runPhase` hier: dat is exact wat
         de PLAY-tik (`resumeSession`) zo dadelijk alsnog doet — maar
         `runPhase()` spreekt enkel de VOLGENDE fase vooruit uit, nooit
         zijn eigen fase, dus zonder deze vlag zou de fase waarmee je
         resumet nooit klinken (operator, 24 september 2026, 10de melding,
         de echte oorzaak — zie `firstSpeakPendingRef` hierboven). */
      firstSpeakPendingRef.current = true;
      /* Audit 8 okt 2026: het wachten vóór de eerste tik op Play is een
         pauze, geen ademtijd. Stond dit op 0, dan telde die wachttijd mee:
         na het vergrendelen sprong de sessie vooruit of eindigde ze meteen
         als "voltooid", en de historiek kreeg te veel minuten. */
      pausedAtWallRef.current = Date.now();
      setPaused(true);
      return;
    }
    setPaused(false);
    /* De allereerste cue kan per definitie niet vooruitlopen — er is geen
       fase vóór deze. Die klinkt dus gelijk met de start.
       Operator, 11 september 2026 (2e ronde): Ujjayi's keelklank-uitleg
       ("Soft throat sound") verhuisde van hier (één keer, in plaats van de
       eerste "Inhale"-aankondiging) naar een eigen tekst-popup VÓÓR de
       sessie start (zie `ujjayiIntroOpen` verderop) — een los woordje
       tijdens de sessie legde niet uit WAT je moest doen, enkel DAT er iets
       was. De popup speelt zijn eigen, uitgebreidere uitleg-cue
       (`playUjjayiStartCue()`, nu "Create a soft Darth Vader–like sound...")
       vóórdat deze functie draait, dus hier weer gewoon het normale pad
       voor elke techniek.
       Operator, 24 september 2026 (9de melding, teruggedraaid): een versie
       die deze aanroep in `audioModeReady.then()` wikkelde stond hier
       eerder — bevestigd KAPOT via live logcat: `speak()`'s eigen
       `__DEV__`-log verscheen dan NOOIT voor deze allereerste cue (elke
       latere cue, via runPhase()'s eigen timer, logde en klonk wél
       feilloos). De promise-chain verloor deze ene aanroep op een niet
       gevonden manier. Terug naar de simpele, altijd-uitgevoerde directe
       aanroep — `ensureAudioModeSet()` hierboven blijft gewoon fire-and-
       forget staan (kan geen kwaad), en de bestaande retry-lus in
       `playUrl()` (tot 2 sec) is het echte vangnet als de modus nog niet
       actief is. */
    speak(techRef.current.phases[0]);
    runPhase(techRef.current.phases[0].key, 1);
  }, [breath, runPhase, st.key]);

  /* Operator, 11 september 2026 (22e ronde): "enjoy your session pagina
     weg" — hier stond eerder een volledige `beginCountdown()`-keten
     (rustig infadende Buddha-overlay + voortgangsbalk, 1400ms hold +
     700ms uitfade, dan pas `start()`). Nu de sessie sowieso pas begint
     na een bewuste tik op START/TRY (zie de verwijderde auto-start
     hierboven), voegt die ceremoniële vertraging niets meer toe — de tik
     ZELF is al het "ik ben klaar"-moment. `proceedToStart` roept `start`
     daarom rechtstreeks aan. */

  /* Vraagt EERST de uitleg, start de sessie pas NA het antwoord (operator,
     14 augustus 2026: "sessie begint onmiddellijk terwijl ik nog aan het
     lezen ben") — de vorige versie toonde de uitleg als bijwerking BINNEN
     start(), dus de sessie liep al terwijl de popup nog open stond. Nu
     bepaalt het antwoord ZELF wanneer start() draait: "Not now" start
     meteen zonder de systeem-permissie, "Continue" vraagt 'm eerst en
     start dan. Toont zich hooguit één keer ooit (hasSeenBatteryPrompt). */
  const proceedToStart = useCallback(
    (preview = false) => {
      if (
        Platform.OS === 'android' &&
        !hasSeenBatteryPrompt &&
        !isIgnoringBatteryOptimizations()
      ) {
        void setHasSeenBatteryPrompt(true);
        void showVibezAlert({
          title: 'One more step',
          message:
            "Your phone is about to ask permission for VIBEZCORE to keep running when your screen is locked. Tap \"OK\" or \"Allow\" on that screen — otherwise your session's voice and vibration can stop partway through.",
          light,
          buttons: [
            { text: 'Not now', style: 'cancel', onPress: () => start(preview, true) },
            {
              text: 'Continue',
              style: 'primary',
              onPress: () => {
                requestIgnoreBatteryOptimizations();
                start(preview, true);
              },
            },
          ],
        });
        return;
      }
      start(preview, true);
    },
    [hasSeenBatteryPrompt, setHasSeenBatteryPrompt, start],
  );

  /* Operator, 11 september 2026: Ujjayi's keelklank ("Create a soft Darth
     Vader–like sound...") is niet vanzelfsprekend — wie de techniek niet
     kent, weet niet wat er bedoeld wordt met "Soft throat sound" tijdens
     de sessie zelf. Vóór de gewone start-poort (batterij-check/countdown)
     nu een eigen, korte tekst-popup MET de bijbehorende uitleg-cue, enkel
     voor deze techniek. `ujjayiPreviewRef` onthoudt of dit een preview-tik
     was, want de popup onderbreekt het normale `preview`-argument. */
  const ujjayiPreviewRef = useRef(false);
  const [ujjayiIntroOpen, setUjjayiIntroOpen] = useState(false);
  const startWithBatteryCheck = useCallback(
    (preview = false) => {
      if (tech.key === 'ujjayi') {
        ujjayiPreviewRef.current = preview;
        setUjjayiIntroOpen(true);
        /* Operator, 11 september 2026 (3e ronde): "geen audio bij popup...
           audio moet bij eerste popup beginnen" — speelt nu METEEN als de
           popup verschijnt (auto-play), niet pas als "Got it" ingedrukt
           wordt. */
        playUjjayiStartCue();
        return;
      }
      proceedToStart(preview);
    },
    [tech.key, proceedToStart],
  );

  /* Operator, 11 september 2026 (24e ronde, herroept de 22e ronde
     hierboven): "dit is een oude setting/duration-pagina die nog eens
     verschijnt, doe iets TOTAAL anders" — de 22e ronde liet dit scherm
     bewust in rust openen (idle pacer + eigen START/TRY-knop), met de
     bedoeling dat DIE knop de bewuste "play"-tik zou zijn. In de praktijk
     las dat niet als een rust-scherm maar als een tweede, overbodige
     kopie van breath-setup.tsx: user tikt daar al op "Try 30 seconds
     free"/"Start session", en komt dan op EEN VOLGEND scherm met exact
     dezelfde knoptekst — alsof er niets gebeurde. De bewuste "play"-tik
     IS de tik op breath-setup.tsx's eigen CTA; dit scherm moet daarna
     direct in de lopende sessie belanden, zonder eigen tussenstop. Terug
     naar automatisch starten op mount — de "Enjoy your session"-Buddha-
     intro blijft WEL verwijderd (zie proceedToStart/start hierboven),
     dat was een apart, correct verzoek. */
  const autostarted = useRef(false);
  useEffect(() => {
    if (autostarted.current) return;
    autostarted.current = true;
    if (locked) {
      startWithBatteryCheck(true);
    } else {
      startWithBatteryCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Operator, 11 september 2026 (8e ronde): dit scherm droeg zijn EIGEN,
     oudere kies-UI (ritme-chips, duur-chips, START/TRY-knop) uit de tijd
     vóór `breath-setup.tsx` bestond. Sinds de 9e ronde hierboven (elke
     ingang start altijd automatisch) is die UI overal onbereikbaar — deze
     vlag is nu enkel nog de gate die dat garandeert, ongeacht welke
     query-param een aanroeper wel of niet meegeeft.

     Operator, 11 september 2026: "iets kapot gemaakt, na pauzeren en
     stoppen kom ik op een foute/lege pagina" — zonder `hasStartedOnceRef`
     werd deze vlag NA een sessie (pauzeren → stoppen → `finish()` zet
     `running` terug op `false`) weer `true`, dus verdween ALLES wat
     hierop gate't (figuur, duur-kiezer, CTA, battery-banner, unlock-link)
     na het einde van een sessie, met een leeg scherm als gevolg.
     `hasStartedOnceRef` (hierboven gedeclareerd, gezet in `start()`)
     onderscheidt "nog nooit gestart" van "al gestart en nu gestopt" —
     enkel de EERSTE situatie mag dit gedeelte verbergen.
     Operator, 11 september 2026 (22e ronde, ZELF WEER HERROEPEN in de
     24e ronde): een tussentijdse versie zette dit vast op `false` zodat
     het rust-scherm (figuur + eigen START-knop) ALTIJD zichtbaar bleef —
     bedoeld als bewuste "wacht op play"-stap, maar las in de praktijk als
     een overbodige tweede kopie van breath-setup.tsx (zie de toelichting
     bij de herstelde auto-start hierboven). Nu weer terug op de
     oorspronkelijke betekenis: enkel waar tijdens het korte venster
     vóórdat de herstelde auto-start daadwerkelijk vuurt. */
  /* Oude startscherm (figuur-kaart, START/ENJOY YOUR SESSION, unlock-link, batterijbanner) bestaat niet meer — operator, 8 okt 2026: "waarom bestaat dat oude startscherm nog?". Was enkel nog bereikbaar als een gestarte sessie stopte zonder einde (o.a. na de 30 s preview) en flitste dan achter het betaalscherm. */ 
  const awaitingAutostart = !running && !hasStartedOnceRef.current;

  const stop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    finish();
  }, [finish]);

  /* Operator, 7 september 2026: "user kan ook via CTA 'end session'
     eindigen, daar moet ook dezelfde popup gelinkt worden" — de X-knop
     bovenaan had de "End trial?"-check, maar de losse END SESSION-knop
     onderaan riep `stop` nog rechtstreeks aan en omzeilde 'm. Beide moeten
     door dezelfde beslissing lopen, dus één gedeelde functie i.p.v. de
     check op twee plekken te dupliceren (en de volgende keer opnieuw te
     vergeten op een derde plek). */
  /* Operator, 11 september 2026: "bij stoppen zie ik enkele seconden het
     oude set session pagina" — een gewone `router.back()` popt terug naar
     wat er toevallig op de stack staat (breath-setup.tsx, of — bleek 14
     september — zelfs breath-welcome.tsx als je via de onboarding/gratis-
     sessie binnenkwam). Dat gokwerk gaf steeds een nieuwe variant van
     dezelfde klacht: "ik zie een pagina die ik nooit meer had moeten zien".
     Operator, 14 september 2026 (totale omgooi, geen `back()` meer): "end
     session moet terug naar select pagina op breathwork" — dus niet meer
     proberen te raden waar je vandaan kwam, gewoon ALTIJD expliciet naar
     de CHOOSE YOUR MODE-pagina (`/breath`), hoe je de sessie ook binnenkwam
     (setup, agenda, onboarding, protocol, kortere link). */
  /* Operator, 8 okt 2026 ("bij afsluiten heel even het welcome-scherm"):
     dismissTo('/breath') vond de tab niet als eigen stack-item wanneer
     welcome.tsx onderaan de stapel lag → pop tot de bodem (welcome = flits)
     en dan pas naar Breath. Nu rechtstreeks volgens waar je staat. */
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const leaveSession = useCallback(() => {
    /* Elke uitgang: eerst het effen vlak erover (8 okt 2026), zodat een
       rusttoestand van dit scherm nooit kort in beeld komt. */
    setLeaving(true);
    /* Operator, 14 september 2026: "ik kom altijd uit op de Breathe/Build/
       Become-hero met Explore modes-knop" — dat is (tabs)/breath.tsx's
       eigen inline "welkomstbeeld" (mandala/gezichten-drempel), gestuurd
       door `skipBreathIntroOnce()`/`consumeBreathIntroSkip()`. Andere
       plekken riepen die vlag netjes vóór `leaveSession()` aan (bv.
       requestStop, handleTopbarBack), maar de paywall-popup's `onClose`
       deed dat niet — precies het pad in de screenshots (sessie → gratis
       preview op → paywall → wegklikken → hero i.p.v. de kies-pagina).
       Zo'n vlag apart bij ELKE aanroepplek onthouden is precies hoe dit
       een tweede keer misging; nu hier centraal, zodat GEEN enkele uitgang
       (ook toekomstige) 'm nog kan vergeten. */
    skipBreathIntroOnce();
    skipBreathOnboardingRedirectOnce();
    /* Operator, 20 september 2026 (20e+ klacht over een "fout scherm" na
       het sluiten van een sessie): `router.replace('/breath')` VERVANGT
       enkel het bovenste stack-item — breath-setup.tsx (de duur/techniek-
       kiezer die je vóór de sessie zag) bleef daaronder in de stack staan,
       met een nieuw "/breath"-item erbovenop. Dat gaf zowel het
       kortstondige flits-scherm tijdens de vervang-animatie (React
       Navigation toont bij `replace` even het oude en het nieuwe scherm
       over elkaar) als een vervuilde stack: terug-swipen na deze schermen
       kon opnieuw op breath-setup.tsx uitkomen.
       `(tabs)/breath.tsx` staat, zoals hierboven al stond beschreven,
       ALTIJD al gemonteerd ONDER deze hele stack (het is de tab zelf, geen
       nieuw scherm) — dit hoort dus geen "vervangen", maar een "terug
       ernaartoe" te zijn. `dismissTo` pop't in één atomaire stap ALLES
       terug tot dat al bestaande scherm (breath-setup.tsx + breath-
       session.tsx verdwijnen allebei uit de stack, geen nieuwe montage,
       geen tussenliggende animatie-frame van een ander scherm). Valt hij
       — heel uitzonderlijk, bv. een deeplink die nooit langs (tabs)/breath
       kwam — terug op de oude `replace` als vangnet. */
    /* Sessie-laag (5 okt 2026): sluiten = de laag weg; eronder staat nog
       het scherm waar je de sessie startte. Gestart vanuit een plan → daar
       blijven. Anders zoals voorheen naar de keuzepagina van Breath
       (dismissTo pop't eventuele tussenschermen zoals breath-setup weg). */
    closeBreathSession();
    if (params.fromPlan === '1') return;
    const here = pathnameRef.current;
    if (here === '/breath') return;
    if ((here === '/breath-setup' || here === '/feel-now') && router.canGoBack()) {
      router.back();
      return;
    }
    router.navigate('/breath');
  }, [params.fromPlan]);

  const requestStop = useCallback(() => {
    if (isFreeOnboardingSession) {
      setEndTrialConfirm(true);
      return;
    }
    const wasLockedPreview = locked;
    if (wasLockedPreview) {
      /* Operator, 7 okt 2026 ("vroegtijdig end session: zelfde popup maar
         zonder glaseffect"): eerst stoppen haalde het sessiebeeld weg, dus
         stond er achter de paywall enkel zwart en oogde het glas vlak. Nu
         PAUZEREN: het huidige sessiebeeld blijft achter het glas staan,
         net als na de volle 30 s. Echt gestopt wordt bij het sluiten van
         de paywall (zie onClose van PremiumPaywallModal). */
      pauseSession();
      stopScape(false);
      setPaywall(true);
      return;
    }
    setLeaving(true);
    setSessionEnded(true);
    stop();
    /* Operator, 11 september 2026: "de oude selectiepagina bestaat nog,
         wil dat nooit meer zien" — vroeg stoppen liet `finish()` gewoon
         `running` op `false` zetten, waarna dit scherm terugviel op zijn
         eigen, oude kies-UI (rhythm-chips/duur-chips/START-knop) — exact
         wat niet meer mag. Nu terug naar waar je vandaan kwam, zelfde
         navigatie als `handleTopbarBack` hierboven, i.p.v. hier te
       blijven hangen. */
    skipBreathIntroOnce();
    leaveSession();
  }, [isFreeOnboardingSession, locked, stop, leaveSession, pauseSession]);

  /* ── Knoppen op het horloge (Wear OS + Apple Watch, 6 okt 2026) ─────────
     Eén sessie, twee bedieningen: Pause / Resume / Stop op de pols bedienen
     deze sessie precies zoals de knoppen hier. De telefoon blijft de bron
     van waarheid en stuurt daarna zelf de nieuwe stand naar het horloge. */
  const watchHandlersRef = useRef({ pauseSession, resumeSession, requestStop });
  watchHandlersRef.current = { pauseSession, resumeSession, requestStop };
  useEffect(() => {
    const handle = (e: { action: 'pause' | 'resume' | 'stop'; kind: string }) => {
      if (e.kind !== 'breath' || !runningRef.current) return;
      const h = watchHandlersRef.current;
      if (e.action === 'pause') {
        if (!pausedRef.current) h.pauseSession();
      } else if (e.action === 'resume') {
        if (pausedRef.current) h.resumeSession();
      } else if (e.action === 'stop') {
        h.requestStop();
      }
    };
    const offWear = onWearWatchAction(handle);
    const offApple = onAppleWatchAction(handle);
    return () => {
      offWear();
      offApple();
    };
  }, []);

  /* Operator, 10 september 2026: "de backknoppen van de telefoon moeten
     enkel 1 pagina terug gaan" — de X-knop bovenaan riep `skipBreathIntroOnce()`
     op vóór het teruggaan (zie toelichting bij breath-setup.tsx voor
     waarom dat nodig is: zonder die vlag zet (tabs)/breath.tsx zichzelf
     terug naar zijn intro-scherm). De harde/gebaar-terugknop van Android
     gebruikte de standaard stack-pop en sloeg die aanroep over. Zelfde
     functie nu op BEIDE gekoppeld. */
  const handleTopbarBack = useCallback(() => {
    /* Operator, 5 okt 2026: tijdens een sessie minimaliseert terug (chevron
       of de terugknop van de telefoon) — de sessie loopt door, de pill
       brengt je terug. Stoppen enkel via "End session". */
    if (running) {
      minimizeBreathSession();
      return;
    }
    skipBreathIntroOnce();
    leaveSession();
  }, [running, requestStop, leaveSession]);

  useEffect(() => {
    /* Geminimaliseerd: de terugknop hoort bij het scherm eronder, niet bij
       de sessie (audit 5 okt 2026 — anders stopte een terug-tik elders de
       sessie). */
    if (minimized) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleTopbarBack();
      return true;
    });
    return () => sub.remove();
  }, [handleTopbarBack, minimized]);

  useEffect(
    () => () => {
      stopAll();
      stopScape(true);
      stopSessionKeepAlive();
      endLiveSession();
      /* Symmetrisch met de start: de native achtergrond-loop mag niet
         doortikken nadat de JS-sessie al is afgesloten. Onschadelijk als hij
         nooit succesvol begon. */
      stopBackgroundBreathSession();
      /* Actuele waarde, niet die van bij het openen (audit 8 okt 2026):
         zette de gebruiker de stem "voor alles" uit, dan sprong hij anders
         weer aan. */
      setVoiceEnabled(getSetting('voiceCues'));
      releaseVoiceSource('breath');
    },
    [stopAll],
  );

  /* ── De afsluitende monoloog ────────────────────────────────────────
     Eén opname per toestand, ingesproken door de operator. Die hoorde bij
     het afsluitscherm van de oude Breath-tab, en die tab is op 2 augustus
     2026 vervangen door de keuzepagina — daarmee riep niemand hem nog aan
     en eindigde een afgemaakte sessie in stilte. De bestanden zijn nooit
     weg geweest; de aanroep wel.

     Volgt exact dezelfde schakelaar als de fasecues (operator, 3 augustus
     2026): staat de stem uit — hier, in Settings, of doordat de onboarding
     op trillingen of stil is gezet — dan blijft ook de afsluiting stil. Eén
     schakelaar voor alles wat geluid maakt; er is geen pad meer dat er
     omheen loopt.

     Bij het wegtikken van het scherm stopt de opname, anders praat hij door
     over een scherm dat er niet meer is. */
  useEffect(() => {
    if (!done) return;
    if (!voiceRef.current) return;
    try {
      playCompletionCue(st.key as BreathKey);
    } catch {
      /* een haperende afsluiting mag de sessie niet alsnog laten stuklopen */
    }
  }, [done, st.key]);

  /* Operator, 19 september 2026 ("bij Clarity en alle andere sessies
     blijft het probleem met na sluiten ademsessie kort fout scherm
     zichtbaar"): dezelfde stale-scherm-bug als bij `requestStop`
     hierboven, maar dan op de NATUURLIJKE afronding — de "Well done"-
     modal (`done`) heeft vier uitgangen (mind-card, Browse Library,
     Continue with Premium, I'M DONE), die ALLEMAAL via `dismissDone()`
     lopen vóór hun eigen navigatie. Zodra de modal dichtgaat (`setDone
     (false)`) en `running` al `false` staat (dat deed `finish()` al bij
     het natuurlijk aflopen), lag dit scherm z'n eigen idle-UI weer bloot
     in de fractie van een seconde vóór die navigatie voltooit — exact
     dezelfde klasse bug, alleen via een ander pad dan `requestStop`. Eén
     `setSessionEnded(true)` HIER dekt alle vier de uitgangen tegelijk. */
  const dismissDone = useCallback(() => {
    setSessionEnded(true);
    stopVoice();
    if (keepAliveStopRef.current) {
      clearTimeout(keepAliveStopRef.current);
      keepAliveStopRef.current = null;
      stopSessionKeepAlive();
    }
    setDone(false);
  }, []);

  /* Eerste tik kiest, tweede tik legt uit. Zo hoeft er geen extra
     info-knopje naast te staan. */
  const pickDuration = (i: number) => {
    if (running) return;
    Haptics.selectionAsync();
    if (i === durationIdx) setInfoIdx(i);
    else setDurationIdx(i);
  };

  /* Verstreken tijd wordt AFGELEID uit de fase-lus, niet apart geteld. Een
     tweede timer naast de eerste loopt onvermijdelijk uit de pas. */
  const idx = tech.phases.findIndex((p) => p.key === phase);
  const elapsed =
    (round - 1) * CYCLE_S +
    tech.phases.slice(0, idx).reduce((s, p) => s + p.secs, 0) +
    (byKey(phase).secs - secsLeft);
  const leftSec = Math.max(0, totalSec - elapsed);

  /* Druk-schaal-animatie voor elk tikbaar element hieronder — zie
     `usePressScale` bovenaan het bestand. Eén hook-aanroep per element;
     voor rijen die uit een `.map()` komen (drie of vier gelijksoortige
     chips die nooit tegelijk ingedrukt worden) wordt bewust ÉÉN gedeelde
     waarde hergebruikt, want hooks mogen niet binnen een `.map()`-callback
     staan. */
  const pressBack = usePressScale(0.93);
  const pressSettings = usePressScale(0.93);
  const pressBatteryBanner = usePressScale(0.95);
  const pressAvBar = usePressScale(0.95);
  const pressPauseMain = usePressScale(0.95);
  const pressEndSession = usePressScale(0.94);
  const pressStart = usePressScale(0.96);
  const pressUnlockLink = usePressScale(0.93);
  const pressUjjayiStart = usePressScale(0.95);
  const pressEndTrial = usePressScale(0.95);
  const pressContinueSession = usePressScale(0.94);
  const pressScapeOff = usePressScale(0.95);
  const pressScapeLevelChip = usePressScale(0.95); // gedeeld: soft/medium/loud
  const pressScapeRowChip = usePressScale(0.95); // gedeeld: soundscape-rijen
  const pressScapeDone = usePressScale(0.95);
  const pressAvScapeNone = usePressScale(0.95);
  const pressAvScapeChip = usePressScale(0.95); // gedeeld: soundscape-chips
  const pressBraceletBadge = usePressScale(0.95);
  const pressAvDone = usePressScale(0.95);
  const pressNarratorChip = usePressScale(0.95); // gedeeld: female/male, nu inline in Audio & Haptics
  const pressDurationInfoDone = usePressScale(0.95);
  const pressBrowseLibrary = usePressScale(0.95);
  const pressContinuePremium = usePressScale(0.95);
  const pressNotYet = usePressScale(0.94);
  /* Operator, 8 okt 2026 ("alles hapert — buddha gewoon stil, beetje
     kleiner, en cirkel errond met ronddraaiende lijn"): adem/zwaai van de
     Buddha weg; enkel een dunne lijn die traag rond hem draait (lineair,
     één ronde per 6 s). Een draaiende lijn is veel lichter dan een
     schalende afbeelding boven het live glas. */
  const buddhaSpin = useSharedValue(0);
  useEffect(() => {
    if (!done) {
      cancelAnimation(buddhaSpin);
      buddhaSpin.value = 0;
      return;
    }
    /* De ademende figuur achter het glas stilzetten — sessie voorbij. */
    cancelAnimation(breath);
    buddhaSpin.value = 0;
    buddhaSpin.value = withRepeat(
      withTiming(1, { duration: 10000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(buddhaSpin);
  }, [done, buddhaSpin]);
  const buddhaSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${buddhaSpin.value * 360}deg` }],
  }));
  const pressImDone = usePressScale(0.95);

  return (
    // Operator, 2 okt 2026 ("die zwarte strook bovenaan moet weg"): was
    // de sterrenhemel als KIND van de SafeAreaView — die reserveert
    // bovenaan ruimte voor de statusbalk/notch (`edges:['top']`), dus de
    // sterrenhemel begon pas ONDER die strook en liet daar enkel de platte
    // achtergrondkleur zichtbaar. Nu een gewone, niet-inset `View` als
    // buitenste laag (de sterrenhemel vult hier het ECHTE volledige
    // scherm, ook achter de statusbalk), met de SafeAreaView als kind
    // erboven — enkel de knoppen/tekst zelf blijven binnen de veilige
    // zone, de achtergrond niet meer.
    <View style={s.root}>
      {/* Ruimte achter alles. Eén kleur, lage dichtheid, traag fonkelen —
          het geeft diepte zodat de figuur ergens IN hangt in plaats van
          op een zwart vlak te liggen. Ligt onder alle content. */}
      {/* Operator, 8 okt 2026 ("de buddha schokt"): achter het glazen
          afsluitblad moest het glas de fonkelende sterren elk frame opnieuw
          vervagen. Sessie voorbij → sterren weg zolang het blad open is. */}
      {!done && (
        <View style={s.stars} pointerEvents="none">
          <Starfield
            width={SCREEN_W}
            height={SCREEN_H}
            count={70}
            color={C.starColor}
          />
        </View>
      )}

      {/* Operator, 2 okt 2026 ("zwarte band snijdt de glow af"): de echte
         oorzaak was dat deze gloed voorheen ALS KIND van de `ScrollView`
         rond `figureStage` hing — een ScrollView knipt zijn inhoud altijd
         af aan zijn eigen zichtbare rand (standaard scroll-gedrag op
         zowel iOS als Android, los van elke `overflow`-style), dus de
         -120px bleed naar boven (zie `FigureGlow` hierboven) werd daar
         hard afgesneden vlak onder de topbar — precies de "band". Hier,
         buiten de ScrollView, mag hij vrij tot boven de topbar uitdijen.
         `topOffset` = de top-rand die `figureStage` zou hebben: het
         statusbalk-inzet (`insets.top`) + de topbar (38px iconBtn + 4px
         paddingBottom) + de scroll-paddingTop tijdens running (4px). */}
      {running && (
        <FigureGlow
          breath={breath}
          color={accent}
          topOffset={insets.top + 38 + 4 + 4}
        />
      )}

      {/* Operator, 16 september 2026: "de overlay kleur onderaan mag weg"
         — de accentkleur-tint die van transparant bovenaan naar de
         state-kleur onderaan liep is verwijderd. */}

      <SafeAreaView style={s.safeContent} edges={['top']}>
      <View style={s.topbar}>
        {/* Operator, 11 september 2026 (18e ronde): "kruisje bovenaan mag
           ook weg?" — TIJDENS een lopende sessie roept dit kruisje exact
           dezelfde `requestStop()` aan als de nieuwe END SESSION-knop
           hieronder (zie `handleTopbarBack`) — puur dubbel op, en met
           PAUSE + END SESSION erbij nu ook druk. Weg tijdens `running`,
           een lege plek van dezelfde afmeting ervoor in de plaats zodat
           de titel gecentreerd blijft. VOOR de sessie start (nog geen
           END SESSION-knop) blijft het gewoon de enige weg terug. */}
        {/* Operator, 16 september 2026 ("cirkel linksboven, wat is dat?"):
           deze placeholder droeg nog gewoon `iconBtn`'s zichtbare rand/
           cirkel-styling, dus las als een leeg, onverklaarbaar rondje
           i.p.v. onzichtbare opvulling. `spacerBtn` behoudt alleen de
           breedte/hoogte voor het centreren van de titel eronder, zonder
           rand of achtergrond. */}
        {running ? (
          /* Minimaliseren (operator, 5 okt 2026) — zelfde Apple-chevron als
             de State Control-sessie; de sessie loopt door. */
          <AnimatedPressable
            onPress={minimizeBreathSession}
            onPressIn={pressBack.onPressIn}
            onPressOut={pressBack.onPressOut}
            hitSlop={12}
            style={[s.iconBtn, pressBack.style]}
            accessibilityLabel="Minimize session"
          >
            <ChevronDown size={22} color={C.dim72} strokeWidth={2.4} />
          </AnimatedPressable>
        ) : (
          <AnimatedPressable
            /* De onboarding komt hier binnen met `replace`, dus er is geen
               geschiedenis om naar terug te keren — `back()` deed dan niets
               en je zat vast op dit scherm. Vandaar de val naar de Breath-tab.
               `handleTopbarBack` hierboven — gedeeld met de hardware-
               terugknop, zie toelichting daar. */
            onPress={handleTopbarBack}
            onPressIn={pressBack.onPressIn}
            onPressOut={pressBack.onPressOut}
            hitSlop={12}
            style={[s.iconBtn, pressBack.style]}
          >
            <X size={18} color={C.dim72} strokeWidth={2.2} />
          </AnimatedPressable>
        )}
        {/* Operator, 2 okt 2026 ("band staat er nog, ook calm control/
           clarity moet verdwijnen bij play"): niet enkel de techniek-regel
           — de VOLLEDIGE kop (staatnaam + techniek) verdwijnt nu samen,
           zelfde `!running || paused`-voorwaarde als de Voice & Haptics-
           pil. Echte conditionele render (geen opacity-fade), zodat er
           tijdens actief ademen niets meer gereserveerd staat in de
           topbar — enkel de twee icoon-knoppen blijven over. */}
        {(!running || paused) && (
          <View style={s.eyebrowCol}>
            <Text style={s.eyebrow}>{st.eyebrow}</Text>
            <Text style={s.eyebrowTechnique}>{tech.name}</Text>
          </View>
        )}
        {/* Operator, 13 september 2026: "settings knop is weg, wil hem
           terug" — herroept de 24e ronde (11 september) die deze knop
           hier verving door een lege plek (puur voor centrering, zie
           die toelichting). settings.tsx is terug, dus deze link ook. */}
        <AnimatedPressable
          onPress={() => {
            /* Naar een ander scherm: de sessie-laag eerst opzij (lopend →
               minimaliseren, anders sluiten), anders opent het scherm
               onzichtbaar ónder de laag. */
            if (running) minimizeBreathSession();
            else closeBreathSession();
            router.push('/settings');
          }}
          onPressIn={pressSettings.onPressIn}
          onPressOut={pressSettings.onPressOut}
          hitSlop={12}
          style={[s.iconBtn, pressSettings.style]}
        >
          <Settings size={17} color={light ? C.dim72 : 'rgba(255,255,255,0.72)'} strokeWidth={2} />
        </AnimatedPressable>
      </View>

      {/* `flex: 1` is hier niet cosmetisch. Zonder dat krimpt een ScrollView
          in React Native niet mee — hij groeit met zijn inhoud en duwt de
          voet onder de schermrand. Dat was precies waarom START SESSION
          soms verdween en er geen manier meer was om opnieuw te beginnen. */}
      <Animated.ScrollView
        style={s.scrollView}
        contentContainerStyle={[
          s.scroll,
          running && s.scrollRunning,
          {
            paddingBottom:
              (running ? RUNNING_FOOTER_H : FOOTER_H) +
              Math.max(insets.bottom, 10) +
              24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* De figuurnaam ("Lotus") en de tagline zijn weg (operator, 4
            augustus 2026). Ze stonden bovenaan en duwden de illustratie zo ver
            omlaag dat je moest scrollen om de knop te zien. De naam van de
            TOESTAND staat al in de balk erboven; dat is wat iemand hier nodig
            heeft. Alles wat je niet leest kost hier hoogte, en hoogte is het
            schaarse goed op dit scherm. */}

        {/* Weg zodra de sessie loopt. Wie ademt leest niet. */}
        {/* De beschrijving is eruit (operator 2 augustus 2026): drie regels
            kostten zoveel hoogte dat alles eronder opgekropt raakte en het
            scherm moest scrollen. De tagline blijft — die is één regel en
            zegt waar de toestand over gaat. */}


        {/* Het beeld is vierkant, maar een lotus is breder dan hoog: de
            bovenste en onderste marge blijven leeg. Die snijden we weg,
            zodat de bloem groot blijft zonder een vijfde van het scherm
            aan niets te besteden. */}
        {/* Operator, 8 september 2026: "Calm Control"-mockup — de gloeiende
           generatieve 3D-orb (`BreathPacer`, al goedgekeurd + bevestigd
           vloeiend op toestel) i.p.v. de platte 2D-illustratie, maar ALLEEN
           vóór de sessie start. Bewust niet ook tijdens de lopende sessie:
           `SessionArt` daar draagt de volledige, uitgebreid geteste
           sessielogica (fase-overgangen, haptiek, stem, rings) — dat blijft
           ongemoeid. `BreathPacer`/`LotusPacer` lopen hier hun EIGEN, losse
           voorbeeldcyclus op `tech.phases` (exact hetzelfde PhaseDef-schema
           als hun eigen BreathPhase-type, dus rechtstreeks doorgeefbaar) —
           een "rehearsal", geen echte sessie-tick. Zodra `running` waar
           wordt, wisselt het scherm terug naar het bestaande, ongewijzigde
           pad.
           Operator, 9 september 2026 (LotusPacer-proef, variant "sway"
           gekozen): enkel voor Calm Control de echte-foto-3D-lotus i.p.v.
           de generieke orb — de andere vier toestanden hebben nog geen
           eigen 3D-vorm, dus blijven bij `BreathPacer`. */}
        <View style={s.figureStage}>
          {/* Operator, 11 september 2026 (21e ronde): "lichtbron rondom de
             animatie" — zie de toelichting bij `FigureGlow` hierboven:
             deze wrapper heeft BEWUST geen `overflow:hidden` (in
             tegenstelling tot `visualWrap` eronder), zodat de gloed vrij
             buiten het beeldvak mag uitdijen. */}
          {/* Operator, 16 september 2026 ("het groen moet beter bij groen
             animatie passen"): was `st.glow` — een apart, donkerder
             "gloed"-groen (#0F5C42 voor Rest & Reset) dat niet overeenkwam
             met de helderdere `accent`-kleur (#20B486) die de rest van dit
             scherm gebruikt (boog-stip, eyebrow, etc). Nu dezelfde
             `accent`, zodat de "groene animatie" en de rest van de UI
             letterlijk dezelfde tint delen.
             Operator, 2 okt 2026: deze laag staat niet meer hier — een
             `ScrollView` knipt zijn inhoud altijd af aan zijn eigen
             zichtbare rand, dus de opwaartse bleed werd hier hard
             afgesneden. Nu als sibling van de ScrollView gerenderd, zie
             verderop in dit bestand. */}
          <View style={s.visualWrap}>
          {running ? (
            <SessionArt
              size={ART_RUN * (st.artScale ?? 1)}
              art={st.art}
              breath={breath}
              glow={st.glow}
              boxHeight={BOX_RUN}
              focusY={st.focusY}
              /* Operator, 11 september 2026 (16e ronde): "boog moet hoger,
                 desnoods de uitdeinende ringen weg en vanachter de
                 animatie uitdeinende lichtbron" — de ringen (los van de
                 boog, de twee ovalen rond de figuur) uit, om ruimte te
                 maken voor de hogere ademboog eronder. De gloed-lichtbron
                 áchter de figuur (`SessionArt`'s eigen `glow`-laag) blijft
                 gewoon meeademen — dat IS de "uitdeinende lichtbron" die
                 gevraagd werd, die bestond al.
                 Operator, 11 september 2026 (18e ronde): "waar is de
                 lichtbron die bij expand vanachter de animatie komt" — de
                 gloed was er, maar te subtiel om zonder de ringen als
                 ademcue op te vallen. `glowBoost` maakt 'm hier
                 zichtbaarder (alleen op dit scherm, zie SessionArt.tsx). */
              rings={false}
              glowBoost
            />
          ) : true ? null : st.key === 'calm' ? (
            <LotusPacer
              size={ART_IDLE * (st.artScale ?? 1)}
              accent={accent}
              pattern={tech.phases}
              variant="sway"
            />
          ) : (
            <BreathPacer
              size={ART_IDLE * (st.artScale ?? 1)}
              accent={accent}
              pattern={tech.phases}
            />
          )}
          </View>
        </View>

        {/* Operator, 11 september 2026 (13e ronde): "teller moet mee onder
           de lijn komen" — stond hier los, boven de ademboog. Verhuisd naar
           `rhythmCenter` hieronder, samen met de nieuwe korte balk (12e
           ronde) — ronde + tijd nu op ÉÉN plek onder de ademanimatie i.p.v.
           verspreid over het scherm. */}
        {/* Operator, 11 september 2026 (23e ronde): "die oude
           instellingenpagina mag niet meer bestaan" — dit blok (ritme-
           chips, duur-chips, uitleg) is exact de oude kies-UI van vóór
           `breath-setup.tsx` bestond. Het `awaitingAutostart`-un-gaten
           hierboven (22e ronde, "sessie moet op pauze beginnen") maakte
           dit blok per ongeluk weer zichtbaar op het rust-scherm, samen
           met de figuur/START-knop die daar WEL horen. Vast op render-
           null: `breath-setup.tsx` is en blijft de enige plek om ritme/
           duur te kiezen, dit scherm toont enkel nog wat al gekozen is. */}
        {true ? null : (
          <View style={s.durationWrap}>
            {st.techniques.length > 1 && (
              <>
                <Text style={s.sectionEyebrow}>Breathing rhythm</Text>
                <View style={s.chips}>
                  {st.techniques.map((t, i) => {
                    const on = i === techIdx;
                    return (
                      <Pressable
                        key={t.key}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setTechIdx(i);
                        }}
                        style={[s.techChip, on && s.chipActive]}
                      >
                        {/* Naam boven, patroon eronder (operator, 7 augustus
                            2026). De officiele term hoort er te staan — een
                            app die ook door mensen uit het vak gelezen wordt,
                            kan niet "Energize" zeggen waar de literatuur
                            "Equal Breathing" zegt. Maar bij BOOST heten
                            allebei de ritmes zo; dan is het patroon het enige
                            dat ze uit elkaar houdt, en dus moet dat er los
                            onder. Het patroon komt uit de fases zelf. */}
                        <Text style={[s.techTxt, on && s.chipTxtActive]}>
                          {t.name}
                        </Text>
                        <Text
                          style={[
                            s.techPattern,
                            on && { color: accent, opacity: 0.9 },
                          ]}
                        >
                          {patternOf(t)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {/* Wat het VERSCHIL is, meteen zichtbaar (operator, 6 augustus
                    2026). "Box 4-4-4-4" en "Triangle 4-4-4" zeggen niets tegen
                    wie de termen niet kent — en dat is vrijwel iedereen. De
                    uitleg stond wel geschreven, maar alleen in een venster op
                    een ander scherm; hier moet hij staan, want hier kies je.
                    Geen tik nodig: een keuze die je eerst moet openen om te
                    snappen, is geen keuze. */}
                <TechniqueExplain
                  text={tech.explain}
                  accent={accent}
                  step={techIdx}
                  style={s.techExplain}
                />
              </>
            )}
            <Text style={s.sectionEyebrow}>Session duration</Text>
            <View style={s.chips}>
              {DURATIONS.map((d, i) => {
                const active = i === Math.min(durationIdx, DURATIONS.length - 1);
                return (
                  <Pressable
                    key={d.name}
                    onPress={() => pickDuration(i)}
                    style={[s.chip, active && s.chipActive]}
                  >
                    <Text style={[s.chipTxt, active && s.chipTxtActive]}>
                      {d.cycles ?? d.minutes}
                      <Text style={s.chipUnit}>
                        {d.cycles ? ' CYCLES' : ' MIN'}
                      </Text>
                    </Text>
                    <Text style={[s.chipName, active && s.chipNameActive]}>
                      {d.name.split(' ')[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.exact}>
              {fmt(totalSec)} · {rounds} rounds
              {chosen.recommended ? ' · recommended' : ''}
            </Text>
            {/* Operator, 7 september 2026 (productkritiek): "te veel
               informatie vóór iemand begint" — de hint-tekst weg, de
               dubbele-tik-functie zelf (nogmaals tikken op de al gekozen
               duur opent de uitleg) blijft gewoon werken, enkel niet meer
               apart uitgelegd. */}
          </View>
        )}

        {/* ── Ademritme. Vooraf stil en volledig; tijdens de sessie licht
             de fase op waar je in zit. ──
             Operator, 11 september 2026 (23e ronde): zelfde reden als het
             blok hierboven — hoort bij de oude, retired kies-UI, niet bij
             het rust-scherm. Overlapte daar bovendien zichtbaar met de
             START-knop (footer lag er overheen). */}
        {true ? null : (
          <View style={s.patternCard}>
            <Text style={s.cardEyebrow}>Breathing pattern</Text>
            <View style={s.phaseRow}>
              {tech.phases.map((p, i) => (
                <View key={i} style={s.phaseCol}>
                  <Text style={s.phaseSecsSmall}>{p.secs}s</Text>
                  <Text style={s.phaseName}>
                    {p.label[0] + p.label.slice(1).toLowerCase()}
                  </Text>
                  {/* Dit ontbrak: nergens was af te lezen of je door de
                      neus of door de mond ademt. */}
                  <Text style={p.via ? s.phaseVia : s.phaseViaNone}>
                    {p.via ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={s.patternFoot}>{tech.name}</Text>
          </View>
        )}

        {/* Alleen tijdens de sessie (operator, 4 augustus 2026). Vooraf
            stond dit blok er ook, maar daar hoort het niet: op de
            startpagina kies je je ritme en je duur, en de kanalen zitten een
            tik verder. Twee keer hetzelfde blok op twee schermen maakt geen
            van beide duidelijker.

            De opbouw is nu VERTICAAL. De knoppen stonden links en rechts van
            de boog en liepen er zichtbaar tegenaan; nu staat de boog boven en
            staan de drie er netjes onder, naast elkaar. Alles krijgt lucht,
            en niets overlapt meer. */}
        {running && (
          <View style={s.rhythmCard}>
                        <View style={s.rhythmCenter}>
              <PhaseArc
                  width={SCREEN_W * 0.576}
                  progress={arc}
                  accent={accent}
                  gradient={st.gradient}
                />
              {/* In de boog staat alleen nog de tijd. De naam van de fase
                  paste er niet meer bij zodra de opening erbij kwam —
                  "EXHALE · NOSE" liep dwars door de boog heen, en een
                  instructie die over zijn eigen meter valt is geen
                  instructie. */}
              <View style={s.arcOverlay}>
                <Text style={s.phaseBig}>
                  {Math.max(0, secsLeft).toFixed(1)}
                </Text>
                <Text style={s.phaseUnit}>SEC</Text>
              </View>
              {/* Onder de boog, over de volle breedte, in de kleur van de
                  toestand: wat je NU doet en waar de lucht langs gaat. Hier
                  stond "Next: …", en die is eruit — de sessie stuurt elke
                  fase live aan met stem en trilling, dus vooruitlezen wat er
                  zo komt voegt niets toe en trekt de aandacht juist weg van
                  wat er op dit moment moet gebeuren. */}
              <Text style={s.phaseLine}>
                {byKey(phase).label}
                {byKey(phase).via
                  ? ` · ${byKey(phase).via!.toUpperCase()}`
                  : ''}
              </Text>
              {/* Operator, 19 september 2026 ("clean typography grid — de
                 dunne lijn onder INHALE · NOSE moet volledig weg, scheiding
                 puur via witruimte"): verving de voortgangsbalk (12e/20e
                 ronde hierboven) die als een storende lijn oogde naast de
                 fase-tekst. De voortgang leeft al in de seconden-aftelling
                 en de ronde-teller zelf; deze balk voegde niets toe. */}
              <Text style={s.sessionMeta}>
                ROUND {round}/{rounds} · {fmt(leftSec)} left
              </Text>
            </View>
          </View>
        )}

        {/* Hier stond een kaart die de Smart Bead Bracelet aanprees. Weg
            (operator, 7 augustus 2026): de pagina hoort te ademen en niet
            gescrold te worden, en dat blok was het enige dat er niet in paste.
            De bracelet staat trouwens al op dit scherm — als vierde kanaal
            naast stem, geluid en telefoon, met zijn datum erbij. Twee keer
            hetzelfde aankondigen op één scherm is geen aandacht vragen maar
            aandacht verliezen. Hij blijft bereikbaar via zijn eigen tab. */}
      </Animated.ScrollView>

      {/* Verloop onder de knop. Zonder dit lijkt de laatste kaart door de
          knop doorgesneden; nu vervaagt de inhoud eronder en leest de knop
          als iets dat ervóór zweeft. Dat verschil is het hele verschil
          tussen "afgekapt" en "afgewerkt". */}
      <ExpoGradient
        colors={[light ? 'rgba(245,245,247,0)' : 'rgba(10,10,10,0)', C.bg, C.bg]}
        locations={[0, 0.55, 1]}
        pointerEvents="none"
        style={[s.footerScrim, { height: FOOTER_H + Math.max(insets.bottom, 10) + 88 }]}
      />

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10) + 24 }]}>
        {/* Blijvende, niet-opdringerige banner (operator, 14 augustus 2026 —
           zie de toelichting bij batteryRestricted hierboven). Alleen op
           het startscherm (niet tijdens running), zodat hij niet ook nog
           over de actieve sessie heen ligt. Verdwijnt vanzelf zodra de
           uitzondering verleend is — geen apart "OK, snap ik"-tikje nodig. */}
        {false && batteryRestricted && (
          <AnimatedPressable
            style={[s.batteryBanner, pressBatteryBanner.style]}
            onPress={() => {
              requestIgnoreBatteryOptimizations();
              setTimeout(
                () => setBatteryRestricted(!isIgnoringBatteryOptimizations()),
                1500,
              );
            }}
            onPressIn={pressBatteryBanner.onPressIn}
            onPressOut={pressBatteryBanner.onPressOut}
            accessibilityLabel="Fix: sessions may pause when your screen locks. Tap to allow VIBEZCORE to keep running in the background."
          >
            <View style={s.batteryBannerIcon}>
              <BatteryWarning size={15} color="#E0B341" strokeWidth={2.2} />
            </View>
            <View style={s.batteryBannerBody}>
              <Text style={s.batteryBannerTitle}>
                Keep sessions running when locked
              </Text>
              <Text style={s.batteryBannerSubtitle}>
                Tap to allow background audio & haptics
              </Text>
            </View>
            <ChevronRight size={16} color="rgba(224,179,65,0.55)" strokeWidth={2.2} />
          </AnimatedPressable>
        )}
        {/* Operator, 19 september 2026 ("radicale symmetrie onderaan —
           verplaats Audio & Haptics naar de onderzijde, strak gecentreerd
           direct boven de paarse Play-knop"): stond eerst tussen het
           ademritme-kaartje en de timerboog, waar hij de visuele flow
           blokkeerde. Zelfde zichtbaarheids-logica als voorheen (via
           `audioHapticsStyle`/`audioHapticsVisible`): zichtbaar in de
           wachtstand en tijdens pauze, onzichtbaar tijdens het actieve
           ademen. */}
        <Animated.View
          style={[audioHapticsStyle, { alignItems: 'center', marginBottom: 14 }]}
          pointerEvents={!running || paused ? 'auto' : 'none'}
        >
          {/* Operator, 19 september 2026 ("te lang, maak dat ook Voice &
             Haptics, en pas hier ook de blur toe"): was een edge-to-edge
             capsule (`alignSelf:'stretch'`) met een vlakke rgba-vulling —
             nu content-breed en met dezelfde echte `BlurView`-matglas als
             de Session duration-kaart op breath-setup.tsx (`expo-blur` zit
             al in de build, geen rebuild nodig). Kortere naam ("Voice")
             i.p.v. "Audio" — dekt exact wat de knop opent: stem, geluid en
             haptiek, en past korter in de pil. */}
          {/* Operator, 20 september 2026 ("het glaseffect klopt niet, wil
             blur native"): zonder `blurMethod` valt `expo-blur` op Android
             terug op `'none'` (vlak semi-transparant vlak, geen echte
             blur). `dimezisBlurViewSdk31Plus` = echte native blur op
             Android 12+. */}
          <BlurView
            intensity={40}
            tint="dark"
            blurMethod="dimezisBlurViewSdk31Plus"
            style={s.avBar}
          >
            <AnimatedPressable
              onPress={() => setAvSheetOpen(true)}
              onPressIn={pressAvBar.onPressIn}
              onPressOut={pressAvBar.onPressOut}
              style={[s.avBarInner, pressAvBar.style]}
              hitSlop={8}
            >
              <SlidersHorizontal size={16} color="rgba(255,255,255,0.75)" strokeWidth={2} />
              <Text style={s.avBarTxt}>Voice & Haptics</Text>
            </AnimatedPressable>
          </BlurView>
        </Animated.View>
        {running ? (
          /* END SESSION blijft BEWUST stil en omlijnd (operator vroeg om wit
             en vol, 7 augustus 2026 — dit is de ene plek waar ik het afraad).
             Tijdens een sessie is er geen handeling die je hoort te doen; het
             hele punt is dat je niets doet. Een volle witte balk is dan het
             felste op het scherm en nodigt uit tot stoppen, precies wat de
             sessie niet moet. Hij blijft vindbaar, niet luid.

             Operator, 8 september 2026: "wij zouden moeten kunnen pauzeren
             ook" — PAUSE krijgt exact dezelfde stille, omlijnde behandeling
             als END SESSION (zelfde reden: geen handeling hoort hier luid te
             zijn).
             Operator, 11 september 2026 (10e ronde): "pause knop kan dat
             gewoon een cirkel met pauze-symbool zijn, en END SESSION
             centreren" — PAUSE werd een icoon-only cirkel, los aan de
             linkerkant; END SESSION vrij gecentreerd.
             Operator, 11 september 2026 (15e ronde, zie bijlage mockup):
             "pauze wordt de mainknop, mag ook zelfde uitvoering hebben" —
             PAUSE is nu de grote, prominente hoofdknop.
             Operator, 11 september 2026 (16e ronde): "pause knop moet
             gecentreerd, alles is opgekropt" — een gewone rij (cirkel +
             tekst, samen gecentreerd) oogde nooit echt gecentreerd: de
             cirkel weegt visueel zwaarder dan de tekst ernaast, dus het
             ganse BLOK stond scheef t.o.v. het echte midden.
             Operator, 11 september 2026 (17e ronde): "end session rechts
             zetten" — dus niet onder elkaar (dat was de vorige, tussentijdse
             poging), maar weer naast elkaar, alleen nu wiskundig echt
             gecentreerd: de cirkel wordt ABSOLUUT op exact 50% van de rij
             gepositioneerd (zijn eigen breedte eraf getrokken), en END
             SESSION staat daar los van vast ernaast, op de rand van de
             cirkel + een vaste marge. Zo blijft de cirkel altijd op het
             ware midden staan, ongeacht hoe lang "END SESSION" is. */
          /* Operator, 12 september 2026 (6e correctie, herroept de 5e
             correctie hierboven): "play knop staat over tekst, zet END
             SESSION terug rechts maar zwart" — de kolom-layout (cirkel
             boven, tekst eronder) bleef overlappen met de kanalen-rij
             erboven; terug naar de bestaande naast-elkaar-rij, enkel de
             tekstkleur in light nu zwart i.p.v. het te lichte grijs. */
          <View style={s.runningBtnRow}>
            {/* Operator, 21 september 2026: vlakke volle `accent`-vulling
               → transparant blur MET tint → "mag echt transparant zonder
               kleur" (geen tint) → "misschien heel licht de kleur van de
               sessie, transparant?" — nu een zeer lichte tint (12%) i.p.v.
               niets: genoeg link met de statekleur zonder weer een
               kleurvlak te worden. Geen wit-op-wit-risico zoals Clarity's
               `modalBtn` eerder had — dit is enkel een achtergrondwas
               ACHTER het icoon, geen tekst/icoon-kleur die erop moet
               contrasteren. */}
            <AnimatedPressable
              onPress={paused ? resumeSession : pauseSession}
              onPressIn={pressPauseMain.onPressIn}
              onPressOut={pressPauseMain.onPressOut}
              style={[s.pauseMain, pressPauseMain.style]}
              accessibilityLabel={paused ? 'Resume' : 'Pause'}
            >
              {/* Operator, 8 okt 2026: echt glas kan hier niet (knop zit IN de
                 vervaagde app → crash, zie memory real-glass-only-in-sheets),
                 en de kale BlurView zonder target was vlak donker ("lelijk").
                 Nu Apple's glas-recept zonder vervaging: doorschijnende witte
                 vulling, zachte lichtreflectie van boven, dunne lichte rand
                 (pauseMain), en een vleugje toestandskleur. */}
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.07)' }]}
              />
              {/* Operator, 8 okt 2026 ("knop in sleep zelfde kleur als in de
                 boog, nu te veel verschillende groenen"): de tint komt nu uit
                 dezelfde kleur als het heldere uiteinde van de boog. */}
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  s.pauseMainTint,
                  { backgroundColor: st.gradient?.[2] ?? accent },
                ]}
              />
              <ExpoGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFill}
              />
              {paused ? (
                <Play size={24} color={activeIconColor} strokeWidth={2.2} />
              ) : (
                <Pause size={24} color={activeIconColor} strokeWidth={2.2} />
              )}
            </AnimatedPressable>
            <AnimatedPressable
              onPress={requestStop}
              onPressIn={pressEndSession.onPressIn}
              onPressOut={pressEndSession.onPressOut}
              hitSlop={10}
              style={[s.endTxtWrap, pressEndSession.style]}
            >
              <Text style={[s.endTxt, { color: light ? '#0a0a0c' : C.dim72 }]}>END SESSION</Text>
            </AnimatedPressable>
          </View>
        ) : true ? null : (
          /* VOL in de kleur van de toestand (operator, 7 augustus 2026).
             Vervangt de keuze van 4 augustus om hem te omlijnen. Dit is de
             enige handeling op het scherm en hoort ook de enige te zijn die
             opvalt. De vorm blijft gelijk aan SELECT MODE op de keuzepagina,
             dus de twee schermen lezen nog steeds als een product — nu
             allebei gevuld in plaats van allebei omlijnd.
             OUD: omlijnd, niet gevuld — dezelfde vorm als SELECT MODE op de
             keuzepagina (operator, 4 augustus 2026: "start session is ook
             niet mooi"). Een volle balk van vijftig punten is het zwaarste
             element op een scherm dat verder uit één lichtgevende figuur op
             zwart bestaat, en dat hoort de figuur te zijn. Twee schermen na
             elkaar met dezelfde knopvorm lezen bovendien als één product. */
          <AnimatedPressable
            onPress={() => {
              if (locked) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                startWithBatteryCheck(true);
                return;
              }
              startWithBatteryCheck();
            }}
            onPressIn={pressStart.onPressIn}
            onPressOut={pressStart.onPressOut}
            style={[
              s.startBtn,
              { backgroundColor: accent, borderColor: accent },
              pressStart.style,
            ]}
            android_ripple={{ color: 'rgba(0,0,0,0.12)' }}
          >
            <Text style={[s.startTxt, { color: '#0a0a0a' }]}>
              {/* Operator, 7 september 2026: "2 cycles verwijderen, 30 sec
                 preview" — het rondeaantal verschilt nu per toestand
                 (zie PREVIEW_ROUNDS), de tekst noemt daarom de vaste
                 tijdsduur, niet een rondeaantal dat niet meer klopt.
                 Operator, 28 september 2026 ("enkel cta try 30 seconds
                 free moet enjoy your session ofzo worden"): enkel de
                 LOCKED-variant van deze tekst wijzigt — 'START SESSION'
                 (niet-locked) blijft ongewijzigd. */}
              {locked ? 'ENJOY YOUR SESSION' : 'START SESSION'}
            </Text>
          </AnimatedPressable>
        )}
        {/* Losse weg voor wie NIET eerst wil proeven en meteen wil kopen
            (operator, 10 augustus 2026: "wat als user onmiddellijk wil
            kopen zonder eerst de cycles te doen? dan kan die momenteel
            nergens terecht"). Alleen zichtbaar als er iets te unlocken valt
            en er geen sessie loopt — tijdens het proeven zelf zou hij
            afleiden van precies de ervaring die moet overtuigen. */}
        {false && locked && (
          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPaywall(true);
            }}
            onPressIn={pressUnlockLink.onPressIn}
            onPressOut={pressUnlockLink.onPressOut}
            hitSlop={10}
            style={[s.unlockLink, pressUnlockLink.style]}
          >
            <Text style={s.unlockLinkTxt}>Unlock all sessions →</Text>
          </AnimatedPressable>
        )}
      </View>

      {/* Premium-popup — gedeelde component (operator, 13 augustus 2026:
          welcome.tsx had dezelfde popup nodig; nu één bron in
          `PremiumPaywallModal.tsx` i.p.v. twee kopieën die uit elkaar
          konden gaan lopen). */}
      {leaving ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: '#050507', zIndex: 999, elevation: 999 }]}
        />
      ) : null}
      <PremiumPaywallModal visible={scapePaywall} onClose={() => setScapePaywall(false)} />

      <PremiumPaywallModal
        visible={paywall}
        onClose={() => {
          setLeaving(true);
          setPaywall(false);
          /* Vroeg gestopte voorproef staat nog gepauzeerd (zie requestStop):
             nu echt stoppen, daarna terug zoals altijd. */
          if (runningRef.current) {
            setSessionEnded(true);
            stop();
          }
          /* Operator, 8 september 2026: "na 30 sec free als ik de popup
             wegklik krijg ik de oude start session pagina" — kwam via
             `autostart=1`, dus wegklikken liet dit scherm z'n EIGEN, oude
             keuze-UI zien. Was toen enkel gefixt voor de autostart-ingang;
             sinds de 9e ronde (11 september 2026, "check alles overal")
             start ELKE ingang automatisch en bestaat die oude keuze-UI
             nergens meer bereikbaar, dus dit geldt nu onvoorwaardelijk —
             altijd terugnavigeren, nooit meer op dit scherm blijven
             hangen.
             Operator, 11 september 2026: zelfde `fromSetup`-fix als
             `leaveSession` — anders popt dit terug naar breath-setup.tsx
             i.p.v. er voorbij te navigeren. */
          leaveSession();
        }}
      />

      {/* ── Zal ik dit onthouden? ─────────────────────────────────────────
           Verschijnt alleen als je iets verzet dat AFWIJKT van je opgeslagen
           stand. Zeg je nee, dan geldt de wijziging alleen deze sessie en
           zwijgt de app tot je het ooit weer verzet.

           Bewust niet na afloop van de sessie: dan is het moment voorbij en
           weet je niet meer waar de vraag over gaat. En bewust niet bij
           soundscapes — die zijn per sessie en hebben geen standaard.

           Operator, 20 september 2026 ("eerst just this session, en pas als
           gebruiker remember aanklikt nog eens vragen enkel deze state of
           alle"): TWEE stappen, `askScopeStep` bepaalt welke. Stap 1 is
           ALTIJD hetzelfde eerste scherm dat hier al stond ("Just this
           time" vs "Yes, remember it") — wie 'm wegtikt is met één tik
           klaar. Pas wie "Yes, remember it" kiest krijgt de tweede vraag
           (scope: deze toestand of allemaal); die extra tik is er enkel
           voor wie 'm ook echt nodig heeft.

           Elke NIEUWE afwijking van de opgeslagen stand triggert deze hele
           flow opnieuw, ongeacht wat je een moment eerder al koos — er is
           geen "al gevraagd deze sessie"-onthoudlaag: `askDefault` wordt
           bij elke aanroepplek vers aangemaakt (zie de `onValueChange`-
           handlers hierboven) en `voiceDefault`/`hapticDefault`/
           `voiceGenderDefault` veranderen alleen als je zelf "Yes, remember
           it" koos. Zet je iets dus een tweede keer om binnen dezelfde
           sessie, dan verschijnt dezelfde vraag gewoon opnieuw. */}
      <Modal
        visible={askDefault !== null}
        transparent
        animationType="fade"
        onRequestClose={cancelAskDefault}
      >
        <Pressable style={s.modalBackdrop} onPress={cancelAskDefault}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            {/* VIBEZCORE-glas, zelfde als de "Well done"-kaart (operator,
                7 okt 2026: "popupkaarten breathwork nog altijd niet glas"). */}
            <VibezGlass radius={22} level="sheet" tint={accent} style={StyleSheet.absoluteFill} />
            {/* Operator, 25 september 2026 ("wat als gebruiker van gedachte
               verandert bij deze popup... gewoon een X, wat zegt onze
               procedure?"): zelfde kruisje-protocol als de andere
               fade-kaart-popups (ProtocolTeaserModal/PremiumPaywallModal).
               Operator, vervolg ("bij sluiten via kruisje mag er in
               principe niets veranderen"): kruisje/backdrop/hardware-back
               gebruiken nu `cancelAskDefault` (zet ook de sessie-wijziging
               terug), niet `closeAskDefault` (die liet 'm staan). */}
            {/* Operator, 25 september 2026 ("verwijder de animatie op de
               knoppen als dat het probleem is"): deze hele popup crashte
               herhaaldelijk (Reanimated "should not already be working")
               ongeacht welke knop erin werd aangetikt — inclusief dit
               kruisje en "Yes, remember it", die na elkaar getest zijn.
               Terug naar gewone, niet-geanimeerde `Pressable`s: deze popup
               wisselt zelf ook nog een INTERNE stap (`askScopeStep`) via
               dezelfde Modal, dus er zit kennelijk iets in DIT scherm
               specifiek dat niet samengaat met de druk-animatie — pragmatisch
               weggehaald i.p.v. verder te gokken naar de exacte oorzaak. */}
            <Pressable
              style={s.modalClose}
              onPress={cancelAskDefault}
              hitSlop={12}
            >
              <X size={18} color={C.dim55} strokeWidth={2.2} />
            </Pressable>
            <Text style={s.modalEyebrow}>{askDefault?.what.toUpperCase()}</Text>
            {!askScopeStep ? (
              <>
                <Text style={s.modalTitle}>Make this your default?</Text>
                <Text style={s.modalBody}>
                  Or keep it just for this session — nothing changes until
                  you say so.
                </Text>
                <Pressable
                  style={s.modalBtn}
                  onPress={() => setAskScopeStep(true)}
                >
                  <Text style={s.modalBtnTxt}>Yes, remember it</Text>
                </Pressable>
                <Pressable
                  style={s.modalSecondary}
                  onPress={closeAskDefault}
                  hitSlop={8}
                >
                  <Text style={s.modalSecondaryTxt}>Just this time</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={s.modalTitle}>Apply to just {stateLabel}?</Text>
                <Text style={s.modalBody}>
                  Or make it the default for every breathwork mode.
                </Text>
                <Pressable
                  style={s.modalBtn}
                  onPress={() => {
                    askDefault?.apply('all');
                    closeAskDefault();
                  }}
                >
                  <Text style={s.modalBtnTxt}>All breathwork modes</Text>
                </Pressable>
                <Pressable
                  style={s.modalSecondary}
                  onPress={() => {
                    askDefault?.apply('state');
                    closeAskDefault();
                  }}
                  hitSlop={8}
                >
                  <Text style={s.modalSecondaryTxt}>Just {stateLabel}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Ujjayi: wat is dat geluid? ────────────────────────────────────
           Operator, 11 september 2026: "moijn vraag is moet gebuiker
           continue dat troat sound maken tijdens ademsessie" — ja, en
           zonder uitleg weet niemand dat. Korte tekst-popup vóór de sessie
           start, enkel voor Ujjayi, met de bijbehorende audio-uitleg
           ("Create a soft Darth Vader–like sound..."). Verschijnt bij ELKE
           start van deze techniek (geen eenmalige onboarding) — het is een
           technique-reminder, geen intro die je maar één keer hoeft te
           zien. */}
      <Modal
        visible={ujjayiIntroOpen}
        transparent
        animationType="fade"
        /* Audit 8 okt 2026: wegtikken liet een leeg scherm achter (de sessie
           wachtte nog op de start) — wegtikken = "Got it, start". */
        onRequestClose={() => {
          setUjjayiIntroOpen(false);
          proceedToStart(ujjayiPreviewRef.current);
        }}
      >
        <Pressable
          style={s.modalBackdrop}
          onPress={() => {
            setUjjayiIntroOpen(false);
            proceedToStart(ujjayiPreviewRef.current);
          }}
        >
          <Pressable style={s.modalCard} onPress={() => {}}>
            {/* VIBEZCORE-glas, zelfde als de "Well done"-kaart (operator,
                7 okt 2026: "popupkaarten breathwork nog altijd niet glas"). */}
            <VibezGlass radius={22} level="sheet" tint={accent} style={StyleSheet.absoluteFill} />
            <Text style={s.modalEyebrow}>UJJAYI BREATHING</Text>
            <Text style={s.modalTitle}>The sound is the technique</Text>
            <Text style={s.modalBody}>
              Create a soft Darth Vader–like sound at the back of your
              throat as you breathe in and out.
            </Text>
            {/* Operator, 11 september 2026: "hoe creëren ze dat geluid" —
               korte "how to find it"-regel, Apple-stijl (kort, zelfverzekerd,
               geen overbodige woorden).
               2e ronde: "sigh haaa zal niemand begrijpen" — vervangen door
               de universeler herkenbare "whisper"-vergelijking. Nu WEL met
               eigen audio: beide regels samen in één opname, zie
               `MALE_UJJAYI_START_URL`/`FEMALE_UJJAYI_START_URL` in
               breath-voice.ts. */}
            <Text style={[s.modalBody, { marginTop: 10 }]}>
              Slightly tighten the back of your throat — like a soft
              whisper.
            </Text>
            <AnimatedPressable
              style={[s.modalBtn, pressUjjayiStart.style]}
              onPress={() => {
                setUjjayiIntroOpen(false);
                proceedToStart(ujjayiPreviewRef.current);
              }}
              onPressIn={pressUjjayiStart.onPressIn}
              onPressOut={pressUjjayiStart.onPressOut}
            >
              <Text style={s.modalBtnTxt}>Got it, start</Text>
            </AnimatedPressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── End trial? ──────────────────────────────────────────────────
           Operator, 7 september 2026: de ENE gratis kennismakingssessie
           (`isFreeOnboardingSession`) mag niet stilletjes verdampen op een
           misklik op het kruisje. Bevestigen stopt de sessie EN stuurt naar
           de Breath-tab (niet welcome.tsx — de tabbalk daar geeft al
           toegang tot Audio Library/Bracelet/Activity/Account, dus "verder
           rondkijken" kan meteen). */}
      {/* Operator, 8 okt 2026 ("end trial popup staat in het midden en is
          geen glas"): een Modal tekent op Android in een apart venster, dus
          het glas zag de sessie erachter nooit. Nu hetzelfde onderblad met
          echt glas als het betaalscherm (GlassSheetHost). */}
      <GlassSheet visible={endTrialConfirm} onClose={() => setEndTrialConfirm(false)}>
          <View style={[s.trialSheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <Pressable
              onPress={() => setEndTrialConfirm(false)}
              hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }}
              accessibilityLabel="Close"
            >
              <View style={s.sheetGrip} />
            </Pressable>
            <Text style={s.modalEyebrow}>{st.eyebrow}</Text>
            <Text style={s.modalTitle}>End trial?</Text>
            <Text style={s.modalBody}>
              This is your one free full session. Leaving now ends it — next
              time you'll only get a 30-second preview.
            </Text>
            <AnimatedPressable
              style={[s.modalBtn, pressEndTrial.style]}
              onPressIn={pressEndTrial.onPressIn}
              onPressOut={pressEndTrial.onPressOut}
              onPress={() => {
                /* Operator, 20 september 2026: dit was de derde, losse
                   kopie van dezelfde uitgangslogica (naast requestStop en
                   dismissDone) — riep zelf `router.replace('/breath')` aan
                   i.p.v. de gedeelde `leaveSession()`, en miste daardoor de
                   `dismissTo`-fix. Dit is exact "de popup in free
                   environment" — de belangrijkste plek waar het foute
                   scherm zichtbaar was. */
                setEndTrialConfirm(false);
                setSessionEnded(true);
                stop();
                leaveSession();
              }}
            >
              <Text style={s.modalBtnTxt}>End trial</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[s.modalSecondary, pressContinueSession.style]}
              onPressIn={pressContinueSession.onPressIn}
              onPressOut={pressContinueSession.onPressOut}
              onPress={() => setEndTrialConfirm(false)}
              hitSlop={8}
            >
              <Text style={s.modalSecondaryTxt}>Continue session</Text>
            </AnimatedPressable>
          </View>
      </GlassSheet>

      {/* ── Welk geluid eronder ──────────────────────────────────────────
           Dertien opties passen niet in een rij, dus een vel met de vier
           groepen als kopjes. Off staat bovenaan en los: dat is geen geluid
           maar een keuze. Tikken speelt meteen, zodat je hoort wat je pakt
           in plaats van dertien namen te moeten raden. */}
      {/* Echt glas, ook op Android: in hetzelfde venster als de app
          (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
      <GlassSheet visible={scapeOpen} onClose={() => setScapeOpen(false)}>
          <View style={[
              s.sheet,
              /* De navigatiebalk van het toestel hoort er NIET overheen te
                 vallen. Zonder deze inzet stond Done half onder de balk en was
                 niet te lezen wat er stond. */
              { paddingBottom: Math.max(insets.bottom, 12) + 12 },
            ]}>
            {/* Operator, 25 september 2026 ("streep bovenaan doet niets,
               kan daarmee niet sluiten"): het streepje was puur decoratief.
               Nu tikbaar — sluit hetzelfde als een backdrop-tap. */}
            <Pressable
              onPress={() => setScapeOpen(false)}
              hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }}
            >
              <View style={s.sheetGrip} />
            </Pressable>
            <Text style={s.sheetTitle}>Background sound</Text>
            {/* Drie standen, geen schuifregelaar. Die vraagt een extra pakket,
                is lastig te raken terwijl je ademt, en het verschil tussen
                0,30 en 0,35 hoort niemand. De stem blijft ongeregeld: die is
                de instructie, en wie die zachter zet mist cues en wijt dat aan
                de app. Het volume van het toestel regelt het geheel al. */}
            <View style={s.levelRow}>
              {(['soft', 'medium', 'loud'] as const).map((l) => {
                const on = l === scapeLevel;
                return (
                  <AnimatedPressable
                    key={l}
                    onPressIn={pressScapeLevelChip.onPressIn}
                    onPressOut={pressScapeLevelChip.onPressOut}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setScapeLevelLocal(l);
                      setScapeLevel(l);
                    }}
                    style={[
                      s.levelChip,
                      on && { borderColor: accent, backgroundColor: accentSoft },
                      pressScapeLevelChip.style,
                    ]}
                  >
                    <Text
                      style={[
                        s.levelTxt,
                        on && { color: accent },
                      ]}
                    >
                      {l.toUpperCase()}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            <ScrollView style={s.sheetList} showsVerticalScrollIndicator={false}>
            <AnimatedPressable
              style={[s.scapeRow, !scape && s.scapeRowOn, pressScapeOff.style]}
              onPressIn={pressScapeOff.onPressIn}
              onPressOut={pressScapeOff.onPressOut}
              onPress={() => pickScape(null)}
            >
              <VolumeX
                size={19}
                color={!scape ? accent : C.dim45}
                strokeWidth={2.2}
              />
              <View style={s.scapeText}>
                <Text style={[s.scapeName, !scape && { color: accent }]}>
                  Off
                </Text>
                <Text style={s.scapeHint}>Voice and haptics only</Text>
              </View>
            </AnimatedPressable>

              {GROUP_ORDER.map((g) => (
                <View key={g}>
                  <Text style={s.scapeGroup}>{g}</Text>
                  {SOUNDSCAPES.filter((x) => x.group === g).map((x) => {
                    const on = x.key === scapeKey;
                    return (
                      <AnimatedPressable
                        key={x.key}
                        style={[s.scapeRow, on && s.scapeRowOn, pressScapeRowChip.style]}
                        onPressIn={pressScapeRowChip.onPressIn}
                        onPressOut={pressScapeRowChip.onPressOut}
                        onPress={() => pickScapeGated(x.key)}
                      >
                        <x.Icon
                          size={19}
                          color={on ? accent : C.dim45}
                          strokeWidth={2.2}
                        />
                        <View style={s.scapeText}>
                          <Text
                            style={[s.scapeName, on && { color: accent }]}
                          >
                            {x.name}
                          </Text>
                          <Text style={s.scapeHint}>{x.hint}</Text>
                        </View>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              ))}
              <View style={{ height: 18 }} />
            </ScrollView>

            <AnimatedPressable
              style={[s.modalBtn, pressScapeDone.style]}
              onPressIn={pressScapeDone.onPressIn}
              onPressOut={pressScapeDone.onPressOut}
              onPress={() => {
                /* Voorbeluisteren stopt bij het sluiten; hij komt terug bij
                   START. Anders speelt er geluid op een scherm waar niets
                   loopt. */
                if (!running) stopScape();
                setScapeOpen(false);
              }}
            >
              <Text style={s.modalBtnTxt}>Done</Text>
            </AnimatedPressable>
          </View>
      </GlassSheet>

      {/* ── Audio & Haptics (geconsolideerd) ────────────────────────────────
           Operator, 19 september 2026: vervangt de vier losse kanaal-
           knoppen door één vel — Voice Guidance (schakelaar + link naar
           het bestaande Eli/Benjamin-vel eronder, geen dubbele logica),
           Soundscapes (horizontale scroll, dezelfde `pickScape`/
           `SOUNDSCAPES` als het bestaande "Background sound"-vel),
           Phone haptics en Bracelet haptics (beide letterlijk dezelfde
           tik-logica als voorheen op de losse knoppen, nu als rij). Geen
           losse intensiteits-schuifregelaar voor de bracelet — er is geen
           echte hardware-verbinding (`braceletReady` is nog altijd
           `false`, Fall 2026), dus een schuifregelaar zou een instelling
           voorspiegelen die nergens naartoe gaat. */}
      {/* Echt glas, ook op Android: in hetzelfde venster als de app
          (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
      <GlassSheet visible={avSheetOpen} onClose={() => setAvSheetOpen(false)}>
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            {/* Operator, 25 september 2026 ("streep bovenaan doet niets,
               kan daarmee niet sluiten"): het streepje was puur decoratief.
               Nu tikbaar — sluit hetzelfde als een backdrop-tap. */}
            <Pressable
              onPress={() => setAvSheetOpen(false)}
              hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }}
            >
              <View style={s.sheetGrip} />
            </Pressable>
            {/* Operator, 19 september 2026 ("na kiezen instellingen sluiten
               via kruisje? misschien beter cta done"): een klein kruisje
               in de hoek oogt als een uitgang, niet als een bevestiging —
               een "Done"-knop onderaan (zelfde vorm als het Voice-vel)
               leest wél als "instellingen staan vast, ga verder". */}
            <Text style={s.sheetTitle}>Audio & Haptics</Text>

            {/* Rij 1 — Voice Guidance. */}
            <View style={s.voiceSheetRow}>
              <Text style={s.voiceSheetRowLabel}>Voice guidance</Text>
              <Switch
                value={voiceOn}
                onValueChange={(v) => {
                  const prev = voiceOn;
                  setVoiceOnLocal(v);
                  if (v !== voiceDefault) {
                    setAskDefault({
                      what: `${st.eyebrow} · Voice ${v ? 'on' : 'off'}`,
                      apply: (scope) => remember({ voice: v }, scope),
                      revert: () => setVoiceOnLocal(prev),
                    });
                  }
                }}
                trackColor={{ false: '#3a3a3a', true: '#00A3A3' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#3a3a3a"
              />
            </View>
            {/* Operator, 25 september 2026 ("kijk na hoe Apple dit zou doen
               voor gebruiksgemak"): was een knop die naar een APART
               "Choose narrator"-vel navigeerde — omslachtig vergeleken met
               Voice/Haptics hierboven, die gewoon inline staan. Apple zet
               een 2-optie-keuze inline (segmented control), geen eigen
               scherm — dat is hier voorbehouden aan langere lijsten
               (Soundscapes hieronder). Narrator nu als inline chip-rij,
               zelfde patroon als de bestaande soft/medium/loud-chips. */}
            <Text style={s.avRowLabel}>Narrator</Text>
            <View style={s.levelRow}>
              {(['female', 'male'] as const).map((g) => {
                const on = g === voiceGenderLocal;
                const label = g === 'male' ? 'Benjamin' : 'Eli';
                return (
                  <AnimatedPressable
                    key={g}
                    onPressIn={pressNarratorChip.onPressIn}
                    onPressOut={pressNarratorChip.onPressOut}
                    onPress={() => {
                      const prev = voiceGenderLocal;
                      Haptics.selectionAsync();
                      setVoiceGenderLocal(g);
                      if (g !== voiceGenderDefault) {
                        setAskDefault({
                          what: `${st.eyebrow} · Voice · ${label}`,
                          apply: (scope) => remember({ voiceGender: g }, scope),
                          revert: () => setVoiceGenderLocal(prev),
                        });
                      }
                    }}
                    style={[
                      s.levelChip,
                      on && { borderColor: '#ffffff', backgroundColor: 'rgba(255,255,255,0.12)' },
                      pressNarratorChip.style,
                    ]}
                  >
                    <Text style={[s.levelTxt, on && { color: '#ffffff' }]}>
                      {label.toUpperCase()} · {g === 'male' ? 'MALE' : 'FEMALE'}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            {/* Rij 2 — Soundscapes, horizontale scroll i.p.v. een aparte
               kiezer-modal. */}
            <Text style={s.avRowLabel}>Soundscapes</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              /* Operator, 8 okt 2026 ("soundscapes is niet aanklikbaar"):
                 in het glas-onderblad (GlassSheetHost) mat Android deze
                 horizontale rij als 0 hoog — knoppen onzichtbaar. Vaste
                 hoogte = chip 38 + paddingBottom 20, en flexShrink 0: het vel heeft
                 een maxHeight en liet net deze rij tot 0 krimpen. */
              style={{ flexGrow: 0, flexShrink: 0, height: 58 }}
              contentContainerStyle={s.avScapeScroll}
            >
              {/* Operator, 25 september 2026 ("bij aantikken binnenkant wit
                 highlighten, rand ook wit"): was accent-gekleurd — nu wit,
                 zelfde protocol als de narrator-chips. Ook de al-gedeclareerde
                 maar nooit gekoppelde `pressAvScapeNone`/`pressAvScapeChip`
                 hooks nu echt aangesloten. */}
              <AnimatedPressable
                onPress={() => pickScape(null)}
                onPressIn={pressAvScapeNone.onPressIn}
                onPressOut={pressAvScapeNone.onPressOut}
                style={[
                  s.avScapeChip,
                  !scape && { borderColor: '#ffffff', backgroundColor: 'rgba(255,255,255,0.12)' },
                  pressAvScapeNone.style,
                ]}
              >
                <VolumeX size={16} color={!scape ? '#ffffff' : C.dim55} strokeWidth={2.2} />
                <Text style={[s.avScapeChipTxt, !scape && { color: '#ffffff' }]}>None</Text>
              </AnimatedPressable>
              {/* Gratis gebruiker: de twee gratis geluiden vooraan, niet eerst
                 een rij kroontjes (8 okt 2026). */}
              {(isPro
                ? SOUNDSCAPES
                : [
                    ...SOUNDSCAPES.filter((x) => FREE_SOUNDSCAPES.has(x.key)),
                    ...SOUNDSCAPES.filter((x) => !FREE_SOUNDSCAPES.has(x.key)),
                  ]
              ).map((x) => {
                const on = scape?.key === x.key;
                return (
                  <AnimatedPressable
                    key={x.key}
                    onPress={() => pickScapeGated(x.key)}
                    onPressIn={pressAvScapeChip.onPressIn}
                    onPressOut={pressAvScapeChip.onPressOut}
                    style={[
                      s.avScapeChip,
                      on && { borderColor: '#ffffff', backgroundColor: 'rgba(255,255,255,0.12)' },
                      pressAvScapeChip.style,
                    ]}
                  >
                    <x.Icon size={16} color={on ? '#ffffff' : C.dim55} strokeWidth={2.2} />
                    <Text style={[s.avScapeChipTxt, on && { color: '#ffffff' }]}>{x.name}</Text>
                    {scapeLocked(x.key) && (
                      <Crown size={12} color={C.dim55} strokeWidth={2.2} />
                    )}
                  </AnimatedPressable>
                );
              })}
            </ScrollView>

            {/* Rij 3 — Phone haptics. */}
            <View style={s.voiceSheetRow}>
              <Text style={s.voiceSheetRowLabel}>Phone haptics</Text>
              <Switch
                value={hapticsOn}
                onValueChange={(v) => {
                  const prev = hapticsOn;
                  setHapticsOn(v);
                  if (v !== hapticDefault) {
                    setAskDefault({
                      what: `${st.eyebrow} · Phone ${v ? 'on' : 'off'}`,
                      apply: (scope) => remember({ haptics: v }, scope),
                      revert: () => setHapticsOn(prev),
                    });
                  }
                }}
                trackColor={{ false: '#3a3a3a', true: '#00A3A3' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#3a3a3a"
              />
            </View>

            {/* Rij 4 — Bracelet haptics (zelfde tik-logica als de vorige
               losse Gem-knop: schakelaar zodra er hardware is, anders de
               bestaande preview-bevestiging). */}
            <View style={s.voiceSheetRow}>
              <Text style={s.voiceSheetRowLabel}>Bracelet haptics</Text>
              {braceletReady ? (
                <Switch
                  value={braceletOn}
                  onValueChange={(v) => setBraceletOn(v)}
                  trackColor={{ false: '#3a3a3a', true: '#00A3A3' }}
                  thumbColor="#ffffff"
                  ios_backgroundColor="#3a3a3a"
                />
              ) : (
                <AnimatedPressable
                  onPressIn={pressBraceletBadge.onPressIn}
                  onPressOut={pressBraceletBadge.onPressOut}
                  onPress={() => {
                    void showVibezAlert({
                      title: 'Smart Bead Bracelet',
                      message:
                        'Feel your session through your wrist. This channel activates once your bracelet arrives (Fall 2026) — preview how it works, or stay focused here.',
                      light,
                      buttons: [
                        { text: 'Stay here', style: 'cancel' },
                        {
                          text: 'View Preview',
                          style: 'primary',
                          /* Bracelet-links → de website (operator 7 okt;
                             audit 8 okt 2026). De sessie loopt gewoon door. */
                          onPress: () => {
                            void openBraceletWebsite();
                          },
                        },
                      ],
                    });
                  }}
                  style={[s.avBraceletBadge, pressBraceletBadge.style]}
                >
                  <Gem size={13} color={light ? '#9C7A1C' : '#E0B341'} strokeWidth={2.2} />
                  <Text style={s.avBraceletBadgeTxt}>Fall 2026</Text>
                </AnimatedPressable>
              )}
            </View>

            {/* Operator, 19 september 2026 ("hoe weten gebruikers dat ze na
               sluiten, tijdens de sessie, kunnen pauzeren om dit opnieuw in
               te stellen?"): de knop zelf verdwijnt bewust tijdens het
               actieve ademen (focus mode) — zonder deze regel lijkt dat
               alsof de instellingen dan onbereikbaar zijn. */}
            <Text style={s.avSheetHint}>
              Pause your session anytime to reopen these settings.
            </Text>
            <AnimatedPressable
              style={[s.modalBtn, pressAvDone.style]}
              onPressIn={pressAvDone.onPressIn}
              onPressOut={pressAvDone.onPressOut}
              onPress={() => setAvSheetOpen(false)}
            >
              <Text style={s.modalBtnTxt}>Done</Text>
            </AnimatedPressable>
          </View>
      </GlassSheet>

      {/* ── Waarom deze lengte ── */}
      <Modal
        visible={infoIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoIdx(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setInfoIdx(null)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            {/* VIBEZCORE-glas, zelfde als de "Well done"-kaart (operator,
                7 okt 2026: "popupkaarten breathwork nog altijd niet glas"). */}
            <VibezGlass radius={22} level="sheet" tint={accent} style={StyleSheet.absoluteFill} />
            {infoIdx !== null && (
              <>
                <Text style={s.modalEyebrow}>
                  {DURATIONS[infoIdx].minutes} MIN ·{' '}
                  {fmt(DURATIONS[infoIdx].rounds * CYCLE_S)} ·{' '}
                  {DURATIONS[infoIdx].rounds} ROUNDS
                </Text>
                <Text style={s.modalTitle}>{DURATIONS[infoIdx].name}</Text>
                <Text style={s.modalBody}>{DURATIONS[infoIdx].why}</Text>
                <Text style={s.modalFoot}>
                  There is no single correct length. Pick what fits the
                  moment — a short session you actually do beats a long one
                  you skip.
                </Text>
                <AnimatedPressable
                  style={[s.modalBtn, pressDurationInfoDone.style]}
                  onPressIn={pressDurationInfoDone.onPressIn}
                  onPressOut={pressDurationInfoDone.onPressOut}
                  onPress={() => setInfoIdx(null)}
                  android_ripple={{ color: C.dim10 }}
                >
                  <Text style={s.modalBtnTxt}>Got it</Text>
                </AnimatedPressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Sessie afgerond ──────────────────────────────────────────────
          De Buddha is terug (operator, 3 augustus 2026). Hij hoorde bij het
          afsluitscherm van de oude Breath-tab en verdween met dat scherm;
          nu sluit ELKE afgemaakte sessie er weer mee af, net als bij de
          bracelet — dezelfde figuur, dezelfde woorden.

          De vraag om Premium staat er ALLEEN bij de eerste sessie uit de
          onboarding. Binnen de app zelf is dat verkeerd getimed: iemand die
          net vijf minuten heeft geademd verdient een afsluiting, geen
          verkooppraatje. In de onboarding is het wél op zijn plaats, want
          daar is de gratis sessie het aanbod.

          Herkend aan `from=onboarding` in de route, niet aan de toestand:
          welke toestand de onboarding gebruikt kan veranderen, waar de
          gebruiker vandaan komt niet. */}
      {/* Operator, 8 okt 2026 ("lelijk met rand boven, kan dat ook glass,
          deel tekst links ander midden — hoe zou Apple dat doen"): was een
          Modal (apart venster → geen echt glas) met een gekleurde streep
          bovenaan. Nu hetzelfde echte-glas-onderblad als "End trial?",
          alles gecentreerd, geen streep. Naast het blad tikken = I'M DONE. */}
      <GlassSheet
        visible={done}
        onClose={() => {
          dismissDone();
          skipBreathIntroOnce();
          leaveSession();
        }}
      >
          {/* Glas (operator, 6 okt 2026): zelfde materiaal als de rest van de
              sessie. De toestandskleur zit enkel IN de kaart — de streep
              bovenaan en een vleugje tint in het glas — nooit in de tekst. */}
          <View style={[s.doneCard, s.doneSheet, { paddingBottom: Math.max(insets.bottom, 12) + 30 }]}>
            <VibezGlass
              radius={24}
              level="sheet"
              tint={accent}
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            <View style={s.sheetGrip} />
            <View style={s.buddhaRingWrap}>
              <View style={s.buddhaRing} />
              <Animated.View
                renderToHardwareTextureAndroid
                style={[s.buddhaRing, s.buddhaRingArc, { borderTopColor: accent }, buddhaSpinStyle]}
              />
              <Image
                source={{ uri: BUDDHA_IMG }}
                resizeMode="contain"
                style={s.doneBuddha}
              />
            </View>
            <Text style={[s.modalEyebrow, s.doneEyebrow]}>✦ CONGRATULATIONS ✦</Text>
            <Text style={[s.modalTitle, s.doneCenter]}>Well done</Text>
            <Text style={[s.modalBody, s.doneCenter]}>
              You completed {rounds} rounds of {tech.name}.
              {'\n'}Carry the breath with you.
            </Text>

            {/* Operator, 8 okt 2026 ("coming to your wrist en go to the audio
                library mag ook weg in de popups"): afsluitblad enkel nog de
                felicitatie + knop — rustiger, één taak. */}

            {/* Enkel bij instant-gestarte sessies, enkel ná een echte
               voltooiing (dit is het "Well done"-scherm, geen preview-
               afbreking) — geen modal, geen sluitknop nodig, het scherm
               verdwijnt toch zodra de gebruiker verdergaat. */}
            {isInstantSession && (
              <View style={s.instantFeedbackRow}>
                {instantFeedbackGiven ? (
                  <Text style={s.instantFeedbackThanks}>Thanks — we'll tune it for next time.</Text>
                ) : (
                  <>
                    <Text style={s.instantFeedbackLabel}>How was that?</Text>
                    <View style={s.instantFeedbackChips}>
                      <Pressable onPress={() => onInstantFeedback('worked')} hitSlop={6}>
                        <Text style={s.instantFeedbackChip}>Worked</Text>
                      </Pressable>
                      <Pressable onPress={() => onInstantFeedback('too_hard')} hitSlop={6}>
                        <Text style={s.instantFeedbackChip}>Too hard</Text>
                      </Pressable>
                      <Pressable onPress={() => onInstantFeedback('too_long')} hitSlop={6}>
                        <Text style={s.instantFeedbackChip}>Too long</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            )}

            {askPremium ? (
              <>
                <AnimatedPressable
                  style={[s.modalBtn, s.doneBtn, pressContinuePremium.style]}
                  onPressIn={pressContinuePremium.onPressIn}
                  onPressOut={pressContinuePremium.onPressOut}
                  onPress={() => {
                    dismissDone();
                    /* Operator, 10 september 2026: breathwork-context —
                       zie toelichting in subscribe.tsx voor waarom dit
                       betrouwbaarder is dan raden uit onboarding-status. */
                    closeBreathSession();
                    router.push('/subscribe?returnTo=breathwork' as never);
                  }}
                  android_ripple={{ color: C.dim10 }}
                >
                  <Text style={s.modalBtnTxt}>Continue with Premium</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={[s.modalSecondary, pressNotYet.style]}
                  onPressIn={pressNotYet.onPressIn}
                  onPressOut={pressNotYet.onPressOut}
                  onPress={() => {
                    /* Operator, 19 september 2026: deze knop deed enkel
                       `dismissDone()` — geen navigatie. Dat liet je op dit
                       scherm z'n eigen (lege, want `sessionEnded`) idle-UI
                       staan i.p.v. terug te gaan naar de kies-pagina, net
                       als "I'M DONE" hieronder al wel deed. */
                    dismissDone();
                    skipBreathIntroOnce();
                    leaveSession();
                  }}
                  hitSlop={8}
                >
                  <Text style={s.modalSecondaryTxt}>Not yet</Text>
                </AnimatedPressable>
              </>
            ) : (
              <AnimatedPressable
                style={[s.modalBtn, s.doneBtn, pressImDone.style]}
                onPressIn={pressImDone.onPressIn}
                onPressOut={pressImDone.onPressOut}
                onPress={() => {
                  /* Operator, 11 september 2026: "oude selectiepagina wil
                     ik nooit meer zien" — dit was de andere plek waar
                     'm dat nog kon overkomen: "I'M DONE" sloot enkel de
                     modal, en dan viel dit scherm terug op zijn eigen
                     oude kies-UI (zelfde bug als bij vroeg stoppen, zie
                     requestStop hierboven). Nu ook hier terug naar waar
                     je vandaan kwam.
                     Operator, 11 september 2026: zelfde `fromSetup`-fix
                     — anders popt dit terug naar breath-setup.tsx. */
                  dismissDone();
                  skipBreathIntroOnce();
                  leaveSession();
                }}
                android_ripple={{ color: C.dim10 }}
              >
                <Text style={s.modalBtnTxt}>I'M DONE</Text>
              </AnimatedPressable>
            )}
          </View>
      </GlassSheet>

      </SafeAreaView>
    </View>
  );
}

function makeStyles(st: BreathState, accent: string, accentSoft: string) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  stars: { ...StyleSheet.absoluteFillObject },
  /* Transparant — de sterrenhemel (buiten deze SafeAreaView, zie hierboven)
     moet er zichtbaar doorheen blijven schijnen, ook in de top-inset-zone. */
  safeContent: { flex: 1 },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.iconBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Onzichtbare opvulling tijdens `running` — alleen de afmeting van
     `iconBtn` (voor het centreren van de eyebrow-titel), zonder rand of
     achtergrond. */
  spacerBtn: {
    width: 38,
    height: 38,
  },
  /* Operator, 11 september 2026: exacte specificatie — 14px Bold,
     letterSpacing +1.5. Was 12px/3.6. */
  /* Operator, 2 okt 2026 ("staatnaam/techniek groter en iets lager, dat
     verdwijnt toch bij play"): dit blok is enkel zichtbaar vóór/tijdens
     pauze (`!running || paused`, zie JSX) — geen hoogte-impact tijdens het
     ademen zelf, dus ruimte geven kan hier vrij. `marginTop` duwt het
     geheel iets omlaag in de topbar-rij. */
  eyebrowCol: { alignItems: 'center', marginTop: 6 },
  eyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    letterSpacing: 1.5,
    color: accent,
  },
  eyebrowTechnique: {
    marginTop: 3,
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    color: C.dim50,
  },

  scrollView: { flex: 1 },
  /* De ruimte onderaan wordt bij het renderen gezet: FOOTER_H plus de
     toestel-inzet. Een vast getal zou op het ene toestel een gat geven en
     op het andere de laatste kaart afsnijden. */
  scroll: { alignItems: 'center' },
  /* Tijdens de sessie staat het blok GECENTREERD. Bovenaan pakken liet een
     kwart scherm leeg onderaan; gelijk verdelen trok de onderdelen uit
     elkaar. Centreren zet de overgebleven ruimte gelijk boven en onder, en
     omdat het beeldvak een vaste hoogte heeft staat dat blok op elke
     toestand op precies dezelfde plek. */
  /* Tijdens de sessie begint het blok BOVENAAN in plaats van gecentreerd
     (operator, 4 augustus 2026: "de animatie kan nog naar boven"). Met het
     kanalenblok eronder werd het geheel zo hoog dat centreren de figuur naar
     beneden duwde; nu staat hij waar je hem het eerst ziet en valt de
     overgebleven ruimte onderaan. */
  scrollRunning: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 4 },

  /* Eén ritme voor het hele scherm: 6 binnen een blok, 18 tussen blokken,
     26 rond de figuur. Afstanden die per onderdeel apart gekozen zijn
     lezen als rommel, ook als geen enkele afzonderlijk fout is. */
  title: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 27,
    letterSpacing: -0.6,
    color: C.text,
    marginTop: 6,
  },
  tagline: {
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    color: accent,
    marginTop: 6,
  },
  desc: {
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: C.dim58,
    textAlign: 'center',
    marginTop: 12,
  },

  /* Operator, 11 september 2026 (21e ronde): wrapper ZONDER
     `overflow:hidden` rond `visualWrap`, puur zodat `FigureGlow` (zie
     hierboven) buiten het bijgesneden beeldvak mag uitdijen — `visualWrap`
     zelf blijft ongewijzigd zijn eigen bijsnede-rol dragen. */
  figureStage: { width: SCREEN_W, alignItems: 'center', justifyContent: 'center' },
  /* Het beeld is breder dan het scherm; hier wordt het bijgesneden.
     De marges zijn niet optioneel: zonder ademruimte plakte "SESSION
     DURATION" tegen de onderste blaadjes. Een figuur die het moet hebben
     van rust kan geen tekst tegen zich aan hebben staan. */
  /* Operator, 12 september 2026 (8e correctie): "boog en animatie te
     dicht opeen" — enkel in light iets meer lucht onder de figuur (dark
     blijft ongewijzigd, dat is al goedgekeurd). */
  visualWrap: {
    width: SCREEN_W,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 14,
  },

  /* ── Sectielabels ──────────────────────────────────────────────────
     Geen gespatieerde kapitalen meer (operator, 8 augustus 2026). Vette caps
     met 2,6 punt spatiëring waren rond 2019 de standaard voor "premium" en
     lezen nu als sjabloon. Ze schreeuwen bovendien: een label dat vertelt
     WAT er onder staat hoort het stilste element op het scherm te zijn, niet
     het luidste.
     Nu gewone tekst in een licht gewicht en een lager contrast. Hetzelfde
     woord, half zo veel aandacht. */
  sectionEyebrow: {
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    letterSpacing: 0,
    color: C.dim38,
  },

  /* ── Voorkeuzes ── */
  durationWrap: { alignItems: 'center', gap: 7 },
  chips: { flexDirection: 'row', gap: 7 },
  chip: {
    width: (SCREEN_W - 28 - 21) / 4,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.dim12,
    backgroundColor: C.dim04,
    alignItems: 'center',
  },
  chipActive: { borderColor: accent, backgroundColor: accentSoft },
  /* Breder dan de duurknoppen: hier staat een naam met een ritme erin
     ("Long Exhale 4-2-6"), geen getal van twee tekens. */
  techChip: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.dim12,
    backgroundColor: C.dim04,
    alignItems: 'center',
  },
  techExplain: {
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: C.dim55,
    textAlign: 'center',
    /* Randen en marges zitten nu op het omhullende vlak (staticStyles.
       explainWrap), anders licht er straks een strook op die niet om de tekst
       heen valt maar ernaast. */
  },
  techTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12,
    letterSpacing: 0.2,
    color: C.dim72,
    textAlign: 'center',
  },
  techPattern: {
    marginTop: 2,
    fontFamily: BrandFonts.bold,
    fontSize: 13,
    letterSpacing: 1.1,
    color: C.dim50,
  },
  chipTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 18,
    color: C.dim72,
    lineHeight: 22,
  },
  chipTxtActive: { color: C.text },
  chipUnit: {
    fontFamily: BrandFonts.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  chipName: {
    fontFamily: BrandFonts.medium,
    fontSize: 9.5,
    letterSpacing: 0.3,
    color: C.dim38,
    marginTop: 1,
  },
  chipNameActive: { color: accent },
  exact: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    letterSpacing: 0.1,
    color: C.dim90,
  },
  /* ── Voortgang tijdens de sessie ── */
  /* Operator, 11 september 2026 (12e ronde): "toch liever terug de lijn
     maar korter, onder inhale/exhale animatie" — verhuisd naar onder
     `phaseLine` in `rhythmCenter` (was eerst een los blok bovenaan de
     figuur).
     Operator, 11 september 2026 (20e ronde): "tijdlijn mag breder, even
     breed als de boog" — de breedte komt nu inline mee van de aanroep
     (zelfde formule als de boog), dus geen vaste breedte meer hier. */
  sessionBarTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: C.dim10,
    marginTop: 6,
    overflow: 'hidden',
  },
  /* Operator, 11 september 2026 (20e ronde): "tijdlijn moet wit doorlopen
     en round moet ook in wit" — was in de sessiekleur, nu wit zoals de
     rest van de rustige, kleurloze tekst op dit scherm. */
  sessionBarFill: { height: 3, borderRadius: 2, backgroundColor: C.textSoft },
  /* Operator, 11 september 2026 (13e ronde): "teller moet mee onder de
     lijn komen" — ronde + resterende tijd, nu op één rustige, kleine regel
     onder de balk i.p.v. een los, groter blok bovenaan de figuur. */
  /* Operator, 11 september 2026: exacte specificatie — 13px Regular,
     geen letterSpacing, rustige lichtgrijze kleur. Was medium/11px/0.4,
     wit. "Dit staat nu erg klein, maak het iets groter." */
  /* Operator, 19 september 2026 ("clean typography grid"): scheiding met
     "INHALE · NOSE" erboven komt nu puur uit marginTop (was 4, de balk die
     ertussen stond is weg), en de regel zelf is kleiner/gedimder (was 13px/
     dim55) zodat hij duidelijk als ondergeschikte metadata leest t.o.v. de
     fase-tekst erboven. */
  sessionMeta: {
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 14,
  },

  /* ── Ademritme vooraf ── */
  /* Geen rand meer (operator, 8 augustus 2026). Op dit scherm stonden vier
     omkaderde blokken onder elkaar — ritmeknoppen, uitlegvak, duurknoppen,
     patroonkaart. Randen om alles maakt van een rustig scherm een formulier.
     De knoppen HOUDEN hun rand, want die kun je indrukken; wat je alleen
     leest, hoeft geen doos. Afstand doet daar het werk. */
  /* Strakker gezet (8 augustus 2026). De grotere labels van de
     typografieronde maakten de pagina langer en toen viel de onderkant van
     deze kaart weer achter de knop. De ruimte komt hiervandaan en niet uit de
     lettergrootte: leesbaarheid was juist het punt. */
  patternCard: {
    width: SCREEN_W - 28,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: C.dim03,
    alignItems: 'center',
    gap: 6,
  },
  cardEyebrow: {
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    letterSpacing: 0,
    color: accent,
  },
  phaseRow: { flexDirection: 'row', width: '100%' },
  phaseCol: { flex: 1, alignItems: 'center', gap: 1 },
  phaseSecsSmall: {
    fontFamily: BrandFonts.bold,
    fontSize: 19,
    color: C.text,
    lineHeight: 23,
  },
  phaseName: {
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    letterSpacing: 0,
    color: C.dim72,
  },
  /* Door welke opening je ademt. Stond eerst klein en violet en was
     daardoor niet af te lezen — juist dít is de instructie. */
  phaseVia: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: C.text,
    marginTop: 2,
  },
  phaseViaNone: {
    fontFamily: BrandFonts.regular,
    fontSize: 11,
    color: C.dim26,
    marginTop: 2,
  },
  patternFoot: {
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    letterSpacing: 0.4,
    color: C.dim55,
  },

  /* ── Ritmeblok tijdens de sessie ── */
  /* Operator, 8 september 2026: "kaart waarin de animatie en voice off...
     staan verwijderen, alles moet rechtstreeks op de zwarte achtergrond
     staan" — enkel de kaart-chrome (rand, achtergrondtint, ronding) weg;
     de lay-out-eigenschappen (breedte, marge, padding, centrering) blijven
     ONGEWIJZIGD zodat de boog en de kanalen-rij exact even groot/gepositioneerd
     blijven staan als voorheen — enkel niet meer "in een doosje". */
  /* Operator, 11 september 2026 (18e ronde): "vanaf boog alles hoger,
     alles moet boven de pauzeknop beginnen" — marges hier en bij
     `visualWrap` ingekort, samen met de kleinere boog hierboven, zodat de
     totale inhoud weer boven de vaste voet past i.p.v. eronder te
     schuiven. */
  rhythmCard: {
    alignItems: 'center',
    paddingTop: 8,
    width: SCREEN_W - 28,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  channel: { alignItems: 'center', gap: 3, flex: 1 },
  /* De drie kanalen onder de boog, gelijk verdeeld over de breedte.
     Operator, 11 september 2026 (13e ronde, en 15e ronde nog compacter):
     "voice on kleiner" — ronde-teller + balk kwamen erboven bij staan (zie
     sessionMeta), en de boog zelf werd intussen groter, dus dit rijtje mag
     zelf zo klein en stil mogelijk: kleiner icoon, kleinere tekst, minder
     ruimte erboven. */
  /* Operator, 12 september 2026: "menuknoppen onderin beter leesbaar" —
     de losse iconen+tekst stonden rechtstreeks op de witte pagina-
     achtergrond, wat los zand oogde. Een subtiel grijs vlak eromheen
     (widget-vorm) geeft de rij een duidelijke, tikbare "bedieningsbalk".
     Enkel in light — in dark stond dit al goed op de zwarte achtergrond,
     geen vlak nodig (en de bestaande `channelUpcoming`-gouden-highlight
     op het vierde kanaal zou tegen een grijs vlak minder opvallen dan
     tegen zwart). */
  /* Operator, 12 september 2026 (2e correctie): "de knoppen boven pauze
     moeten omlijnd worden, kan dat in cirkels" — de gedeelde grijze balk
     hierboven (`#F2F2F7`) viel niet op tegen de bijna identieke
     paginakleur (`#F5F5F7`); losse omlijnde cirkels rond elk icoon geven
     wél duidelijk zichtbare, individueel tikbare knoppen. Zie
     `channelIconCircle` verderop.
     Operator, 12 september 2026 (5e correctie): "bundel ze in één
     widget-vlak, zoals een dock" — de cirkels losten dat "los zand"-
     gevoel per icoon op, maar de operator wil de VIER knoppen ook als
     groep herkenbaar. Nu een net iets steviger grijs (`#EDEDF2`, wél
     zichtbaar tegen `#F5F5F7`, in tegenstelling tot de eerdere `#F2F2F7`-
     poging) rond de hele rij.
     Operator, 13 september 2026: "gebruik deze nieuwe layout volledig,
     maar dan dark mode, niets verandert aan plaatsing knoppen" — het
     widget-vlak (en alles eronder: cirkels, geen labels, boog-afmeting)
     geldt nu voor BEIDE thema's, `light` bepaalt enkel nog kleuren via
     `C.channelCardBg`, niet meer OF het vlak er staat. */
  /* Operator, 19 september 2026 ("te lang, en pas hier ook de blur toe"):
     was een edge-to-edge rgba-glas pil (`alignSelf:'stretch'`, vlakke
     achtergrondkleur). `expo-blur` bleek al gelinkt (zie `welcome.tsx` en
     de Session duration-kaart op breath-setup.tsx) — geen rebuild nodig —
     dus deze knop kreeg dezelfde echte `BlurView`. `avBar` is nu enkel het
     matglas-omhulsel: content-breed (geen stretch meer), overflow hidden
     zodat de blur de ronde hoeken respecteert. `avBarInner` doet de rij-
     layout + padding + is de eigenlijke Pressable-hitbox. */
  avBar: {
    alignSelf: 'center',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  avBarTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.75)',
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    marginTop: 8,
    backgroundColor: C.channelCardBg,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  /* Operator, 12 september 2026 (3e correctie): "grotere cirkels, zelfde
     als in session selectie pagina" — 60px, exact `RING_SIZE` van de
     duur-cirkels op breath-setup.tsx, i.p.v. de kleinere 38px hiervoor. */
  /* Operator, 12 september 2026 (4e correctie): "tekst onder cirkels is
     onleesbaar en cirkels/symbolen mogen ook donkerder" — de rand stond
     op `C.dim18` (18% zwart, amper zichtbaar); flink opgetrokken naar
     `C.dim38`. Zie ook `channelOff` verderop voor de bijbehorende
     tekst/icoon-kleur. */
  /* Operator, 12 september 2026 (7e correctie): "circkels geactiveerd
     volle kleur, niet actief licht pastel?" — een kale omlijning oogde
     "statisch en lelijk"; niet-actief krijgt nu zelf ook al een lichte
     pastel-vulling in de accentkleur (i.p.v. enkel een grijze/gedimde
     rand), actief wordt hieronder (`channelIconCircleOn`) een volle,
     dekkende vulling. */
  /* Operator, 12 september 2026 (9e correctie): "desnoods cirkels
     kleiner, alles moet kunnen ademen" — 60px paste niet zonder overlap
     met de vaste PAUSE-voet; 46px geeft dat écht op, nog altijd
     duidelijk groter dan de oorspronkelijke 38px. */
  channelIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: `${accent}30`,
    backgroundColor: `${accent}12`,
  },
  channelIconCircleOn: {
    borderColor: accent,
    backgroundColor: accent,
  },
  /* Operator, 11 september 2026 (21e ronde): "geselecteerde voice... moet
     wit, we moeten accentkleur subtiel gebruiken" — de "AAN"-tekst was in
     de sessiekleur, nu wit; de accentkleur blijft wel op het icoontje
     ernaast (`Volume2` e.d., zie de aanroepen) — dat is de subtiele,
     kleine toepassing die overblijft, niet de tekst zelf. */
  /* Operator, 11 september 2026: exacte specificatie — 12px Medium,
     geen letterSpacing. Was semibold/9px. */
  channelLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    color: C.textSoft,
    marginTop: 2,
  },
  channelState: {
    fontFamily: BrandFonts.bold,
    fontSize: 8,
    letterSpacing: 0.4,
    color: C.textSoft,
  },
  /* Operator, 12 september 2026 (4e correctie): "tekst onder cirkels is
     onleesbaar" — `C.dim30` (30% zwart) had te weinig contrast op de
     lichte pagina; `C.dim55` leest duidelijk als "inactief/gedimd"
     zonder onleesbaar te worden. */
  channelOff: { color: C.dim55 },
  hapticGlyph: {
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    letterSpacing: -0.5,
  },

  /* Operator, 11 september 2026 (19e ronde): "boog en timing als 1 blok
     beetje 1cm naar boven, voice on... blijft op dezelfde plaats" — een
     `transform` i.p.v. een marge: dat verschuift enkel dit blok VISUEEL
     omhoog zonder de document-flow aan te raken, dus de kanalen-rij
     eronder (`channelRow`) blijft exact staan waar hij stond. */
  rhythmCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -36 }],
  },
  /* Vóór de sessie hoeft dit blok niet zo hoog: er staat geen boog in. */
  rhythmCardIdle: { paddingVertical: 12 },
  idleHint: {
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    color: C.dim50,
    textAlign: 'center',
    marginTop: 4,
  },
  /* Lager dan eerst: in de boog staat nu alleen de tijd, dus die hoort in
     het midden van de boog te hangen en niet tegen de bovenrand. */
  /* Operator, 11 september 2026 (14e ronde): mee opgeschaald met de
     grotere boog ("boog moet zelfs groter, zie bijlage mockup") — meer
     top-offset zodat het getal in het geopende midden van de grotere boog
     blijft staan, en de teksten zelf groter zodat ze de extra ruimte
     vullen i.p.v. er klein in te verdwalen. */
  /* Operator, 11 september 2026: "cijfers staan iets te hoog, moet
     exact in het middelpunt van de boog staan" — plus het getal zelf is
     net gegroeid (64px i.p.v. 46px, +17px hoogte) wat het nog hoger deed
     ogen. 48 → 62. */
  /* Operator, 12 september 2026 (3e correctie): `ARC_H` 152 → 134 (zie
     toelichting daar) — `top` hier stond op deze cijfer-boog afgestemd
     (62 = middelpunt van de oude 152px-boog); ongewijzigd gelaten
     overlapte "SEC"/"INHALE · NOSE" nu elkaar. 62 → 44, zelfde
     verhouding. */
  /* `top` volgt `ARC_H` 1-op-1 (top = ARC_H - 90, zo hield elke eerdere
     correctie het getal exact boven het midden van de boog) — 134 → 120,
     dus 44 → 30. */
  arcOverlay: { position: 'absolute', top: 50, alignItems: 'center' },
  /* De fase-regel onder de boog. Krijgt de volle breedte van het blok, dus
     "EXHALE · MOUTH" past zonder ergens tegenaan te lopen.
     Operator, 11 september 2026 (21e ronde): "exhale inhale tekst ook wit,
     accentkleur subtiel gebruiken" — was in de sessiekleur, nu wit. */
  /* Operator, 11 september 2026: exacte specificatie — 22px SemiBold,
     letterSpacing +1.0. Was bold/17px/2. */
  phaseLine: {
    fontFamily: BrandFonts.semibold,
    fontSize: 22,
    letterSpacing: 1,
    color: C.textSoft,
    textAlign: 'center',
    marginTop: 2,
  },
  /* Operator, 11 september 2026 (15e ronde): "lijn countdown groter" —
     het seconden-getal in de boog vergroot, meeschalend met de boog.
     Operator, 11 september 2026 (18e ronde): boog 20% kleiner, dus dit
     getal mee terug omlaag.
     Operator, 11 september 2026 (exacte specificatie): 64px, -1.0px
     letterSpacing. "Dit getal mag nóg groter en dikker." */
  phaseBig: {
    fontFamily: BrandFonts.bold,
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: -1,
    color: C.text,
  },
  /* Operator, 11 september 2026: exacte specificatie — 11px Medium,
     letterSpacing +0.5. Was semibold/1.6. */
  phaseUnit: {
    fontFamily: BrandFonts.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    color: C.dim50,
  },

  /* ── Bracelet ── */

  /* ── Voet ── */
  footerScrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  /* Vast onderaan, NIET als derde blok in de kolom. Als sibling van de
     ScrollView werd de knop bij tijd en wijle onder de schermrand geduwd —
     dan stond er geen enkele manier meer op het scherm om te beginnen of te
     stoppen. Een vastgezette voet kan niet weggedrukt worden, wat de inhoud
     ook doet. */
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
  },
  batteryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(224,179,65,0.25)',
    backgroundColor: 'rgba(224,179,65,0.07)',
  },
  batteryBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(224,179,65,0.14)',
  },
  batteryBannerBody: {
    flex: 1,
    gap: 2,
  },
  batteryBannerTitle: {
    color: '#E0B341',
    fontSize: 12.5,
    fontFamily: BrandFonts.semibold,
  },
  batteryBannerSubtitle: {
    color: 'rgba(224,179,65,0.65)',
    fontSize: 11,
    fontFamily: BrandFonts.medium,
  },
  /* Bewust lager dan eerst. Een knop van bijna zestig punten hoog domineert
     een scherm dat over rust gaat; vijftig is ruim genoeg om te raken.

     De hoogte staat EXPLICIET, niet via de padding van de tekst erin. Dit
     was de oorzaak van de verdwijnende knop: een LinearGradient die zijn
     hoogte alleen uit een kind haalt, meet met tussenpozen nul en verdwijnt
     dan volledig. Dat verklaart ook waarom END SESSION nooit wegviel — dat
     is een gewone View met rand, geen verloop. */
  /* GEEN `overflow: hidden` met borderRadius eromheen. Dat was de echte
     oorzaak van de verdwijnende knop: een verloop dat door een afgeronde
     ouder geclipt moet worden, komt er op deze renderer soms helemaal niet
     uit. De scrim — hetzelfde verloop, maar zonder clip — verscheen altijd
     wél, en dat verschil wees de weg. De ronding zit nu op het verloop
     zelf, dus er valt niets te clippen. */
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'center',
    paddingHorizontal: 30,
    height: BTN_H,
    borderRadius: BTN_H / 2,
    borderWidth: 1,
  },
  startTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 13.5,
    letterSpacing: 2.2,
  },
  unlockLink: {
    alignSelf: 'center',
    marginTop: 14,
    paddingVertical: 4,
  },
  unlockLinkTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    color: C.dim55,
  },
  /* Operator, 11 september 2026 (17e ronde): "end session rechts zetten"
     (na "pause knop moet gecentreerd") — een gewone rij zet het BLOK
     (cirkel+tekst) in het midden, niet de cirkel zelf; hoe breed de tekst
     is duwt de cirkel dan scheef. Nu is de cirkel ABSOLUUT vastgezet op
     exact 50% van deze rij (eigen halve breedte ervan afgetrokken via
     `marginLeft`), dus staat altijd op het echte midden. END SESSION staat
     daar los van vast, op de rand van de cirkel + een vaste marge. */
  /* Operator, 19 september 2026 ("END SESSION weg van rechts, als kleine
     gecentreerde tekstlink recht ONDER de paarse knop — herstelt de
     verticale symmetrie"): een eerdere poging tot deze kolom-layout (zie
     toelichting hieronder bij `pauseMain`) werd teruggedraaid omdat hij
     overlapte met de kanalen-rij die toen nog boven dit blok stond — die
     rij bestaat niet meer (vervangen door de "Audio & Haptics"-knop),
     dus die blokkade is weg. Geen `position:'absolute'`-trucs meer nodig
     om de cirkel gecentreerd te houden — bij een kolom (cirkel boven,
     tekst eronder) centreert `alignItems:'center'` ze allebei perfect,
     ongeacht hoe lang "END SESSION" is. */
  runningBtnRow: { width: '100%', alignItems: 'center' },
  /* Operator, 12 september 2026: "play-knop is nu wit met zwarte rand, oogt
     hard" — in light wordt de cirkel een volle vulling in de state-
     accentkleur (het paars van de lotus) i.p.v. een omlijnde witte
     schijf, met een wit icoon erin (zie de aanroep hieronder) — dat is nu
     de duidelijkste, meest opvallende actie op het scherm. Dark blijft de
     bestaande omlijnde stijl.
     (5e correctie, kort geprobeerd en weer teruggedraaid: een aparte
     kolom-layout met END SESSION los eronder — overlapte de kanalen-rij
     erboven. 6e correctie: terug naar deze rij, enkel de END SESSION-
     tekstkleur in light is nu zwart i.p.v. te licht grijs.) */
  /* Operator, 12 september 2026 (6e correctie): terug naar de bestaande
     naast-elkaar-rij (zie de toelichting bij de aanroep) — dus ook deze
     knop weer altijd absoluut gecentreerd, net als voorheen. */
  /* Operator, 12 september 2026 (9e correctie): light iets kleiner (72 →
     64) als deel van "alles moet kunnen ademen" — dark blijft op 72. */
  /* Operator, 21 september 2026 ("play en pause knop transparant blur
     maken... mag echt transparant zonder kleur"): geen vlakke
     `backgroundColor: accent` en geen tint-laag meer — enkel de BlurView
     (zie JSX). `overflow:'hidden'` zodat die netjes binnen de ronde vorm
     clipt. Vervolg ("buitencirkel mag wel duidelijker"): zonder vulling
     was `borderWidth: 0` niet genoeg om de vorm nog af te bakenen — een
     zichtbare witte rand i.p.v. geen rand. */
  /* Operator, 21 september 2026 ("buitenlijn mag iets zachter" → "nog
     iets rustiger"): 0.4 → 0.25 → 0.15 dekking, dunne dikte blijft — de
     echte `BlurView` (`dimezisBlurViewSdk31Plus`, zie JSX) staat er nog
     gewoon op, enkel de randkleur werd verder getemperd. */
  /* 64 → 72, en meer lucht tot END SESSION (operator, 6 okt 2026) —
     ademsessie en State Control blijven gelijk. */
  pauseMain: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    overflow: 'hidden',
  },
  /* Operator, 21 september 2026 ("misschien heel licht de kleur van de
     sessie, transparant?" → "mag iets duidelijker maar moet transparant
     blijven"): 0.12 → 0.2 — nog steeds een tint, geen vol vlak. */
  pauseMainTint: { opacity: 0.24 },
  endTxtWrap: {
    marginTop: 22,
  },
  /* Operator, 11 september 2026 (18e ronde): "end session mag kleiner".
     Operator, 12 september 2026: "strak en clean in het donkergrijs/
     zwart" — in light `C.dim72` (donkergrijs) i.p.v. het wittige
     `C.dim72`-equivalent dat er al stond; de token zelf verschilt al per
     thema (`DARK`/`LIGHT`), dus geen aparte light-tak nodig hier. */
  endTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: C.dim72,
  },

  /* ── Uitleg-popup. Eigen vormgeving, geen systeem-alert. ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: C.modalBackdrop,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  modalCard: {
    width: '100%',
    borderRadius: 22,
    /* Glas i.p.v. vlakke kaart (7 okt 2026): de VibezGlass-laag binnenin
       draagt kleur en glans — geen eigen vulling of rand meer. */
    overflow: 'hidden',
    paddingVertical: 22,
    paddingHorizontal: 22,
    gap: 9,
    position: 'relative',
  },
  /* Operator, 25 september 2026: kruisje-protocol, zelfde positie als
     ProtocolTeaserModal/PremiumPaywallModal (top-right, 44×44 hitSlop-
     vriendelijke zone). Enkel op de "Make this your default?"-kaart —
     deze `modalCard`-stijl wordt door meerdere popups in dit bestand
     gedeeld, maar de X zelf staat alleen in de JSX van die ene popup. */
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modalEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: accent,
  },
  modalTitle: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: C.text,
  },
  modalBody: {
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: C.dim78,
  },
  modalFoot: {
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: C.dim44,
    marginTop: 2,
  },
  /* Operator, 25 september 2026 ("cta ook wit, volgens ons protocol"): was
     accent-gekleurd (`accentSoft`/`accent`) — nu de officiële witte
     CTA-chrome uit `constants/theme.ts`'s `CTA`-object, gedeeld over alle
     ~8 vellen die deze stijl gebruiken (remember-keuze, Ujjayi-intro,
     trial-einde, Audio&Haptics/narrator Done, veiligheidsnote,
     premium-upsell, sessie-einde). */
  modalBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D2D2D7',
  },
  modalBtnTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 13.5,
    letterSpacing: 1.4,
    color: '#1D1D1F',
  },
  /* ── Het afsluitscherm ── */
  doneCard: {
    width: '100%',
    paddingTop: 26,
    paddingBottom: 22,
    paddingHorizontal: 22,
    gap: 9,
    alignItems: 'center',
    overflow: 'hidden',
  },
  /* Een streep in de kleur van de toestand, zoals bij de bracelet. Geeft het
     scherm zijn identiteit terug zonder er een gekleurd vlak van te maken. */
  doneEyebrow: { color: C.dim50 },
  /* Volle breedte: de kaart centreert zijn inhoud, anders krimpt de knop
     tot zijn tekst ("I'M DONE" viel tegen de rand). */
  doneBtn: { alignSelf: 'stretch' },
  braceletLine: {
    alignSelf: 'center',
    minHeight: 32,
    justifyContent: 'center',
    marginTop: -4,
    marginBottom: 12,
  },
  braceletLineTxt: {
    textAlign: 'center',
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    color: C.dim58,
  },
  feedMind: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
    gap: 4,
  },
  feedMindLead: {
    textAlign: 'center',
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: C.dim50,
  },
  feedMindLink: {
    textAlign: 'center',
    fontFamily: BrandFonts.semibold,
    fontSize: 14,
    color: C.text,
  },
  instantFeedbackRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  instantFeedbackLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    color: C.dim40,
    marginBottom: 6,
  },
  instantFeedbackChips: {
    flexDirection: 'row',
    gap: 14,
  },
  instantFeedbackChip: {
    fontFamily: BrandFonts.semibold,
    fontSize: 12,
    color: C.dim70,
    textDecorationLine: 'underline',
  },
  instantFeedbackThanks: {
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    color: C.dim40,
  },
  doneSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
  },
  doneCenter: { textAlign: 'center' },
  doneStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: accent,
  },
  doneBuddha: { width: 104, height: 104 },
  buddhaRingWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  buddhaRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  buddhaRingArc: {
    borderColor: 'transparent',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: C.sheetBackdrop,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '84%',
    backgroundColor: C.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: accentSoft,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  trialSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 10,
    gap: 9,
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.dim18,
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 17,
    letterSpacing: -0.2,
    color: C.text,
    marginBottom: 10,
  },
  /* Operator, 19 september 2026: hint boven de Done-knop die uitlegt
     waarom de Audio & Haptics-knop tijdens het ademen zelf verdwijnt (focus
     mode) — zonder deze regel oogt dat als "instellingen niet meer
     bereikbaar", terwijl pauzeren ze terugbrengt. */
  avSheetHint: {
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    color: C.dim55,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 12,
  },
  avChangeNarrator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginTop: -6,
    marginBottom: 20,
  },
  avChangeNarratorTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    color: C.dim55,
  },
  avRowLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    color: '#f4f4f4',
    marginBottom: 10,
  },
  avScapeScroll: {
    gap: 8,
    paddingBottom: 20,
  },
  avScapeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  avScapeChipTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    color: C.dim55,
  },
  avBraceletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(224,179,65,0.14)',
  },
  avBraceletBadgeTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    color: '#E0B341',
  },
  voiceSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  voiceSheetRowLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    color: C.textSoft,
  },
  /* `flexShrink` in plaats van een vrije hoogte. Zonder dit groeit de lijst
     met dertien regels tot voorbij het vel en duwt hij de Done-knop onder de
     navigatiebalk van het toestel — precies wat de operator zag: een knop die
     half onzichtbaar onderaan bleef hangen. Nu krimpt de lijst en houdt de
     knop zijn plek. */
  sheetList: { flexShrink: 1 },
  levelRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  levelChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.dim12,
    alignItems: 'center',
  },
  levelTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: C.dim50,
  },
  scapeGroup: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: C.dim38,
    marginTop: 16,
    marginBottom: 4,
  },
  scapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  scapeRowOn: { borderColor: accent, backgroundColor: accentSoft },
  scapeText: { flex: 1 },
  scapeName: {
    fontFamily: BrandFonts.semibold,
    fontSize: 14.5,
    color: C.text,
  },
  scapeHint: {
    fontFamily: BrandFonts.regular,
    fontSize: 11.5,
    color: C.dim42,
    marginTop: 1,
  },
  modalSecondary: { paddingVertical: 12, alignItems: 'center' },
  modalSecondaryTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    color: C.dim50,
  },

  /* Premium-popup-stijlen verhuisd naar PremiumPaywallModal.tsx. */
  });
}

/* ── Route /breath-session ────────────────────────────────────────────
   Deeplinks en meldingen openen nog deze route. Ze geeft de parameters
   door aan de sessie-laag en verdwijnt meteen weer; loopt er al een
   sessie, dan wordt die enkel teruggehaald (audit 5 okt 2026: een melding
   tijdens een sessie verving anders de lopende sessie). */
export default function BreathSessionRoute() {
  const raw = useLocalSearchParams();
  useEffect(() => {
    const params: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(raw)) params[k] = Array.isArray(v) ? v[0] : v;
    if (getBreathHost()) restoreBreathSession();
    else openBreathSession(params);
    if (router.canGoBack()) router.back();
    else router.replace('/breath');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <Stack.Screen options={{ headerShown: false, animation: 'none' }} />
    </View>
  );
}
