/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Herinneringen

   Het grootste gat tegenover Othership en Open: die sturen dagelijks een
   bericht, wij stuurden er nul. Een ademsessie duurt drie minuten; het
   probleem is nooit de tijd maar het momént waarop je eraan denkt.

   ── Drie vaste momenten, geen tijdkiezer ──────────────────────────────
   Een vrije tijdkiezer vraagt een extra pakket en een scherm, en levert een
   keuze op waar niemand over nadenkt. Drie momenten sluiten bovendien aan op
   de suggestie-logica die er al is (utils/breath-suggestion.ts): 's ochtends
   activeren, overdag herstellen, 's avonds afbouwen. Wie alle drie aanzet
   krijgt drie berichten; wie er één aanzet krijgt er één.

   ── De toon ──────────────────────────────────────────────────────────
   Geen aansporing, geen schuldgevoel, geen streak-dreiging. Een bericht
   meldt dat er iets klaarstaat, meer niet — "Your evening reset is ready".
   Wie zich schuldig voelt over een gemiste dag opent de app niet vaker maar
   minder.

   Alleen toestand-taal, geen claims over wat ademen met je lichaam doet
   (CLAUDE.md §1).
   ───────────────────────────────────────────────────────────────────────── */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { pickStatesForDay, reasonForPick } from '@/utils/day-plan';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { dayKey } from '@/utils/bracelet-history';
import type { ActivePlan } from '@/utils/plan-store';
import { getModeMeta, type BraceletMode } from '@/services/ble-contract';

/* Operator, 11 september 2026: nieuw vierde moment "after work / on the
   way home" — zie utils/day-plan.ts se `DAY_CANDIDATES` voor de volledige
   toelichting. Bestaande `evening` (21:00, "Time to wind down") verandert
   niet van betekenis of tijdstip — dat blijft het vlak-voor-slapen-moment;
   `afterWork` is nieuw en zit er qua tijd vóór. */
export type ReminderSlot = 'morning' | 'midday' | 'afterWork' | 'evening';

/* Voor welke ACTIVITEIT een herinnering geldt (operator, 6 augustus 2026).
   Breathwork en bracelet zijn twee verschillende dingen om aan herinnerd te
   worden: het ene vraagt vijf minuten en aandacht, het andere vraagt dat je
   op één knop drukt. Ze delen dus geen schakelaar.

   De sleutel in Settings wordt `breath:evening` of `bracelet:morning`, zodat
   beide onafhankelijk aan en uit kunnen.

   Operator, 29 september 2026 ("set daily plan... start dagelijks
   automatisch"): `'bracelet-plan'` erbij — apart van het generieke
   `'bracelet'` (dat opent enkel de Bracelet-tab). Een dagplan-melding kent
   al de exacte modus + duur, dus die MOET rechtstreeks naar
   `/bracelet-control` met die waarden vooraf ingevuld — geen eigen
   ReminderSlot nodig, het is 1 vast tijdstip per dag, geen 4 momenten. */
export type ReminderKind = 'breath' | 'bracelet' | 'bracelet-plan';

export const reminderKey = (kind: ReminderKind, slot: ReminderSlot) =>
  `${kind}:${slot}`;

type SlotDef = {
  slot: ReminderSlot;
  hour: number;
  label: string;
  when: string;
  title: string;
  body: string;
};

/* Binnen welke uren een moment mag vallen. Grenzen, geen vrije keuze: een
   "ochtend"-herinnering om elf uur 's avonds is geen instelling maar een
   fout, en die hoort de app niet mogelijk te maken. */
export const SLOT_RANGE: Record<ReminderSlot, [number, number]> = {
  morning: [5, 11],
  midday: [11, 17],
  afterWork: [17, 20],
  evening: [20, 23],
};

export const SLOTS: SlotDef[] = [
  {
    slot: 'morning',
    hour: 8,
    label: 'Morning',
    when: '08:00',
    title: 'Set the tone',
    body: 'Three minutes before the day takes over.',
  },
  {
    slot: 'midday',
    hour: 13,
    label: 'Midday',
    when: '13:00',
    title: 'Your midday reset is ready',
    body: 'Come back to steady before the afternoon.',
  },
  {
    slot: 'afterWork',
    hour: 18,
    label: 'After work',
    when: '18:00',
    title: 'On your way home',
    body: 'A few minutes to leave the day behind you.',
  },
  {
    slot: 'evening',
    hour: 21,
    label: 'Evening',
    when: '21:00',
    title: 'Time to wind down',
    body: 'The slowest breath of the day is waiting.',
  },
];

