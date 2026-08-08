/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Root layout

   Eerste scherm is `welcome` (CLAUDE.md §3 + SPEC DEEL 0, operator-beslissing
   19 mei 2026): NIET-blokkerend welkomstscherm, géén poort. Voor gasten
   tonen we welcome; reeds ingelogde gebruikers slaan het over en komen
   direct in de (tabs)-groep met de 3 gelijkwaardige tabs (Audio · Bracelet
   · Account). bracelet-control blijft een losse stack-screen, gepusht
   vanuit de Bracelet-tab.

   Routering-detail: Expo Router routeert op URL en negeert `initialRouteName`
   wanneer `/` resolvable is (→ `(tabs)/index.tsx`). Daarom doen we de keuze
   "welcome vs tabs" hier in de root via een `router.replace('/welcome')`
   zodra blijkt dat er nog geen sessie-token is. Splash blijft op tot zowel
   Inter geladen is als de token-check klaar is — geen flash van de audio-tab
   vóór de welcome-redirect.

   Inter (MERK_ANKER §1) is loaded ÉÉN keer hier, zodat alle schermen
   beschikken over alle gewichten 400/500/600/700/800/900.
   ─────────────────────────────────────────────────────────────────────────── */

import { AccountWallModal } from '@/components/AccountWallModal';
import { BraceletUpsellModal } from '@/components/BraceletUpsellModal';
import { BreathMiniControl } from '@/components/BreathMiniControl';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { VibezAlertHost } from '@/components/VibezAlert';
import { WelcomeBackPopup } from '@/components/WelcomeBackPopup';
import { WelcomeBackWarrior } from '@/components/WelcomeBackWarrior';
import { Brand, BrandFonts } from '@/constants/theme';
import {
  getAuthUserIdFromToken,
  getToken,
  linkRevenueCatUser,
} from '@/services/auth';
import { refreshSubscription } from '@/hooks/useSubscription';
import { recoverOnStartup as iapRecoverOnStartup } from '@/services/iap-recovery';
import { clearSessionIfBuildChanged } from '@/services/version-tracker';
import { setVoiceEnabled as setBreathVoiceEnabled } from '@/services/breath-voice';
import { setVoiceEnabled as setBraceletVoiceEnabled } from '@/services/bracelet-voice';
import { getSetting, ensureSettingsLoaded, useSetting } from '@/utils/settings';
import { cacheAssets } from '@/services/asset-cache';
import { OFFLINE_ASSETS } from '@/services/offline-assets';
import {
  awaitDevUserOverrideLoaded,
  getDevUserOverride,
} from '@/utils/dev-user-override';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from '@expo-google-fonts/inter';
import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  onReminderTap,
  reminderRoute,
  syncReminders,
  tappedReminderOnLaunch,
  type TappedReminder,
} from '@/services/reminders';
import * as Notifications from 'expo-notifications';
import { markBootDecided } from '@/utils/boot';
import { AppState, Image, Platform, Text as RNText, View } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => {});

/* Iter 9dq v100 (2026-06-04): bracelet-mode foto-prefetch.
   Operator-feedback: "audio pro de bracelet korte pagina laadt soms
   traag". Oorzaak: bracelet etalage + bracelet-control gebruiken beide
   dezelfde 5 Bunny-CDN-foto's, geladen on-demand. Eerste navigatie =
   netwerk-fetch, voelt laggy.
   Fix: kick-off Image.prefetch bij app-cold-start zodat tegen de tijd
   dat user de bracelet-tab opent (via welcome of post-login), de cache
   warm is. Fire-and-forget, faalt stil bij offline.
   URLs zijn gespiegeld met bracelet-control.tsx MODE_IMAGES en
   (tabs)/bracelet.tsx MODE_PHOTOS_BY_WAVE — als één wijzigt, hier ook. */
