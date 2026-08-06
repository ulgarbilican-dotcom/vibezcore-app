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
      await Notifications.setNotificationChannelAsync('breath', {
        name: 'Breathwork',
        importance: Notifications.AndroidImportance.DEFAULT,
        /* Geen trilling en geen geluid: een herinnering om rustig te worden
           hoort niet met een schok binnen te komen. */
        vibrationPattern: [0],
        sound: null,
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
          data: { kind: k },
          ...(Platform.OS === 'android' ? { channelId: 'breath' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          /* De gekozen tijd, anders het standaarduur van dit moment. */
          hour: Math.floor((at[reminderKey(k, s.slot)] ?? s.hour * 60) / 60),
          minute: (at[reminderKey(k, s.slot)] ?? s.hour * 60) % 60,
        },
      });
    } catch {
      /* Eén moment dat niet lukt mag de andere niet meeslepen. */
    }
   }
  }
}