/* Eén vaste sleutel per moment, zodat opnieuw plannen de oude vervangt in
   plaats van er een tweede naast te zetten. Zonder dit krijgt iemand na een
   week zeven avondberichten. */
const idFor = (kind: ReminderKind, slot: ReminderSlot) =>
  `vzc-${kind}-${slot}`;

/** Vraagt toestemming. Geeft `false` terug als de gebruiker weigert — dan
 *  hoort de schakelaar in Settings terug te springen in plaats van te doen
 *  alsof er iets gepland staat. */
export async function ensurePermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

async function cancel(kind: ReminderKind, slot: ReminderSlot): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(idFor(kind, slot));
  } catch {
    /* stond er niet — prima */
  }
}

/* Gedeeld tussen syncReminders() en syncPlanReminders() — beide plannen op
   hetzelfde Android-kanaal, dus één plek die het aanmaakt. */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      description: 'Your breathwork and bracelet moments.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 40],
      sound: null,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {}
}

/* "SLEEP" -> "Sleep" — de `eyebrow`-namen in breath-states.ts
   zijn in hoofdletters voor op het sessiescherm, niet voor in een
   meldingstitel. Korte woorden ("&") blijven ongemoeid. */
function titleCase(s: string): string {
  return s
    .split(' ')
    .map((w) => (w.length <= 2 ? w : w[0] + w.slice(1).toLowerCase()))
    .join(' ');
}

/** Zet de geplande berichten gelijk aan wat er in Settings staat.
 *
 *  Werkt met de VOLLEDIGE lijst en niet met losse aan/uit-opdrachten: zo kan
 *  wat er gepland staat niet uit de pas lopen met wat de gebruiker ziet, ook
 *  niet na een herinstallatie of een geweigerde toestemming. */
