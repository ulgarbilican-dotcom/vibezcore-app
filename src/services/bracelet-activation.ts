/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet activation code redemption

   Iter 9dq v87 (2026-06-03): backend-call wrapper voor de activation-code
   flow. Kickstarter-backers + reguliere bracelet-kopers krijgen na shipping
   een activation-code via email (16 chars, format XXXX-XXXX-XXXX-XXXX).
   Die code linkt hun bracelet aan hun VIBEZCORE-account zodat
   `useBraceletOwner()` true wordt + Bracelet-tab unlockt de control-screen.

   Flow:
     1. User tikt "Activate your bracelet" in Account-tab → /activate-bracelet
     2. Voert code in (4×4 chars met dashes, auto-format)
     3. POST /api/bracelet/activate met {code, email_hint?}
     4. Backend valideert code in Supabase bracelet_activations-tabel
     5. Backend update user-row: has_bracelet=true
     6. App: refreshSubscription → useSubscription/useBraceletOwner re-render
     7. Success-state → router naar Bracelet-tab

   Backend-endpoint: TODO (vibezcore-backend repo). Specificatie:
     POST /api/bracelet/activate
     Headers: Authorization: Bearer <token>
     Body:    { code: "XXXX-XXXX-XXXX-XXXX" }
     200:     { ok: true, activated_at: "ISO", model?: "kickstarter" | "retail" }
     400:     { error: "invalid_code" | "already_used" | "expired" }
     404:     { error: "code_not_found" }
     401:     { error: "unauthorized" }

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ⚠️  ACTIVATIE = ACCOUNT-LEVEL, ÉÉNMALIG PER BRACELET
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   De 12-char code linkt een fysieke bracelet aan een VIBEZCORE-account
   (backend store). Eens geredeem'd:
     - User koopt nieuwe telefoon → login zelfde account → bracelet is
       nog steeds geactiveerd; alleen de BLE-pairing op de nieuwe
       telefoon moet nog gebeuren (separate, lokale handshake)
     - Code kan NIET op een 2e account worden hergebruikt ('already_used'
       error van backend)
     - Multi-device support: zelfde account op telefoon + tablet =
       beide zien activated, beide kunnen connecten

   Daarom moet de backend bij elke /api/subscription-status-call een
   `has_bracelet_activated`-boolean teruggeven. App leest dat ipv een
   eigen lokale flag bij te houden.

   Dev-mock flow (deze file in __DEV__):
     1. activateBracelet(code) → mock 600ms success
     2. setDevBraceletActivated(true) in dev-user-override.ts
     3. useDevBraceletActivated() retourneert nu true
     4. UI toont post-activation state

   Productie-flow (na backend-endpoint):
     1. activateBracelet(code) → echte POST → backend valideert
     2. refreshSubscription() → /api/subscription-status haalt fresh
     3. useSubscription() krijgt has_bracelet_activated=true
     4. UI toont post-activation state

   De lokale dev-flag verdwijnt zodra de subscription-hook 't kan dragen.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { refreshSubscription } from '@/hooks/useSubscription';
/* apiCall is uit imports gehaald in iter v180 — mock-only path totdat
   /api/bracelet/activate endpoint live is. Herstel-import wanneer
   productie-pad geactiveerd wordt (zie commented block onderaan file). */

export type ActivationResult =
  | { ok: true; activatedAt?: string; model?: string }
  | { ok: false; code: ActivationErrorCode; message: string };

export type ActivationErrorCode =
  | 'invalid_format'
  | 'invalid_code'
  | 'already_used'
  | 'expired'
  | 'unauthorized'
  | 'network'
  | 'unknown';

/** Normalize user-typed code → "XXXX-XXXX-XXXX" format (12 chars + 2 dashes).
 *  Strips spaces / dashes / lowercase, uppercases, re-inserts dashes
 *  elke 4 chars. Tolereert tussenruimtes en mixed case.
 *  Iter 9dq v88 (2026-06-03): code-lengte 16 → 12 op operator-verzoek
 *  (12 chars = ~10^18 combinaties, ruim genoeg voor Kickstarter-units). */
export function normalizeActivationCode(raw: string): string {
  const stripped = raw
    .replace(/[\s\-_]/g, '')
    .toUpperCase()
    .slice(0, 12);
  /* Splits in 4-char-groepen en plak met dashes terug. Werkt ook bij
     kortere input (gedeeltelijk getypt) zodat de UI live kan formatten. */
  const groups: string[] = [];
  for (let i = 0; i < stripped.length; i += 4) {
    groups.push(stripped.slice(i, i + 4));
  }
  return groups.join('-');
}

/** Snel client-side validatie of een code de juiste vorm heeft.
 *  12 alfa-num chars (na strip). Backend doet de echte check. */
export function isValidActivationCodeFormat(raw: string): boolean {
  const stripped = raw.replace(/[\s\-_]/g, '').toUpperCase();
  return /^[A-Z0-9]{12}$/.test(stripped);
}

/** Submit activation code naar backend.
 *  Iter v217 (2026-07-04): mock volledig verwijderd. Roept echte
 *  /api/bracelet/activate endpoint in vibezcore-backend. Endpoint
 *  valideert code in Supabase bracelet_activations table, markeert
 *  activation als used, update users.has_bracelet + bracelet_model.
 *  Sluit UI-loop met refreshSubscription zodat isPro/isBraceletOwner
 *  direct propageren naar alle mounted schermen. */
export async function activateBracelet(
  code: string,
): Promise<ActivationResult> {
  const stripped = code.replace(/[\s\-_]/g, '').toUpperCase();
  if (!isValidActivationCodeFormat(stripped)) {
    return {
      ok: false,
      code: 'invalid_format',
      message: 'Please enter a 12-character activation code.',
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { apiCall } = require('@/utils/api');
    const data = await apiCall<Record<string, unknown>>(
      '/api/bracelet/activate',
      { method: 'POST', auth: true, body: { code: stripped } },
    );
    /* Iter v221 (2026-07-07): AWAIT ipv fire-and-forget. Zonder await
       zag Account-tab nog stale niet-owner state direct na success. */
    await refreshSubscription();
    return {
      ok: true,
      activatedAt: typeof data.activated_at === 'string' ? data.activated_at : undefined,
      model: typeof data.model === 'string' ? data.model : undefined,
    };
  } catch (e) {
    const body = (e as { body?: string })?.body ?? '';
    if (body === 'timeout') {
      return {
        ok: false,
        code: 'network',
        message: 'The request took too long. Check your connection and try again.',
      };
    }
    if (body.includes('invalid_code') || body.includes('code_not_found')) {
      return {
        ok: false,
        code: 'invalid_code',
        message: 'This code is not valid. Check the email we sent you.',
      };
    }
    if (body.includes('already_used')) {
      return {
        ok: false,
        code: 'already_used',
        message: 'This code has already been used.',
      };
    }
    if (body.includes('expired')) {
      return {
        ok: false,
        code: 'expired',
        message: 'This code has expired. Contact support to issue a new one.',
      };
    }
    if (body.includes('unauthorized') || (e as { status?: number })?.status === 401) {
      return {
        ok: false,
        code: 'unauthorized',
        message: 'Please sign in to activate your bracelet.',
      };
    }
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: 'network',
      message: message || 'Could not reach the server. Please try again.',
    };
  }
}