/* Iter v177 (2026-07-02): image prefetch verplaatst naar (tabs)/bracelet.tsx
   useFocusEffect. Bij cold-start liet dit 5 parallel CDN-fetches lopen die
   met langzame netwerken (2G/3G) andere startup-work konden vertragen.
   Nu triggert prefetch ALLEEN wanneer user daadwerkelijk de bracelet-tab
   opent — sneller cold-start, geen impact op eerst-load UX. */

/* Centrale font-inheritance — zet Inter als default op elke <Text> in de app,
   zodat schermen die geen eigen fontFamily zetten tóch Inter krijgen
   (MERK_ANKER §1, BrandFonts in src/constants/theme.ts). Schermen die een
   ander gewicht willen (bold/extrabold/etc.) blijven via BrandFonts.X
   overschrijven — dat wint van defaultProps. */
const RNTextWithDefault = RNText as unknown as {
  defaultProps?: { style?: unknown };
};
RNTextWithDefault.defaultProps = RNTextWithDefault.defaultProps || {};
RNTextWithDefault.defaultProps.style = [
  { fontFamily: BrandFonts.regular },
  RNTextWithDefault.defaultProps.style,
];

/* `undefined` = nog aan het checken; `null` = gast; string = token. */
type AuthState = undefined | null | string;

/* Auth-flow deep-link paden die de welcome-redirect MOETEN overrulen.
   Zonder deze check zou een cold-start vanaf bv. een email-magic-link
   (`vibezcoreapp://auth-callback?...`) als gast worden gedetecteerd
   → `router.replace('/welcome')` zou de auth-callback push opslokken
   → user landt op welcome ipv het verify-scherm.

   Iter v170 (2026-06-28): `account` toegevoegd. Web reset-password.html
   stuurt user naar `vibezcoreapp://account` na "Password updated" zodat
   hij direct kan inloggen met nieuwe password. Zonder deze entry zou de
   welcome-redirect dat opslokken → user landt op welkomstscherm en moet
   extra "Already have a product? Sign in" tappen. Operator-test
   2026-06-28 ~11:50 toonde deze friction expliciet aan. */
const AUTH_DEEP_LINK_PATHS = new Set([
  'auth-callback',
  'reset-password',
  'forgot-password',
  'account',
]);

/* De snelkoppelingen onder het app-icoon (plugins/withQuickShortcuts.js).
   Het zijn gewone deeplinks, want die worden ook afgeleverd als de app AL
   draait — dat was het gebrek van de vorige aanpak. Ze staan hier als vaste
   lijst en niet als "alles wat binnenkomt", zodat een vreemde link de app nog
   steeds nergens heen kan sturen. */
/* GEEN vaste bestemmingen meer maar toegestane paden (audit, 8 augustus
   2026). Hier stond '/breath-session?state=calm&quick=1' hard, en die
   herspeling walste over de parameters van de ECHTE link heen: een deeplink
   naar mode=boost rendeerde eerst goed en werd 300 ms later door deze regel
   naar CALM omgezet. De lijst blijft de poort — een vreemd pad stuurt de app
   nog steeds nergens heen — maar de parameters komen voortaan uit de link
   zelf. */
const SHORTCUT_PATHS = new Set(['breath-session', 'breath', 'bracelet']);

/* Waar het pad in een deeplink terechtkomt.
   Bij `vibezcoreapp://breath-session?state=calm` is er geen host én pad —
   Expo zet `breath-session` in `hostname` en laat `path` leeg. Bij een link
   mét schuine streep staat het juist in `path`. Wie maar één van de twee
   leest, mist de helft.

   Dat was de fout achter "alle drie gaan naar Stop Drifting" (operator,
   7 augustus 2026): het pad kwam leeg terug, de app dacht dat er geen
   deeplink was, en het welkomstscherm kwam over de bestemming heen. Expo
   Router had ondertussen zelf al goed gerouteerd. */
function linkPath(url: string): string {
  const parsed = Linking.parse(url);
  return (parsed.path || parsed.hostname || '').replace(/^\/+/, '');
}

