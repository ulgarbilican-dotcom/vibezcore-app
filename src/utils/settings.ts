/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — User settings (vzs_v1)

   Persistente UI-instellingen. Webapp-parity: zelfde key. Schema is
   extensible — nieuwe setting = veld + default toevoegen. JSON-parse
   gaat door try/catch en valt terug op defaults bij corruptie.

   Patroon: module-state + listener-set (zelfde als history.ts, vzp.ts,
   useFavorites.ts). Synchrone getter (`getSetting`) zodat de audio-
   service zonder hook kan lezen — een eerste auto-import van dit
   bestand triggert direct de load van AsyncStorage.
   ─────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { GOAL_KEYS } from '@/data/goal-states';

export const SETTINGS_KEY = 'vzs_v1';

/** Hoeveel tijd iemand per dag aan het protocol besteedt (operator, 13
 *  augustus 2026, protocol-systeem). Bepaalt zowel het AANTAL sloten per
 *  dag als WELKE duration binnen een toestand gekozen wordt — zie
 *  `utils/protocol.ts`, de enige plek die deze waarde interpreteert. */
/** 'complete' (17 september 2026): 4 sessies/dag — alle 4 dagdelen, enige
 *  tier die dat mogelijk maakt sinds de dagdeel-kiezer op intensity.tsx
 *  (zie protocol.ts `INTENSITY_SESSION_COUNT`/`INTENSITY_TARGET_MINUTES`).
 *  'custom' (17 september 2026, "Build it yourself"): geen vaste tier —
 *  de gebruiker bepaalt zelf hoeveel sessies per dagdeel, ook meerdere in
 *  hetzelfde dagdeel. Zie `build-your-day.tsx`/`generateCustomTemplate`. */
export type Intensity = 'essential' | 'standard' | 'advanced' | 'complete' | 'custom';

