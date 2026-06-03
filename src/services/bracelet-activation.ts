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
   ─────────────────────────────────────────────────────────────────────── */

import { refreshSubscription } from '@/hooks/useSubscription';
import { apiCall } from '@/utils/api';

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

/** Normalize user-typed code → "XXXX-XXXX-XXXX-XXXX" format.
 *  Strips spaces / dashes / lowercase, uppercases, re-inserts dashes
 *  elke 4 chars. Tolereert tussenruimtes en mixed case. */
export function normalizeActivationCode(raw: string): string {
  const stripped = raw
    .replace(/[\s\-_]/g, '')
    .toUpperCase()
    .slice(0, 16);
  /* Splits in 4-char-groepen en plak met dashes terug. Werkt ook bij
     kortere input (gedeeltelijk getypt) zodat de UI live kan formatten. */
  const groups: string[] = [];
  for (let i = 0; i < stripped.length; i += 4) {
    groups.push(stripped.slice(i, i + 4));
  }
  return groups.join('-');
}

/** Snel client-side validatie of een code de juiste vorm heeft.
 *  16 alfa-num chars (na strip). Backend doet de echte check. */
export function isValidActivationCodeFormat(raw: string): boolean {
  const stripped = raw.replace(/[\s\-_]/g, '').toUpperCase();
  return /^[A-Z0-9]{16}$/.test(stripped);
}

/** Submit activation code naar backend. */
export async function activateBracelet(
  code: string,
): Promise<ActivationResult> {
  const stripped = code.replace(/[\s\-_]/g, '').toUpperCase();
  if (!isValidActivationCodeFormat(stripped)) {
    return {
      ok: false,
      code: 'invalid_format',
      message: 'Please enter a 16-character activation code.',
    };
  }

  try {
    /* TODO (backend-dependency): endpoint /api/bracelet/activate bestaat
       nog niet. Wanneer live, verwijder deze guard. Voor dev/mock-mode
       returnen we een mock-success na 600ms zodat de UI-flow eind-tot-eind
       getest kan worden zonder backend.

       Productie-pad zal zijn:
         const data = await apiCall('/api/bracelet/activate', {
           method: 'POST',
           auth: true,
           body: { code: stripped },
         });
         refreshSubscription();
         return { ok: true, activatedAt: data.activated_at, model: data.model };
    */
    if (__DEV__) {
      console.log(
        '[bracelet-activation] would POST /api/bracelet/activate with:',
        stripped,
      );
      /* Mock 600ms delay zodat dev-UI de busy-state ziet. */
      await new Promise((r) => setTimeout(r, 600));
      /* Echo-back voor dev: code eindigend op "FAIL" → simuleer fout. */
      if (stripped.endsWith('FAIL')) {
        return {
          ok: false,
          code: 'invalid_code',
          message: 'This code is not valid. Check the email we sent you.',
        };
      }
      refreshSubscription();
      return {
        ok: true,
        activatedAt: new Date().toISOString(),
        model: 'kickstarter',
      };
    }

    /* Productie zonder dev-flag — endpoint bestaat nog niet → fail safely. */
    const data = await apiCall<Record<string, unknown>>(
      '/api/bracelet/activate',
      {
        method: 'POST',
        auth: true,
        body: { code: stripped },
      },
    );
    refreshSubscription();
    return {
      ok: true,
      activatedAt:
        typeof data.activated_at === 'string' ? data.activated_at : undefined,
      model: typeof data.model === 'string' ? data.model : undefined,
    };
  } catch (e) {
    const body = (e as { body?: string })?.body ?? '';
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
