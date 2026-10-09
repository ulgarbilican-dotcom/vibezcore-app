/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "How do you feel?" (instant situation picker)

   Operator, 2 oktober 2026: vervangt de eerdere "How do you want to feel?"
   swipe-door (1 okt 2026) volledig. Die vroeg naar een DOEL-toestand; deze
   vraagt naar de HUIDIGE toestand ("I feel tired", "I feel stressed") — de
   app bepaalt zelf de bestemming via `utils/instant-feel.ts`, geen
   keuzescherm nodig. Bereikt vanaf de intro-overlay van de Breath-tab, het
   eerste scherm dat een gebruiker ziet bij het openen van die tab — geen
   verdere navigatie nodig om hier te komen.

   12 situaties (4 core-basics + 8 nuance-chips), elk gekoppeld aan één van
   de 5 bestaande toestanden — koppeling geverifieerd tegen elke staat se
   eigen `need`-omschrijving in breath-states.ts, niet zomaar aangenomen.
   Techniek + duur komen altijd uit de staat zelf (`pickInstantTechnique`/
   `pickInstantDuration`), nooit verzonnen per situatie — dat ging de vorige
   keer fout (technieken die nergens bestaan).

   "Niet-beginner" (operator): wie via dit pad komt wil een reëel werkende
   oplossing, geen voorzichtige instap — zie de toelichting in
   `instant-feel.ts` voor hoe dat precies vertaald wordt.

   CTA-tekst wisselt free/Premium, zelfde patroon als breath-session.tsx's
   "ENJOY YOUR SESSION"/"START SESSION" — free gebruikers krijgen hier een
   60s preview-met-fade (zie breath-session.tsx, `instant=1`-param) in
   plaats van een harde cut, Premium/bracelet-eigenaars de volledige sessie
   zonder enige limiet. */