/** Ervaringsniveau met breathwork (operator, 21 september 2026: "gebruiker
 *  moet ook wel het niveau invullen... zodat wij op basis daarvan de
 *  ademtechniek en timing kunnen opstellen"). Bepaalt WELKE techniek
 *  `protocol.ts` per toestand kiest — elke toestand heeft 3 technieken,
 *  altijd in Beginner→Intermediate→Advanced-volgorde (`breath-states.ts`).
 *  `null` = nog niet gekozen; protocol.ts valt dan terug op Beginner. */
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type Settings = {
  autoPlayNext: boolean;
  /** Save listening progress — bewaart positie zodat sessies kunnen
   *  hervatten waar je gebleven was. Default true (gewenste UX).
   *  Wanneer uitgezet wordt vzp_v1 (saved-position) genegeerd door de
   *  audio-player. Bestaande positie-state blijft staan tot user
   *  Clear local data uitvoert. */
  saveProgress: boolean;
  /** Track listening history — vult vzh_v1 (Your Journey). Default true.
   *  Uitschakelen voorkomt nieuwe history-entries; bestaande blijven
   *  staan tot user 'm clear. */
  trackHistory: boolean;
  /** Audio quality — high (default) of low. Backend levert nu nog 1
   *  bitrate, dus deze setting is voor toekomstige variant-keuze.
   *  Comment-stub: audio-player respecteert deze nog niet (pas nodig
   *  wanneer backend multi-bitrate ondersteunt). */
  audioQuality: 'high' | 'low';
  /** Voice cues aan/uit voor breath- én bracelet-sessies. Eén schakelaar
   *  voor alles wat spreekt: de fasecues tijdens een sessie én de
   *  afsluitende monoloog bij het eindscherm. De knoppen op het
   *  sessiescherm en bij de bracelet zijn deze waarde — geen kopie ervan.
   *
   *  Default AAN (operator, 3 augustus 2026). Stond sinds 25 juni op UIT,
   *  zodat een ongeplande bracelet-activatie nooit onverwacht zou praten.
   *  Dat kostte meer dan het opleverde: begeleiding met stem is waar het
   *  product om draait, en een gebruiker die niets instelt hoorde niets.
   *  Wie stilte wil zet 'm uit — in Settings, met de knop in de sessie, of
   *  door in de onboarding voor trillingen of stil te kiezen — en dan is
   *  álles stil, tot en met het eindscherm. */
  voiceCues: boolean;
  /** Heeft de gebruiker de stem OOIT zelf aan- of uitgezet?
   *
   *  Nodig om een bewaarde `false` te kunnen onderscheiden van een `false`
   *  die er alleen stond omdat dat vroeger de standaard was. Zonder dit
   *  onderscheid zou het omzetten van de standaard (3 augustus 2026) iedereen
   *  die de app al draaide in stilte achterlaten — en juist die mensen hebben
   *  nooit om stilte gevraagd.
   *  Wordt door `setSetting('voiceCues', …)` automatisch op true gezet; vanaf
   *  dat moment is de bewaarde waarde leidend en raakt hij nooit meer kwijt. */
  voiceCuesChosen: boolean;
  /** Iter v??? (breath-onboarding): timestamp (ms) wanneer de gebruiker
   *  de eerste-run Breath-onboarding heeft afgerond (of geskipt).
   *  null = nog nooit doorlopen → Breath-tab-focus stuurt naar
   *  /breath-welcome. Non-null → onboarding voorbij, ga direct naar
   *  Breath-tab. Bestaande users (die al breath-history hebben vóór dit
   *  veld bestond) worden herkend op history.length > 0 in de
   *  Breath-tab-focus-check, dus zij zien de onboarding NIET ondanks
   *  null-waarde. Geen data-migratie nodig. */
  breathOnboardingCompletedAt: number | null;
  /** Operator, 7 september 2026: "mag maar 1 keer werken, de eerste
   *  keer" — de volledige, ontgrendelde gratis kennismakingssessie
   *  (`/breath-session?from=onboarding`) mag maar ÉÉN keer per gebruiker.
   *  Los van `breathOnboardingCompletedAt`: die vlag wordt bewust
   *  teruggezet door "Watch the intro again" in Settings (zodat je de
   *  UITLEG opnieuw kan zien), maar dat mag de gratis-sessie-sperre niet
   *  meenemen — anders is "intro opnieuw bekijken" een omweg naar
   *  onbeperkt gratis volledige sessies. null = nog nooit gebruikt. */
  breathFreeSessionUsedAt: number | null;
  /** Welk achtergrondgeluid bij welke toestand hoort. Per TOESTAND, want wie
   *  voor slapen Deep wil en voor focus Rain hoort dat niet elke keer opnieuw
   *  te kiezen. `null` als waarde betekent bewust GEEN geluid; ontbreekt de
   *  sleutel, dan geldt de standaard uit soundscapes.ts. */
  soundscapeByState: Record<string, string | null>;
  /** Waar de begeleiding vandaan komt: telefoon, bracelet, of privé.
   *  Zie data/guidance.ts — de bracelet-kanalen vragen hardware die er nog
   *  niet is, dus tot die tijd valt alles terug op de telefoon. */
  /** Telefoon-trilling aan of uit. Standaard AAN: samen met de stem is dit
   *  wat een sessie begeleidt. Dit is de ALGEMENE stand; per toestand kan er
   *  een eigen voorkeur overheen staan — zie `breathPrefs`. */
  hapticsPhone: boolean;
  /** Voorkeur PER TOESTAND (operator, 5 augustus 2026).
   *
   *  Iemand wil bij CALM CONTROL de stem aan en bij SLEEP alleen
   *  trilling. Eén stand voor alles kan dat niet, en dwingt hem elke sessie
   *  opnieuw te sleutelen. Ontbreekt er een sleutel, dan geldt de algemene
   *  stand hierboven — dus wie nooit iets per toestand instelt merkt niets
   *  van deze laag. */
  /* `voiceGender` (operator, 20 september 2026: "moet user niet de keuze
     krijgen om enkel voor deze state of voor alle states te setten?") —
     zelfde per-toestand-laag als `voice`/`haptics` hierboven, nu ook voor
     de verteller. Ontbreekt de sleutel, dan geldt de globale `voiceGender`
     hieronder. */
  breathPrefs: Record<
    string,
    { voice?: boolean; haptics?: boolean; voiceGender?: 'female' | 'male' }
  >;
  /** Waar iemand naartoe werkt. Leeg = niet gekozen, en dan gedraagt de app
   *  zich zoals zonder doel: klok en historiek bepalen de suggestie.
   *
   *  Hoogstens TWEE (operator, 6 augustus 2026). Bij drie of vier wegen alle
   *  vijf de toestanden even zwaar en valt de suggestie terug op puur de
   *  klok — dan doet de functie stilletjes niets meer terwijl de gebruiker
   *  denkt dat hij iets heeft ingesteld. Twee dekt wél de combinatie die
   *  mensen echt hebben, zoals slapen én minder stress. */
  goals: string[];
  /** Welke dagelijkse herinneringen aan staan. Zie services/reminders.ts —
   *  drie vaste momenten, geen vrije tijdkiezer. Standaard alle drie UIT:
   *  een app die ongevraagd begint te porren verliest precies de mensen die
   *  hij wil houden. */
  reminders: Record<string, boolean>;
  /** Op welk UUR een herinnering valt, per sleutel (`breath:morning`).
   *  Ontbreekt er een, dan geldt het standaarduur van dat moment. Bewust
   *  alleen hele uren: een keuze uit 24 dingen is te doen, een keuze uit
   *  1440 minuten is een formulier. */
  reminderHours: Record<string, number>;
  /** Wanneer een herinnering valt, in MINUTEN na middernacht. Vervangt
   *  `reminderHours`, dat alleen hele uren kon — iemand die om 7:15 opstaat
   *  hoort geen keuze te maken tussen 7 en 8. De oude sleutel wordt nog
   *  gelezen zodat een bestaande instelling niet verdwijnt. */
  reminderAt: Record<string, number>;
  /** Antwoorden uit de vragenlijst in de onboarding. Alles optioneel en
   *  nooit vereist — "prefer not to say" is een volwaardig antwoord. Wordt
   *  gebruikt om suggesties en het dagplan te kleuren, niet als poort. */
  profile: {
    gender?: string;
    age?: string;
    /* `experience` (onboarding stap 4) stond hier tot 22 september 2026 —
       verhuisd naar het echte `experienceLevel` hieronder, dat door
       `intensity.tsx`/`utils/protocol.ts` gelezen wordt. Dit veld werd
       nergens door het protocol-systeem gelezen, enkel door een tekstregel
       in breath-quiz.tsx (die nu ook `experienceLevel` leest). */
    /** MEERDERE momenten mogelijk (operator, 8 augustus 2026): wie
     *  's ochtends én 's avonds wil oefenen, hoort dat allebei te kunnen
     *  zeggen. Doelen blijven wél op twee — daar betekent alles aanvinken
     *  hetzelfde als niets aanvinken. */
    preferredSlots?: string[];
  };
  /** Intensiteit van het protocol (operator, 13 augustus 2026,
   *  protocol-systeem). `null` = nog geen protocol gegenereerd; zie
   *  `utils/protocol.ts`. Onafhankelijk van `goals` — het doel bepaalt
   *  WELKE toestanden, de intensiteit bepaalt HOEVEEL en HOE LANG. */
  intensity: Intensity | null;
  /** Zie `ExperienceLevel` hierboven. `null` = nog niet gekozen. */
  experienceLevel: ExperienceLevel | null;
  /** Heeft deze gebruiker OOIT een volledig protocol bevestigd (operator,
   *  13 augustus 2026: "user moet wel van 1 volledige versie kunnen
   *  proeven")? Bepaalt of "Build my protocol" nog gratis doorgaat naar
   *  intensity.tsx, of eerst de premium-teaser toont. Blijft `true` na een
   *  eventuele latere upgrade/downgrade — het is een proef die je hebt
   *  gehad, geen lopende status. */
  hasBuiltProtocol: boolean;
  /** Testschakelaar (operator, 13 augustus 2026: "ik wil permanent om
   *  regelmatig te kunnen testen") — omzeilt de 2-cycli-preview-limiet in
   *  breath-session.tsx net als de `from=onboarding`-deeplink, maar dan
   *  zonder telkens een URL te moeten intikken. Puur lokaal, ontgrendelt
   *  geen echte entitlement — alleen de sessie-lengte. */
  testFullSessions: boolean;
  /** Heeft de eenmalige uitleg over "blijf doorlopen als het scherm op slot
   *  gaat" al getoond (operator, 14 augustus 2026: "iemand die gewoon
   *  breathwork begint gaat nooit weten dat het hierdoor komt... iedereen
   *  gaat denken het werkt niet")? Toont zichzelf automatisch bij de eerste
   *  sessie op Android i.p.v. verstopt te blijven in Settings — zie
   *  breath-session.tsx `start()`. Blijft `true` na de eerste keer, ongeacht
   *  het antwoord; wie "Cancel" tikte vindt de rij nog altijd terug in
   *  Settings. */
  hasSeenBatteryPrompt: boolean;
  /** Light/dark-modus (operator-beslissing 2026-09-05: hele app krijgt
   *  light + dark; operator-omkering 26 september 2026: dark is nu de
   *  default, niet light). Wordt gelezen door `useAppTheme()`
   *  in `src/hooks/useAppTheme.ts`. 'system' volgt de telefoon se eigen
   *  instelling (toegevoegd 6 september 2026 — standaard bij de grote
   *  apps naast een eigen vaste voorkeur; useAppTheme() lost 'm live op
   *  via de Appearance-API). */
  themeMode: 'light' | 'dark' | 'system';
  /** Operator, 11 september 2026: welke stem de breathwork-cues spreekt —
   *  'female' (Kylie, UI-naam "Eli") of 'male' (Marius, UI-naam
   *  "Benjamin"). Eén globale keuze (Settings), niet per sessie — zelfde
   *  patroon als `voiceCues` hierboven; de per-sessie Voice-knop op
   *  breath-session.tsx blijft enkel AAN/UIT regelen, niet de identiteit.
   *  Default 'female': Kylie is de stem die al vóór deze instelling
   *  bestond, dus bestaande gebruikers merken bij het invoeren van deze
   *  toggle niets — geen stilzwijgende stemwissel. Zie
   *  `services/breath-voice.ts` voor welke cue-set elke waarde selecteert. */
  voiceGender: 'female' | 'male';
  /** Operator, 29 september 2026 ("na connect, bij eerste connectie door
   *  klant, soort onboarding"): zelfde rol als `breathOnboardingCompletedAt`
   *  hierboven, nu voor de bracelet — `null` = nog nooit verbonden geweest,
   *  dus `bracelet-control.tsx` stuurt de gebruiker na de EERSTE succesvolle
   *  connectie naar `/bracelet-set-day` i.p.v. rechtstreeks het idle-
   *  scherm. Daarna blijft dit een timestamp, nooit meer teruggezet (in
   *  tegenstelling tot de breath-versie, die je zelf via Settings kan
   *  herstarten — hier is er geen "intro opnieuw bekijken"-equivalent). */
  braceletOnboardingCompletedAt: number | null;
};

