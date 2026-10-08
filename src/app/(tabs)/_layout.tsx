/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Tab navigation skeleton

   Gast-first: the app opens DIRECTLY here. No welcome page, no login wall.
   3 tabs: Audio Library · Bracelet · Account.

   Library is GEEN aparte tab meer; de Library-functionaliteit (zoekbalk,
   filters, Your Journey, FOLLOW per serie, favorites per sessie) wordt
   geïntegreerd ÍN de Audio Library-tab — bron: blauwdruk §3 + besluit
   eigenaar. library.tsx is daarom verwijderd uit deze map.

   ─── Waarom een custom tabBarButton ───
   Vastgesteld via console.log-diagnostiek: de default tab-button uit
   @react-navigation/bottom-tabs (PlatformPressable) ving de press niet
   door op deze stack (RN 0.83 + expo-router 55 + react 19 + reactCompiler).
   Tikken op een tab triggerde geen onPress en dus ook geen tabPress-listener
   — vandaar dat Library "dood" leek. We vervangen de button daarom door een
   gewone `Pressable` uit react-native met directe `router.navigate(path as never)`.
   Daarmee gaat de navigatie buiten het navigator-event-systeem om en is ze
   onafhankelijk van welke optimalisatie er ook bovenop ligt.

   Uiterlijk: MERK_ANKER — Brand-palet, Inter via _layout.
   ─────────────────────────────────────────────────────────────────────────── */

