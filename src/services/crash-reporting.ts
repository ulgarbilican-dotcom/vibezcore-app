/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — crashrapporten (Sentry, audit 12 okt 2026)

   Zonder dit zagen we fouten in de echte app nooit (ErrorBoundary logde
   enkel in dev). Bewust zuinig ingesteld:
     - enkel FOUTEN (geen session replay, tracing, profiling of logs);
     - geen persoonsgegevens: sendDefaultPii uit, geen gebruiker/e-mail,
       IP niet bewaard (Sentry-project: "Prevent storing of IP addresses");
     - geen schermafbeeldingen of view-hiërarchie;
     - niets in de ontwikkelversie (enkel echte builds).
   Native module → werkt pas vanaf de volgende build. In de huidige dev-
   build is dit een stille no-op.
   ───────────────────────────────────────────────────────────────────────── */

/* Publieke client-sleutel (geen geheim) — Sentry → Settings → Projects →
   react-native → Client Keys (DSN). Leeg = uit. */
const SENTRY_DSN = 'https://2956d778b8eb948c33ad88605501a15f@o4512242031722496.ingest.de.sentry.io/4512242049679440';

type SentryLike = {
  init: (o: Record<string, unknown>) => void;
  captureException: (e: unknown, ctx?: Record<string, unknown>) => void;
};

let sentry: SentryLike | null = null;

/* 12 okt 2026: de gebruiker kan crashrapporten uitzetten (Settings →
   Privacy). Standaard aan, uitgelegd in de privacyverklaring. */
const OPT_OUT_KEY = 'vz_crash_reports_off_v1';

export async function getCrashReportsEnabled(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AS = require('@react-native-async-storage/async-storage').default;
    return (await AS.getItem(OPT_OUT_KEY)) !== '1';
  } catch {
    return true;
  }
}

export async function setCrashReportsEnabled(on: boolean): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AS = require('@react-native-async-storage/async-storage').default;
    await AS.setItem(OPT_OUT_KEY, on ? '0' : '1');
  } catch {
    /* stil */
  }
  if (!on && sentry) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      await require('@sentry/react-native').close();
    } catch {
      /* stil */
    }
    sentry = null;
  } else if (on) {
    initCrashReporting();
  }
}

export function initCrashReporting(): void {
  if (__DEV__ || !SENTRY_DSN || sentry) return;
  void getCrashReportsEnabled().then((on) => {
    if (on) initNow();
  });
}

function initNow(): void {
  if (sentry) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const S = require('@sentry/react-native') as SentryLike;
    S.init({
      dsn: SENTRY_DSN,
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      tracesSampleRate: 0,
      enableAutoSessionTracking: false,
      /* Kruimels zonder netwerkadressen (ondertekende audio-links e.d.). */
      beforeBreadcrumb: (b: { category?: string }) =>
        b.category === 'fetch' || b.category === 'xhr' ? null : b,
    });
    sentry = S;
  } catch {
    sentry = null;
  }
}

/** Een gevangen fout melden (ErrorBoundary). Stil als Sentry uit staat. */
export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  try {
    sentry?.captureException(error, extra ? { extra } : undefined);
  } catch {
    /* melden mag zelf nooit iets breken */
  }
}
