/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Anonymous play-event logging (aggregate analytics)

   Doel: vanaf launch dag-1 weten welke audio het populairst is, gemiddeld
   plays/sessie, etc. ZONDER user-tracking of externe analytics-SDK.

   PRIVACY-MODEL:
     - Random anon_token per install (UUID, in AsyncStorage)
     - GEEN account-link, geen user_id, geen e-mail
     - Geen IP-tracking (Supabase strip dat)
     - Aggregate-only via Supabase views (zie supabase-play-events-migration.sql)
     - Privacy Policy sectie 03 "Monitoring platform performance and usage
       patterns" dekt deze data

   IMPLEMENTATIE:
     - logPlayEvent(sessionId): fire-and-forget POST naar Supabase REST API
     - Geen await — playback wordt nooit geblokkeerd door event-logging
     - Faalt stil bij netwerk-error (best-effort)

   GEBRUIK:
     - audio-player.ts roept logPlayEvent() aan naast startListen()
   ─────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { SUPABASE_KEY, SUPABASE_URL } from '@/constants/supabase';

const ANON_TOKEN_KEY = '@vzc:play-events:anon-token';

let cachedToken: string | null = null;

/* Random UUID v4 zonder externe lib. Goed genoeg voor aggregate-tokens —
   collisions vrijwel onmogelijk in onze schaal. */
function randomToken(): string {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i++) {
    s += hex[Math.floor(Math.random() * 16)];
    if (i === 7 || i === 11 || i === 15 || i === 19) s += '-';
  }
  return s;
}

async function getAnonToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  try {
    const stored = await AsyncStorage.getItem(ANON_TOKEN_KEY);
    if (stored && stored.length > 10) {
      cachedToken = stored;
      return stored;
    }
  } catch {
    /* AsyncStorage faal — val terug op vers token (zal niet persisten) */
  }
  const fresh = randomToken();
  cachedToken = fresh;
  try {
    await AsyncStorage.setItem(ANON_TOKEN_KEY, fresh);
  } catch {
    /* niet kritiek — gebruik token alleen voor deze sessie */
  }
  return fresh;
}

/* Public API — fire-and-forget call. Roep aan wanneer user echt start
   met luisteren (na "wil-luisteren"-intent, niet auto-play).

   sessionId: unieke identifier voor de sessie (audio URL of slug).
              Korter is beter voor SQL queries — gebruik slug indien
              beschikbaar, anders URL.

   Returnt void: caller hoeft niet te awaiten. Errors worden gelogd
   in DEV maar nooit gepropageerd. */
export function logPlayEvent(sessionId: string): void {
  if (!sessionId || sessionId.length === 0) return;
  /* Geen await — we willen NOOIT blokkeren of crashen op event-logging. */
  void (async () => {
    try {
      const token = await getAnonToken();
      const url = `${SUPABASE_URL}/rest/v1/play_events`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          session_id: sessionId.slice(0, 500),
          anon_token: token,
        }),
      });
      if (__DEV__ && !res.ok) {
        // eslint-disable-next-line no-console
        console.warn('[play-events] log failed:', res.status, await res.text());
      }
    } catch (e) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[play-events] log error:', e);
      }
    }
  })();
}