export async function syncReminders(
  enabled: Record<string, boolean>,
  /** Minuten na middernacht per sleutel. */
  at: Record<string, number> = {},
  /** Doelen van de gebruiker (operator, 13 augustus 2026: de melding-tekst
   *  was vast, los van welke toestand het plan voor dat moment koos —
   *  onderdeel van dezelfde klacht als de dode Breath-tab-suggestie). Leeg
   *  = dezelfde generieke tekst als voorheen, dus bestaande aanroepers die
   *  dit niet meegeven breken niet. */
  goals: string[] = [],
): Promise<void> {
  const kinds: ReminderKind[] = ['breath', 'bracelet'];
  const wantsAny = kinds.some((k) =>
    SLOTS.some((s) => enabled[reminderKey(k, s.slot)]),
  );
  if (wantsAny && !(await ensurePermission())) return;

  /* Een NIEUWE kanaalnaam, want Android bevriest een kanaal zodra het
     bestaat: wie de oude 'breath' had, hield voor altijd de oude
     instellingen (operator, 7 augustus 2026). HIGH toont de melding over
     het scherm en op het vergrendelscherm; geluid blijft uit. */
  await ensureAndroidChannel();

  /* Dezelfde motor als /plan.tsx (utils/day-plan.ts) — ÉÉN keer voor alle
     drie de sloten doorgerekend. Zo kan de meldingstekst nooit iets anders
     beloven dan wat de gebruiker in de app zelf ziet staan.

     Operator, 11 september 2026: "het gaat over heel systeem" — dit was
     nog de oude slot-voor-slot `pickForSlot` + "niet gelijk aan vorige"-
     regel (zelfde constructiefout als de protocol-generator, zie
     utils/protocol.ts): bij twee doelen die op rang 1 gelijk staan
     pingpongt dat tussen precies die twee toestanden i.p.v. de dag echt
     te variëren. `pickStatesForDay` kiest de hele dag in één keer. */
  const pickedFor = pickStatesForDay(
    SLOTS.map((s) => s.slot),
    goals,
  ) as Record<ReminderSlot, BreathStateKey>;

  for (const k of kinds) {
   for (const s of SLOTS) {
    await cancel(k, s.slot);
    if (!enabled[reminderKey(k, s.slot)]) continue;
    /* Doel-bewuste tekst voor breath, alleen als er ook echt een doel
       gekozen is — zonder doel blijft de oorspronkelijke, generieke
       toon staan (die was al goed voor "hier staat iets klaar", zonder
       een reden te verzinnen die er niet is). */
    const picked = pickedFor[s.slot];
    const st = BREATH_STATES[picked];
    const why = goals.length > 0 ? reasonForPick(picked, goals, s.label) : null;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: idFor(k, s.slot),
        content: {
          /* De melding ÍS de vraag: tikken opent meteen de juiste sessie.
             Geen bevestiging in de app erna — wie niet wil, veegt hem weg, en
             dat is het antwoord "nee". */
          title:
            k === 'breath'
              ? why
                ? `Your ${titleCase(st.eyebrow)} session is ready`
                : s.title
              : 'Your bracelet is ready',
          body:
            k === 'breath'
              ? why
                ? `${why} — ${st.durations[st.defaultDuration].minutes} min.`
                : s.body
              : 'One press. No screen, no sound, no effort.',
          /* Waar een tik naartoe moet. Zonder dit opent de app op het
             welkomstscherm en is er van de herinnering niets meer terug te
             vinden — precies de klacht van de operator (7 augustus 2026). */
          /* `state` erbij (operator, 13 augustus 2026: "de link naar de app
             gaat maar naar verkeerde scherm en modus") — zonder dit wist een
             tik alleen dat het om 'breath' ging, en opende de generieke tab
             die op zijn eigen standaard landt (Calm Control), niet op de
             toestand die de melding zelf net beloofde. */
          data: { kind: k, slot: s.slot, state: k === 'breath' ? picked : undefined },
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          /* De gekozen tijd, anders het standaarduur van dit moment. `% 24`
             op het uur (operator, 10 augustus 2026: de avondkeuze loopt nu
             door tot 3:45 's nachts). Zonder die modulo werd 25:00
             doorgegeven aan een dagelijkse trigger die alleen 0-23 kent —
             dat plant geen wekker op 1 uur 's nachts, dat plant hem
             helemaal niet. */
          hour:
            Math.floor((at[reminderKey(k, s.slot)] ?? s.hour * 60) / 60) % 24,
          minute: (at[reminderKey(k, s.slot)] ?? s.hour * 60) % 60,
        },
      });
    } catch {
      /* Eén moment dat niet lukt mag de andere niet meeslepen. */
    }
   }
  }
}

/* Operator, 17 september 2026 ("Bouw je dag" — meerdere sessies toegestaan
   in hetzelfde dagdeel): dit was per SLOT geïdentificeerd
   (`vzc-plan-${slot}-${n}`), wat werkte zolang elk dagdeel hoogstens één
   item droeg. Zodra een dagdeel er twee kan hebben, overschrijft de tweede
   `scheduleNotificationAsync` gewoon de eerste (Expo's `identifier` is een
   unieke sleutel) — de eerste sessie in dat dagdeel verliest stilzwijgend
   zijn melding. Nu per POSITIE in `today.items` i.p.v. per slot; een vaste
   bovengrens (`MAX_PLAN_ITEMS`) i.p.v. de 4 vaste dagdelen om bij het
   opruimen ook oudere, langere dagen volledig te annuleren. */
export const MAX_PLAN_ITEMS = 8;
const planIdFor = (index: number, n: 1 | 2) => `vzc-plan-${index}-${n}`;

/** Herinneringen voor een ACTIEF protocol (operator, 13 augustus 2026,
 *  protocol-systeem) — schedult per moment van VANDAAG's dag uit het plan
 *  (de template herhaalt zich toch identiek elke dag, zie protocol.ts, dus
 *  vandaag volstaat als bron voor de dagelijkse trigger-tijd). Gebruikt
 *  dezelfde doel-bewuste titel/body-logica als syncReminders(), plus PRECIES
 *  één extra, zachte melding 15 minuten later — geen derde, geen
 *  streak-dreiging (zie de toon-regel bovenaan dit bestand). `null` = geen
 *  actief protocol → alles opruimen. */