import { saveLastTab } from '@/utils/last-tab';
import { bootDecided } from '@/utils/boot';
import BraceletIcon from '@/components/BraceletIcon';
import { BraceletMiniIndicator } from '@/components/BraceletMiniIndicator';
import { MiniPlayer } from '@/components/MiniPlayer';
import { PremiumPill } from '@/components/PremiumPill';
import { AUDIO_ENABLED } from '@/constants/features';
import { BrandFonts } from '@/constants/theme';
import { requestLibraryReset } from '@/utils/library-reset-intent';
import {
  isActiveSessionVisible,
  isChooseScreenVisible,
  isStateControlIntroVisible,
  setTabsOnTop,
  subscribeActiveSessionVisible,
  subscribeChooseScreenVisible,
  subscribeStateControlIntroVisible,
} from '@/utils/state-control-ui';
import { router, Tabs, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ChartNoAxesColumn,
  CircleUserRound,
  BookAudio,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabPath = '/' | '/breath' | '/bracelet' | '/activity' | '/account';

/* Operator, 18 september 2026 ("verander bracelet icoon in tablat naar
   minimalistische bracelet icoon"): lucide's `Watch` was hier een
   horloge-icoon, geen bracelet — `BraceletIcon` is een eigen SVG-icoon
   (zie dat bestand) met dezelfde `size`/`color`/`strokeWidth`-props als
   een lucide-icoon, dus TabGlyph accepteert voortaan allebei. */
type IconComponent = LucideIcon | typeof BraceletIcon;

/* Eigen tab-button. Wraps de bestaande icon+label-children van de navigator
   in een gewone Pressable; onPress doet één ding: navigeer naar path. */
function TabButton({
  path,
  children,
  accessibilityLabel,
  accessibilityState,
  testID,
}: {
  path: TabPath;
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  testID?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        if (__DEV__) console.log('TABBUTTON tap:', path);
        /* Iter 9dq v98 (2026-06-04): tap op Audio Library-tab reset de
           landing-state in (tabs)/index.tsx zodat bracelet-only users die
           in de free-library waren doorgeklikt, bij hun terugkeer eerst
           de korte bracelet-only landing-page zien (operator-spec). Vuurt
           alleen op echte tab-button-tap — modal-close triggert dit niet
           (geen focus-effect-misuse). */
        if (path === '/') {
          requestLibraryReset();
        }
        /* `as never`: expo-router genereert zijn routetypes uit de mappen,
           en een net toegevoegd scherm staat pas in dat bestand na de
           volgende build. De route bestaat wel — hij staat hieronder als
           Tabs.Screen. */
        router.navigate(path as never);
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      testID={testID}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      /* Operator ("bij aanklikken moet het donkerder highlighten nu niet
         duidelijk"): stond nog op wit-op-wit (rgba(255,255,255,0.06)) —
         dat paste bij de oude donkere balk, is op de huidige witte balk
         vrijwel onzichtbaar. Donkere ripple, zelfde donkere tint als de
         rest van de app op lichte vlakken. */
      android_ripple={{ color: 'rgba(10,10,12,0.12)', borderless: true }}
    >
      {children}
    </Pressable>
  );
}

/* Operator, 18 september 2026 ("kan jij onderste tabblad ook hetzelfde
   maken? de iconen en doorzichtig?" → later: "tabblad bij aanklikken
   gewoon wit behouden", "icoon groter en duidelijker aangeven"): echte
   lijn-iconen i.p.v. de platte tekst-tekens (○/♪/◎/◔/○) die hier voorheen
   stonden, in een doorzichtige cirkel met enkel een rand. Icoon EN rand
   blijven altijd wit/licht, ook actief — geen kleur als selectie-signaal.
   De cirkel zelf toont selectie via grootte/rand/vulling (zie hieronder);
   het label eronder (`TabLabel`) draagt het enige streepje. */
/* Operator, 19 september 2026 ("weg met de dikke witte strepen... Apple-
   standaard: actief icoon 100% opacity, inactief dimt naar 50%"): de
   omlijnde-cirkel + onderstreep-balk (18 september, hierboven verwijderd)
   was een bewust gekozen, net-getunede stijl — maar de operator wil hier
   nu toch de kalere Apple-conventie: geen rand, geen balk, enkel opacity
   draagt de selectie. */
/* Operator, 24 september 2026, definitief (na twee keer heen en weer over
   een chroma-glow achter het actieve tab-icoon): "dat moet gewoon weg,
   enkel witte highlight blijft bij aanklikken" — geen kleur-cirkel meer
   hier, enkel opacity (1 actief, 0.45 inactief) draagt de selectie. */
/* Operator, 25 september 2026, vierde ronde ("niet-actieve iconen/tekst
   niet goed zichtbaar"): de vorige `opacity: focused ? 1 : 0.35`-selectie
   (18/24 september) was getuned voor WITTE iconen op een DONKERE balk —
   35% van wit blijft nog altijd redelijk leesbaar tegen zwart. Nu de balk
   wit is en de iconen donker (`#1D1D1F`), doet diezelfde 0.35 opacity het
   omgekeerde: 35% van bijna-zwart op wit is bijna onzichtbaar. Geen
   opacity-truc meer — active/inactive zijn nu gewoon twee losse, altijd
   voluit zichtbare kleuren, zelfde paar als de rest van de light-mode
   chrome (`text` / `text-muted` uit het design-system: `#1D1D1F` /
   `#8E8E93`), exact zoals Apple's eigen tab bar (donkergrijs = geselecteerd,
   middengrijs = niet-geselecteerd, nooit halftransparant). */
const TAB_ACTIVE_COLOR = '#1D1D1F';
const TAB_INACTIVE_COLOR = '#8E8E93';

function TabGlyph({ Icon, focused }: { Icon: IconComponent; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Operator ("iconen mogen kleiner"): 22 → 19. */}
      <Icon
        size={19}
        color={focused ? TAB_ACTIVE_COLOR : TAB_INACTIVE_COLOR}
        strokeWidth={2}
      />
    </View>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      numberOfLines={1}
      style={{
        /* Operator, 2 okt 2026 ("vrij hoog, hoe zou Apple dat doen"):
           Apple's eigen tab bar zet het label vlak onder het icoon (±2pt),
           niet met 8px lucht ertussen — samen met de kleinere balk-hoogte
           hierboven maakt dit de hele balk zichtbaar compacter. */
        marginTop: 2,
        fontSize: 10,
        fontFamily: focused ? BrandFonts.semibold : BrandFonts.medium,
        letterSpacing: 0.3,
        color: focused ? TAB_ACTIVE_COLOR : TAB_INACTIVE_COLOR,
      }}
    >
      {label}
    </Text>
  );
}