const defaults: Settings = {
  /* Iter 9dq v153 (operator-fix 2026-06-17): default ON. Operator-keuze
     "hij moet automatisch doorspelen volgende" — voorheen stond default
     OFF wat na elke sessie het "Session Complete"-paneel triggerde ook
     wanneer er nog volgende sessies in de serie waren. User kan altijd
     terug-toggle via de Auto-play switch op de Library. */
  autoPlayNext: true,
  saveProgress: true,
  trackHistory: true,
  audioQuality: 'high',
  voiceCues: true,
  voiceCuesChosen: false,
  breathOnboardingCompletedAt: null,
  breathFreeSessionUsedAt: null,
  soundscapeByState: {},
  hapticsPhone: true,
  breathPrefs: {},
  goals: [],
  reminders: {},
  reminderHours: {},
  reminderAt: {},
  profile: {},
  intensity: null,
  experienceLevel: null,
  hasBuiltProtocol: false,
  testFullSessions: false,
  hasSeenBatteryPrompt: false,
  themeMode: 'dark',
  voiceGender: 'female',
  braceletOnboardingCompletedAt: null,
};

let state: Settings = { ...defaults };
let initialized = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  setTimeout(() => { listeners.forEach((l) => l()); }, 0);
}

async function loadOnce(): Promise<void> {
  if (initialized) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          state = {
            ...defaults,
            ...(typeof obj.autoPlayNext === 'boolean'
              ? { autoPlayNext: obj.autoPlayNext }
              : {}),
            ...(typeof obj.saveProgress === 'boolean'
              ? { saveProgress: obj.saveProgress }
              : {}),
            ...(typeof obj.trackHistory === 'boolean'
              ? { trackHistory: obj.trackHistory }
              : {}),
            ...(obj.audioQuality === 'high' || obj.audioQuality === 'low'
              ? { audioQuality: obj.audioQuality }
              : {}),
            /* Deze regel ONTBRAK (gevonden 3 augustus 2026). `voiceCues`
               werd wel weggeschreven maar nooit teruggelezen, dus viel hij
               bij elke start terug op de standaard: wie de stem uitzette had
               hem na herstart weer aan staan. Dat verklaart ook waarom de
               schermen een eigen kopie van die knop bijhielden — de
               instelling zelf hield niets vast.
               Alleen leidend als de gebruiker hem ooit zelf heeft omgezet;
               anders geldt de standaard van vandaag, niet die van toen. */
            ...(obj.voiceCuesChosen === true && typeof obj.voiceCues === 'boolean'
              ? { voiceCues: obj.voiceCues, voiceCuesChosen: true }
              : {}),
            ...(typeof obj.breathOnboardingCompletedAt === 'number' ||
            obj.breathOnboardingCompletedAt === null
              ? { breathOnboardingCompletedAt: obj.breathOnboardingCompletedAt }
              : {}),
            ...(typeof obj.breathFreeSessionUsedAt === 'number' ||
            obj.breathFreeSessionUsedAt === null
              ? { breathFreeSessionUsedAt: obj.breathFreeSessionUsedAt }
              : {}),
            ...(obj.profile &&
            typeof obj.profile === 'object' &&
            !Array.isArray(obj.profile)
              ? { profile: obj.profile }
              : {}),
            ...(obj.reminderAt &&
            typeof obj.reminderAt === 'object' &&
            !Array.isArray(obj.reminderAt)
              ? { reminderAt: obj.reminderAt }
              : {}),
            ...(obj.reminderHours &&
            typeof obj.reminderHours === 'object' &&
            !Array.isArray(obj.reminderHours)
              ? { reminderHours: obj.reminderHours }
              : {}),
            ...(obj.reminders &&
            typeof obj.reminders === 'object' &&
            !Array.isArray(obj.reminders)
              ? { reminders: obj.reminders }
              : {}),
            ...(typeof obj.hapticsPhone === 'boolean'
              ? { hapticsPhone: obj.hapticsPhone }
              : {}),
            /* Leest ook de oude enkelvoudige sleutel, zodat wie al een doel
               had het niet kwijtraakt.
               Operator, 22 september 2026 ("peak performance en calm the
               mind schrappen, van 8 naar 6 doelen"): filtert nu ook tegen
               `GOAL_KEYS`, de actuele lijst — zonder dit zou een
               gebruiker die eerder 'peakPerformance'/'calmMind' koos die
               stale sleutel voor altijd blijven meeslepen (geen crash,
               maar wel een "undefined"-label zodra `GOAL_NAMES`/
               `GOAL_STATES` 'm niet meer herkennen, zie day-plan.ts). */
            ...(Array.isArray(obj.goals)
              ? {
                  goals: obj.goals.filter(
                    (g: unknown): g is string =>
                      typeof g === 'string' &&
                      (GOAL_KEYS as string[]).includes(g),
                  ),
                }
              : typeof obj.goal === 'string' && (GOAL_KEYS as string[]).includes(obj.goal)
                ? { goals: [obj.goal] }
                : {}),
            ...(obj.breathPrefs &&
            typeof obj.breathPrefs === 'object' &&
            !Array.isArray(obj.breathPrefs)
              ? { breathPrefs: obj.breathPrefs }
              : {}),
            ...(obj.soundscapeByState &&
            typeof obj.soundscapeByState === 'object' &&
            !Array.isArray(obj.soundscapeByState)
              ? { soundscapeByState: obj.soundscapeByState }
              : {}),
            /* BUG (operator, 13 augustus 2026): `intensity` en
               `hasBuiltProtocol` stonden wel in Settings + defaults, maar
               hadden hier geen merge-regel — dus las loadOnce() ze na een
               herstart altijd terug als de default, ook als ze net daarvoor
               echt opgeslagen waren. Precies zichtbaar geworden toen de
               teaser-popup na een app-herstart nooit verscheen: de app
               dacht bij elke cold start weer dat er nog nooit een protocol
               gebouwd was. */
            ...(obj.intensity === 'essential' ||
            obj.intensity === 'standard' ||
            obj.intensity === 'advanced' ||
            obj.intensity === 'complete' ||
            obj.intensity === 'custom' ||
            obj.intensity === null
              ? { intensity: obj.intensity }
              : {}),
            ...(obj.experienceLevel === 'beginner' ||
            obj.experienceLevel === 'intermediate' ||
            obj.experienceLevel === 'advanced' ||
            obj.experienceLevel === null
              ? { experienceLevel: obj.experienceLevel }
              : {}),
            ...(typeof obj.hasBuiltProtocol === 'boolean'
              ? { hasBuiltProtocol: obj.hasBuiltProtocol }
              : {}),
            ...(typeof obj.testFullSessions === 'boolean'
              ? { testFullSessions: obj.testFullSessions }
              : {}),
            ...(typeof obj.hasSeenBatteryPrompt === 'boolean'
              ? { hasSeenBatteryPrompt: obj.hasSeenBatteryPrompt }
              : {}),
            ...(obj.themeMode === 'light' ||
            obj.themeMode === 'dark' ||
            obj.themeMode === 'system'
              ? { themeMode: obj.themeMode }
              : {}),
            /* Operator, 11 september 2026: nieuw veld — zonder deze regel
               zou een opgeslagen keuze na herstart altijd terugvallen op de
               default (zelfde klasse bug als hierboven bij voiceCues en
               intensity/hasBuiltProtocol al eens gebeurde). */
            ...(obj.voiceGender === 'male' || obj.voiceGender === 'female'
              ? { voiceGender: obj.voiceGender }
              : {}),
            /* Operator, 29 september 2026: nieuw veld — zelfde regel als
               hierboven, anders vergeet de app na een herstart telkens
               dat deze gebruiker al eens verbonden is geweest. */
            ...(typeof obj.braceletOnboardingCompletedAt === 'number' ||
            obj.braceletOnboardingCompletedAt === null
              ? { braceletOnboardingCompletedAt: obj.braceletOnboardingCompletedAt }
              : {}),
          };
        }
      }
    } catch {
      /* corrupt → defaults */
    }
    initialized = true;
    notify();
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
  } catch {
    /* schrijf-fout — runtime-state blijft staan */
  }
}

