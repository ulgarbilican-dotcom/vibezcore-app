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

export type ReminderSlot = 'morning' | 'midday' | 'evening';

/* Voor welke ACTIVITEIT een herinnering geldt (operator, 6 augustus 2026).
   Breathwork en bracelet zijn twee verschillende dingen om aan herinnerd te
   worden: het ene vraagt vijf minuten en aandacht, het andere vraagt dat je
   op één knop drukt. Ze delen dus geen schakelaar.

   De sleutel in Settings wordt `breath:evening` of `bracelet:morning`, zodat
   beide onafhankelijk aan en uit kunnen. */
export type ReminderKind = 'breath' | 'bracelet';

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
  evening: [17, 23],
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

/** Zet de geplande berichten gelijk aan wat er in Settings staat.
 *
 *  Werkt met de VOLLEDIGE lijst en niet met losse aan/uit-opdrachten: zo kan
 *  wat er gepland staat niet uit de pas lopen met wat de gebruiker ziet, ook
 *  niet na een herinstallatie of een geweigerde toestemming. */
export async function syncReminders(
  enabled: Record<string, boolean>,
  /** Minuten na middernacht per sleutel. */
  at: Record<string, number> = {},
): Promise<void> {
  const kinds: ReminderKind[] = ['breath', 'bracelet'];
  const wantsAny = kinds.some((k) =>
    SLOTS.some((s) => enabled[reminderKey(k, s.slot)]),
  );
  if (wantsAny && !(await ensurePermission())) return;

  if (Platform.OS === 'android') {
    try {
      /* Een NIEUWE naam, want Android bevriest een kanaal zodra het bestaat:
         wie de oude 'breath' had, hield voor altijd de oude instellingen
         (operator, 7 augustus 2026 — "als mijn telefoon uitstaat, krijg ik
         dan een bericht?"). Met DEFAULT stond er alleen een pictogram in de
         balk: geen banner, geen scherm dat aangaat. Op een toestel dat in je
         zak ligt, is dat hetzelfde als niets sturen.

         HIGH toont hem wél over het scherm en op het vergrendelscherm. Geluid
         blijft uit en de trilling is één korte tik: zichtbaar, niet luid. Een
         herinnering om rustig te worden hoort niet met een schok binnen te
         komen, maar hij hoort ook niet ongezien te blijven. */
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        description: 'Your breathwork and bracelet moments.',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 40],
        sound: null,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch {}
  }

  for (const k of kinds) {
   for (const s of SLOTS) {
    await cancel(k, s.slot);
    if (!enabled[reminderKey(k, s.slot)]) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: idFor(k, s.slot),
        content: {
          /* De melding ÍS de vraag: tikken opent meteen de juiste sessie.
             Geen bevestiging in de app erna — wie niet wil, veegt hem weg, en
             dat is het antwoord "nee". */
          title: k === 'breath' ? s.title : 'Your bracelet is ready',
          body:
            k === 'breath'
              ? s.body
              : 'One press. No screen, no sound, no effort.',
          /* Waar een tik naartoe moet. Zonder dit opent de app op het
             welkomstscherm en is er van de herinnering niets meer terug te
             vinden — precies de klacht van de operator (7 augustus 2026). */
          data: { kind: k, slot: s.slot },
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


/* ── Wat er gebeurt als je op de melding tikt ──────────────────────────
   De melding IS de vraag; tikken hoort meteen op de juiste plek uit te komen.
   Dat stond hier als bedoeling beschreven maar was nooit aangesloten: er
   luisterde niemand naar de tik, dus je kwam op het welkomstscherm terecht en
   zag nergens meer waarom je de app geopend had.

   Twee wegen naar binnen, en ze zijn allebei nodig:
   · de app stond UIT      → `tappedReminderOnLaunch` bij het opstarten
   · de app stond op de achtergrond → `onReminderTap`, live                */

export type TappedReminder = { kind: ReminderKind; slot?: ReminderSlot };

/* Waarheen per soort. Breathwork opent de vijf toestanden, al staand op wat
   er voorgesteld wordt; de bracelet opent zijn eigen tab. */
export const reminderRoute = (t: TappedReminder) =>
  t.kind === 'bracelet' ? '/bracelet' : '/breath';

function fromResponse(
  r: Notifications.NotificationResponse | null,
): TappedReminder | null {
  const data = r?.notification.request.content.data as
    | { kind?: string; slot?: ReminderSlot }
    | undefined;
  if (data?.kind !== 'breath' && data?.kind !== 'bracelet') return null;
  return { kind: data.kind, slot: data.slot };
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
