/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — meldingen rond het einde van de toegang (29 okt 2026, operator: "ok voor alle 3")

   Drie momenten, gangbaar bij abonnementsapps (geen melding vóór een GEWONE verlenging — dat lokt opzeggen uit, en
   prijswijzigingen/verlengingsmails doen Apple en Google zelf):
     1. Dagpas: 1 uur vóór het einde.
     2. Opgezegd maand-/jaarabonnement (loopt nog tot het einde van de periode): 2 dagen vóór het einde.
     3. Betaalprobleem (store meldt een billing issue, de gebruiker zit in de "grace period"): één keer per probleem.

   Werkwijze: bij ELKE nieuwe abonnementsstatus (useSubscription → notifyAll) wordt opnieuw berekend wat er gepland hoort te
   staan, met vaste sleutels — dus nooit dubbel, en wat niet meer klopt (gekocht, verlengd, opnieuw aangezet) verdwijnt vanzelf.
   Enkel als meldingen al toegestaan zijn: deze module vraagt zelf geen toestemming. Een tik opent het aankoopscherm, bij een
   betaalprobleem het abonnementenbeheer van de store. Teksten goedgekeurd door de operator (29 okt 2026).
   ───────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Linking, Platform } from 'react-native';

export type AccessStatus = {
  active: boolean;
  tier?: 'monthly' | 'yearly' | 'day';
  validUntil?: string;
  willRenew?: boolean;
  isTrialing?: boolean;
  /** ISO-moment waarop de store een betaalprobleem meldde (RevenueCat `billingIssueDetectedAt`). */
  billingIssueAt?: string;
} | null;

export type PlannedAccessNotification = {
  id: 'vz-access-daypass' | 'vz-access-ending' | 'vz-access-billing';
  /** Moment in ms; `null` = meteen. */
  at: number | null;
  title: string;
  body: string;
  action: 'subscribe' | 'manage';
};

const HOUR = 60 * 60_000;
const DAY_PASS_BEFORE = 1 * HOUR;
const ENDING_BEFORE = 48 * HOUR;
/** Een melding die binnen een minuut zou vallen, plannen we niet meer (het moment is in feite voorbij). */
const MIN_LEAD = 60_000;

/** Pure beslissing: wat hoort er nu gepland te staan? (Getest in __tests__/access-notifications.test.ts.) */
export function plannedAccessNotifications(
  status: AccessStatus,
  now: number,
  billingAlreadyShownFor: string | null,
): PlannedAccessNotification[] {
  const out: PlannedAccessNotification[] = [];
  if (!status?.active) return out;
  const end = status.validUntil ? Date.parse(status.validUntil) : NaN;

  if (status.tier === 'day' && Number.isFinite(end)) {
    const at = end - DAY_PASS_BEFORE;
    if (at - now > MIN_LEAD) {
      out.push({
        id: 'vz-access-daypass',
        at,
        title: 'Your Day Pass ends in 1 hour',
        body: 'Keep full access to Breathwork, State Control and the Audio Library.',
        action: 'subscribe',
      });
    }
  }

  if ((status.tier === 'monthly' || status.tier === 'yearly') && status.willRenew === false && !status.isTrialing && Number.isFinite(end)) {
    const at = end - ENDING_BEFORE;
    if (at - now > MIN_LEAD) {
      out.push({
        id: 'vz-access-ending',
        at,
        title: 'Your Premium ends in 2 days',
        body: 'Your plan and progress stay. Keep full access anytime.',
        action: 'subscribe',
      });
    }
  }

  if (status.billingIssueAt && status.billingIssueAt !== billingAlreadyShownFor) {
    out.push({
      id: 'vz-access-billing',
      at: null,
      title: 'Update your payment to keep Premium',
      body: 'There was a problem with your payment. Update it in your store account to keep full access.',
      action: 'manage',
    });
  }
  return out;
}

const BILLING_SHOWN_KEY = 'vz_access_billing_shown_v1';
const ALL_IDS: PlannedAccessNotification['id'][] = ['vz-access-daypass', 'vz-access-ending', 'vz-access-billing'];
const CHANNEL = 'account';
let syncing: Promise<void> | null = null;
let pending: AccessStatus | undefined;

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Your Premium',
      description: 'When your Day Pass or Premium is about to end.',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
    });
  } catch {
    /* swallow */
  }
}

async function apply(status: AccessStatus): Promise<void> {
  let granted = false;
  try {
    granted = (await Notifications.getPermissionsAsync()).granted;
  } catch {
    granted = false;
  }
  let billingShown: string | null = null;
  try {
    billingShown = await AsyncStorage.getItem(BILLING_SHOWN_KEY);
  } catch {
    /* swallow */
  }
  const planned = granted ? plannedAccessNotifications(status, Date.now(), billingShown) : [];
  const keep = new Set(planned.filter((p) => p.id !== 'vz-access-billing').map((p) => p.id));
  for (const id of ALL_IDS) {
    if (id === 'vz-access-billing' || keep.has(id)) continue;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      /* stond er niet */
    }
  }
  if (planned.length === 0) return;
  await ensureChannel();
  for (const p of planned) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: p.id,
        content: {
          title: p.title,
          body: p.body,
          data: { kind: 'access', action: p.action },
          ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
        },
        trigger: p.at === null ? null : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(p.at) },
      });
      if (p.id === 'vz-access-billing' && status?.billingIssueAt) {
        await AsyncStorage.setItem(BILLING_SHOWN_KEY, status.billingIssueAt);
      }
    } catch {
      /* één melding die niet lukt mag de andere niet meeslepen */
    }
  }
}

/** Opnieuw berekenen na een statuswijziging. Eén tegelijk; de laatste status wint. */
export function syncAccessNotifications(status: AccessStatus): void {
  pending = status;
  if (syncing) return;
  syncing = (async () => {
    while (pending !== undefined) {
      const s = pending;
      pending = undefined;
      await apply(s);
    }
  })().finally(() => {
    syncing = null;
  });
}

function handleTap(data: unknown): boolean {
  const d = data as { kind?: string; action?: string } | undefined;
  if (d?.kind !== 'access') return false;
  if (d.action === 'manage') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { storeSubscriptionsUrl } = require('@/services/subscription-actions') as typeof import('@/services/subscription-actions');
    Linking.openURL(storeSubscriptionsUrl()).catch(() => {});
  } else {
    router.push('/subscribe' as never);
  }
  return true;
}

const HANDLED_KEY = 'vz_access_tap_handled_v1';

/** Eén keer in de root-layout: tik op zo'n melding (app open of net geopend) → aankoopscherm / abonnementenbeheer. */
export function startAccessNotificationTaps(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const raw = r.notification.date;
    AsyncStorage.setItem(HANDLED_KEY, `${r.notification.request.identifier}:${raw}`).catch(() => {});
    handleTap(r.notification.request.content.data);
  });
  /* Koude start via de melding: na het opstarten één keer afhandelen (en nooit opnieuw). */
  setTimeout(() => {
    void (async () => {
      try {
        const r = await Notifications.getLastNotificationResponseAsync();
        if (!r || (r.notification.request.content.data as { kind?: string } | undefined)?.kind !== 'access') return;
        const key = `${r.notification.request.identifier}:${r.notification.date}`;
        if ((await AsyncStorage.getItem(HANDLED_KEY)) === key) return;
        await AsyncStorage.setItem(HANDLED_KEY, key);
        handleTap(r.notification.request.content.data);
      } catch {
        /* swallow */
      }
    })();
  }, 2500);
  return () => sub.remove();
}