export async function syncPlanReminders(plan: ActivePlan | null): Promise<void> {
  for (let i = 0; i < MAX_PLAN_ITEMS; i += 1) {
    try {
      await Notifications.cancelScheduledNotificationAsync(planIdFor(i, 1));
      await Notifications.cancelScheduledNotificationAsync(planIdFor(i, 2));
    } catch {}
  }
  if (!plan) return;

  const today = plan.days[dayKey(new Date())];
  if (!today || today.items.length === 0) return;
  if (!(await ensurePermission())) return;
  await ensureAndroidChannel();

  for (const [index, it] of today.items.entries()) {
    /* Bovengrens deelt de cancel-loop hierboven — een item erbuiten zou bij
       de volgende sync nooit meer geannuleerd kunnen worden. */
    if (index >= MAX_PLAN_ITEMS) break;
    const st = BREATH_STATES[it.state];
    const slotDef = SLOTS.find((s) => s.slot === it.slot);
    const why = reasonForPick(it.state, plan.goals, slotDef?.label ?? it.slot);
    const hour = Math.floor(it.reminderAt / 60) % 24;
    const minute = it.reminderAt % 60;
    const second = it.reminderAt + 15;
    const hour2 = Math.floor(second / 60) % 24;
    const minute2 = second % 60;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: planIdFor(index, 1),
        content: {
          title: `Your ${titleCase(st.eyebrow)} session is ready`,
          body: `${why} — ${it.minutes} min.`,
          data: { kind: 'breath', slot: it.slot, state: it.state },
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
      await Notifications.scheduleNotificationAsync({
        identifier: planIdFor(index, 2),
        content: {
          /* Zacht, geen schuldgevoel — meldt alleen dat het er nog staat. */
          title: 'Still time for your session today',
          body: `${titleCase(st.eyebrow)} — ${it.minutes} min, whenever you're ready.`,
          data: { kind: 'breath', slot: it.slot, state: it.state },
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hour2, minute: minute2 },
      });
    } catch {
      /* Eén moment dat niet lukt mag de andere niet meeslepen. */
    }
  }
}

/* Operator, 29 september 2026 ("een echte pagina... horizon kunnen
   kiezen... per dag individueel... zolang je wil laten doorlopen"): de
   vorige, platte "1 dag vaste sessies"-opslag is vervangen door
   `bracelet-plan-store.ts`'s `BraceletActivePlan` (horizon + per-dag
   `items[]`, zelfde architectuur als breathwork's `plan-store.ts`). Deze
   functie leest — net als `syncPlanReminders` hierboven — VANDAAG's
   `BraceletPlanDay` uit dat plan (de template herhaalt zich toch
   identiek elke dag tenzij de gebruiker een specifieke dag via
   agenda.tsx afwijkend maakt, dus vandaag volstaat als bron voor de
   dagelijkse trigger-tijd). */
export const MAX_BRACELET_SESSIONS = 8;
const braceletPlanIdFor = (index: number, n: 1 | 2) => `vzc-bracelet-plan-${index}-${n}`;

/** Herinneringen voor het actieve bracelet-plan — zelfde patroon als
 *  `syncPlanReminders` hierboven: per sessie van VANDAAG precies één
 *  hoofdmelding + één zachte herinnering 15 minuten later, geen derde,
 *  geen streak-dreiging (zie de toon-regel bovenaan dit bestand). `null`
 *  = alles opruimen. */