/* Welk scherm de tab-groep als eerste opent.
   MOET expliciet sinds het audio-tabblad verborgen is (5 augustus 2026): dat
   was het eerste scherm in de map en dus vanzelf de startroute. Met `href:
   null` bestaat die route nog wel maar is hij niet meer bereikbaar, en dan
   loopt navigeren naar de groep stuk — precies de fout die de operator zag op
   het welkomstscherm. */
export const unstable_settings = { initialRouteName: 'breath' };

export default function TabLayout() {
  /* @react-navigation/bottom-tabs plakt zelf `paddingBottom: insets.bottom`
     bovenop `tabBarStyle` (BottomTabBar.js) — een VASTE `height` die daar
     geen rekening mee houdt, laat de safe-area-padding gewoon een stuk van
     de vaste hoogte OPETEN. Icoon (22) + marge (8) + label (~14) hebben
     zelf al ~44px nodig; op een toestel met een grote gesture-bar (Android)
     bleef er bij een vaste `height: 56` bijna niets over — de tabs waren
     dan zo goed als onzichtbaar/afgesneden ("ik zie geen tabbladen meer
     onderaan", operator 25 september 2026). `height` telt de inset MEE op,
     zodat er altijd een vaste eigen content-ruimte overblijft, ongeacht
     toestel — zie `tabBarStyle.height` verderop voor de exacte waarde. */
  const insets = useSafeAreaInsets();
  /* Actieve State Control-sessie = volledig scherm, geen tabbalk (operator,
     5 okt 2026) — zie utils/state-control-ui.ts. */
  const [sessionVisible, setSessionVisible] = useState(isActiveSessionVisible());
  useEffect(() => subscribeActiveSessionVisible(setSessionVisible), []);
  /* Ook het keuzescherm zonder tabbalk, zoals de breathwork-setup (6 okt
     2026) — maar niet zolang het intro erover ligt. */
  const [chooseVisible, setChooseVisible] = useState(isChooseScreenVisible());
  useEffect(() => subscribeChooseScreenVisible(setChooseVisible), []);
  const [introVisible, setIntroVisible] = useState(isStateControlIntroVisible());
  useEffect(() => subscribeStateControlIntroVisible(setIntroVisible), []);
  const hideStateControlBar = sessionVisible || (chooseVisible && !introVisible);
  /* Voor openStateControl: tab wisselen als de tabbladen bovenaan liggen,
     anders terugkeren naar de tabbladen (6 okt 2026). */
  useFocusEffect(
    useCallback(() => {
      setTabsOnTop(true);
      return () => setTabsOnTop(false);
    }, []),
  );

  /* Wrap Tabs in een View zodat we de MiniPlayer ernaast (absolute,
     boven de tab-bar) kunnen mounten. MiniPlayer rendert zelf null
     wanneer geen sessie actief is en op /player + /welcome. */
  return (
    /* Operator, 25 september 2026, derde ronde: de balk is terug een GEWONE
       (niet-absolute) balk — reserveert zijn eigen ruimte automatisch in de
       flex-flow, zoals Apple's eigen tab bar ook gewoon deel is van de
       layout i.p.v. een zwevend overlay. Deze `backgroundColor` is enkel
       nog een fallback voor het ene frame vóór een scherm zijn eigen
       achtergrond tekent. */
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Tabs
        /* Terug gaat naar de BEGINROUTE, niet naar het vorige tabblad dat je
           bezocht (operator, 7 augustus 2026). Zonder dit landde de
           terugknop op het verborgen audioscherm — dat is nog steeds het
           eerste scherm van de groep, ook al staat het niet in de balk. */
        backBehavior="initialRoute"
        /* Operator, 7 okt 2026 ("ik volg apple niveau"): onthoud het laatst
           gebruikte tabblad — een ingelogde gebruiker opent daar de volgende
           keer meteen in (zie utils/last-tab.ts). */
        screenListeners={({ route }) => ({
          /* Pas na de opstartbeslissing: bij een koude start monteert eerst
             `/` (Library) en zou dat het echte laatste tabblad overschrijven. */
          focus: () => {
            if (bootDecided()) saveLastTab(route.name);
          },
        })}
        screenOptions={{
          headerShown: false,
          /* Operator, 25 september 2026: eerst een echte `BlurView`-Material
             geprobeerd, operator vond matglas niet mooi — "kunnen we het
             transparant maken". Geen `tabBarBackground`-laag meer, geen
             getinte overlay: de balk zelf heeft nu GEEN achtergrond, enkel
             de iconen/labels zweven op wat eronder staat. */
          tabBarStyle: {
            /* Operator, 25 september 2026, derde ronde ("onderste band wit
               maken, moet totaal doorlopen van links naar rechts, hoe zou
               Apple dit doen"): terug naar Apple's eigen `UITabBar`-patroon
               — GEEN zwevende kaart met marges meer (dat was een eigen
               ontwerpkeuze van eerdere iteraties, geen Apple-standaard).
               Apple's tab bar is vlak, ondoorzichtig wit, loopt volledig
               van links tot rechts door, plakt tegen de onderrand, en heeft
               enkel een haarlijn-scheiding bovenaan — geen ronding, geen
               marge, geen schaduw. Terug een GEWONE (niet-absolute) balk:
               daarmee reserveert de flex-layout automatisch zijn ruimte, dus
               geen `tabBarFootprint`-compensatie meer nodig in de
               tabschermen (die is hier elders weer verwijderd) — exact
               hoe deze balk vóór de "zwevende kaart"-periode ook al werkte. */
            /* Operator, 2 okt 2026 ("staat vrij hoog, hoe zou Apple dat
               doen"): Apple's eigen `UITabBar` content-hoogte is 49pt
               (zonder safe-area) — 62 lag daar ver boven. Terug naar
               Apple's maat, met net genoeg marge (2px) voor de dalende
               "p" in "Profile" die de vorige 56 liet afsnijden; 51 geeft
               diezelfde veiligheid zonder de overmaat van 62. */
            height: 51 + insets.bottom,
            borderRadius: 0,
            backgroundColor: '#ffffff',
            /* Apple se eigen separator-kleur (`separator` in de HIG),
               niet zwart — een zachte grijze haarlijn, geen "fucking lijn"
               in de zin van de eerdere klacht (die ging over een ONGEWENSTE
               schaduw/rand op de vorige DONKERE balk; hier is de haarlijn
               bewust, exact zoals Apple 'm zelf tekent). */
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: 'rgba(60,60,67,0.29)',
            borderWidth: 0,
            paddingTop: 4,
            /* GEEN `paddingBottom: 0` meer — @react-navigation/bottom-tabs
               plakt intern zelf `paddingBottom: insets.bottom` bovenop deze
               stijl (zie BottomTabBar.js), en dat is nu precies gewenst:
               een balk die vast tegen de onderrand plakt hoort de safe-area
               zelf als binnenpadding te dragen — exact hoe Apple's eigen
               tab bar (49pt + safe-area-inset) is opgebouwd. */
          },
        }}
      >
        {/* Operator, 7 september 2026: Breath als 1ste tabblad, Audio Library
           als 2de — volgorde in de balk volgt gewoon de JSX-volgorde
           hieronder, `name="index"` blijft ondertussen de technische
           beginroute van de groep (zie `backBehavior` hierboven). */}
        <Tabs.Screen
          name="breath"
          options={{
            title: 'Breath',
            tabBarIcon: ({ focused }: { focused: boolean }) => (
              <TabGlyph Icon={Wind} focused={focused} />
            ),
            tabBarLabel: ({ focused }: { focused: boolean }) => (
              <TabLabel label="Breath" focused={focused} />
            ),
            tabBarButton: (props) => <TabButton path="/breath" {...props} />,
          }}
        />
        {/* De audiobibliotheek is VERBORGEN, niet verwijderd (operator,
            5 augustus 2026). `href: null` haalt het tabblad uit de balk maar
            laat het scherm bestaan: bestaande abonnementen, voortgang en de
            speler blijven werken, en wie er via een deeplink komt krijgt het
            gewoon te zien. Terugzetten is één waarde in constants/features. */}
        <Tabs.Screen
          name="index"
          options={
            /* ÉÉN van de twee, nooit allebei. Expo Router weigert `href` en
               `tabBarButton` samen en gooit dan de hele tab-groep om — niet
               alleen dit tabblad. Dat was de foutmelding die elke knop naar
               de tabs stuk maakte: het scherm bestond nog, maar de groep
               waarin het zat weigerde te bouwen.
               Verbergen doet `href: null` in zijn eentje; de eigen knop is
               daar dan niet meer voor nodig, want er is niets te tonen. */
            AUDIO_ENABLED
              ? {
                  title: 'Audio Library',
                  tabBarIcon: ({ focused }: { focused: boolean }) => (
                    <TabGlyph Icon={BookAudio} focused={focused} />
                  ),
                  tabBarLabel: ({ focused }: { focused: boolean }) => (
                    <TabLabel label="Library" focused={focused} />
                  ),
                  tabBarButton: (props) => <TabButton path="/" {...props} />,
                }
              : { href: null }
          }
        />
        <Tabs.Screen
          name="bracelet"
          options={{
            /* GEWIJZIGD 4 oktober 2026: deze tab toont nu altijd Session
               Control (geen marketing-etalage meer, zie (tabs)/bracelet.tsx)
               — "State Control" beschrijft die functie beter dan "Bracelet". */
            title: 'State Control',
            tabBarIcon: ({ focused }: { focused: boolean }) => (
              <TabGlyph Icon={BraceletIcon} focused={focused} />
            ),
            tabBarLabel: ({ focused }: { focused: boolean }) => (
              <TabLabel label="State Control" focused={focused} />
            ),
            tabBarButton: (props) => <TabButton path="/bracelet" {...props} />,
            /* Sleutel enkel meegeven als de balk weg moet — een `undefined`
               zou de stijl uit screenOptions overschrijven. */
            ...(hideStateControlBar ? { tabBarStyle: { display: 'none' as const } } : {}),
          }}
        />
        {/* Wat je gedaan hebt verdient een eigen plek in de balk (operator,
            6 augustus 2026), niet een icoontje op een ander scherm.
            Droeg tot 7 september 2026 ook de ingang naar Settings ("dat is
            waar iemand hem zoekt zodra hij naar zijn eigen cijfers kijkt")
            — operator toen: "de settings knop moet in account zitten, nu
            is het zoeken". Terug naar ÉÉN plek: Account. */}
        <Tabs.Screen
          name="activity"
          options={{
            title: 'Activity',
            tabBarIcon: ({ focused }: { focused: boolean }) => (
              <TabGlyph Icon={ChartNoAxesColumn} focused={focused} />
            ),
            tabBarLabel: ({ focused }: { focused: boolean }) => (
              <TabLabel label="Activity" focused={focused} />
            ),
            tabBarButton: (props) => <TabButton path="/activity" {...props} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Account',
            tabBarIcon: ({ focused }: { focused: boolean }) => (
              <TabGlyph Icon={CircleUserRound} focused={focused} />
            ),
            tabBarLabel: ({ focused }: { focused: boolean }) => (
              <TabLabel label="Profile" focused={focused} />
            ),
            tabBarButton: (props) => <TabButton path="/account" {...props} />,
          }}
        />
      </Tabs>
      <MiniPlayer />
      {/* Operator, 16 september 2026 ("iemand kan andere sites bekijken
         en dan onmiddellijk terugvinden waar de sessie loopt"):
         teruggehaald uit `master` (iter v238b) — ontbrak op deze
         rollback-branch. Bewust ALLEEN de pill, niet de v238i tab-bar-
         hide-subscribe die destijds samen met deze pill een crash-on-
         launch veroorzaakte (nooit met zekerheid geïsoleerd welke van
         de twee) — kleiner risico-oppervlak. */}
      <BraceletMiniIndicator />
      {/* Vaste Premium-ingang (6 okt 2026) — niet op schermen zonder
          tabbalk (lopende sessie, State Control-keuzescherm). */}
      <PremiumPill hidden={hideStateControlBar} />
    </View>
  );
}
