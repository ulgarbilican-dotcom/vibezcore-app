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

import { BreathMiniControl } from '@/components/BreathMiniControl';
import { saveLastTab } from '@/utils/last-tab';
import { bootDecided } from '@/utils/boot';
import BraceletIcon from '@/components/BraceletIcon';
import { BraceletMiniIndicator } from '@/components/BraceletMiniIndicator';
import { MiniPlayer } from '@/components/MiniPlayer';
import { PremiumPill } from '@/components/PremiumPill';
import { AUDIO_ENABLED } from '@/constants/features';
import { BrandFonts, AudioAccent } from '@/constants/theme';
import { requestLibraryReset } from '@/utils/library-reset-intent';
import { markTabOpenedByUser } from '@/utils/onboarding-gate';
import {
  isActiveSessionVisible,
  isChooseScreenVisible,
  isStateControlIntroVisible,
  setTabsOnTop,
  subscribeActiveSessionVisible,
  subscribeChooseScreenVisible,
  subscribeStateControlIntroVisible,
} from '@/utils/state-control-ui';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { router, Tabs, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  ChartNoAxesColumnIncreasing,
  Radio,
  User,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated as RNAnimated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setTabBarOverlayHeight, TAB_BAR_CONTENT_HEIGHT } from '@/utils/tab-bar-inset';

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
        /* 19 okt 2026 (operator, punt 24): enkel een tik op het tabblad zelf
           mag de Breathwork-onboarding de eerste keer tonen — niet een
           deeplink, de pill of het terugzetten van de laatste tab bij het
           opstarten. Zie utils/onboarding-gate.ts. */
        if (path === '/breath') {
          markTabOpenedByUser('breath');
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
         duidelijk"): op de witte balk was dit een donkere ripple.
         19 okt 2026 (operator: "kunnen wij onderaan transparant maken en de
         fotos etc full screen?" → "ja"): de balk ligt nu doorzichtig op een
         donkere scrim — een donkere ripple is daar onzichtbaar, dus terug
         een lichte (wit-op-donker), net sterk genoeg om de tik te zien. */
      android_ripple={{ color: 'rgba(255,255,255,0.14)', borderless: true }}
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
/* 19 okt 2026 (operator: "kunnen wij onderaan transparant maken en de
   fotos etc full screen?" → "ja"): de balk is niet meer wit maar
   doorzichtig op een donkere scrim (dark-only app). Het donkere paar
   hierboven verdween daarop — terug naar licht-op-donker, nog steeds twee
   vaste kleuren (geen opacity-truc): actief label wit, inactief icoon+label
   in de gedimde tekstkleur van het merk-palet, maar iets lichter dan
   `#8a8a8a` (rgba-wit 0,6) zodat het ook over een lichte foto leesbaar
   blijft. Het actieve ICOON blijft Bio-Teal (`AudioAccent`, 10 okt). */
const TAB_ACTIVE_COLOR = '#ffffff';
const TAB_INACTIVE_COLOR = 'rgba(255,255,255,0.6)';

/* Operator, 10 okt 2026 ("gebruik deze iconen voor de tabbladen" —
   website-sectie "Three tools. One system."; vervolg: "iconen zonder
   cirkels"): dezelfde symbolen als de website, zonder de ring. Het
   geselecteerde tabblad krijgt een Bio-Teal icoon. */
function TabGlyph({ Icon, focused }: { Icon: IconComponent; focused: boolean }) {
  /* Vervolg (operator, 10 okt 2026: "het gekozen icoon moet groter, met een
     animatie zoals Apple"): zoals de SF Symbols-"bounce" van iOS 17 — bij
     het kiezen veert het icoon kort op en zakt naar een iets grotere stand
     (1,15); niet-gekozen terug naar 1. Op de native driver. */
  const scale = useRef(new RNAnimated.Value(focused ? 1.15 : 1)).current;
  useEffect(() => {
    if (focused) {
      RNAnimated.sequence([
        RNAnimated.timing(scale, { toValue: 1.32, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        RNAnimated.spring(scale, { toValue: 1.15, friction: 4, tension: 160, useNativeDriver: true }),
      ]).start();
    } else {
      RNAnimated.timing(scale, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    }
  }, [focused, scale]);
  return (
    <RNAnimated.View style={{ alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
      <Icon size={21} color={focused ? AudioAccent : TAB_INACTIVE_COLOR} strokeWidth={2} />
    </RNAnimated.View>
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
       layout i.p.v. een zwevend overlay.
       19 okt 2026 (operator: "kunnen wij onderaan transparant maken en de
       fotos etc full screen?" → "ja"): VERVANGEN — de balk zweeft weer,
       doorzichtig, over schermen die tot de onderrand doorlopen (zie de
       `tabBar` hieronder). Deze `backgroundColor` is enkel een fallback
       voor het ene frame vóór een scherm zijn eigen achtergrond tekent. */
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Tabs
        /* Terug gaat naar de BEGINROUTE, niet naar het vorige tabblad dat je
           bezocht (operator, 7 augustus 2026). Zonder dit landde de
           terugknop op het verborgen audioscherm — dat is nog steeds het
           eerste scherm van de groep, ook al staat het niet in de balk. */
        backBehavior="initialRoute"
        /* Operator, 8 okt 2026 ("die player blijft overal in de weg staan
           voor CTA's — hoe zou Apple dat doen"): de mini-speler hoort bij
           de tab-bar, als één blok onderaan (Apple Music). Verborgen tab-bar
           (lopende State Control-sessie) = ook geen mini-speler.
           Sinds 19 okt 2026 zweeft dat blok over het scherm (doorzichtige
           balk); het scherm houdt zijn knoppen erboven via useTabBarInset —
           op dezelfde plek als toen het scherm korter werd. */
        tabBar={(props) => {
          const focused = props.state.routes[props.state.index];
          const opts = props.descriptors[focused.key]?.options;
          const style = opts?.tabBarStyle as { display?: string } | undefined;
          const hidden = style?.display === 'none';
          /* 19 okt 2026 (operator: "kunnen wij onderaan transparant maken en
             de fotos etc full screen?" → "ja"): het hele blok (pills,
             mini-speler, balk) ZWEEFT nu absoluut over de schermen, die tot
             de onderrand doorlopen — foto's randloos achter balk en Android-
             navigatieknoppen. Het scherm wordt dus niet meer korter: de
             gemeten hoogte van dit blok gaat naar utils/tab-bar-inset.ts,
             waarmee elk tabscherm zijn knoppen/laatste rij erboven houdt.
             `box-none`: een tik op de doorzichtige zone gaat naar het scherm
             eronder, enkel de pills/knoppen zelf vangen hem op. */
          return (
            <View
              style={styles.barDock}
              pointerEvents="box-none"
              onLayout={(e) => setTabBarOverlayHeight(e.nativeEvent.layout.height)}
            >
              {/* Zachte scrim: doorzichtig bovenaan → donker onderaan, over de
                  balk én ~60pt erboven, zodat witte iconen/labels leesbaar
                  blijven boven een lichte foto. Hier i.p.v. in
                  `tabBarBackground`: die laag zit BINNEN de balk en zou
                  (laatst getekend) over de gedokte pills heen vallen. */}
              {/* 20 okt 2026 (operator: tekst van de pagina kwam zichtbaar
                  OVER de tabs): enkel een zachte overgang erboven; de balk
                  zelf is een bijna dekkend donker vlak (geen matglas: dat
                  vond de operator op 25 sept niet mooi). Zo leest elk label
                  op elk toestel, boven foto's én boven lijsten. */}
              {!hidden && (
                <>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.55)', 'rgba(10,10,10,0.88)']}
                    locations={[0, 0.6, 1]}
                    style={styles.barFade}
                  />
                  <View pointerEvents="none" style={styles.barFill} />
                </>
              )}
              {/* Lopende sessies (State Control, geminimaliseerde ademsessie)
                  net boven de tabbalk, zoals Apple Music (10 okt 2026). */}
              {!hidden && <BraceletMiniIndicator docked />}
              {!hidden && <BreathMiniControl docked />}
              {!hidden && <MiniPlayer docked />}
              <BottomTabBar {...props} />
            </View>
          );
        }}
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
             transparant maken". Daarna (derde ronde, toen de app nog licht
             was) een vlakke, ondoorzichtig WITTE balk à la Apple's
             `UITabBar`, gewoon in de flex-layout met een haarlijn bovenaan.
             19 okt 2026 (operator, dark-only app: "kunnen wij onderaan
             transparant maken en de fotos etc full screen?" → "ja"): terug
             DOORZICHTIG — geen matglas, geen wit vlak, geen haarlijn. De balk
             zweeft (zie `styles.barDock` in de `tabBar` hierboven) over de
             schermen; leesbaarheid komt van de zachte donkere scrim
             daaronder. Daarom is er weer een compensatie in de tabschermen
             nodig (vroeger `tabBarFootprint`, nu utils/tab-bar-inset.ts). */
          tabBarStyle: {
            /* Operator, 2 okt 2026 ("staat vrij hoog, hoe zou Apple dat
               doen"): Apple's eigen `UITabBar` content-hoogte is 49pt
               (zonder safe-area) — 62 lag daar ver boven. Terug naar
               Apple's maat, met net genoeg marge (2px) voor de dalende
               "p" in "Profile" die de vorige 56 liet afsnijden; 51 geeft
               diezelfde veiligheid zonder de overmaat van 62. */
            height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
            borderRadius: 0,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            borderWidth: 0,
            /* Geen Android-schaduw / iOS-schaduw onder een doorzichtige balk. */
            elevation: 0,
            shadowOpacity: 0,
            paddingTop: 4,
            /* GEEN `paddingBottom` — @react-navigation/bottom-tabs plakt
               intern zelf `paddingBottom: insets.bottom` bovenop deze stijl
               (zie BottomTabBar.js): de iconen blijven zo boven de Android-
               navigatieknoppen / iOS-home-indicator, de scrim loopt er wel
               achter door tot de onderrand. De balk zelf is NIET absoluut:
               het omhullende blok (`styles.barDock`) is dat al. */
          },
        }}
      >
        {/* Operator, 10 okt 2026: State Control als 1ste tabblad (het
            sterkste verkoopargument), dan Breath, dan Audio Library. */}
        <Tabs.Screen
          name="bracelet"
          options={{
            /* GEWIJZIGD 4 oktober 2026: deze tab toont nu altijd Session
               Control (geen marketing-etalage meer, zie (tabs)/bracelet.tsx)
               — "State Control" beschrijft die functie beter dan "Bracelet". */
            title: 'State Control',
            tabBarIcon: ({ focused }: { focused: boolean }) => (
              <TabGlyph Icon={Radio} focused={focused} />
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
                    <TabGlyph Icon={AudioLines} focused={focused} />
                  ),
                  tabBarLabel: ({ focused }: { focused: boolean }) => (
                    <TabLabel label="Library" focused={focused} />
                  ),
                  tabBarButton: (props) => <TabButton path="/" {...props} />,
                }
              : { href: null }
          }
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
              <TabGlyph Icon={ChartNoAxesColumnIncreasing} focused={focused} />
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
              <TabGlyph Icon={User} focused={focused} />
            ),
            tabBarLabel: ({ focused }: { focused: boolean }) => (
              <TabLabel label="Profile" focused={focused} />
            ),
            tabBarButton: (props) => <TabButton path="/account" {...props} />,
          }}
        />
      </Tabs>
      {/* Operator, 16 september 2026 ("iemand kan andere sites bekijken
         en dan onmiddellijk terugvinden waar de sessie loopt"):
         teruggehaald uit `master` (iter v238b) — ontbrak op deze
         rollback-branch. Bewust ALLEEN de pill, niet de v238i tab-bar-
         hide-subscribe die destijds samen met deze pill een crash-on-
         launch veroorzaakte (nooit met zekerheid geïsoleerd welke van
         de twee) — kleiner risico-oppervlak. */}
      {/* Vaste Premium-ingang (6 okt 2026) — niet op schermen zonder
          tabbalk (lopende sessie, State Control-keuzescherm). */}
      <PremiumPill hidden={hideStateControlBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  /* Zwevend blok onderaan (19 okt 2026) — zie de `tabBar` hierboven. */
  barDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  /* Zachte overgang: 48pt boven het blok. */
  barFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -48,
    height: 48,
  },
  /* Het vlak achter pills en balk, tot de onderrand (ook achter de
     Android-navigatieknoppen / iOS-home-indicator). */
  barFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,10,10,0.94)',
  },
});
