/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Email validatie + common-typo detectie

   Doel: voorkomen dat users een typo-email accepteren bij signup (bv.
   `name@gmail.comn` waar Supabase ÉCHT een account voor aanmaakt, maar
   de user nooit meer z'n eigen mailbox kan bereiken).

   Iter v144 (2026-06-24): operator-incident — `nexuscontacteren@gmail.comn`
   passeerde de form omdat er geen format-check was. Account werd in
   Supabase aangemaakt, IAP-popup faalde daarna, user zat vast met een
   onbruikbaar account onder een email die niet bestaat.

   Aanpak:
     1. Format-regex (RFC 5322 light — voor RN UI is dit voldoende).
     2. TLD-format: 2-24 alpha chars, geen cijfers, geen dashes als suffix.
     3. Common-typo dictionary voor TLD's en bekende mail-providers.
     4. Returnt {ok, warning?, suggestion?} zodat UI kan adviseren ipv blokkeren.

   We blokkeren ALLEEN bij format-fout. Een typo-match geeft een
   suggestion + UI markeert 't als "Did you mean X?" — user kan kiezen
   om door te gaan of de suggestie tappen. Strikter zou false-positives
   geven (sommige domains LIJKEN op typos).
   ─────────────────────────────────────────────────────────────────── */

/** Strikte basis-regex. Lokaal-deel + @ + domein-met-dot + TLD.
 *  TLD-deel beperkt tot letters om "abc.123" af te vangen. Lengte
 *  2-24 dekt elke real TLD (langste ICANN-TLD is .travelersinsurance
 *  met 20 chars, we geven marge). */
const EMAIL_FORMAT_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,24}$/;

/** Bekende TLD-typos. Gesorteerd lang-naar-kort zodat ".comn" niet door
 *  ".com" als hit wordt gezien (we anchoren op $ einde maar replace
 *  pattern matters voor visual feedback). */
const TLD_TYPOS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\.comn$/i, '.com'],
  [/\.coom$/i, '.com'],
  [/\.cmo$/i, '.com'],
  [/\.con$/i, '.com'],
  [/\.cim$/i, '.com'],
  [/\.ocm$/i, '.com'],
  [/\.vom$/i, '.com'],
  [/\.xom$/i, '.com'],
  [/\.nett$/i, '.net'],
  [/\.ogr$/i, '.org'],
  [/\.orgg$/i, '.org'],
  [/\.bee$/i, '.be'],
  [/\.nll$/i, '.nl'],
];

/** Bekende provider-typos. Match op de domein-component (alles na de
 *  laatste @). Lower-case vergelijking. */
const PROVIDER_TYPOS: ReadonlyArray<readonly [string, string]> = [
  ['gmial.com', 'gmail.com'],
  ['gnail.com', 'gmail.com'],
  ['gmaill.com', 'gmail.com'],
  ['gmal.com', 'gmail.com'],
  ['gmai.com', 'gmail.com'],
  ['gmail.co', 'gmail.com'],
  ['gmail.cm', 'gmail.com'],
  ['hotmial.com', 'hotmail.com'],
  ['hotnail.com', 'hotmail.com'],
  ['hotmal.com', 'hotmail.com'],
  ['hormail.com', 'hotmail.com'],
  ['yahooo.com', 'yahoo.com'],
  ['yaho.com', 'yahoo.com'],
  ['yahho.com', 'yahoo.com'],
  ['outlok.com', 'outlook.com'],
  ['outloook.com', 'outlook.com'],
  ['iclod.com', 'icloud.com'],
  ['icoud.com', 'icloud.com'],
];

export type EmailValidation =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'format' }
  | { ok: 'maybe'; reason: 'typo'; suggestion: string };

/** Hoofdfunctie. Returnt drie staten:
 *    ok: true            → email is valide, geen issues.
 *    ok: 'maybe'         → format is technisch OK maar lijkt op een typo.
 *                          Caller moet een suggestie tonen + user laten
 *                          beslissen.
 *    ok: false           → format is hard fout, NOOIT submitten. */
export function validateEmail(raw: string): EmailValidation {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (!EMAIL_FORMAT_RE.test(trimmed)) {
    return { ok: false, reason: 'format' };
  }

  const lower = trimmed.toLowerCase();

  /* TLD-typo check eerst (anchored op $). */
  for (const [bad, good] of TLD_TYPOS) {
    if (bad.test(lower)) {
      const suggestion = trimmed.replace(bad, good);
      return { ok: 'maybe', reason: 'typo', suggestion };
    }
  }

  /* Provider-typo check op domein-deel. */
  const atIdx = lower.lastIndexOf('@');
  if (atIdx > 0) {
    const local = trimmed.slice(0, atIdx);
    const domain = lower.slice(atIdx + 1);
    for (const [bad, good] of PROVIDER_TYPOS) {
      if (domain === bad) {
        return {
          ok: 'maybe',
          reason: 'typo',
          suggestion: `${local}@${good}`,
        };
      }
    }
  }

  return { ok: true };
}

/** UI-helper: geeft een korte string voor onder het email-veld.
 *  Gebruikt door subscribe.tsx en account.tsx voor live feedback. */
export function emailHintText(v: EmailValidation): {
  text: string;
  tone: 'success' | 'warn' | 'error' | 'dim';
} {
  if (v.ok === true) return { text: 'Looks good', tone: 'success' };
  if (v.ok === 'maybe' && v.reason === 'typo') {
    return { text: `Did you mean ${v.suggestion}?`, tone: 'warn' };
  }
  if (v.ok === false && v.reason === 'format') {
    return { text: 'Check spelling — that email doesn\'t look right', tone: 'error' };
  }
  return { text: '', tone: 'dim' };
}