import VibezGlass from '@/components/VibezGlass';
import { GlassSheet } from '@/components/GlassSheetHost';
import { rootBlurRef } from '@/utils/root-blur';
import { Brand, BrandFonts } from '@/constants/theme';
import { claimFreeSessionParam } from '@/utils/breath-entry';
import {
  INSTANT_SITUATIONS,
  pickInstantDuration,
  pickInstantTechnique,
  stateFor,
  type InstantSituation,
} from '@/utils/instant-feel';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { openBreathSession } from '@/services/breath-session-host';
import {
  Activity,
  Angry,
  BatteryLow,
  Brain,
  ChevronLeft,
  Cloud,
  HeartPulse,
  Info,
  Leaf,
  Moon,
  Plug,
  Target,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { hapticTap } from '@/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Phase = 'pick' | 'personalizing';

/* Operator, 2 okt 2026 (pasted ChatGPT-mockup): icoon per situatie,
   dezelfde set voor zowel de 4 core-kaarten als de 8 nuance-rijen — geen
   losse iconenset per groep, gewoon 1 icoon per situatie-id. */
const ICON_FOR: Record<string, LucideIcon> = {
  feel_stressed: Zap,
  /* Operator, 2 okt 2026 ("batterij moet beetje gevuld zijn alsof bijna
     leeg"): was de neutrale `Battery`-omtrek (geen vulling, zegt niets
     over het niveau) — `BatteryLow` toont een klein beetje vulling, exact
     "bijna leeg" i.p.v. een lege/willekeurige batterij-omtrek. */
  feel_tired: BatteryLow,
  cant_sleep: Moon,
  cant_focus: Target,
  cant_stop_thinking: Cloud,
  overwhelmed: Wind,
  frustrated_angry: Angry,
  anxious_nervous: HeartPulse,
  brain_fog: Brain,
  /* Referentie-mockup hergebruikt Moon hier (staat al bij cant_sleep) —
     twee andere situaties met hetzelfde icoon is verwarrend, Activity
     (hartslag/golflijn) past semantisch ook beter bij "jittery". */
  restless_jittery: Activity,
  tired_wired: Plug,
  ready_unwind: Leaf,
};

export default function FeelNowScreen() {
  const [phase, setPhase] = useState<Phase>('pick');
  /* Operator, 2 okt 2026 ("i met daaronder apple-stijl info"): welke
     situatie se "waarom deze techniek/duur"-kaart open staat — alleen op
     de 4 core-kaarten (zie `SituationCard`, daar is ruimte voor de knop).
     Dezelfde brondata als breath-session.tsx se eigen "Waarom deze
     lengte"-popup (`technique.explain`/`duration.why` uit
     breath-states.ts), geen apart verzonnen tekst — zo kan dit nooit iets
     anders zeggen dan wat de gebruiker later op het setup-/sessiescherm
     zelf leest. */
  const [infoFor, setInfoFor] = useState<InstantSituation | null>(null);
  const insets = useSafeAreaInsets();

  const closeScale = useSharedValue(1);
  const closeStyle = useAnimatedStyle(() => ({ transform: [{ scale: closeScale.value }] }));

  const choose = (situation: InstantSituation) => {
    hapticTap();
    setPhase('personalizing');

    /* Zelfde "even pauzeren, dan pas doorgaan"-beat als de vorige versie —
       laat voelen dat er iets voor je klaargezet wordt, geen instant
       sprong. Hier ook de enige plek waar echt werk gebeurt: techniek +
       duur bepalen en routeren. */
    setTimeout(() => {
      const st = stateFor(situation.state);
      const technique = pickInstantTechnique(st, situation);
      const duration = pickInstantDuration(st, technique, situation);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      openBreathSession({
          ...claimFreeSessionParam(),
          state: st.key,
          technique: technique.key,
          minutes: String(duration.minutes),
          autostart: '1',
          instant: '1',
        });
    }, 900);
  };

  const core = INSTANT_SITUATIONS.filter((s) => s.isCoreBasis);
  const nuance = INSTANT_SITUATIONS.filter((s) => !s.isCoreBasis);

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Operator, 2 okt 2026 ("back knop ontbreekt"): de losse ronde X
         rechtsboven was de enige uitgang — geen standaard terug-pijl zoals
         de rest van de app (goal.tsx/build-choice.tsx/etc.: een `bar`-rij
         met `ChevronLeft` linksboven, 40×40 tikvlak). Nu dezelfde `bar`. */}
      {/* Operator ("bij Your daily plan/Set your plan staat de titel in
         dezelfde rij als de pijl"): agenda.tsx se precedent — dit is een
         directe bestemming vanuit een hub (net als "Your breathwork
         plan"), geen meerstaps-wizard zoals goal.tsx. Titel dus IN de bar,
         gecentreerd, met een even grote lege ruimte rechts voor symmetrie. */}
      <View style={s.bar}>
        <AnimatedPressable
          onPress={() => router.back()}
          onPressIn={() => { closeScale.value = withTiming(0.9, { duration: 80 }); }}
          onPressOut={() => { closeScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); }}
          hitSlop={12}
          style={[s.back, closeStyle]}
          accessibilityLabel="Back"
        >
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </AnimatedPressable>
        <Text style={s.title}>How do you feel?</Text>
        <View style={s.back} />
      </View>

      {phase === 'pick' && (
        // Operator, 2 okt 2026: "kaart mag niet scrollen" — vast scherm,
        // geen ScrollView. Alles (invoer + 4 core + 8 nuance) moet in de
        // beschikbare hoogte passen; zie de compactere maten hieronder.
        <View style={s.body}>
          {/* Operator ("volgens mij heeft de invoerbalk geen meerwaarde,
             gebruiker moet toch al iets specifieks ingeven anders vinden we
             niets — hebben we zowat alle staten al op de pagina?"): klopt —
             de matcher is keyword-gebaseerd, geen echt taalbegrip, en de 12
             chips dekken de 5 staten al breed. Vrije-tekst-invoer weg;
             `matchFreeText`/`instant-feel.ts` blijft bestaan (onschuldige,
             ongebruikte util) mocht dit later terugkomen. */}
          <Text style={s.subheading}>Choose what's going on — we'll take it from there.</Text>

          <View style={s.grid}>
            {core.map((situation, idx) => (
              <SituationCard
                key={situation.id}
                situation={situation}
                index={idx}
                onPress={() => choose(situation)}
                onInfoPress={() => setInfoFor(situation)}
              />
            ))}
          </View>

          <Text style={s.nuanceLabel}>OR SOMETHING MORE SPECIFIC</Text>
          <View style={s.grid}>
            {nuance.map((situation, idx) => (
              <SituationCard
                key={situation.id}
                situation={situation}
                /* +4: vervolg van de stagger op de 4 core-kaarten hierboven,
                   zodat het hele scherm als één doorlopende reveal voelt
                   i.p.v. twee aparte animatie-groepen. */
                index={idx + core.length}
                onPress={() => choose(situation)}
                onInfoPress={() => setInfoFor(situation)}
                compact
              />
            ))}
          </View>
        </View>
      )}

      {phase === 'personalizing' && (
        <View style={s.centerBody}>
          <Text style={s.personalizingTxt}>Personalizing your flow…</Text>
        </View>
      )}

      {/* ── Waarom deze techniek/duur ── Operator, 2 okt 2026 ("got it-knop
         weg, in de andere kaarten staat toch duidelijk Done in de
         rechterbovenhoek?" → "info moet relevant zijn voor de GEKOZEN
         feel, bv waarom is Calm Control 10 min goed voor I feel
         stressed"): twee aanpassingen op het eerdere bottom-sheet.
         (1) Header nu exact het `sheetHeader`-patroon van breath-setup.tsx
         se eigen duur-infosheet — titel links, "Done" rechtsboven, geen
         losse knop meer onderaan.
         (2) Body noemt nu expliciet de GEKOZEN situatie zelf
         (`situation.label`) i.p.v. een generieke techniek-uitleg los van
         context — nog steeds enkel bestaande, geverifieerde velden
         (`technique.effect`/`duration.why` uit breath-states.ts), alleen
         anders samengevoegd zodat het antwoord op "waarom dit voor MIJ"
         leesbaar wordt, niet een nieuw verzonnen claim. */}
      {/* Echt glas, ook op Android: in hetzelfde venster als de app
          (components/GlassSheetHost.tsx), niet als Modal (7 okt 2026). */}
      <GlassSheet visible={infoFor !== null} onClose={() => setInfoFor(null)}>
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 24 }, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
            {/* VIBEZCORE-glas, echt vervaagd (7 okt 2026). */}
            <VibezGlass
              radius={24}
              level="sheet"
              blurTarget={rootBlurRef}
              style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
            />
            {infoFor !== null && (() => {
              const st = stateFor(infoFor.state);
              const technique = pickInstantTechnique(st, infoFor);
              const duration = pickInstantDuration(st, technique, infoFor);
              return (
                <>
                  <Pressable
                    onPress={() => setInfoFor(null)}
                    hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }}
                  >
                    <View style={s.sheetGrip} />
                  </Pressable>
                  <View style={s.sheetHeader}>
                    <Text style={[s.modalTitle, { color: st.accent }]}>
                      {technique.name}
                    </Text>
                    <Pressable
                      onPress={() => setInfoFor(null)}
                      hitSlop={10}
                    >
                      <Text style={s.sheetDoneTxt}>Done</Text>
                    </Pressable>
                  </View>
                  <Text style={s.modalEyebrow}>
                    FOR "{infoFor.label.toUpperCase()}"
                  </Text>
                  {/* Operator, 2 okt 2026 ("uw uitleg over military klopt
                     niet voor I feel stressed, dat hoort ergens anders"):
                     `technique.explain`/`effect` uit breath-states.ts zijn
                     geschreven voor de NEUTRALE technieken-kiezer (bv. box
                     breathing se militaire herkomst) — dezelfde techniek
                     betekent iets anders per situatie. `infoFor.why` is nu
                     PER SITUATIE geschreven in instant-feel.ts, gegrond in
                     hetzelfde al geverifieerde onderzoek, maar mood-
                     specifiek — "waarom DIT voor I feel stressed", niet
                     een generieke techniek-beschrijving. */}
                  <View style={s.infoBlock}>
                    <Text style={s.infoLabel}>WHY THIS HELPS</Text>
                    <Text style={s.modalBody}>{infoFor.why}</Text>
                  </View>
                  <View style={s.infoBlock}>
                    <Text style={s.infoLabel}>WHY {duration.minutes} MIN</Text>
                    <Text style={s.modalBody}>{duration.why}</Text>
                  </View>
                </>
              );
            })()}
          </View>
      </GlassSheet>
    </SafeAreaView>
  );
}