async function hasPendingAuthDeepLink(): Promise<boolean> {
  try {
    const initialUrl = await Linking.getInitialURL();
    if (!initialUrl) return false;
    const path = linkPath(initialUrl);
    /* Ook een snelkoppeling moet het welkomstscherm overslaan, anders komt
       die eroverheen en strandt je waar je niet heen wilde. */
    return AUTH_DEEP_LINK_PATHS.has(path) || SHORTCUT_PATHS.has(path);
  } catch {
    return false;
  }
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  const [auth, setAuth] = useState<AuthState>(undefined);
  /* Was de app geopend via een auth-deep-link (magic link, password
     recovery, invite)? Dan slaan we de welcome-redirect over zodat de
     deep-link-handler ongestoord naar /auth-callback of /reset-password
     kan pushen. Bug-fix voor de cold-start race waarbij welcome de
     auth-flow opslokte. */
  const [pendingAuthLink, setPendingAuthLink] = useState<boolean | undefined>(
    undefined
  );

  /* Is de app geopend door op een herinnering te tikken? Dan hoort hij daar
     uit te komen en niet op het welkomstscherm (operator, 7 augustus 2026:
     "als ik dan de telefoon ontgrendel en naar de app ga, is er niets meer te
     zien — dat moet logisch en duidelijk zijn").

     `undefined` = nog aan het kijken; `null` = gewoon geopend. Het hoort bij
     `ready`, anders is de welkomst-omleiding er eerder dan het antwoord. */
  const [tapped, setTapped] = useState<TappedReminder | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const t = await tappedReminderOnLaunch();
      if (!cancelled) setTapped(t);
    })();
    /* En zolang de app draait: een tik terwijl hij op de achtergrond staat.
       `navigate` en niet `replace`, want dan blijft de weg terug bestaan. */
    const off = onReminderTap((t) => {
      router.navigate({
        pathname: reminderRoute(t),
        params: { from: 'reminder' },
      } as never);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      /* Iter v159 (2026-06-26): force fresh state bij build-upgrade.
         clearSessionIfBuildChanged() compares nativeBuildVersion met de
         vorige opgeslagen waarde. Bij mismatch (incl. eerste install)
         wordt de Supabase session + email-cache gewist. Voorkomt het
         'oude email automatisch ingevuld na update'-effect. MOET vóór
         getToken() lopen zodat het verse antwoord wordt opgehaald. */
      await clearSessionIfBuildChanged();

      /* Iter 9as (2026-05-31): wacht óók op dev-override cache zodat
         de welcome-redirect-check daar rekening mee kan houden. In prod
         is awaitDevUserOverrideLoaded() een no-op. */
      const [t, pending] = await Promise.all([
        getToken(),
        hasPendingAuthDeepLink(),
        awaitDevUserOverrideLoaded(),
      ]);
      if (cancelled) return;
      setAuth(t ?? null);
      setPendingAuthLink(pending);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ready =
    fontsLoaded &&
    auth !== undefined &&
    pendingAuthLink !== undefined &&
    tapped !== undefined;

  /* Iter v148 (2026-06-25): IAP startup-recovery. Fire-and-forget
     achtergrond-call die (a) pending verifies uit AsyncStorage drain't
     en (b) een silent restorePurchases uitvoert. Zorgt dat een user die
     z'n app sluit mid-verify, of die op een nieuw toestel installeert,
     z'n PRO-toegang automatisch terugkrijgt zonder ergens te tikken.
     Geblokt achter ready zodat we de auth-token-check al hebben gedaan
     (recoverOnStartup zelf no-ops als er geen sessie is). */
  useEffect(() => {
    if (!ready) return;
    void iapRecoverOnStartup();
  }, [ready]);

  /* Herinneringen opnieuw zetten bij elke start.
     Ze werden alleen gepland op het moment dat je een schakelaar omzette. Wat
     daarvóór al gepland stond, bleef staan zoals het toen was — dus een
     verbetering aan de melding zelf bereikte niemand die zijn herinnering al
     had aanstaan (operator, 7 augustus 2026). Hetzelfde gold na een herstart
     van het toestel, waarbij Android geplande wekkers weggooit.

     Opnieuw zetten is veilig: `syncReminders` werkt met de volledige lijst en
     vervangt per moment, dus er komt nooit een tweede naast. */
  useEffect(() => {
    if (!ready) return;
    void (async () => {
      await ensureSettingsLoaded();
      const on = getSetting('reminders');
      if (Object.values(on).some(Boolean)) {
        await syncReminders(on, getSetting('reminderAt'));
      }
      /* Het oude kanaal opruimen, anders staat er in de instellingen van het
         toestel een tweede regel die nergens meer bij hoort. */
      if (Platform.OS === 'android') {
        try {
          await Notifications.deleteNotificationChannelAsync('breath');
        } catch {}
      }
    })();
  }, [ready]);

  /* Iter v165 (2026-06-27): RevenueCat bootstrap — één effect dat Purchases
     configureert, de customer aan de huidige Supabase user koppelt, en een
     customer-info-update listener registreert.

     Volgorde is belangrijk: Purchases.logIn en addCustomerInfoUpdateListener
     vereisen BEIDE dat Purchases.configure al gedraaid heeft. iap.init() is
     idempotent — twee parallelle calls wachten op dezelfde initialized flag.

     Eén effect ipv drie zodat we geen race tussen 'logIn' en 'configure'
     krijgen: bij login op een fresh-install toestel runt configure → logIn
     → listener-attach lineair binnen één promise-chain.

     De listener firet bij elke entitlement-state-change (renewal, cancel,
     refund, restore op ander toestel) en triggert refreshSubscription zodat
     UI overal mee-update. */
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let removeListener: (() => void) | undefined;
    void (async () => {
      try {
        const { getIAP } = await import('@/services/iap');
        await getIAP().init();
      } catch {
        /* Init faalde — listener werkt niet maar UI valt terug op
           backend-status via useSubscription. Auth-flows in auth.ts
           proberen Purchases.logIn opnieuw na hun eigen events. */
        return;
      }
      if (cancelled) return;

      /* Link Supabase user aan RevenueCat customer als er een sessie is.
         Bij vers-geïnstalleerde apps met bestaand account zorgt dit dat
         entitlements direct hersteld worden. */
      if (auth) {
        const authUserId = getAuthUserIdFromToken(auth);
        if (authUserId) {
          await linkRevenueCatUser(authUserId);
        }
      }
      if (cancelled) return;

      /* Customer-info-update listener — backend-events (renewals,
         cancellations, server-side restores) triggeren dit lokaal. */
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Purchases = require('react-native-purchases').default;
        if (!Purchases?.addCustomerInfoUpdateListener) return;
        /* Iter v227 (2026-07-07, audit B9): guard tegen signout-race.
           Purchases.logOut() fired een customerInfoUpdate event → handler
           trigger'de refreshSubscription() ↔ account.tsx setSignedOutStatus()
           → PRO-flash na sign-out. Fix: skip refresh als geen token
           (net-signed-out state). */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handler = async (_info: any) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { getToken } = require('@/services/auth');
            const token = await getToken();
            if (!token) return;
          } catch {
            return;
          }
          refreshSubscription();
        };
        Purchases.addCustomerInfoUpdateListener(handler);
        removeListener = () => {
          try {
            Purchases.removeCustomerInfoUpdateListener?.(handler);
          } catch {
            /* swallow */
          }
        };
      } catch {
        /* swallow */
      }
    })();
    return () => {
      cancelled = true;
      if (removeListener) removeListener();
    };
  }, [ready, auth]);

  /* Iter v165: AppState-foreground refresh. User komt terug uit settings
     (sub geannuleerd) of na ~12h achtergrond → subscription kan zijn
     veranderd. Vers ophalen bij elke foreground-transitie zodat we nooit
     stale PRO-status tonen. */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshSubscription();
        /* Iter v230 (2026-07-08, audit BUG 6/8): retry pending RC-link
           bij foreground. Als linkRevenueCatUser eerder faalde (offline,
           SDK not ready) zit RC nog op $RCAnonymousID → volgende purchase
           zou naar anonymous customer routen → webhook filtert dat weg.
           Fire-and-forget: linkRevenueCatUser is idempotent, marker
           wordt gewist bij succes. */
        void (async () => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { retryPendingRcLink } = require('@/services/auth');
            await retryPendingRcLink();
          } catch {
            /* swallow */
          }
        })();
      }
    });
    return () => sub.remove();
  }, []);

  /* Iter v149 v3 (2026-06-25): sync voice-cues setting met beide
     voice-services (breath + bracelet). Voorheen had elke service een
     eigen default; nu is Settings → Voice cues de single source of truth.
     User toggle wordt live doorgevoerd in beide services. */
  /* Beeld en stem één keer naar het toestel halen. Draait op de achtergrond
     en houdt niets tegen: lukt het niet, dan streamt de app zoals vroeger.
     Vanaf de tweede start werkt een ademsessie zonder netwerk — en dat is de
     belofte die de app doet ("always available"), dus die hoort niet aan
     wifi te hangen. */
  useEffect(() => {
    void cacheAssets(OFFLINE_ASSETS);
  }, []);

  const voiceCuesSetting = useSetting('voiceCues')[0];
  useEffect(() => {
    void (async () => {
      await ensureSettingsLoaded();
      const enabled = getSetting('voiceCues');
      setBreathVoiceEnabled(enabled);
      setBraceletVoiceEnabled(enabled);
    })();
  }, [voiceCuesSetting]);

  /* Iter 9dq (2026-06-02): redirect-guard. Voorheen kon de welcome-
     redirect-effect twee keer firen bij een snelle user: cold-start
     toonde kort /(tabs)/ omdat auth-check async is, user tikte een
     sessie aan → /player gepusht → toen pas resolvede de auth-check,
     ready werd true, effect fired → router.replace('/welcome') blikseme
     de player weg. Tweede klik werkte dan wel (state stabiel).
     Ook in productie mogelijk bij trage netwerk-/storage-reads.
     Fix: ref-guard zorgt dat de welcome-redirect maar ÉÉN keer firet
     per app-mount, namelijk op cold-start vóór enige user-navigatie.
     Latere state-changes (bv. sign-out) worden door de schermen zelf
     afgehandeld via expliciete router-calls, niet door dit globale
     effect. */
  const welcomeRedirectFiredRef = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (welcomeRedirectFiredRef.current) {
      /* Splash zou onderhand allang weg moeten zijn; defensief nogmaals
         aanroepen schaadt niet als 'ie al hidden is. */
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    welcomeRedirectFiredRef.current = true;
    /* Welcome-redirect ALLEEN als er geen auth-deep-link wacht.
       Anders neemt de deep-link-handler in de tweede useEffect het over.
       Iter 9as: dev-override 'guest' triggert óók de welcome-redirect,
       ook al is er nog een token (simuleert niet-ingelogd).
       Iter 9dj (2026-05-31): dev-override 'audio' / 'bracelet' / 'pro'
       simuleren juist een INGELOGDE PRO-user → welcome moet OVERSLAAN
       ook al heeft de tester geen echte token. Hierdoor verschijnt
       welcome niet meer op cold-start bij dev-tests met die overrides. */
    const override = getDevUserOverride();
    const treatAsGuest = override === 'guest';
    const treatAsSignedIn =
      override === 'audio' || override === 'bracelet' || override === 'pro';
    /* ALTIJD het welkomstscherm (operator, 7 augustus 2026: "stop drifting
       moet wel altijd welcome scherm zijn").

       Dit vervangt de regel uit CLAUDE.md §3, waar stond dat een reeds
       ingelogde gebruiker het scherm overslaat. Die regel kwam uit de tijd dat
       welcome vooral een poort naar Audio of Bracelet was; nu is het het
       merkbeeld waarmee de app opent, en dat hoort iedereen te zien — of je nu
       betaalt of niet.

       De uitzondering die BLIJFT: een openstaande auth-deeplink. Zou welcome
       daar overheen komen, dan slokt hij het verify-scherm op en strandt
       iemand midden in het aanmelden. */
    /* Een tik op een herinnering gaat vóór het welkomstscherm. Wie om negen
       uur 's avonds op "Time to wind down" tikt, wil ademen — niet eerst het
       merkbeeld en dan zelf de weg zoeken. */
    const showWelcome = !pendingAuthLink && !tapped;
    void treatAsGuest;
    void treatAsSignedIn;
    if (tapped) {
      router.replace({
        pathname: reminderRoute(tapped),
        params: { from: 'reminder' },
      } as never);
    } else if (showWelcome) {
      router.replace('/welcome');
    } else if (
      !pendingAuthLink &&
      (override === 'bracelet' || override === 'pro')
    ) {
      /* Iter 9dq v21 (2026-06-02): bracelet-owner-only users (no audio
         sub) krijgen de Bracelet-tab als landing zodat dat hun primaire
         interactie-vlak is. Audio Library is voor hen een secondary
         upsell-target (teaser-landing in tab) — niet de eerste indruk
         na app-open.
         Iter 9dq v47 (2026-06-03): operator-keuze — Full PRO override
         ('pro') landt ook op /bracelet. Reden: een Full PRO user heeft
         BEIDE producten, en de bracelet is de actieve fysieke interactie
         die op de juiste mode gestart moet worden. Audio Library blijft
         één tab away. In productie zou dezelfde routing kunnen werken
         o.b.v. backend "has_bracelet"-flag. */
      router.replace('/bracelet');
    }
    /* Vanaf hier mag `/` zijn eigen gang gaan. Zie utils/boot.ts. */
    markBootDecided();
    SplashScreen.hideAsync().catch(() => {});
  }, [ready, auth, pendingAuthLink, tapped]);

  /* ── Deep link handler (operator-keuze 2026-05-27) ───────────
     Webapp wordt uitgefaseerd — alle email-flows (magic link na
     Gumroad-koop, password reset, etc.) moeten in de native app
     openen. Scheme `vibezcoreapp://` (app.json). Wanneer user op
     een email-link tikt:
       vibezcoreapp://auth-callback?token_hash=xxx&type=recovery
       vibezcoreapp://auth-callback?token_hash=xxx&type=invite
       vibezcoreapp://reset-password?token_hash=xxx
     → wordt hier gevangen, gerouted naar de juiste in-app screen
     (die het token uitwisselt tegen Supabase en sessie opzet). */
  useEffect(() => {
    if (!ready) return;

    const handle = (url: string | null) => {
      if (!url) return;
      try {
        const parsed = Linking.parse(url);
        const path = linkPath(url);
        const params = parsed.queryParams ?? {};

        /* Route per deep-link-pad. Onbekende paden negeren we
           bewust — voorkomt dat een rogue link de app naar een
           verkeerde route kan dwingen. */
        if (path === 'auth-callback') {
          router.push({
            pathname: '/auth-callback' as never,
            params: params as Record<string, string>,
          });
        } else if (path === 'reset-password') {
          router.push({
            pathname: '/reset-password' as never,
            params: params as Record<string, string>,
          });
        } else if (path === 'forgot-password') {
          router.push('/forgot-password' as never);
        } else if (SHORTCUT_PATHS.has(path)) {
          /* `replace` en niet `push`: wie via een snelkoppeling binnenkomt
             heeft geen scherm achter zich waar hij naar terug wil. De
             queryparameters reizen mee — dat is het hele punt van de link. */
          const q = (parsed.queryParams ?? {}) as Record<string, string>;
          router.replace({ pathname: `/${path}`, params: q } as never);
        } else if (__DEV__) {
          console.log('[deep-link] unhandled path:', path);
        }
      } catch (e) {
        if (__DEV__) console.warn('[deep-link] parse failed:', e);
      }
    };

    /* Cold-start: app werd geopend via deep-link */
    Linking.getInitialURL().then(handle);

    /* Warm: app draait en deep-link wordt afgevuurd */
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [ready]);

  /* Voorheen stond hier een unmount-cleanup die expliciet audio unloadde,
     als defensie tegen de expo-av "Player accessed on wrong thread"-crash.
     Verwijderd 2026-05-23 met de migratie naar expo-audio — die heeft
     z'n eigen lifecycle-management en het hele PUNT van de migratie is
     dat audio nu in background blijft leven (lock-screen + foreground-
     service). Een unload op root-unmount zou dat doel direct breken. */

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: Brand.bg }} />;
  }

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: Brand.bg }}>
        <StatusBar style="light" />
        <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Brand.bg },
          headerTintColor: Brand.text,
          headerTitleStyle: { fontFamily: 'Inter_700Bold' },
          contentStyle: { backgroundColor: Brand.bg },
        }}
      >
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="bracelet-control"
          options={{ title: 'Bracelet', headerBackTitle: 'Back' }}
        />
        {/* Iter v149 v3 (2026-06-25): preview-screen voor uitgelogde
            users die de 5 bracelet-states willen verkennen zonder eerst
            een account te hoeven aanmaken. */}
        <Stack.Screen
          name="bracelet-preview"
          options={{ title: 'Preview', headerBackTitle: 'Back' }}
        />
        {/* `bracelet-history` — sub-screen voor sessie-overzicht. Push
            vanaf bracelet-control idle (history-knop). */}
        <Stack.Screen
          name="bracelet-history"
          options={{ title: 'Session history', headerBackTitle: 'Back' }}
        />
        {/* `breath-history` — full-page Your Practice met stats + lijst.
            Push vanaf Breath-tab "Your Practice" link. */}
        <Stack.Screen
          name="breath-history"
          options={{ title: 'Your Practice', headerBackTitle: 'Back' }}
        />
        {/* `support` — in-app contact-form (vervangt externe support-URL).
            Push vanaf Account → Support of legal-docs Contact-CTA. */}
        <Stack.Screen
          name="support"
          options={{ title: 'Support', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="player"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        {/* `subscribe` — IAP-bridge screen (operator-flow 2026-06-03).
            Gast tikt pricing-card → /subscribe?tier=monthly|yearly →
            account-create-form (of skip als ingelogd) → IAP-popup. */}
        <Stack.Screen
          name="subscribe"
          options={{ title: 'Subscribe', headerBackTitle: 'Back' }}
        />
        {/* `activate-bracelet` — activation-code redemption (iter 9dq v87).
            Gepusht vanaf Account-tab CTA voor ingelogde users zonder
            has_bracelet=true. Backend-endpoint /api/bracelet/activate
            nog te bouwen — dev draait op mock-success. */}
        <Stack.Screen
          name="activate-bracelet"
          options={{ title: 'Activate your bracelet', headerBackTitle: 'Back' }}
        />
        {/* `settings` — sub-screen pushed from Account-tab. Toont Playback /
           Privacy / About-secties die de webapp ook heeft. */}
        <Stack.Screen
          name="settings"
          options={{ title: 'Settings', headerBackTitle: 'Account' }}
        />
        {/* ── Auth flow schermen (operator-keuze 2026-05-27: webapp wordt
            uitgefaseerd, alles in native). ──
            `auth-callback`: landing voor magic links + invite-emails
            `forgot-password`: in-app form om reset-email te requesten
            `reset-password`: landing voor recovery-email + nieuwe pw setup */}
        <Stack.Screen
          name="auth-callback"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{ title: 'Forgot password', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="reset-password"
          options={{ title: 'Reset password', headerBackTitle: 'Back' }}
        />
        {/* `change-password` — voor ingelogde users die hun bekende
            password willen wijzigen. Anders dan /reset-password
            (forgot flow via email-link). Geopend vanuit Account-tab
            → "Change password" row. */}
        <Stack.Screen
          name="change-password"
          options={{ title: 'Change password', headerBackTitle: 'Account' }}
        />
        {/* `legal/[doc]` — dynamic route voor 5 legal/safety-docs
            (terms/privacy/refund/cookies/health). Inhoud in
            `src/data/legal-content.ts`. */}
        <Stack.Screen
          name="legal/[doc]"
          options={{ headerBackTitle: 'Account' }}
        />
        {/* `faq` — Frequently Asked Questions, gesynced van
            vibezcore.com/faq. Content in `src/data/faq-content.ts`.
            Geopend vanuit Account → Support menu OF vanuit Support
            form ("Browse FAQ first" link bovenaan). */}
        <Stack.Screen
          name="faq"
          options={{ title: 'FAQ', headerBackTitle: 'Back' }}
        />
        {/* `about` — Brand story screen, gesynced van vibezcore.com/
            about-vibezcore. 8 secties (origin, challenge, system,
            science, pillars, collective, who-it's-for, mission) met
            pull-quotes, system cards, pillars grid. Custom layout —
            niet via Legal renderer omdat visueel anders. */}
        <Stack.Screen
          name="about"
          options={{ title: 'About', headerBackTitle: 'Back' }}
        />
        {/* `coming` heeft géén handmatige Stack.Screen-registratie meer —
           expo-router 55 pikte 'm dubbel op (file-based routing + deze
           entry → "Too many screens defined. Route 'coming' is
           extraneous"). headerShown: false wordt nu IN coming.tsx zelf
           gezet via <Stack.Screen options={...} />. */}
      </Stack>

      {/* Bracelet-upsell-modal — gemount aan de ROOT (sibling van Stack)
          zodat 'ie als floating overlay boven player.tsx valt zonder
          native-modal touch-intercept. Visibility wordt door de bracelet-
          upsell singleton-service bepaald, getriggerd vanuit
          (tabs)/index.tsx wanneer playerState.endedPanel toggelt. */}
      <BraceletUpsellModal />

      {/* Account-wall-modal — verschijnt wanneer een gast op een
          'account'-tier sessie tikt. Sibling-mount (zelfde reden als
          BraceletUpsellModal): voorkomt native-Modal touch-intercept,
          werkt als floating overlay over álle schermen heen. Visibility
          gestuurd door utils/openSession.ts → useGatedOpenSession. */}
      <AccountWallModal />

        {/* Welcome-back-popup — verschijnt op cold-start als er een geldige
            last-played-entry is. Operator-besluit 2026-05-25 (vervangt de
            eerdere Continue-card in de library): popup voelt warmer +
            "welkom terug" ipv passieve resume-card. Triggert zichzelf via
            useEffect in de component, beperkt tot (tabs)-segmenten zodat
            'ie nooit over /welcome verschijnt. */}
        <WelcomeBackPopup />

      {/* Welcome-back-warrior — motivationele begroeting bij cold-start
          na >12h gap (iter 9s, operator-feedback "Welcome back Warrior").
          Apart van WelcomeBackPopup (die over audio-resume gaat).
          Subscription-relevant copy + send-feedback link. */}
      <WelcomeBackWarrior />

      {/* Iter v149 v3 (2026-06-25): floating breath mini-control —
          verschijnt wanneer een breath-sessie loopt en user is niet op de
          /breath route. Tap → naar breath-tab, X → stop sessie. */}
      <BreathMiniControl />

      {/* Iter v167 (2026-06-28): VIBEZCORE-styled alert host. Queue-based
          modal that replaces Alert.alert system popups — keeps brand-
          immersion across every app-emitted confirm/notify. Native store
          popups (Google Play "Fout", Apple StoreKit) are intentionally
          left untouched (we have no control over those). */}
      <VibezAlertHost />
      </View>
    </ErrorBoundary>
  );
}