export async function syncBraceletPlanReminder(
  plan: { days: Record<string, { dayKey: string; items: { mode: number; durationMinutes: number; reminderAt: number }[] }> } | null,
): Promise<void> {
  for (let i = 0; i < MAX_BRACELET_SESSIONS; i += 1) {
    try {
      await Notifications.cancelScheduledNotificationAsync(braceletPlanIdFor(i, 1));
      await Notifications.cancelScheduledNotificationAsync(braceletPlanIdFor(i, 2));
    } catch {}
  }
  const today = plan?.days[dayKey(new Date())];
  if (!today || today.items.length === 0) return;
  if (!(await ensurePermission())) return;
  await ensureAndroidChannel();

  for (const [index, item] of today.items.entries()) {
    if (index >= MAX_BRACELET_SESSIONS) break;
    const meta = getModeMeta(item.mode as BraceletMode);
    const hour = Math.floor(item.reminderAt / 60) % 24;
    const minute = item.reminderAt % 60;
    const second = item.reminderAt + 15;
    const hour2 = Math.floor(second / 60) % 24;
    const minute2 = second % 60;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: braceletPlanIdFor(index, 1),
        content: {
          /* De melding ÍS de vraag: tikken opent meteen /bracelet-control
             met modus+duur al ingevuld, verbonden en klaar — 1 tik op
             Resume i.p.v. een hele flow. Zie
             `reminderRoute`/`reminderParams`. */
          title: `Your ${meta.name} session is ready`,
          body: 'One press. No screen, no sound, no effort.',
          data: {
            kind: 'bracelet-plan',
            braceletMode: item.mode,
            braceletDuration: item.durationMinutes,
          },
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
      await Notifications.scheduleNotificationAsync({
        identifier: braceletPlanIdFor(index, 2),
        content: {
          title: 'Still time for your bracelet session',
          body: `${meta.name} — ${item.durationMinutes} min, whenever you're ready.`,
          data: {
            kind: 'bracelet-plan',
            braceletMode: item.mode,
            braceletDuration: item.durationMinutes,
          },
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hour2,
          minute: minute2,
        },
      });
    } catch {
      /* Eén sessie die niet lukt mag de andere niet meeslepen. */
    }
  }
}

/* ── Wat er gebeurt als je op de melding tikt ──────────────────────────
   De melding IS de vraag; tikken hoort meteen op de juiste plek uit te komen.
   Dat stond hier als bedoeling beschreven maar was nooit aangesloten: er
   luisterde niemand naar de tik, dus je kwam op het welkomstscherm terecht en
   zag nergens meer waarom je de app geopend had.

   Twee wegen naar binnen, en ze zijn allebei nodig:
   · de app stond UIT      → `tappedReminderOnLaunch` bij het opstarten
   · de app stond op de achtergrond → `onReminderTap`, live                */

export type TappedReminder = {
  kind: ReminderKind;
  slot?: ReminderSlot;
  /** De exacte toestand die de melding beloofde (operator, 13 augustus
   *  2026: "de link gaat naar verkeerde scherm en modus"). Zonder dit
   *  opende een tik alleen de generieke Breath-tab, die op zijn eigen
   *  standaard landt — nooit per se de toestand uit de melding. */
  state?: BreathStateKey;
  /** Tik op de LOPENDE-sessie-melding (5 okt 2026): meteen naar de sessie,
   *  niet naar het State Control-intro. */
  session?: boolean;
  /** Enkel bij `kind === 'bracelet-plan'` — de exacte modus/duur die de
   *  melding beloofde, zie `syncBraceletPlanReminder`. */
  braceletMode?: number;
  braceletDuration?: number;
};

/* Waarheen per soort. Een breath-melding met een bekende toestand opent die
   sessie RECHTSTREEKS (`/breath-session`); zonder toestand (oudere geplande
   meldingen, of de generieke bracelet-melding) blijft het de tab zelf.
   Een bracelet-DAGPLAN-melding (`'bracelet-plan'`) kent al modus + duur —
   die gaat rechtstreeks naar `/bracelet-control`, net als breathwork naar
   `/breath-session` gaat. */
/* 5 okt 2026: bracelet-plan opent de State Control-TAB (één scherm, geen
   apart /bracelet-control meer — zie utils/state-control-ui.ts); `open` in
   reminderParams slaat het intro over. */
export const reminderRoute = (t: TappedReminder) =>
  t.kind === 'bracelet-plan'
    ? '/bracelet'
    : t.kind === 'bracelet'
      ? '/bracelet'
      : t.state
        ? '/breath-session'
        : '/breath';

/** Extra route-params voor `reminderRoute` — leeg tenzij er een specifieke
 *  toestand bij hoort. `autostart:'1'` erbij (operator, 11 september 2026:
 *  "check alles overal, de oude selectiepagina mag nooit meer
 *  verschijnen") — deze tak geldt enkel wanneer `reminderRoute` naar
 *  `/breath-session` wijst (zelfde `t.state`-voorwaarde), en die kent zijn
 *  toestand al uit de melding, dus er valt niets te kiezen.
 *  `plan:'1'` bij bracelet-plan triggert dezelfde auto-connect/auto-start/
 *  auto-pauze-sequentie op bracelet-control.tsx als breathwork's
 *  `breathwork=1` — zie de toelichting bij `autoStartBracelet` daar. */