/* Operator, 2 okt 2026, derde ronde ("kijk naar protocol en andere
   schermen van breathwork met kaarten en pas hier zo aan"): de vorige twee
   pogingen verzonnen een eigen stijl i.p.v. de al bestaande kaart-regel in
   de app te volgen. Die regel (zie bv. goal.tsx se `tile`): altijd een
   neutrale, donkere `BlurView`-matglas-basis — GEEN kleur-vulling op de
   kaart zelf, rechthoekig (radius 20, geen pil-vorm), rand
   `rgba(255,255,255,0.14)`, en de tekst krijgt NOOIT een `numberOfLines`-
   cap (altijd volledig uitgeschreven, wrapt i.p.v. af te kappen met "…").
   Kleur zit hier enkel nog in het kleine icoon-badge, niet op de kaart. */
function SituationCard({
  situation,
  index,
  onPress,
  onInfoPress,
  compact,
}: {
  situation: InstantSituation;
  /* Positie in de volledige 12-kaarten-reeks (core 0-3, nuance 4-11) —
     bepaalt enkel de entry-stagger hieronder, geen layout-impact. */
  index: number;
  onPress: () => void;
  /* Operator, 2 okt 2026 ("en i voor de 8 andere kaarten?"): nu op alle
     12 kaarten gezet — ook de compacte nuance-rijen, zie de `compact`-tak
     hieronder voor hun eigen, smallere "i"-plaatsing. */
  onInfoPress?: () => void;
  compact?: boolean;
}) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const Icon = ICON_FOR[situation.id] ?? Zap;
  const st = stateFor(situation.state);
  /* Operator ("misschien bovenaan ook de techniek zetten?"): toont meteen
     zichtbaar welke techniek gekozen is — had de "Tired but wired = Can't
     sleep"-bug (identieke techniek) meteen zichtbaar gemaakt. Enkel op de
     4 core-kaarten, waar er ruimte voor is. */
  const techniqueName = !compact
    ? (st.techniques.find((t) => t.key === situation.technique)?.name ?? '')
    : '';
  return (
    <AnimatedPressable
      /* Operator, 2 okt 2026 ("voelt statisch aan, voeg de animatie volgens
         ons protocol toe" → vervolg: "nu te veel bounce, niet hoe de
         andere werken" → "er is geen bounce op de andere kaarten, uw
         uitleg klopt niet"): de veer-theorie (dichte grid, overlappende
         overshoots) was fout geraden, niet geverifieerd. Weg met
         `.springify()` volledig — rechte, niet-bouncy fade zoals
         `history.tsx` se `FadeIn.delay(150).duration(280)`, geen enkel
         overshoot-risico meer. */
      entering={FadeInUp.delay(150 + index * 40).duration(280)}
      onPress={onPress}
      onPressIn={() => { scale.value = withTiming(0.97, { duration: 80 }); }}
      onPressOut={() => { scale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 }); }}
      style={[s.cardSlot, pressStyle]}
    >
      {/* Operator ("de 4 hoofdkaarten lichter dan de achtergrond, de 8
         chips blijven effen en vlak zodat de top-sectie erbovenuit
         springt"): core-kaarten blijven echte matglas (BlurView), de
         nuance-rijen worden een vlakke, effen `View` — een laagverschil
         zonder kleur te gebruiken. */}
      {/* Operator ("iconen mogen los zonder placeholder eronder"): geen
         vierkant kader/badge meer achter het icoon — gewoon los icoon. */}
      {compact ? (
        <View style={[s.card, s.cardRow, s.cardCompactRow, s.cardFlat]}>
          <Icon size={18} color="#ffffff" strokeWidth={2} />
          <Text style={[s.cardLabel, s.cardLabelCompact, s.cardLabelRow]}>
            {situation.label}
          </Text>
          {/* Operator, 2 okt 2026 ("en i voor de 8 andere kaarten?"): als
             laatste item IN de rij i.p.v. absoluut gepositioneerd — deze
             rijen zijn te smal/laag voor een losse hoek-plaatsing zoals
             bij de core-kaarten, maar als rij-laatste item past de "i"
             gewoon natuurlijk mee zonder overlap met het label. */}
          {!!onInfoPress && (
            <Pressable onPress={onInfoPress} hitSlop={10}>
              <Info size={14} color="rgba(255,255,255,0.4)" strokeWidth={2} />
            </Pressable>
          )}
        </View>
      ) : (
        // Operator ("iconen op grote kaarten moeten boven de tekst, tekst
        // moet links onder"): kolom i.p.v. rij — icoon linksboven, label
        // links onderaan, beide op dezelfde linker-as.
        <>
          {/* Operator, 2 okt 2026 ("zou Apple dat met kleur doen?"): de
             radiale gloed-achtergrond (11 september-reeks hierboven) is
             weg — Apple se eigen kaart-patronen (Health, Fitness,
             Shortcuts) zijn vlak en neutraal, kleur zit op een klein
             element (hier: enkel het icoon), niet als sfeer-gloed achter
             de hele kaart. Sluit ook aan bij het eigen `goal.tsx`-
             `tile`-precedent waar deze kaarten al naar verwezen: neutrale
             matglas, kleur enkel in het icoon-badge. */}
          <BlurView
            intensity={40}
            tint="dark"
            blurMethod="dimezisBlurViewSdk31Plus"
            style={[s.card, s.cardColumn]}
          >
            <Icon size={26} color="#ffffff" strokeWidth={1.8} />
            <View style={s.cardColumnSpacer} />
            <Text style={[s.cardLabel, s.cardColumnLabel]} numberOfLines={2}>
              {situation.label}
            </Text>
            {!!techniqueName && (
              <Text style={s.cardTechnique} numberOfLines={1}>
                {techniqueName}
              </Text>
            )}
            {/* Operator, 2 okt 2026 ("i met daaronder apple-stijl info"):
               losse tikzone bovenop de kaart-Pressable — in React Native
               wint de binnenste responder de touch (geen DOM-bubbling),
               dus deze knop opent de info-sheet zonder ook de kaart se
               eigen `onPress` (= sessie starten) te triggeren. */}
            {!!onInfoPress && (
              <Pressable
                onPress={onInfoPress}
                hitSlop={10}
                style={s.cardInfoBtn}
              >
                <Info size={14} color="rgba(255,255,255,0.55)" strokeWidth={2} />
              </Pressable>
            )}
          </BlurView>
        </>
      )}
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  /* Operator, 2 okt 2026 ("back knop ontbreekt, header te laag, alles te
     dicht op elkaar"): zelfde standaard `bar`-rij als goal.tsx/
     build-choice.tsx — ChevronLeft linksboven, 40×40 tikvlak — i.p.v. de
     losse ronde X. Kop begint vlak eronder, niet met een grote lege
     ruimte erboven. */
  /* Exact agenda.tsx se `bar`/`back`/`title` — titel IN de rij, gecentreerd
     via symmetrische `back`-spacer rechts, zelfde patroon als "Your
     breathwork plan". */
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: BrandFonts.bold,
    fontSize: 18,
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  body: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  /* Operator ("invoerbalk weg, chips dekken de staten al"): subheading
     staat nu direct boven de kaarten-grid, iets meer ruimte eronder dan
     toen de invoerbalk er nog tussen stond. */
  subheading: {
    marginTop: 14,
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'left',
    marginBottom: 20,
  },

  /* Operator ("alles opgepropt, moet ademen — al 3 keer gezegd"): gaps en
     marges fors ruimer, core-kaarten duidelijk groter (100→128). Om dit
     zonder scroll te laten passen is elders ingekort (subheading/input
     compacter, zie onder) i.p.v. de kaarten weer klein te maken. */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  cardSlot: { width: '48%' },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  /* Core-kaart (4 stuks): alle 4 EXACT dezelfde vaste hoogte. Kolom —
     icoon linksboven, label links onderaan (operator: "icoon boven de
     tekst, tekst links onder"). */
  /* Operator ("I feel stressed moet op dezelfde hoogte beginnen als I feel
     tired"): was `justifyContent:'space-between'` — dat ankert de tekst
     ONDERAAN, dus een 2-regelig label ("I feel tired / low energy") begint
     hoger dan een 1-regelig label. Nu vast BOVENAAN (icoon, dan tekst met
     een vaste marge), zodat elk label op exact dezelfde Y-positie begint,
     ongeacht de lengte. */
  /* Operator ("staat tekst links onder volgens u?"): klopte niet —
     `flex-start` zet icoon+tekst SAMEN bovenaan. Icoon blijft bovenaan
     (vast, via `cardColumnIcon` hieronder), label wordt nu met `flex:1`
     naar de onderkant geduwd (`justifyContent:'flex-end'` op het label
     zelf lukt niet binnen een column zonder het icoon ook te verplaatsen —
     een tussenliggende `flex:1`-spacer is de juiste oplossing). */
  /* +14 (128→142) om ruimte te maken voor de techniek-naam onder het
     label (operator: "zet de techniek ook op de kaart"). */
  cardColumn: {
    minHeight: 142,
    padding: 16,
    alignItems: 'flex-start',
  },
  cardColumnSpacer: { flex: 1 },
  cardTechnique: {
    marginTop: 2,
    fontFamily: BrandFonts.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  /* 44×44 hitSlop-vriendelijke tikzone rechtsboven, zelfde positie als
     `modalClose` in breath-session.tsx — hier geen kruisje maar de
     losstaande info-knop. */
  cardInfoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Basis voor de nuance-rij (icoon + tekst naast elkaar). */
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  /* Nuance-rij (8 stuks): vlakke, effen vulling (geen BlurView) — zelfde
     laag-verschil-principe als de rest van de app ("belangrijkste kaarten
     lichter/matglas, de rest blijft vlak"), zonder kleur te gebruiken. */
  cardFlat: { backgroundColor: '#1C1C1E' },
  /* Operator ("alle kaarten onderaan even groot, tekst mooi uitgelijnd"):
     was `minHeight` — een langer label (bv. "Exhausted — can't switch
     off", 2 regels) groeide dan hoger dan een kort label ("Overwhelmed /
     rushed", 1 regel), dus de 8 rijen stonden ongelijk. Nu een VASTE
     `height` (ruimte voor 2 regels + padding), identiek voor alle 8,
     ongeacht labellengte — icoon + tekst blijven `alignItems:'center'`
     verticaal gecentreerd binnen die vaste hoogte. */
  cardCompactRow: {
    height: 54,
    padding: 12,
    gap: 10,
  },
  cardLabel: {
    fontFamily: BrandFonts.semibold,
    fontSize: 14,
    lineHeight: 18,
    color: '#ffffff',
    textAlign: 'left',
  },
  cardLabelCompact: { fontSize: 12, lineHeight: 15 },
  cardLabelRow: { flex: 1 },
  /* Vaste hoogte voor 2 regels (18×2), ongeacht of het label er écht 2
     gebruikt — zo blijft de bovenkant van elk label op dezelfde hoogte
     beginnen (ongeacht 1 of 2 regels) ÉN het blok als geheel onderaan de
     kaart geankerd via de flex-spacer ervoor. Beide eisen tegelijk. */
  cardColumnLabel: { height: 36 },
  /* Operator ("or something more... laten zakken, meer ademruimte tussen
     de blokken", toen "nog zakken 0.5cm" ≈ +19dp): extra marginTop
     bovenop de grid se eigen marginBottom (20) — meer lucht tussen de
     core-kaarten en dit label. */
  nuanceLabel: {
    marginTop: 29,
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  centerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  personalizingTxt: {
    fontFamily: BrandFonts.medium,
    fontSize: 16,
    color: '#ffffff',
  },

  /* ── "Waarom deze techniek/duur"-sheet — Operator, 2 okt 2026: omgebouwd
     van gecentreerde fade-kaart naar bottom-sheet, exact het "Background
     sound"-sheetpatroon uit breath-session.tsx (`sheetBackdrop`/`sheet`/
     `sheetGrip`). Content-stijlen (`modalEyebrow`/`modalTitle`/`modalBody`/
     `modalFoot`/`modalBtn`/`modalBtnTxt`) blijven dezelfde als de oude
     "Apple-stijl" fade-kaart — enkel de buitenste vorm veranderde. */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,12,0.58)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 22,
    paddingTop: 10,
    /* Operator, 2 okt 2026 ("meer ademruimte onderaan en in de kaart"):
       9 → 18 tussen de blokken (eyebrow/WHAT IT IS/WHY N MIN), en de
       `paddingBottom` wordt bovenop de insets-berekening op de Pressable
       zelf nog eens +12 extra (was +12, nu +24) voor meer lucht onderaan. */
    gap: 18,
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 10,
  },
  modalEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: 'rgba(255,255,255,0.5)',
  },
  /* Operator, 2 okt 2026: 24px extrabold was getuned voor een los,
     gecentreerd kaart-kop — in de `sheetHeader`-rij naast "Done" (zelfde
     patroon als breath-setup.tsx se duur-infosheet, ook 18px bold daar)
     oogde dat te zwaar. 18px, geen `textAlign:'center'` (zit nu in een
     `space-between`-rij, niet alleen op een regel). */
  modalTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetDoneTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    color: '#ffffff',
  },
  /* Gelabelde blokken (WHAT IT IS / WHY N MIN) i.p.v. doorlopende tekst —
     operator: "moet in 1 opslag duidelijk en leesbaar zijn". */
  infoBlock: { gap: 4 },
  infoLabel: {
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.4)',
  },
  modalBody: {
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.78)',
  },
});
