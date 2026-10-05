/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Your bracelet plan

   Operator, 30 september 2026 ("de agenda planning van breathwork en
   bracelet moet compleet apart"): stond eerder als een sectie ONDER
   breathwork's agenda.tsx, met de kalender van breathwork gedeeld. Nu een
   volledig eigen scherm, eigen state, geen gedeelde state met agenda.tsx —
   de twee "staan onder elkaar, niet door elkaar" tot en met de kalender
   zelf.

   Operator, 30 september 2026, vervolg ("kunnen we in your daily plan ook
   werken met cirkel? rond de cirkel tijd zoals bij breathwork, bolletjes
   in de juiste kleur op de juiste tijd, in de cirkel de datum, en
   mogelijkheid tot openen van de agenda waar per dag de ingestelde states
   staan"): de eerdere "bewust EENVOUDIGERE dag-navigatie"-beslissing
   (vorige/volgende-pijlen i.p.v. de RhythmRing) is hiermee herroepen —
   `RhythmRing` (components/RhythmRing.tsx) bleek bij nader onderzoek een
   VOLLEDIG generieke component zonder enige breathwork-koppeling (geen
   import van BREATH_STATES/plan-store), dus 1-op-1 hergebruikbaar i.p.v.
   nagebouwd. Wat WEL bracelet-eigen blijft (net als voorheen): geen
   gedeelde `selected`/`calendarOpen`-state met agenda.tsx, en de
   ring-middenzone toont hier de DATUM + plan-duur (tikbaar → kalender)
   i.p.v. breathwork's "Next sessie + aftellen" (`showCenterInfo={false}`,
   eigen laag erbovenop).

   Operator, vervolg ("onderaan standaard de 5 states, cirkel met uur
   erbij, in de cirkel ook duration van plan, kies welke sessie proberen"):
   drie losse toevoegingen, geen van alle bestond nog:
   - `itemLabelMode="time"` i.p.v. `"none"` — het uur staat nu bij elk
     bolletje op de ring, zelfde ingebouwde gedrag als agenda.tsx's eigen
     ring (dit was gewoon nog niet aangezet).
   - Ring-middenzone toont naast de datum ook de horizon
     ("Repeats · 1 week") — de duur van het PLAN, niet van een sessie.
   - Onderaan staan nu altijd alle 5 modi (`MODES`, vaste volgorde), elk
     met zijn geplande tijdstip(pen) die dag of "Not planned today" — een
     legenda die klopt met de ring, i.p.v. een lijst die alleen toont wat
     toevallig gepland staat.
   - Elk gepland tijdstip heeft nu een play-knop: start die EXACTE sessie
     (zelfde duur als gepland, geen aparte "30 sec proefrit") in de
     bestaande bracelet-control-simulatie via het al bestaande
     `?plan=1&mode=X&duration=Y`-deeplink-contract (bracelet-control.tsx's
     eigen `autoStartBracelet`/`planDurationMinutes`-logica, hier
     hergebruikt i.p.v. een tweede opstart-pad te verzinnen). Dit is de
     "echte volgende stap" in de free/simulated omgeving: een planning
     zonder fysieke armband is anders een dode configuratie — de gebruiker
     kan 'm hier voelen via de trilmotor-simulatie.
   - Titel "Your bracelet plan" verhuisd naast de terug-pijl (zelfde
     patroon als bracelet-set-day.tsx) — geeft de ring/legenda meer
     ruimte.

   Operator, vervolg ("moet anders: boost/sharp focus/... moet klein met
   kleurbolletje en naam. op de cirkel staan alle kleuren die de user
   gepland heeft al ingevuld. gebruiker kan de states aanklikken; bij
   aanklikken komt aan de cirkel het uur en aantal min van de states —
   bij 2-3x boost op 1 dag verschijnen de verschillende uren/minuten
   allemaal rond de cirkel. ook een zesde kaart met show all"): de grote
   modus-kaarten (icoon-badge + altijd-zichtbare tijden/play-knoppen) zijn
   vervangen door 6 kleine pillen (5 modi + "Show all") — kleurbolletje +
   naam, net als `HorizonChip`. De ring toont ZIJN bolletjes altijd (dat
   veranderde al niet), maar de UUR+DUUR-labels errond verschijnen nu pas
   na een tik op een pil: één modus geselecteerd → enkel DIE bolletjes
   krijgen een label (kan er meerdere zijn, elk zijn eigen tijdstip);
   "Show all" → alle bolletjes tegelijk. `RhythmRing`'s eigen
   `itemLabelMode` is daarvoor te grofmazig (alles-of-niets, geen per-
   modus filter) — de labels hier zijn daarom een eigen laag bovenop de
   ring (`itemLabelMode="none"`), met dezelfde hoek-wiskunde
   (`angleForMinutes`/`pointAt`) als de component zelf gebruikt.
   Tikken op een bolletje op de ring zelf (`onTapItem`) opent nu een klein
   actie-schermpje (Try it / Remove) i.p.v. enkel een highlight — de
   vroegere inline "Try it"/verwijder-knoppen per rij bestaan niet meer nu
   de kaarten klein zijn, dus die acties verhuisden hierheen.

   Opslag/sync: `bracelet-plan-store.ts` (`BraceletActivePlan`) +
   `syncBraceletPlanReminder` (services/reminders.ts) — zelfde bronnen als
   `/bracelet-set-day`, dat hier bereikbaar is via "Edit your plan".
   ───────────────────────────────────────────────────────────────────────── */

import { openStateControl } from '@/utils/state-control-ui';
import { AudioAccent, Brand, BrandFonts, TypeScale } from '@/constants/theme';
import RhythmRing, { type RhythmRingItem } from '@/components/RhythmRing';
import { MODES, getModeMeta, BraceletMode } from '@/services/ble-contract';
import { syncBraceletPlanReminder } from '@/services/reminders';
import {
  useActiveBraceletPlan,
  updateBraceletPlanDay,
  dayKey,
  rangesOverlap,
  type BraceletPlanDay,
} from '@/utils/bracelet-plan-store';
import { getFirstWeekday, leadingBlanks, weekdayLabels } from '@/utils/locale';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Pencil,
  Play,
  Watch,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Eigen label-laag bovenop de ring (zie de toelichting bovenaan dit
   bestand) — zelfde hoek-wiskunde als RhythmRing.tsx zelf, hier
   herhaald omdat de component die niet exporteert (bewust klein
   gehouden, geen publieke geometrie-API). `RING_SIZE` moet gelijk
   blijven aan de `size`-prop hieronder op `<RhythmRing>`. */
const RING_SIZE = 240;
const RING_OUTER_PAD = 40;
const RING_OUTER = RING_SIZE + RING_OUTER_PAD * 2;
const RING_CX = RING_OUTER / 2;
const RING_CY = RING_OUTER / 2;
const RING_DOT_RADIUS = RING_SIZE / 2 - 14;
const angleForMinutes = (mins: number) => ((mins % 1440) / 1440) * Math.PI * 2;
const pointAt = (angleRad: number, radius: number) => ({
  x: radius * Math.sin(angleRad),
  y: -radius * Math.cos(angleRad),
});

const HORIZON_LABEL: Record<string, string> = {
  today: 'Today only',
  '1w': '1 week',
  '2w': '2 weeks',
  '1m': '1 month',
  '3m': '3 months',
  ongoing: 'Ongoing',
};

/* Operator, 1 okt 2026 ("EU vs US kalender-formaat"): zie agenda.tsx's
   identieke toelichting + utils/locale.ts — vaste zondag-eerst volgorde
   vervangen door de echte eerste weekdag van het toestel. */
const FIRST_WEEKDAY = getFirstWeekday();
const WEEKDAY = weekdayLabels(FIRST_WEEKDAY);

const fmtTime = (mins: number) => {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

/* Eén dag-cirkel in de uitklapbare maand-kalender — 1-op-1 agenda.tsx's
   `MonthCell`, enkel de statusstip is hier eenvoudiger: bracelet houdt
   geen voltooiings-geschiedenis bij zoals breathwork (done/partial/
   missed), dus de stip zegt puur "hier staat een gepland dagje", geen
   kleurcode per afgeronde status. */
function MonthCell({
  date,
  isSelected,
  hasPlan,
  onPress,
}: {
  date: Date;
  isSelected: boolean;
  hasPlan: boolean;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));

  return (
    <AnimatedPressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[s.monthCell, pressStyle]}>
      <View style={[s.monthCircle, isSelected && s.monthCircleSel]}>
        <Text style={[s.monthNum, isSelected && { color: '#ffffff' }]}>{date.getDate()}</Text>
      </View>
      <View style={[s.monthDot, { backgroundColor: hasPlan ? 'rgba(255,255,255,0.55)' : 'transparent' }]} />
    </AnimatedPressable>
  );
}

/* Operator, 1 okt 2026 ("onderste pills moeten meer kleine beknopte
   kaarten worden"): van ronde pil naar een klein kaartje — zelfde
   lichte-witte-omlijning-selectieprotocol als voorheen (`chipOn`), nu
   op een kaart-vorm (14px radius, paneel-achtergrond+rand) i.p.v. een
   volledig ronde pil, in een 3-koloms grid (5 modi + "Show all" = 2
   nette rijen van 3). */
function StateCard({
  label,
  color,
  on,
  onPress,
}: {
  label: string;
  color?: string;
  on: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 1 - (1 - scale.value) * 5,
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120 });
      }}
      style={s.cardSlot}
    >
      <Animated.View style={[s.card, on && s.cardOn, pressStyle]}>
        {color ? (
          <View style={[s.cardDot, { backgroundColor: color }]} />
        ) : (
          <Layers size={15} color="rgba(255,255,255,0.6)" strokeWidth={2.4} />
        )}
        <Text style={[s.cardTxt, on && s.cardTxtOn]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function BraceletAgendaScreen() {
  const insets = useSafeAreaInsets();
  const { plan } = useActiveBraceletPlan();
  const [selected, setSelected] = useState(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  /* `filterMode`: welke modus (of 'all') momenteel zijn uur+duur-labels
     rond de ring toont — zie de toelichting bovenaan dit bestand.
     `actionItemIndex`: welke geplande sessie (index in `day.items`) zijn
     Try it/Remove-schermpje open staat, na een tik op een bolletje. */
  const [filterMode, setFilterMode] = useState<BraceletMode | 'all' | null>(null);
  const [actionItemIndex, setActionItemIndex] = useState<number | null>(null);
  const selectedKey = dayKey(selected);
  const todayKey = dayKey(new Date());
  const day: BraceletPlanDay | null = plan?.days[selectedKey] ?? null;

  const ringItems: RhythmRingItem[] = useMemo(() => {
    if (!day) return [];
    return day.items.map((it, i) => {
      const meta = getModeMeta(it.mode as BraceletMode);
      return {
        key: `${i}`,
        reminderAt: it.reminderAt,
        minutes: it.durationMinutes,
        color: meta.color,
        label: meta.name,
      };
    });
  }, [day]);

  const monthCells = useMemo(() => {
    const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const lead = leadingBlanks(first, FIRST_WEEKDAY);
    const daysInMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(selected.getFullYear(), selected.getMonth(), d));
    return cells;
  }, [selected]);

  const removeItem = async (index: number) => {
    if (!day || !plan) return;
    Haptics.selectionAsync();
    const updated: BraceletPlanDay = {
      dayKey: day.dayKey,
      items: day.items.filter((_, i) => i !== index),
    };
    await updateBraceletPlanDay(updated);
    /* Enkel VANDAAG's dag bepaalt de geplande meldingen — zie de
       toelichting bij `syncBraceletPlanReminder`. `plan` uit deze
       render-closure is nog de OUDE staat, dus de bijgewerkte dag zelf
       meegeven i.p.v. daarop te vertrouwen. */
    if (selectedKey === todayKey) {
      await syncBraceletPlanReminder({ ...plan, days: { ...plan.days, [selectedKey]: updated } });
    }
  };

  /* Operator, 30 september 2026 ("mag nooit aparte states en 2 zelfde
     momenten kunnen kiezen, ook rekening houden met de duur"): slepen op
     de ring mag een sessie niet bovenop een andere sessie diezelfde dag
     laten landen — zelfde regel als bracelet-set-day.tsx, hier gedeeld
     via `rangesOverlap`. Bij een botsing een korte waarschuwings-tik i.p.v.
     de sleep stilzwijgend te negeren (de ring zelf springt vanzelf terug
     naar de oude tijd, want de state hier verandert dan niet). */
  const onDragEnd = async (key: string, newReminderAt: number) => {
    if (!day || !plan) return;
    const index = Number(key);
    const moved = day.items[index];
    if (!moved) return;
    const conflict = day.items.some(
      (it, i) => i !== index && rangesOverlap(newReminderAt, moved.durationMinutes, it.reminderAt, it.durationMinutes),
    );
    if (conflict) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    const updated: BraceletPlanDay = {
      dayKey: day.dayKey,
      items: day.items.map((it, i) => (i === index ? { ...it, reminderAt: newReminderAt } : it)),
    };
    await updateBraceletPlanDay(updated);
    if (selectedKey === todayKey) {
      await syncBraceletPlanReminder({ ...plan, days: { ...plan.days, [selectedKey]: updated } });
    }
  };

  /* Operator, 30 september 2026 ("kies welke sessie 30 seconden proberen,
     of misschien 1 volledige sessie"): volledige sessie, geen aparte
     korte proefrit — de gebruiker koos de duur al bewust bij het bouwen
     van de planning. Hergebruikt bracelet-control.tsx's bestaande
     `?plan=1&mode=X&duration=Y`-deeplink (dezelfde die de connectie-
     onboarding al gebruikt), start meteen de simulatie op de telefoon se
     eigen trilmotor. */
  const tryItem = (mode: BraceletMode, durationMinutes: number) => {
    Haptics.selectionAsync();
    /* Operator, 1 okt 2026 ("back komt op de connect-pagina, niet ok"):
       `from=plan` laat bracelet-control.tsx's back-knop echt hierheen
       terugnavigeren i.p.v. terugvallen op het owner/inline connect-
       scherm-gedrag — zie de toelichting daar bij `fromContext`. */
    openStateControl({ plan: 1, mode, duration: durationMinutes, from: 'plan' });
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Operator, 1 okt 2026 ("backpijlen/headers moeten overal
         consistent zijn, zoals Apple dat doet"): van een inline-links
         titel naar een echte 3-zone gecentreerde balk (pijl/titel/lege
         spacer) — zelfde opzet als plan.tsx/breathwork-agenda.tsx/
         plan-summary.tsx. Pijl-specificatie: size 20/strokeWidth 2.8 —
         operator's eigen 18-sept-reden in build-choice.tsx ("officiële
         iOS-chevron.backward i.p.v. dunne, langgerekte Android-pijl")
         is de app-brede standaard geworden, niet de 22/2.2-variant. */}
      <View style={s.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.back}>
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.8} />
        </Pressable>
        <Text style={s.barTitle} numberOfLines={1}>
          Your State Control plan
        </Text>
        <View style={s.back} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: Math.max(insets.bottom, 14) + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {!plan ? (
          <View style={s.emptyWrap}>
            <Watch size={22} color="rgba(255,255,255,0.3)" strokeWidth={2} />
            <Text style={s.emptyT}>No State Control plan yet</Text>
            <Text style={s.emptyB}>Choose your states and times to get started.</Text>
          </View>
        ) : (
          <>
            {/* Operator, 5 okt 2026 ("doe zoals bij breathwork"): zelfde
               opbouw als agenda.tsx — datumregel met uitklapbare kalender
               BOVEN de ring (met Done, zodat hij altijd te sluiten is), en
               in de ring: standaard de eerstvolgende sessie, of na een tik
               op een modus-kaart alle tijden van die modus in het midden
               terwijl hun bolletjes oplichten. Vervangt de losse uur-labels
               rond de ring en de datum in het midden. */}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setCalendarOpen((o) => !o);
              }}
              style={s.dateRow}
              hitSlop={8}
            >
              <Text style={s.dateRowTxt}>
                {selectedKey === todayKey
                  ? 'Today'
                  : selected.toLocaleDateString([], { month: 'long', day: 'numeric' })}
              </Text>
              <Text style={s.dateRowSub}> · {HORIZON_LABEL[plan.horizon] ?? plan.horizon}</Text>
              <ChevronDown
                size={16}
                color="rgba(255,255,255,0.7)"
                strokeWidth={2.6}
                style={calendarOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
              />
            </Pressable>

            {calendarOpen && (
              <View style={s.calendarDropdown}>
                <View style={s.calendarDoneRow}>
                  <Pressable onPress={() => setCalendarOpen(false)} hitSlop={10}>
                    <Text style={s.calendarDoneTxt}>Done</Text>
                  </Pressable>
                </View>
                <View style={s.monthNav}>
                  <Pressable
                    onPress={() => {
                      const d = new Date(selected);
                      d.setMonth(d.getMonth() - 1);
                      setSelected(d);
                    }}
                    hitSlop={10}
                  >
                    <ChevronLeft size={18} color="rgba(255,255,255,0.6)" strokeWidth={2.2} />
                  </Pressable>
                  <Text style={s.monthNavTxt}>
                    {selected.toLocaleDateString([], { month: 'long', year: 'numeric' })}
                  </Text>
                  <Pressable
                    onPress={() => {
                      const d = new Date(selected);
                      d.setMonth(d.getMonth() + 1);
                      setSelected(d);
                    }}
                    hitSlop={10}
                  >
                    <ChevronRight size={18} color="rgba(255,255,255,0.6)" strokeWidth={2.2} />
                  </Pressable>
                </View>
                <View style={s.monthGrid}>
                  {WEEKDAY.map((w, i) => (
                    <Text key={`h-${i}`} style={s.monthHeadTxt}>{w}</Text>
                  ))}
                  {monthCells.map((d, i) => {
                    if (!d) return <View key={i} style={s.monthCell} />;
                    const dk = dayKey(d);
                    const hasPlan = (plan?.days[dk]?.items.length ?? 0) > 0;
                    return (
                      <MonthCell
                        key={i}
                        date={d}
                        isSelected={dk === selectedKey}
                        hasPlan={hasPlan}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelected(d);
                          setCalendarOpen(false);
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            )}

            <View style={s.ringWrap}>
              {(() => {
                const filteredItems =
                  filterMode !== null && filterMode !== 'all'
                    ? ringItems.filter((_, i) => day?.items[i]?.mode === filterMode)
                    : null;
                return (
                  <RhythmRing
                    size={RING_SIZE}
                    items={ringItems}
                    isToday={selectedKey === todayKey}
                    now={new Date()}
                    onTapItem={(key) => {
                      Haptics.selectionAsync();
                      setActionItemIndex(Number(key));
                    }}
                    onDragEnd={(key, newReminderAt) => void onDragEnd(key, newReminderAt)}
                    itemLabelMode="none"
                    selectedKey={actionItemIndex !== null ? `${actionItemIndex}` : undefined}
                    selectedKeys={filteredItems?.map((it) => it.key)}
                    centerItems={filteredItems}
                  />
                );
              })()}
            </View>

            {/* Operator, 1 okt 2026 ("niet duidelijk of je op de bollen
               moet drukken"): korte hint boven de kaarten — de bolletjes
               op de ring zelf zijn ook tikbaar (Try it/Remove), niet
               enkel deze kaarten. */}
            <Text style={s.ringHint}>Tap a dot on the ring to start or remove that session</Text>

            {/* Kaarten — 5 modi + "Show all", zie de toelichting bovenaan
               dit bestand. Kiest WELKE uur+duur-labels op de ring
               verschijnen, niets meer — de bolletjes zelf staan er al
               altijd, ongeacht selectie. */}
            <View style={s.cardGrid}>
              {MODES.map((m) => (
                <StateCard
                  key={m.mode}
                  label={m.name}
                  color={m.color}
                  on={filterMode === m.mode}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFilterMode((prev) => (prev === m.mode ? null : m.mode));
                  }}
                />
              ))}
              {/* Zoals breathwork: terug naar de standaardweergave (de
                  eerstvolgende sessie in het midden) i.p.v. "Show all". */}
              <StateCard
                label="Your next session"
                on={filterMode === null}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilterMode(null);
                }}
              />
            </View>
          </>
        )}

        <Pressable style={s.editLink} onPress={() => router.push('/bracelet-set-day' as never)}>
          <Pencil size={12} color="rgba(255,255,255,0.55)" strokeWidth={2.2} />
          <Text style={s.editLinkTxt}>{plan ? 'Edit your plan' : 'Set your plan'}</Text>
        </Pressable>
      </ScrollView>

      {/* Actie-schermpje voor een aangetikt bolletje op de ring — "Try
         it" (volledige sessie in de bracelet-control-simulatie) en
         "Remove", zie de toelichting bovenaan dit bestand. */}
      {actionItemIndex !== null && day?.items[actionItemIndex] && (() => {
        const item = day.items[actionItemIndex];
        const meta = getModeMeta(item.mode as BraceletMode);
        return (
          <Modal visible transparent animationType="fade" onRequestClose={() => setActionItemIndex(null)}>
            <Pressable style={s.pickBackdrop} onPress={() => setActionItemIndex(null)}>
              <Pressable
                style={[s.pickSheet, { paddingBottom: Math.max(insets.bottom, 14) + 14 }]}
                onPress={() => {}}
              >
                <View style={s.pickHandle} />
                <View style={s.actionHead}>
                  <View style={[s.actionDot, { backgroundColor: meta.color }]} />
                  <View>
                    <Text style={s.actionTitle}>{meta.name}</Text>
                    <Text style={s.actionSub}>
                      {fmtTime(item.reminderAt)} · {item.durationMinutes} min
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={s.actionPlayBtn}
                  onPress={() => {
                    tryItem(item.mode as BraceletMode, item.durationMinutes);
                    setActionItemIndex(null);
                  }}
                >
                  <Play size={14} color="#1D1D1F" strokeWidth={2.4} fill="#1D1D1F" />
                  {/* Operator, 1 okt 2026 ("try it now misschien anders,
                     wat is ux regel"): consistentie — elders (breathwork)
                     heet dit overal "Start session", nooit "Try". Dit
                     start bovendien de ECHTE geplande sessie, geen korte
                     proef — "Try" was dus ook inhoudelijk misleidend. */}
                  <Text style={s.actionPlayTxt}>Start session</Text>
                </Pressable>
                <Pressable
                  style={s.actionRemoveBtn}
                  onPress={() => {
                    void removeItem(actionItemIndex);
                    setActionItemIndex(null);
                  }}
                >
                  <Text style={s.actionRemoveTxt}>Remove from plan</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        );
      })()}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  /* Operator, 30 september 2026 ("kan Your bracelet plan naast de pijl?
     zo hebben we meer ruimte"): zelfde patroon als bracelet-set-day.tsx's
     `barTitle` — titel inline in de terug-balk i.p.v. een losse
     `pageHeader` eronder, geeft de ring/legenda meer verticale ruimte. */
  barTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: '#ffffff',
  },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  /* Kalender-dropdown — 1-op-1 agenda.tsx's `calendarDropdown`/`monthNav`/
     `monthGrid`/`monthCell`/`monthCircle`/`monthDot`, exact dezelfde
     maten (de trigger is hier `ringCenter`, niet een losse datumregel). */
  calendarDropdown: {
    marginBottom: 18,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  monthNavTxt: { fontFamily: BrandFonts.semibold, fontSize: 14.5, color: '#ffffff' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  monthHeadTxt: {
    width: `${100 / 7}%` as const,
    textAlign: 'center',
    fontFamily: BrandFonts.semibold,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 4,
  },
  monthCell: { width: `${100 / 7}%` as const, alignItems: 'center', marginBottom: 4, gap: 2 },
  monthCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  monthCircleSel: { backgroundColor: 'rgba(255,255,255,0.14)' },
  monthNum: { fontFamily: BrandFonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  monthDot: { width: 5, height: 5, borderRadius: 2.5 },

  ringWrap: { alignItems: 'center', marginTop: 12, marginBottom: 22, position: 'relative' },
  /* Zelfde datumregel als agenda.tsx (breathwork). */
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  dateRowTxt: { fontFamily: BrandFonts.semibold, fontSize: 17, color: '#ffffff' },
  dateRowSub: { fontFamily: BrandFonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  calendarDoneRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 },
  calendarDoneTxt: { fontFamily: BrandFonts.semibold, fontSize: 13.5, color: AudioAccent },
  /* Datum + plan-duur in de cirkel — zelfde verticale plek (`top:'38%'`)
     als RhythmRing's eigen (hier uitgeschakelde) middenzone. */


  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyT: { fontFamily: BrandFonts.bold, fontSize: 15, color: '#ffffff' },
  emptyB: {
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },

  /* Operator, 1 okt 2026 ("niet duidelijk of je op de bollen moet
     drukken"): hint tussen ring en kaarten, gecentreerd, gedimd —
     dezelfde toon als `emptyB` hierboven. */
  ringHint: {
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginBottom: 14,
  },

  /* Operator, 1 okt 2026 ("vierkant, bolletje groter linksboven, tekst
     links onder, zoals we altijd hebben gedaan"): zelfde indeling als
     `ModeTile` in bracelet-set-day.tsx (badge boven, naam onder, links
     uitgelijnd) — nu toegepast op deze kleinere kaart i.p.v. de vorige
     rij-indeling (dot+naam naast elkaar). `aspectRatio: 1` + vaste
     `cardSlot`-breedte houdt alle 6 kaarten exact even groot, ongeacht
     hoeveel regels de naam nodig heeft (`flex-end` duwt de tekst altijd
     naar de onderkant). 3-koloms grid, `cardSlot` draagt de breedte
     zodat de press-animatie op `card` zelf de layout niet verstoort. */
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cardSlot: { width: '31.5%' },
  card: {
    aspectRatio: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardOn: { borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.1)' },
  cardDot: { width: 15, height: 15, borderRadius: 7.5 },
  cardTxt: { fontFamily: BrandFonts.medium, fontSize: 12.5, lineHeight: 15, color: 'rgba(255,255,255,0.65)' },
  cardTxtOn: { color: '#ffffff', fontFamily: BrandFonts.semibold },

  /* Uur+duur-label rond de ring — zelfde maat/plek als RhythmRing's eigen
     (hier uitgeschakelde) `dotLabel`. Operator, 1 okt 2026: "min" (niet
     "minutes") is de staande afspraak voor duur overal in de app — de
     "geen afkortingen"-regel ging over afgekapte NAMEN met "…", niet
     over deze eenheid. 2 regels (tijd/duur) i.p.v. voorheen "20m" op één
     regel, gewoon omdat dat leesbaarder staat op de ring. */
  ringLabel: {
    position: 'absolute',
    width: 68,
    textAlign: 'center',
    fontFamily: BrandFonts.bold,
    fontSize: 11.5,
    lineHeight: 14,
  },

  /* Actie-schermpje (Try it/Remove) — 1-op-1 het `pickBackdrop`/
     `pickSheet`/`pickHandle`-protocol dat bracelet-set-day.tsx al
     gebruikt voor zijn "Your plan"-popup. */
  pickBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  pickSheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'stretch',
  },
  pickHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  actionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  actionDot: { width: 14, height: 14, borderRadius: 7 },
  actionTitle: { ...TypeScale.compactCardTitle, color: '#ffffff' },
  actionSub: { marginTop: 2, ...TypeScale.cardDetail, color: 'rgba(255,255,255,0.5)' },
  actionPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
  },
  actionPlayTxt: { fontFamily: BrandFonts.bold, fontSize: 15, color: '#1D1D1F' },
  actionRemoveBtn: { alignItems: 'center', paddingVertical: 16 },
  actionRemoveTxt: { fontFamily: BrandFonts.medium, fontSize: 14, color: Brand.error },

  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 18,
  },
  editLinkTxt: { fontFamily: BrandFonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.55)' },
});