export const reminderParams = (t: TappedReminder): Record<string, string> =>
  t.kind === 'bracelet' && t.session
    ? { open: String(Date.now()) }
    : t.kind === 'breath' && t.state
    ? { state: t.state, autostart: '1' }
    : t.kind === 'bracelet-plan' && t.braceletMode !== undefined
      ? {
          mode: String(t.braceletMode),
          plan: '1',
          open: String(Date.now()),
          ...(t.braceletDuration !== undefined
            ? { duration: String(t.braceletDuration) }
            : {}),
        }
      : {};

function fromResponse(
  r: Notifications.NotificationResponse | null,
): TappedReminder | null {
  const data = r?.notification.request.content.data as
    | {
        kind?: string;
        slot?: ReminderSlot;
        state?: BreathStateKey;
        braceletMode?: number;
        braceletDuration?: number;
      }
    | undefined;
  /* 'bracelet-session' (bracelet-session-monitor.ts's lopende-status-
     melding, apart kind zodat de notification-handler in _layout.tsx de
     herhaalde tijd-updates kan onderscheiden van een echte reminder) tikt
     hetzelfde weg als 'bracelet' — genormaliseerd hier zodat de rest van
     dit bestand (reminderRoute/reminderParams/TappedReminder) er niets
     extra's van hoeft te weten. */
  if (data?.kind === 'bracelet-session') {
    return { kind: 'bracelet', slot: data.slot, state: data.state, session: true };
  }
  if (data?.kind === 'bracelet-plan') {
    return {
      kind: 'bracelet-plan',
      braceletMode: data.braceletMode,
      braceletDuration: data.braceletDuration,
    };
  }
  if (data?.kind !== 'breath' && data?.kind !== 'bracelet') return null;
  return { kind: data.kind, slot: data.slot, state: data.state };
}

/** De melding waarmee de app zojuist geopend is, of `null`.
 *
 *  Het systeem bewaart het laatste antwoord langer dan één start, dus een
 *  oude tik zou de app dagen later nog kunnen omleiden. Vandaar de grens van
 *  tien minuten: verder terug is het geen "ik open dit nu" meer. */
export async function tappedReminderOnLaunch(): Promise<TappedReminder | null> {
  try {
    const r = await Notifications.getLastNotificationResponseAsync();
    const t = fromResponse(r);
    if (!t) return null;
    const when = r?.notification.date;
    const age = typeof when === 'number' ? Date.now() - when : 0;
    return age > 10 * 60_000 ? null : t;
  } catch {
    return null;
  }
}

/** Luistert zolang de app draait. Geeft de opzegging terug. */
export function onReminderTap(cb: (t: TappedReminder) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const t = fromResponse(r);
    if (t) cb(t);
  });
  return () => sub.remove();
}

/** Wanneer de eerstvolgende herinnering valt, als leesbare tekst.
 *
 *  Nodig omdat een dagelijkse herinnering pas op zijn uur afgaat: je zet iets
 *  en er gebeurt niets, en dan weet je niet of het gelukt is (operator,
 *  7 augustus 2026). Dit zegt het gewoon.
 *
 *  Zet je om 09:00 een tijd van 12:14, dan valt hij VANDAAG. Zet je 08:00,
 *  dan is dat moment voorbij en valt hij morgen. Datzelfde onderscheid maakt
 *  het systeem, dus het klopt met wat er werkelijk gepland staat. */
export function nextFireText(minsOfDay: number, days?: number[]): string {
  const now = new Date();
  const target = new Date(now);
  target.setHours(Math.floor(minsOfDay / 60), minsOfDay % 60, 0, 0);

  /* Zoek de eerstvolgende dag die meedoet, te beginnen bij vandaag. */
  for (let i = 0; i < 8; i += 1) {
    const d = new Date(target);
    d.setDate(d.getDate() + i);
    const allowed = !days || days.length === 0 || days.includes(d.getDay());
    if (!allowed) continue;
    if (d.getTime() <= now.getTime()) continue;
    const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (i === 0) return `First reminder today at ${t}`;
    if (i === 1) return `First reminder tomorrow at ${t}`;
    return `First reminder ${d.toLocaleDateString([], { weekday: 'long' })} at ${t}`;
  }
  return 'No day selected yet';
}
