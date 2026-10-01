/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Build your day

   Pad B van de Protocol-flow (operator, 17 september 2026: "we moeten de
   gebruiker ook de optie geven om zijn eigen dagindeling te maken... kan
   gebruiker bv kiezen om middagindeling en daar 2, 3 of 4 oefeningen te
   doen").

   VOLLEDIG vrij per sessie: staat, techniek, duur EN tijdstip, allemaal
   gebruiker se eigen keuze (operator, vervolg dezelfde dag).

   Operator, later diezelfde dag (2e verfijning): "het zou veel beter zijn
   als gebruiker add session doet en daar alles op 1 kaart kan invullen...
   zelfde kaart als breathwork... cirkel in de kaart zorgt dan voor
   geanimeerde info geven, kleur, tijd" — "Add session" opent daarom NIET
   meer een eigen invulscherm hier, maar het BESTAANDE breath-setup.tsx in
   een nieuwe "addToDay"-modus (dark, staat+techniek+duur+tijd op één
   kaart met de al bestaande ademende cirkel). Dit scherm is dus enkel nog
   het OVERZICHT per dagdeel + de terugkoppeling via day-builder-draft.ts. */

import { BrandDark, BrandLight, BrandFonts, CTA, TypeScale } from '@/constants/theme';
import { StepIndicator } from '@/components/StepIndicator';
import { ProtocolFlowCancel } from '@/components/ProtocolFlowCancel';
import { BREATH_STATES } from '@/data/breath-states';
import { DAYPART_PHOTO } from '@/data/daypart-photos';
import { SLOT_WINDOW } from '@/utils/day-plan';
import { SLOTS, MAX_PLAN_ITEMS } from '@/services/reminders';
import { consumeDraftSession } from '@/utils/day-builder-draft';
import type { PlanHorizon, PlannedItem, PlanSlot } from '@/utils/plan-store';
import { ChevronLeft, ChevronRight, Pencil, Plus, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Operator, 18 september 2026 ("build it yourself hele flow dark mode
   maken"): was `true` (licht) — deze stap (en de rest van Pad B: hier,
   plan-review.tsx) blijft nu ALTIJD donker, ongeacht het app-brede
   licht/donker-thema, zelfde aanpak als build-choice.tsx (stap 1 van
   dezelfde flow) eerder deze sessie kreeg. */
const light = false;
const C = light ? BrandLight : BrandDark;

const fmtTime = (mins: number) => {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

/* Operator, 18 september 2026 ("kan je opbouwen zoals in bijlage" — 4
   echte foto's aangeleverd, telkens 1 per dagdeel): kopij (headline +
   korte regel) komt letterlijk uit dat voorbeeld over, geen eigen
   invulling — enkel de foto-url's + die twee tekstregels per dagdeel,
   `SLOT_WINDOW`/uur-bereik en de sessie-lijst eronder blijven zoals ze al
   waren.
   Operator, zelfde dag (2e ronde): "morning start strong beter denk ik.
   middag reload and...?" — morning headline vervangen, midday's eerste
   werkwoord "Reset" → "Reload" (rest van de zin ongewijzigd, sluit ook
   beter aan bij "Reclaim your energy" eronder). */
const DAYPART_CARD: Record<PlanSlot, { image: string; headline: string; sub: string }> = {
  morning: {
    image: DAYPART_PHOTO.morning,
    headline: 'Start strong',
    sub: 'Set the tone for a focused day.',
  },
  midday: {
    image: DAYPART_PHOTO.midday,
    headline: 'Reload and refocus',
    sub: 'Reclaim your energy.',
  },
  afterWork: {
    image: DAYPART_PHOTO.afterWork,
    headline: 'Release the tension',
    sub: 'Make space for what matters.',
  },
  evening: {
    image: DAYPART_PHOTO.evening,
    headline: 'End with calm',
    sub: 'Prepare for deeper rest.',
  },
};

export default function BuildYourDayScreen() {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<PlannedItem[]>([]);
  /* Operator, 18 september 2026 ("aantal dagen moet in add to day komen" —
     bedoelde uiteindelijk de addToDay-ringeditor zelf, 5e/brede tegel
     naast Time/State/Technique/Duration): horizon geldt voor het HELE
     protocol, niet voor 1 sessie, dus leeft hij HIER (build-your-day.tsx)
     als gedeelde staat — elke keer dat breath-setup.tsx teruggeeft via
     day-builder-draft.ts komt de op dat moment gekozen waarde mee terug,
     zodat 'm wijzigen bij sessie 2 ook geldt voor sessie 1. Zelfde
     standaard als voorheen op plan-review.tsx: '2w'. */
  const [horizon, setHorizon] = useState<PlanHorizon>('2w');

  const backScale = useSharedValue(1);
  const onBackPressIn = () => {
    backScale.value = withTiming(0.92, { duration: 80 });
  };
  const onBackPressOut = () => {
    backScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const backPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  const ctaScale = useSharedValue(1);
  const onCtaPressIn = () => {
    ctaScale.value = withTiming(0.96, { duration: 80 });
  };
  const onCtaPressOut = () => {
    ctaScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const ctaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  /* Operator, 17 september 2026: geen eigen invulscherm meer — "Add
     session"/een bestaande sessie aantikken opent breath-setup.tsx
     (addToDay-modus), dat de keuze wegzet via day-builder-draft.ts vlak
     vóór `router.back()`. Bij terugkeer hier ligt 'm klaar. */
  useFocusEffect(
    useCallback(() => {
      const draft = consumeDraftSession();
      if (!draft) return;
      const { item, editIndex, horizon: draftHorizon } = draft;
      setSessions((cur) => {
        if (editIndex !== null && cur[editIndex]) {
          return cur.map((it, i) => (i === editIndex ? item : it));
        }
        if (cur.length >= MAX_PLAN_ITEMS) return cur;
        return [...cur, item];
      });
      setHorizon(draftHorizon);
    }, []),
  );

  /* Operator, 17 september 2026 ("als gebruiker overlappende tijden kiezen
     mag dat niet, moet melding komen"): breath-setup.tsx kent de andere
     sessies in ditzelfde dagdeel niet uit zichzelf — geef ze mee zodat het
     daar, vóór "Add to day", kan checken en blokkeren. Enkel hetzelfde
     dagdeel telt: de vensters (SLOT_WINDOW) grenzen aaneen, dus twee
     verschillende dagdelen kunnen sowieso nooit overlappen. */
  const sameSlotOthers = (slot: PlanSlot, editIndex: number | null) =>
    sessions
      .map((it, i) => ({ it, i }))
      .filter(({ it, i }) => it.slot === slot && i !== editIndex)
      .map(({ it }) => ({ reminderAt: it.reminderAt, minutes: it.minutes }));

  const addSession = (slot: PlanSlot) => {
    router.push({
      pathname: '/breath-setup',
      params: {
        context: 'addToDay',
        slot,
        horizon,
        existing: JSON.stringify(sameSlotOthers(slot, null)),
        /* Operator, 18 september 2026 ("Update Protocol Length?"-
           bevestiging): +1, want de sessie die hier wordt toegevoegd telt
           ook mee zodra hij bewaard is — de "Whole protocol"-tekst op het
           volgende scherm hoort het ECHTE totaal na deze toevoeging te
           tonen, niet het aantal ervoor. */
        totalSessions: String(sessions.length + 1),
      },
    } as never);
  };

  const editSession = (index: number) => {
    const it = sessions[index];
    router.push({
      pathname: '/breath-setup',
      params: {
        context: 'addToDay',
        slot: it.slot,
        editIndex: String(index),
        state: it.state,
        technique: it.techniqueKey,
        minutes: String(it.minutes),
        time: String(it.reminderAt),
        horizon,
        existing: JSON.stringify(sameSlotOthers(it.slot, index)),
        /* Bewerken van een bestaande sessie verandert het totaal niet —
           die telt al mee in `sessions.length`. */
        totalSessions: String(sessions.length),
      },
    } as never);
  };

  const removeSession = (index: number) => {
    setSessions((cur) => cur.filter((_, i) => i !== index));
  };

  const next = () => {
    if (sessions.length < 1) return;
    /* Operator, 18 september 2026 ("geen aparte 'Protocol ready'-pagina
       meer... de twee schermen zijn eigenlijk dezelfde stap"): rechtstreeks
       naar plan-review.tsx i.p.v. via building-protocol.tsx (dat scherm is
       weg) — de sessies zijn hier al volledig door de gebruiker samengesteld,
       er valt niets meer te "berekenen" of te tonen tijdens het bouwen. */
    router.push({
      pathname: '/plan-review',
      params: { path: 'custom', template: JSON.stringify(sessions), horizon },
    } as never);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.bar}>
        <AnimatedPressable
          onPress={() => router.back()}
          onPressIn={onBackPressIn}
          onPressOut={onBackPressOut}
          hitSlop={12}
          style={[s.back, backPressStyle]}
        >
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </AnimatedPressable>
        {/* build-choice.tsx is stap 1 en routeert Pad B rechtstreeks
           hierheen (geen Goal-stap ertussen) — dus stap 2 van Pad B's 3
           stappen (Build-choice → Build your day → Plan review).
           `color="#ffffff"` i.p.v. het standaard blauw — zelfde reden als
           op build-choice.tsx: de rand/vinkje-selectiekleur op dit donkere
           pad is bewust wit, geen extra accentkleur erbij.
           Operator, 21 september 2026 ("balk is storend zo laag, zet 'm
           naast de pijl"): terug in de knoppenrij. */}
        <StepIndicator step={2} total={3} color="#ffffff" />
        <ProtocolFlowCancel />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          /* Ruimte houden voor de nu vaste, zwevende CTA-laag hieronder —
             anders schuift de laatste kaart er half achter weg. */
          { paddingBottom: Math.max(insets.bottom, 12) + 140 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.header}>Build once . Use daily</Text>
        <Text style={s.lead} numberOfLines={1}>
          Design your personal rhythm
        </Text>

        {SLOTS.map((sl) => {
          const rows = sessions
            .map((it, i) => ({ it, i }))
            .filter((x) => x.it.slot === sl.slot);
          const card = DAYPART_CARD[sl.slot];
          const atCap = sessions.length >= MAX_PLAN_ITEMS;
          /* Operator, 20 september 2026 ("midday, kijk alles na, moet
             weergegeven worden als morning" → vervolg, "alle iconen
             moeten zelfde formaat zoals morning"): alle 4 dagdelen kregen
             ondertussen dezelfde soort transparante lijnicoon (zon-op/
             hoge zon/zon-onder/maan) i.p.v. de oorspronkelijke 4 echte
             foto's — dus geen onderscheid meer tussen "icoon-dagdelen" en
             "foto-dagdelen", ALLE 4 gebruiken nu de icoon-weergave
             (contain, gecentreerd label, geen streepje, padding weg van
             het label). Bleef een losse constante i.p.v. de branches
             hieronder gewoon te verwijderen — als een dagdeel ooit weer
             een échte foto terugkrijgt, is dit de ene plek om 'm uit te
             zonderen. */
          const isIconDaypart = true;
          return (
            <DaypartCard
              key={sl.slot}
              sl={sl}
              card={card}
              rows={rows}
              atCap={atCap}
              isIconDaypart={isIconDaypart}
              onAdd={() => addSession(sl.slot)}
              onEdit={editSession}
              onRemove={removeSession}
            />
          );
        })}

        {sessions.length >= MAX_PLAN_ITEMS && (
          <Text style={s.capNote}>
            {MAX_PLAN_ITEMS} sessions a day is the most VIBEZCORE can remind you about.
          </Text>
        )}

      </ScrollView>

      {/* Operator, 18/19 september 2026 ("cta's moeten naar boven en
         sticky, stap 2 en 3"): was een `marginTop:'auto'`-blok BINNEN de
         ScrollView (duwde de CTA naar onder als er weinig content was,
         maar scrolde gewoon MEE zodra de dagdeel-lijst lang genoeg werd)
         — nu, zelfde patroon als plan-review.tsx, een vaste laag BUITEN
         de ScrollView die nooit meeschuift. Gradient (transparant → C.bg)
         zorgt dat content die eronder doorscrolt zacht wegvloeit. */}
      <View
        style={[s.ctaFloat, { paddingBottom: Math.max(insets.bottom, 12) + 40 }]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={['transparent', C.bg]}
          locations={[0, 0.4]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Operator, 20 september 2026 ("de 3 stippen onderaan boven de
           cta moet weg"): stonden dubbel met de "STEP 2 OF 3" + eigen
           stippen die al bovenaan staan (`StepIndicator` in de `s.bar`-
           rij) — zelfde overbodige dubbele voortgang als build-choice.tsx
           eerder had. */}
        <AnimatedPressable
          style={[s.cta, sessions.length < 1 && s.ctaDisabled, ctaPressStyle]}
          disabled={sessions.length < 1}
          onPress={next}
          onPressIn={onCtaPressIn}
          onPressOut={onCtaPressOut}
        >
          <Text style={s.ctaTxt}>Continue</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

/* Geëxtraheerd uit de vroegere inline `SLOTS.map(...)`-callback zodat elke
   kaart zijn eigen press-scale-hooks mag hebben (hooks mogen niet in een
   `.map()`-callback staan) — zelfde patroon als `StartCard` in
   breath-welcome.tsx. Puur een verhuizing van de bestaande JSX, geen
   gedragswijziging. */
function DaypartCard({
  sl,
  card,
  rows,
  atCap,
  isIconDaypart,
  onAdd,
  onEdit,
  onRemove,
}: {
  sl: (typeof SLOTS)[number];
  card: { image: string; headline: string; sub: string };
  rows: { it: PlannedItem; i: number }[];
  atCap: boolean;
  isIconDaypart: boolean;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const rowScale = useSharedValue(1);
  const onRowPressIn = () => {
    rowScale.value = withTiming(0.95, { duration: 80 });
  };
  const onRowPressOut = () => {
    rowScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const rowPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rowScale.value }],
  }));

  return (
    /* Operator, 18 september 2026 ("gekozen state moet duidelijk
       bij die bepaalde tijdzone horen — nu aparte kaart eronder,
       druk en onduidelijk"): daypart-header (foto+titel) en zijn
       sessie-rijen zitten voortaan in ÉÉN doorlopende kaart
       (`dayCard`, met de rand/achtergrond/afronding die
       `dayCardRow` en `sessionRow` eerder EIGEN hadden) i.p.v.
       los-op-elkaar-gestapelde kaarten — leest nu ondubbelzinnig
       als "deze sessies horen bij dit dagdeel", geen giswerk meer
       welke kaart bij welke hoort. */
    <View style={s.dayCard}>
      {/* Operator, 20 september 2026 ("build once use daily, stap 2
         of 3, ook blur effect kaarten"): `backgroundColor: rgba(...)`
         (fake-glas) vervangen door een echte `BlurView` — zelfde
         recept als breath-setup.tsx's kaartjes (`intensity=40`,
         `dimezisBlurViewSdk31Plus`, anders valt `expo-blur` op
         Android terug op een vlak, ongeblurd vlak). `dayCard` had
         al `overflow:'hidden'` (voor de foto-hoeken), en geen
         losse selectie-ring-overlay zoals breath-setup.tsx's
         tegels — dus geen aparte clip-laag nodig hier. */}
      <BlurView
        intensity={40}
        tint="dark"
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
      {/* Operator, 18 september 2026 ("hele kaart is de knop, i.p.v.
         losse plusknop rechts"): was een `<View>` met een aparte
         ronde "+"-`Pressable` erin — nu de rij zelf de tap-target,
         met enkel nog een subtiele chevron als visuele hint (geen
         geneste Pressable-in-Pressable meer). */}
      <AnimatedPressable
        style={[s.dayCardRow, atCap && s.dayCardRowDisabled, rowPressStyle]}
        disabled={atCap}
        onPress={onAdd}
        onPressIn={onRowPressIn}
        onPressOut={onRowPressOut}
        accessibilityLabel={`Add session to ${sl.label}`}
      >
        {/* Operator, 18 september 2026 ("in build your day moet ook
           duidelijk zijn welke uren morning/midday/... zijn"): het
           uur-bereik (`SLOT_WINDOW`, dezelfde bron als de
           Time-kiezer in breath-setup.tsx) staat nu OVER de foto,
           zodat het duidelijk is vóór je "+" tikt. */}
        <View style={s.dayCardImgWrap}>
          {/* Operator, 20 september 2026 ("nieuw icoon is
             transparante achtergrond, moet zonder placeholder in
             de grote morning kaart komen" → vervolg, "symbool
             staat nu in de tekst morning"): de vervangende
             morning-afbeelding is een lijnicoon met transparante
             achtergrond, geen foto meer — `cover` + de
             `dayCardImgShiftRight`-pan (bedoeld om een BREDE foto
             te centreren op zijn rechterhelft) hoorden bij een
             foto, niet bij een gecentreerd icoon; die twee gelden
             nu enkel nog voor de overige 3, wél-foto dagdelen.
             `padding` RECHTSTREEKS op een RN `<Image>` blijkt
             zijn eigen `resizeMode`-berekening niet te beïnvloeden
             (bekende platform-eigenaardigheid, vooral Android) —
             de vorige poging (padding op de Image zelf) deed dus
             zichtbaar niets, het icoon bleef tot de volle
             108×108 doorlopen en onder tegen het label botsen.
             Een omwikkelende `View` mét padding, met de Image
             daarbinnen op 100%/100%, dwingt de padding wél af —
             Yoga past 'm dan toe op de OUDER-doos vóór de Image
             zijn `contain`-berekening op de overgebleven ruimte
             doet. */}
          {isIconDaypart ? (
            <View style={s.dayCardImgIconPad}>
              <Image
                source={{ uri: card.image }}
                resizeMode="contain"
                style={s.dayCardImg}
              />
            </View>
          ) : (
            <Image
              source={{ uri: card.image }}
              resizeMode="cover"
              style={s.dayCardImg}
            />
          )}
          {/* Operator, 18 september 2026 ("evening-foto: tekst
             valt weg tegen de lamp op de achtergrond, contrast
             verminderd"): 2 stops (transparant→70% zwart) hield te
             veel van de originele foto-helderheid net onder de
             tekst. 3 stops, met de donkerste 85% al op 55% van de
             hoogte i.p.v. pas helemaal onderaan — geeft de
             eyebrow/uur-tekst een gegarandeerd donkere ondergrond,
             ongeacht hoe fel de foto daar zelf is. */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.55, 1]}
            style={s.dayCardImgGrad}
          />
          {/* Operator, 20 september 2026 ("icoon en Morning moeten
             mooi onder elkaar staan, het streepje voor Morning
             moet weg"): het icoon (contain-mode) centreert
             horizontaal, maar het label stond links-uitgelijnd —
             twee verschillende assen, oogde niet als één geheel.
             Voor morning specifiek nu gecentreerd (`dayCardImgLabelCenter`)
             zodat icoon+label als één verticale stapel lezen, en
             zonder het decoratieve streepje (dat hoorde bij de
             links-uitgelijnde foto-kaarten, niet bij dit
             icoon+bijschrift-patroon). De 3 foto-dagdelen behouden
             hun bestaande links-uitgelijnde label + streepje. */}
          <View
            style={[
              s.dayCardImgLabel,
              isIconDaypart && s.dayCardImgLabelCenter,
            ]}
          >
            {!isIconDaypart && <View style={s.dayCardImgRule} />}
            <Text
              style={[
                s.dayCardImgEyebrow,
                isIconDaypart && s.dayCardImgTxtCenter,
              ]}
              numberOfLines={1}
            >
              {sl.label}
            </Text>
            <Text
              style={[
                s.dayCardImgRange,
                isIconDaypart && s.dayCardImgTxtCenter,
              ]}
              numberOfLines={1}
            >
              {fmtTime(SLOT_WINDOW[sl.slot].from * 60)}
              {' – '}
              {fmtTime(SLOT_WINDOW[sl.slot].to * 60)}
            </Text>
          </View>
        </View>

        <View style={s.dayCardText}>
          {/* Operator, 18 september 2026 ("titels niet afkappen met
             '...', Apple laat doorlopen naar regel 2"): was
             `numberOfLines={1}`, wat "Reload and refocus"/"Release
             the tension" halverwege afkapte. */}
          <Text style={s.dayCardHeadline} numberOfLines={2}>
            {card.headline}
          </Text>
          <Text style={s.dayCardSub} numberOfLines={2}>
            {card.sub}
          </Text>
        </View>

        {/* Operator, 18 september 2026 ("de 'add nog een' moet op
           de kaart zelf komen na het aanmaken van de eerste
           sessie — gebruiker moet weten dat hij in hetzelfde
           tijdvak nog sessies kan instellen"): zodra dit dagdeel
           al minstens 1 sessie heeft, vervangt een expliciete
           "+ Add another"-badge de neutrale chevron — dezelfde
           kaart blijft de tap-target, enkel het affordance-label
           verandert per dagdeel, precies waar de gebruiker moet
           kijken. */}
        {rows.length > 0 ? (
          <View style={s.dayCardAddMore}>
            <Plus size={13} color="rgba(255,255,255,0.85)" strokeWidth={2.8} />
            <Text style={s.dayCardAddMoreTxt}>Add another</Text>
          </View>
        ) : (
          <ChevronRight size={20} color="rgba(255,255,255,0.35)" strokeWidth={2.4} />
        )}
      </AnimatedPressable>

      {rows.map(({ it, i }) => (
        <SessionRow
          key={i}
          it={it}
          index={i}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ))}
    </View>
  );
}

/* Geëxtraheerd samen met `DaypartCard` hierboven — dezelfde reden (hooks
   mogen niet in een `.map()`-callback). Bevat 2 losse tappable elementen
   (de rij zelf = bewerken, en de geneste X = verwijderen), elk met zijn
   eigen press-scale, exact zoals ze voorheen als 2 losse `Pressable`s
   naast elkaar bestonden. */
function SessionRow({
  it,
  index,
  onEdit,
  onRemove,
}: {
  it: PlannedItem;
  index: number;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const st = BREATH_STATES[it.state];
  const tech = st.techniques.find((t) => t.key === it.techniqueKey);

  const rowScale = useSharedValue(1);
  const onRowPressIn = () => {
    rowScale.value = withTiming(0.95, { duration: 80 });
  };
  const onRowPressOut = () => {
    rowScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const rowPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rowScale.value }],
  }));

  const removeScale = useSharedValue(1);
  const onRemovePressIn = () => {
    removeScale.value = withTiming(0.92, { duration: 80 });
  };
  const onRemovePressOut = () => {
    removeScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const removePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: removeScale.value }],
  }));

  return (
    <View>
      {/* Haarlijn i.p.v. een losse kaartrand tussen elke
         sessie — hoort nu bij DEZE kaart, geen eigen kaart
         meer. */}
      <View style={s.sessionDivider} />
      <AnimatedPressable
        style={[s.sessionRow, rowPressStyle]}
        onPress={() => onEdit(index)}
        onPressIn={onRowPressIn}
        onPressOut={onRowPressOut}
      >
        <View style={[s.dot, { backgroundColor: st.accent }]} />
        <View style={s.sessionText}>
          <Text style={[s.sessionState, { color: st.accent }]}>{st.eyebrow}</Text>
          <Text style={s.sessionSub}>
            {tech?.name ?? 'Technique'} · {it.minutes} min · {fmtTime(it.reminderAt)}
          </Text>
        </View>
        <Pencil size={13} color="rgba(255,255,255,0.4)" strokeWidth={2.2} />
        <AnimatedPressable
          onPress={() => onRemove(index)}
          onPressIn={onRemovePressIn}
          onPressOut={onRemovePressOut}
          hitSlop={10}
          style={[s.removeBtn, removePressStyle]}
        >
          <X size={15} color="rgba(255,255,255,0.45)" strokeWidth={2.4} />
        </AnimatedPressable>
      </AnimatedPressable>
    </View>
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

  /* Operator, 18 september 2026 ("hele flow dark, fonts ook aanpassen,
     consistent"): links uitgelijnd i.p.v. gecentreerd — zelfde Apple-
     redesign-richting als build-choice.tsx (stap 1 van dit pad). */
  header: {
    marginTop: 4,
    ...TypeScale.pageHeader,
    textAlign: 'left',
    color: C.text,
  },
  /* Operator, 18 september 2026 ("kijk font na, klopt niet header
     subheader"): was `TypeScale.pageLead` (bedoeld voor een kleine,
     gedempte regel ONDER een subheader) — zelfde verkeerde token als
     build-choice.tsx eerder had, hier gemist. `pageSubhead` is de rol
     "direct onder een pageHeader". */
  lead: {
    marginTop: 8,
    marginBottom: 28,
    ...TypeScale.pageSubhead,
    textAlign: 'left',
    color: 'rgba(255,255,255,0.55)',
  },

  /* Operator, 18 september 2026 ("gekozen state moet duidelijk bij die
     bepaalde tijdzone horen — nu aparte kaart eronder, druk en
     onduidelijk"): de rand/achtergrond/afronding die eerder los op
     `dayCardRow` ÉN `sessionRow` stonden (twee zichtbaar losse kaarten)
     zitten nu hier, op de GEDEELDE buitenste container — header-rij en
     sessie-rijen zijn voortaan gewoon interne rijen van dezelfde kaart.
     `overflow:'hidden'` knipt de vierkante hoeken van de binnenste rijen
     af tot de kaart z'n eigen afgeronde vorm. */
  /* Operator, 20 september 2026 ("kaarten moeten beetje verder van
     elkaar zodat ze beter kunnen ademen"): 18 → 26. */
  dayCard: {
    marginBottom: 26,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  /* Operator, 18 september 2026 ("kan je opbouwen zoals in bijlage...
     fotos hier"): foto-kaart per dagdeel i.p.v. het vorige platte
     tekst-kopje — foto links (label+uur-bereik erover), headline+subtekst
     in het midden, ronde "+"-knop rechts. */
  dayCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
  },
  /* Operator, zelfde dag (2e ronde): "de fotos en tekst op fotos mag
     groter" — foto van 78→108, en de eyebrow/uur-tekst erover een stap
     groter + iets meer lucht, zodat het op de foto zelf ook leesbaar
     weegt i.p.v. als klein bijschrift oogt. */
  /* Operator, 20 september 2026 ("zonder placeholder"): de rgba-
     achtergrondtint diende als laad-plaatshouder achter een foto — nu de
     morning-afbeelding een icoon met transparante achtergrond is, zou die
     tint er als een storend grijs vlak achter blijven staan. Weg, voor
     alle 4 dagdelen (de 3 overige zijn wél-foto's die 'm nooit zichtbaar
     nodig hadden — `cover` vult het kader toch altijd volledig zodra
     geladen). */
  dayCardImgWrap: {
    width: 108,
    height: 108,
    borderRadius: 16,
    overflow: 'hidden',
  },
  dayCardImg: { width: '100%', height: '100%' },
  /* Operator, 20 september 2026: verving `dayCardImgShiftRight` (was een
     "foto naar rechts pannen"-truc via `width:'150%'`+negatieve `left` —
     bedoeld voor een BREDE foto, zinloos/schadelijk op een gecentreerd
     icoon). Morning's `resizeMode` staat nu op `contain`.
     Operator, zelfde dag (vervolg, "symbool staat nu in de tekst
     morning"): het icoon vulde de volle 108×108-hoogte en liep zo onder
     tegen `dayCardImgLabel` (eyebrow + uur-bereik, `bottom:9`) aan. Een
     grotere kaart optillen voor dit ene dagdeel zou de andere 3 (echte
     foto's, die dit probleem niet hebben) nodeloos scheeftrekken —
     asymmetrische padding houdt de kaartmaat gelijk over alle 4 dagdelen
     en geeft enkel het icoon zelf ruimte weg van het label: onderaan
     genoeg (~ label se eigen hoogte + marge) om nooit te overlappen, de
     andere kanten blijven lichte lucht.
     Operator, zelfde dag (2e correctie): padding rechtstreeks op de
     `<Image>` bleek zonder effect (RN negeert eigen padding bij
     `resizeMode`-berekening, vooral op Android) — nu een omwikkelende
     `View` met deze padding, Image erbinnen op 100%/100%, zie de JSX.
     Operator, zelfde dag (3e ronde): midday kreeg dezelfde soort
     transparante lijnicoon-vervanging als morning — hernoemd van
     `dayCardImgMorningPad` naar `dayCardImgIconPad`, geldt nu voor beide
     (`isIconDaypart`). */
  dayCardImgIconPad: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  dayCardImgGrad: { ...StyleSheet.absoluteFillObject },
  dayCardImgLabel: { position: 'absolute', left: 10, right: 8, bottom: 9 },
  /* Operator, 20 september 2026: morning-variant — gecentreerd i.p.v.
     links-uitgelijnd, zodat het label recht onder het (eveneens
     gecentreerde) icoon staat. */
  dayCardImgLabelCenter: { left: 0, right: 0, alignItems: 'center' },
  dayCardImgTxtCenter: { textAlign: 'center' },
  dayCardImgRule: {
    width: 18,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  dayCardImgEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: '#ffffff',
  },
  dayCardImgRange: {
    marginTop: 2,
    fontFamily: BrandFonts.medium,
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
  },
  dayCardText: { flex: 1 },
  /* Operator, 18 september 2026 ("fonts ook aanpassen, consistent, we
     hebben een blueprint"): was een losse `bold 15.5` — dit is letterlijk
     de rol die `TypeScale.compactCardTitle` beschrijft ("titel op een
     compacte, horizontale entry-kaart", zie constants/theme.ts), dus dat
     token i.p.v. een eigen maat. */
  dayCardHeadline: {
    ...TypeScale.compactCardTitle,
    color: C.text,
  },
  dayCardSub: {
    marginTop: 2,
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.5)',
  },
  dayCardAddMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dayCardAddMoreTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.85)',
  },
  /* Haarlijn tussen de header-rij en elke sessie-rij, en tussen
     sessie-rijen onderling — vervangt de eigen kaartrand die hier
     stond vóór alles in één `dayCard` samenkwam. */
  sessionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 8,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  sessionText: { flex: 1 },
  sessionState: {
    fontFamily: BrandFonts.bold,
    fontSize: 12.5,
    letterSpacing: 0.3,
  },
  sessionSub: {
    marginTop: 2,
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  removeBtn: { padding: 2 },

  /* Vervangt `addBtnDisabled` — de hele rij is nu de tap-target, dus die
     dimt zichzelf i.p.v. enkel de oude plusknop. */
  dayCardRowDisabled: { opacity: 0.4 },

  capNote: {
    marginTop: 4,
    marginBottom: 4,
    textAlign: 'center',
    fontSize: 11.5,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.4)',
  },

  /* Operator, 18/19 september 2026 ("sticky/floating button panel"):
     vaste laag onderaan, los van de ScrollView — zelfde patroon als
     plan-review.tsx. */
  ctaFloat: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 26,
  },
  cta: { ...CTA.container },
  ctaDisabled: CTA.disabled,
  ctaTxt: CTA.label,
});
