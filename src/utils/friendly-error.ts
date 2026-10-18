/* Leesbare foutmeldingen voor de gebruiker (verplaatst uit subscribe.tsx,
 * 18 okt 2026, account-audit): ruwe backend-/Supabase-teksten ("Upstream fetch
 * failed", "Invalid login credentials", HTML-foutpagina's, id-token-fouten)
 * kwamen op de Profile-tab letterlijk in beeld. Eén vertaling voor elk pad. */
export function friendlyError(raw: string | null | undefined): string {
  if (!raw) return 'Something went wrong. Please try again.';
  const t = String(raw).toLowerCase();
  if (
    t.includes('upstream') ||
    t.includes('fetch failed') ||
    t.includes('failed to fetch') ||
    t.includes('network') ||
    t.includes('timeout') ||
    t.includes('econnrefused') ||
    t.includes('econnreset') ||
    t.includes('socket')
  ) {
    return "We couldn't reach our servers. Check your connection and try again.";
  }
  if (t.includes('already') && (t.includes('exist') || t.includes('registered'))) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (
    (t.includes('invalid') || t.includes('wrong') || t.includes('incorrect')) &&
    (t.includes('password') || t.includes('credentials') || t.includes('login') || t.includes('email'))
  ) {
    return 'Email or password is incorrect.';
  }
  if (t.includes('email') && (t.includes('invalid') || t.includes('not valid'))) {
    return "That email address doesn't look valid.";
  }
  if (t.includes('email not confirmed') || t.includes('confirm your email')) {
    return 'Please confirm your email first — check your inbox.';
  }
  if (t.includes('weak') && t.includes('password')) {
    return 'Please choose a stronger password (8+ characters).';
  }
  if (t.includes('sign in') && (t.includes('before') || t.includes('first'))) {
    return 'Please sign in first, then try again.';
  }
  if (t.includes('no session') || t.includes('no token') || t.includes('not signed in')) {
    return 'You are not signed in. Please sign in and try again.';
  }
  if (t.includes('not available') || t.includes('unavailable') || t.includes('store')) {
    return 'In-app purchases are not available right now. Please try again later.';
  }
  if (t.includes('audience') || t.includes('id_token') || t.includes('provider is not enabled')) {
    return "That sign-in method isn't available right now. Use your email and password, or try again later.";
  }
  if (t.includes('rate limit') || t.includes('too many')) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  /* Iter v143 (2026-06-24): pass-through voor reeds-user-friendly messages.
     Detectie: korte string (<140 char), geen stack-trace markers, geen
     opaque codes/IDs. Voorkomt dat onze eigen vriendelijke errors (uit
     auth.ts, restore-purchases.ts, etc.) onnodig worden weggegooid. */
  const looksFriendly =
    raw.length < 140 &&
    !/[{}<>]/.test(raw) &&
    !/\b[a-f0-9]{16,}\b/i.test(raw) &&
    !raw.includes('Error:') &&
    !raw.includes('at ') &&
    !raw.match(/^[A-Z_]+$/);
  if (looksFriendly) return raw;
  /* Onbekend & niet pass-through-veilig → safe default. */
  return 'Something went wrong. Please try again — or contact support if it keeps happening.';
}