/** Synchrone read — geldig na initiële load. Vóór de eerste load returnt
 *  hij de defaults; voor onze use-case (autoPlayNext default false) is
 *  een eventuele gemiste eerste finished-event acceptabel. */
export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return state[key];
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): Promise<void> {
  await loadOnce();
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  /* Wie de stem omzet, doet dat bewust — en vanaf dat moment is zijn keuze
     leidend, ook als een latere versie een andere standaard kiest. */
  if (key === 'voiceCues') state = { ...state, voiceCuesChosen: true };
  notify();
  /* Operator, 7 september 2026: elders (settings.tsx) volgt op een
     `await setSetting(...)` soms een harde `DevSettings.reload()` — als
     `persist()` hier niet werd afgewacht, resolvet deze functie zodra de
     schrijf naar AsyncStorage enkel GESTART is, niet klaar. Een reload die
     daar vlak op volgt kan de JS-engine dan afbreken vóór de schrijf de
     schijf haalt, en de wijziging is spoorloos weg na de "reset". */
  await persist();
}

/** Kicker voor de eerste load. Wordt automatisch aangeroepen bij module
 *  init (zie regel onderaan dit bestand). Veilig om handmatig nogmaals
 *  aan te roepen vanuit bv. de root-layout. */
export function ensureSettingsLoaded(): Promise<void> {
  return loadOnce();
}

export function useSetting<K extends keyof Settings>(
  key: K
): [Settings[K], (v: Settings[K]) => void] {
  const [val, setVal] = useState<Settings[K]>(state[key]);
  useEffect(() => {
    loadOnce().then(() => setVal(state[key]));
    const listener = () => setVal(state[key]);
    listeners.add(listener);
    setVal(state[key]);
    return () => {
      listeners.delete(listener);
    };
  }, [key]);
  const setter = (v: Settings[K]) => {
    setSetting(key, v);
  };
  return [val, setter];
}

/* Auto-init: zodra een module dit bestand importeert (bv. audio-service
   of een React-hook in account.tsx) wordt de load alvast gekickt. Tegen
   de tijd dat een sessie eindigt en `getSetting('autoPlayNext')` wordt
   gelezen, zit de waarde in memory. */
loadOnce();
