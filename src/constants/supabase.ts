/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Supabase client config (single source of truth)

   Publishable key + project URL voor Supabase Auth (magic links, invites,
   password recovery, user updates). Supabase publishable keys zijn veilig
   om in client-code te hebben — ze hebben alleen scoped permissions (RLS).

   Gebruikt door:
   - src/app/auth-callback.tsx   (magic link + invite landing)
   - src/app/forgot-password.tsx (request recovery email)
   - src/app/reset-password.tsx  (verify recovery token + set new password)

   Eén plek wijzigen = alle auth-flows mee. Vorm: NIET in env-file (provider-
   agnostic principe — backend levert geen runtime-config), wél centraal
   gedupliceerd-vrij.
   ─────────────────────────────────────────────────────────────────────────── */

export const SUPABASE_URL = 'https://zotxpyjvcamnlzwdgceh.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_LZH7TZUskMTphvMIiefiQQ_8As5C_Q2';
