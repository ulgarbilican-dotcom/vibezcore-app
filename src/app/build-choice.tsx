/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — How do you want to build it?

   Stap 1 van de Protocol-flow (operator, 17 september 2026) — VOOR Goal,
   niet erna. Reden (operator, dezelfde dag): "als gebruiker zelf wil
   bouwen moet venster met set your state overgeslagen worden" — wie zelf
   alles kiest (Pad B) heeft niets aan een doel-vraag, die stuurt enkel de
   automatische suggesties. Dus de vork komt EERST, en Pad A alleen gaat
   door naar Goal (Set your state).

   · "Let VIBEZCORE build it" → Goal → Intensity → Set your times →
     Building → Plan review. Kiest zelf hoeveel sessies, wanneer en welke
     toestand, op basis van doel + klok.
   · "Build it yourself" → Build your day (rechtstreeks, geen Goal-stap) →
     Building → Plan review. Gebruiker kiest alles zelf, per sessie:
     staat, techniek, duur, tijdstip.

   De ene-gratis-proefronde-gate (operator, 13 augustus 2026: "user moet
   wel van 1 volledige versie kunnen proeven") woonde tot nu toe op
   goal.tsx se Continue-knop — verhuisd hierheen, want dat is nu het
   ECHTE beginpunt van de flow; Pad B zou anders nooit gegated worden
   (komt niet meer langs goal.tsx).

   Operator, 18 september 2026 ("Apple-principe van Clarity en Deference
   i.p.v. de zware, blokkerige Android-vibe"): volledige herbouw van de
   twee kaarten, hier zelf beschreven (niet elders herbruikt — dit is de
   enige plek met deze twee paden):
   · Kaarten: compacte, horizontale rijen i.p.v. vierkante, schermvullende
     vlakken — icoon-avatar links, links-uitgelijnde titel+detail rechts,
     dunne selectie-checkmark uiterst rechts (standaard iOS-lijst-patroon).
     Geen losse foto/gradient-vulling meer per kaart (`image`-veld en de
     ExpoGradient-overlay zijn daarmee vervallen — dit compacte rij-
     ontwerp heeft geen ruimte meer voor een full-bleed achtergrond).
   · Iconen: dezelfde flinterdunne lijnstijl als de state-iconen
     (`StateGlyph`, strokeWidth ~1.8) i.p.v. de dikke, "cartooneske"
     eerdere iconen (`Wand2`/`LayoutGrid`) — `Sparkle` (enkele ster,
     Apple-Intelligence-achtig) voor de AI-optie, `SlidersHorizontal`
     voor de handmatige optie.
   · Progressie: de "STEP 1 OF 5"-tekst bovenaan is weg — de bovenkant
     blijft leeg/rustig met enkel de titel. Voortgang komt terug als
     subtiele paginastipjes vlak boven de Continue-knop (lokaal hier
     opgebouwd, NIET via het gedeelde `StepIndicator`-component — dat
     blijft ongewijzigd voor goal.tsx/intensity.tsx/plan-review.tsx, die
     de tekst-variant nog gebruiken).
   · Tekst blijft functioneel identiek ("Let VIBEZCORE build it"/"Build
     it yourself" enz.) — enkel de PRESENTATIE is herbouwd, geen
     copy-beslissing (de "AI Blueprint"/"Auto-Pilot"-namen uit de
     ontwerp-referentie waren daar zelf al met "bijvoorbeeld" gemarkeerd,
     geen vaste operator-tekstkeuze). */

import { BrandDark, BrandLight, CTA, TypeScale } from '@/constants/theme';
import { StepIndicator } from '@/components/StepIndicator';
import { ProtocolFlowCancel } from '@/components/ProtocolFlowCancel';
import { useSubscription } from '@/hooks/useSubscription';
import { useSetting } from '@/utils/settings';
import PremiumPaywallModal from '@/components/PremiumPaywallModal';
import ProtocolTeaserModal from '@/components/ProtocolTeaserModal';
import { skipBreathIntroOnce } from '@/utils/breath-entry';
import { ChevronLeft, Sparkle } from 'lucide-react-native';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Operator, 19 september 2026 ("dit landschap met de gloeiende bol...
   maak de afbeelding de volledige achtergrond"): vervangt de synthetische
   `AmbientGlow` — de echte foto heeft de gloeiende bol al ingebakken, dus
   een tweede, zelfgemaakte gloed erbovenop zou enkel botsen. Volle-
   scherm achtergrond + een verticale donkere gradiënt (zwart bovenin,
   volledig doorzichtig rond het midden) zodat titel/kaarten bovenin
   scherp contrasteren, terwijl de bol onderin zichtbaar blijft — zelfde
   Apple-trucje als de foto-achtergronden op breath-welcome.tsx.
   Operator, 20 september 2026 ("veel te groot, klein elegant"): niet
   langer een volle-scherm/kaart-achtergrond — zie `rowThumb` verderop,
   nu een kleine foto-thumbnail per kaart, één per pad. Vierde vervanging
   van de AI-foto ("pic let vibezcore build it app" → "...app 2" →
   "pic tetris app" → nu "pic tetris let vibescore app"), en de manuele
   kaart kreeg er nu ook zelf één ("pic tetris build yourself"), i.p.v.
   het paarse icoon-avatar dat hiervoor stond — zelfde beeldtaal, geen
   losse iconenstijl meer op dit scherm. */
/* Operator, 20 september 2026: nog een vervanging voor LET VIBEZCORE
   BUILD IT ("...app 3" → "...app 4"). */
const AUTO_BG_IMG =
  'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20let%20vibezcore%20build%20it%20app%204.png';
/* Operator, 20 september 2026: vervanging voor BUILD IT YOURSELF (was
   even hetzelfde bestand als AUTO_BG_IMG, nu terug een eigen foto —
   "pic build it yourself app 4"). */
const CUSTOM_BG_IMG =
  'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20build%20it%20yourself%20app%204.png';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

/* Operator, 18 september 2026 ("we bouwen de onboarding volledig in
   dark ook in light mode"): deze stap (en de rest van de Protocol-flow)
   blijft ALTIJD donker, ongeacht het app-brede licht/donker-thema — dit
   is geen `useAppTheme()`-scherm en volgt dus toch al nooit de live
   toggle; de `light`-constante hieronder stond hier enkel als
   kopieer-sjabloon van de rest van de flow en stond op `true`. Vast op
   `false`. */
const light = false;
const C = light ? BrandLight : BrandDark;

type BuildPath = 'auto' | 'custom';

const PATHS: {
  key: BuildPath;
  img: string;
  name: string;
  /** Eén doorlopende detail-zin — zie `bullets` voor het alternatief. */
  detail?: string;
  /** Operator, 20 september 2026 ("we build your protocol... maar
   *  duidelijk als bulletpoint"): het AI-pad is een 2-staps-belofte (jij
   *  zet je voorkeuren, wij bouwen eruit) — dat las als vlakke tekst in
   *  één zin, nu als losse, scanbare stappen. */
  bullets?: string[];
  /** Operator, 18 september 2026: "RECOMMENDED"-badge, enkel op het
   *  AI-pad — matcht de ontwerp-referentie. */
  recommended?: boolean;
}[] = [
  /* Operator, 20 september 2026 ("zet build it yourself voor let
     vibezcore"): volgorde omgedraaid — handmatig pad nu eerst, AI-pad
     (nog altijd RECOMMENDED-gemarkeerd) erna. */
  {
    key: 'custom',
    img: CUSTOM_BG_IMG,
    name: 'Build it yourself',
    /* Operator, 20 september 2026: zelfde bullet-behandeling als het
       AI-pad hieronder — was één doorlopende zin. */
    bullets: ['Choose your goals & preferences', 'Build your protocol your way'],
  },
  {
    key: 'auto',
    img: AUTO_BG_IMG,
    /* Operator, 18 september 2026: "Let VIBEZCORE" op regel 1, "build
       it" op regel 2 — vaste line-break i.p.v. de natuurlijke wrap. */
    name: 'Let VIBEZCORE\nbuild it',
    /* Operator, 18 september 2026 ("wij kiezen timing niet, wij bouwen
       protocol op basis van de voorkeuren van gebruiker"): was "We pick
       the timing and states that fit your goal" — dat las alsof de app
       zelfstandig een tijdstip verzint. Het protocol wordt gebouwd UIT de
       voorkeuren die de gebruiker net opgeeft (Goal → Intensity → Set
       your times), niet erlangs. */
    bullets: ['Set your preferences', 'We build your protocol'],
    recommended: true,
  },
];

/* Eigen component (niet inline in de `.map()`) — elke kaart heeft zijn
   EIGEN animated shared value nodig, dat kan niet in een lus met
   `useSharedValue` (Rules of Hooks: vast aantal hooks per render).
   Operator, 21 september 2026 ("choose your path kaarten dezelfde
   beweging bij aanklikken als set your state"): letterlijk goal.tsx's
   `GoalTile`-druk-animatie overgenomen — inkrimpen bij press-in, terug
   opveren bij press-out. */
function PathCard({
  p,
  on,
  onPress,
}: {
  p: (typeof PATHS)[number];
  on: boolean;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        pressScale.value = withTiming(0.97, { duration: 80 });
      }}
      onPressOut={() => {
        pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
      }}
      onPress={onPress}
      style={[
        s.row,
        cardStyle,
        on && {
          borderColor: 'rgba(255,255,255,0.3)',
          backgroundColor: 'rgba(255,255,255,0.07)',
        },
      ]}
    >
      <View style={s.rowText}>
        {/* Operator, 21 september 2026 ("recommended in wit maar met
           sterretje vooraan"): was `AccentTextOnDark` (indigo) — nu vol
           wit, met een klein `Sparkle`-icoontje vooraan i.p.v. kale
           tekst. */}
        {p.recommended && (
          <View style={s.rowBadgeRow}>
            <Sparkle size={11} color="#ffffff" fill="#ffffff" strokeWidth={0} />
            <Text style={s.rowBadge}>RECOMMENDED</Text>
          </View>
        )}
        <Text style={s.rowName}>{p.name}</Text>
        {p.bullets ? (
          <View style={s.rowBullets}>
            {p.bullets.map((b) => (
              <View key={b} style={s.rowBulletLine}>
                <View style={s.rowBulletDot} />
                <Text style={s.rowDetail}>{b}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.rowDetail}>{p.detail}</Text>
        )}
      </View>
      <Image source={{ uri: p.img }} style={s.rowThumb} resizeMode="contain" />
    </AnimatedPressable>
  );
}

export default function BuildChoiceScreen() {
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState<BuildPath | null>(null);

  /* Eén gratis protocol om te proeven, daarna teaser → paywall — zie de
     toelichting bovenaan dit bestand. */
  const sub = useSubscription();
  const isPremium = sub.isPro || sub.hasBracelet;
  const [hasBuiltProtocol] = useSetting('hasBuiltProtocol');
  const [teaserOpen, setTeaserOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const next = () => {
    if (!choice) return;
    if (!isPremium && hasBuiltProtocol) {
      setTeaserOpen(true);
      return;
    }
    router.push((choice === 'auto' ? '/goal' : '/build-your-day') as never);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Operator, 18 september 2026 ("bovenaan ook step 1 of afhankelijk
         van welke kaart"): terug — de eerdere Apple-redesign haalde de
         STEP-tekst hier weg naar puntjes onderaan, maar de operator wil
          'm ook weer boven, EN correct meetellend: 5 stappen voor het
         AI-pad (Goal→Intensity→Set your times→Building→Plan review), 3
         voor het handmatige pad (Build your day→Building→Plan review) —
         zie de toelichting bovenaan het bestand. Vóór een keuze (nog geen
         `choice`) tonen we 5, dezelfde aanname als de puntjes onderaan. */}
      <View style={s.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          {/* Operator, 18 september 2026 ("officiële iOS-chevron.backward
             i.p.v. dunne, langgerekte Android-pijl"): kleiner + dikker
             (22→20, strokeWidth 2.2→2.8) — compacter en steviger, past
             beter bij de vette titels op dit scherm. */}
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </Pressable>
        {/* Operator, 21 september 2026 ("balk is storend zo laag, zet 'm
           naast de pijl"): terug in de knoppenrij, na een korte poging
           eronder (Apple HIG-full-width). */}
        <StepIndicator step={1} total={choice === 'custom' ? 3 : 5} color="#ffffff" />
        {/* Operator, 18 september 2026 ("eindeloos op back klikken om
           eruit te gaan"): vervangt de lege spacer-View — 1 tik verlaat
           de hele flow i.p.v. terug-terug-terug door elke vorige stap. */}
        <ProtocolFlowCancel />
      </View>

      {/* Operator, 18 september 2026 ("cta staat te hoog"): met maar 2
         kaarten is de content hier korter dan het scherm, en zonder
         `flexGrow` op de scroll-inhoud eindigt de CTA gewoon direct ná de
         laatste kaart in plaats van onderaan het scherm te landen (zoals
         op de langere stappen vanzelf gebeurt, omdat die WEL genoeg
         content hebben om het scherm te vullen). `flexGrow: 1` geeft de
         inhoud de volledige schermhoogte als er ruimte over is, en
         `marginTop: 'auto'` op de footer (stipjes + CTA) duwt 'm — Yoga/
         flexbox ondersteunt 'auto'-marges — naar de onderkant van die
         ruimte. Overloopt de inhoud toch (kleiner toestel), dan scrollt
         het gewoon normaal. */}
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { flexGrow: 1, paddingBottom: Math.max(insets.bottom, 12) + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Operator, 18 september 2026 ("titel links uitlijnen, korter en
           krachtiger, zoals 'Choose your path'"): was gecentreerd over 2
           regels ("How do you want to build it?") — brak de links-
           uitgelijnde flow die de kaarten eronder al hebben. */}
        <Text style={s.header}>Choose your path</Text>
        {/* Operator, 18 september 2026: subheader "Your goal. Your
           approach." — zelfde links uitlijning als de titel. */}
        {/* Operator, 18 september 2026: geen punt aan het eind — tagline,
           geen zin (zelfde regel als headers/subheaders elders). */}
        <Text style={s.subheader}>Your goal. Your approach</Text>

        {/* Operator, 20/21 september 2026: kaarten zijn compacte,
           horizontale rijen (foto klein rechts, contain — geen crop),
           transparante achtergrond + dunne rand die bij selectie subtiel
           oplicht (zelfde recept als intensity.tsx), en nu ook dezelfde
           druk-animatie als goal.tsx (`PathCard`, hierboven). */}
        <View style={s.list}>
          {PATHS.map((p) => (
            <PathCard
              key={p.key}
              p={p}
              on={choice === p.key}
              onPress={() => setChoice(p.key)}
            />
          ))}
        </View>

        {/* marginTop: 'auto' duwt deze footer (CTA) naar de onderkant van
           de beschikbare ruimte — zie toelichting bij de ScrollView
           hierboven. */}
        <View style={{ marginTop: 'auto' }}>
          {/* Operator, 20 september 2026 ("de puntjes onderaan moeten ook
             weg, boven CTA — dat staat al onder STEP bovenaan"): deze
             paginastipjes waren bedoeld als VERVANGING van de "STEP 1 OF
             5"-tekst bovenaan (zie de toelichting bovenaan het bestand),
             maar die tekst + eigen stipjes kwamen daarna terug (18
             september, `StepIndicator` in de `s.bar`-rij) — sindsdien
             stond de voortgang dubbel op het scherm. */}
          <Pressable
            style={[s.cta, !choice && s.ctaDisabled]}
            disabled={!choice}
            onPress={next}
          >
            <Text style={s.ctaTxt}>Continue</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ProtocolTeaserModal
        visible={teaserOpen}
        onClose={() => setTeaserOpen(false)}
        onUpgrade={() => {
          setTeaserOpen(false);
          setPaywallOpen(true);
        }}
        onMaybeLater={() => {
          setTeaserOpen(false);
          skipBreathIntroOnce();
          router.replace('/breath' as never);
        }}
      />
      <PremiumPaywallModal visible={paywallOpen} onClose={() => setPaywallOpen(false)} />
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
  scroll: { paddingHorizontal: 16 },

  header: {
    marginTop: 12,
    ...TypeScale.pageHeader,
    textAlign: 'left',
    color: C.text,
  },
  /* Operator, 18 september 2026 ("subheader niet zelfde font zoals
     voorgeschreven — check fonts, moet consistent zijn, we hebben een
     blueprint"): gebruikte `TypeScale.pageLead` (bedoeld voor een kleine,
     gedempte toelichting-regel ONDER een subheader) i.p.v. het echte
     blueprint-token voor deze rol, `TypeScale.pageSubhead`
     ("Vraag/onderschrift direct onder een pageHeader", zie
     constants/theme.ts) — verkeerd token, geen bewuste afwijking. */
  subheader: {
    marginTop: 6,
    /* Operator, 18 september 2026 ("kaarten beiden nog beetje zakken,
       meer ruimte"): 28→44 — meer lucht tussen subheader en de kaarten. */
    marginBottom: 44,
    ...TypeScale.pageSubhead,
    textAlign: 'left',
    color: 'rgba(255,255,255,0.55)',
  },

  /* Operator, 18 september 2026 ("kaarten verder uit elkaar, alles moet
     kunnen ademen"): 18→28. */
  list: { gap: 28 },
  /* Compacte, horizontale rij i.p.v. de vorige vierkante, schermvullende
     kaart — icoon-avatar links, links-uitgelijnde tekst rechts, dunne
     rand die bij selectie oplicht in de accentkleur. */
  row: {
    /* Operator, 18 september 2026 ("wiskundig gelijke marge — 20pt vanaf
       boven/onder/links, 12-16pt tussen icoon en tekstkolom"): de vorige
       30/22/18-mix was willekeurig, wat de badge tegen de rand liet
       aanplakken en de titel tegen het icoon. Nu een vaste 20pt padding
       rondom de kaart en 14pt vaste afstand tussen icoon en tekst (zie
       `rowIconWrap`'s `marginRight` — losstaand van de kaart-padding, dus
       die twee maten kunnen nooit meer door elkaar lopen). */
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    /* Operator, 19 september 2026 ("subtiele omlijning i.p.v. matglas —
       kaart-achtergrond volledig transparant, bergen/water lopen door"):
       geen gevulde `backgroundColor` meer — enkel een flinterdunne rand,
       zodat de foto rechtstreeks door de kaart heen zichtbaar blijft.
       Selectie vult de kaart pas met een zachte kleur (zie de inline
       `on &&`-stijl verderop), niet standaard. */
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    /* `overflow:'hidden'` zodat de foto-achtergrond van de aanbevolen
       kaart (zie de JSX) binnen de afgeronde hoeken blijft. */
    overflow: 'hidden',
    /* Operator, 18 september 2026 ("kaarten hoger"): verticaal 20→28,
       horizontaal blijft 20 (de "20pt vanaf de rand"-marge hierboven). */
    paddingVertical: 28,
    paddingHorizontal: 20,
    /* Basis onzichtbaar (opacity 0) — selectie zet `shadowColor`+
       `shadowOpacity` pas echt aan. */
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    shadowOpacity: 0,
  },
  rowText: { flex: 1 },
  /* Operator, 20 september 2026 ("veel te groot, moet rechts naast de
     tekst komen, klein elegant"): klein, vierkant beeld uiterst rechts —
     zelfde maat/afronding als `rowIconWrap` links op de andere kaart,
     enkel zonder de gevulde gradient (dit is een foto, geen icoon). */
  rowThumb: {
    /* Operator, 20 september 2026: "dubbel zo groot" — 56 → 112. */
    width: 112,
    height: 112,
    borderRadius: 20,
    marginLeft: 14,
  },
  /* Operator, 18 september 2026 ("check fonts, moet overal consistent
     zijn, we hebben een blueprint"): `rowBadge` had een zelfverzonnen
     10/1.2 i.p.v. het blueprint-token voor exact deze rol —
     `TypeScale.cardEyebrow` ("klein, gespatieerd label BOVEN een
     cardHeadline", zie constants/theme.ts) is letterlijk hiervoor
     bedoeld. */
  /* Operator, 21 september 2026 ("recommended in wit met sterretje"):
     was `AccentTextOnDark` (indigo, huisstijl-correctie 19 september) —
     nu vol wit, naast een `Sparkle`-icoon (zie `rowBadgeRow`). */
  rowBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 5,
  },
  rowBadge: {
    ...TypeScale.cardEyebrow,
    color: '#ffffff',
  },
  /* `rowName` had een losse `fontSize: 18`-override op `cardHeadline`
     (blueprint-waarde 22) zonder reden — teruggezet op het token zelf. */
  rowName: {
    ...TypeScale.cardHeadline,
    textAlign: 'left',
    color: C.text,
  },
  /* `rowDetail` zette dezelfde `fontSize: 14` als `TypeScale.cardDetail`
     al voorschrijft — geen echte afwijking, enkel een overbodige
     duplicate-override, hier verwijderd. */
  rowDetail: {
    marginTop: 4,
    ...TypeScale.cardDetail,
    textAlign: 'left',
    color: 'rgba(255,255,255,0.5)',
  },
  /* Operator, 20 september 2026: bullet-variant van `rowDetail` hierboven
     — twee scanbare stappen i.p.v. één doorlopende zin. */
  rowBullets: { marginTop: 2, gap: 4 },
  rowBulletLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  cta: { ...CTA.container },
  ctaDisabled: CTA.disabled,
  ctaTxt: CTA.label,
});
