/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Day Pass-kaart (punt 22) en Welcome Back (punt 23b).

   Operator, 19 okt 2026 (copy goedgekeurd): twee rustige glaskaarten die
   over elke tab kunnen verschijnen — één keer in de root-layout gemount,
   naast ConfirmMomentHost. De boekhouding (seconden, frequentie, wat al
   getoond is) staat in services/sales-nudges.ts; hier enkel het WANNEER
   en het blad zelf.

   Wanneer mag er een kaart komen ("rustig moment"):
   - app op de voorgrond, niet op het welkomstscherm, een onboarding
     (breath-welcome, state-onboarding), /subscribe of een auth-scherm;
   - geen ademsessie (ook geminimaliseerd), geen State Control-sessie of
     30 s-voorproef, de Audio Library speelt niet;
   - geen ander blad, melding, account-wall of bevestigingsmoment open;
   - niet binnen ~2 min na een andere paywall/saleskaart, niet binnen
     2 uur na een aankoop.

   Day Pass-kaart: enkel voor wie geen Premium heeft (abonnement of lopende
   dagpas) en geen bracelet bezit. Eerste keer na 60 s actief rondkijken
   (seconden tellen enkel onder de voorwaarden hierboven, en overleven een
   herstart). Daarna opnieuw na twee keer plannen/paywall wegtikken zonder
   kopen, bij de volgende app-opening. Max 1× per 7 dagen, 3× in totaal.

   Welcome Back: wie een abonnement had dat verlopen is (RevenueCat:
   entitlement staat in `all` maar is niet actief; vangnet: het bewaarde
   'wasPro'-einde voor hetzelfde account). Eén keer per verlopen
   abonnement, bij een app-opening — nooit midden in een sessie. Geen
   kortingen, geen pushmeldingen.

   Kopen gaat altijd via /subscribe?tier=day (start meteen de kassa) — één
   aankoopflow in de hele app, niets dubbel.
   ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BalancedText from '@/components/BalancedText';
import PressScale from '@/components/PressScale';
import VibezGlass from '@/components/VibezGlass';
import { GlassSheet, afterGlassSheetClosed, isGlassSheetOpen } from '@/components/GlassSheetHost';
import { isAccountWallOpen } from '@/components/AccountWallModal';
import { isConfirmMomentOpen } from '@/components/ConfirmMoment';
import { isVibezAlertOpen } from '@/components/VibezAlert';
import { BrandFonts } from '@/constants/theme';
import { useIAP } from '@/hooks/useIAP';
import { useSubscription } from '@/hooks/useSubscription';
import { getToken } from '@/services/auth';
import { isModePreviewRunning } from '@/services/bracelet-haptics';
import { isBraceletSessionMonitorActive } from '@/services/bracelet-session-monitor';
import { isBraceletUpsellVisible } from '@/services/bracelet-upsell';
import { getPendingBreathOpen } from '@/services/breath-session-host';
import { isLibraryPlaying } from '@/services/library-priority';
import {
  DAY_PASS_FIRST_AFTER_SEC,
  addActiveSeconds,
  dayPassCapAllows,
  ensureSalesNudgesLoaded,
  getActiveSeconds,
  getWasPro,
  getWinBackShownFor,
  hasDismissedPlansEnough,
  hasShownDayPass,
  markDayPassShown,
  markWinBackShown,
  salesQuietAllows,
  setWasPro,
} from '@/services/sales-nudges';
import { useBraceletOwner } from '@/utils/dev-user-override';
import { isAnySessionRunning } from '@/utils/onboarding-gate';
import { rootBlurRef } from '@/utils/root-blur';

/** Hoe vaak we tellen en kijken of het moment rustig is. */
const TICK_MS = 5000;
/** Prijs zolang de store nog niet geantwoord heeft (operator-goedgekeurd). */
const DAY_PASS_FALLBACK_PRICE = '€1.29';

/** Schermen waar nooit een saleskaart mag verschijnen. */
const BLOCKED_PATHS = [
  '/welcome',
  '/breath-welcome',
  '/state-onboarding',
  '/subscribe',
  '/breath-session',
  '/auth-callback',
  '/forgot-password',
  '/reset-password',
  '/change-password',
  '/activate-bracelet',
  '/plan-success',
];

function isBlockedPath(path: string): boolean {
  return BLOCKED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Rustig = actief rondkijken (telt voor de 60 s), los van open bladen. */
function isCalmBrowsing(path: string): boolean {
  if (AppState.currentState !== 'active') return false;
  if (isBlockedPath(path)) return false;
  if (isAnySessionRunning() || isBraceletSessionMonitorActive() || isModePreviewRunning()) return false;
  if (getPendingBreathOpen()) return false;
  return !isLibraryPlaying();
}

/** Niets anders ligt al bovenop de app. */
function nothingOnTop(): boolean {
  return (
    !isGlassSheetOpen() &&
    !isAccountWallOpen() &&
    !isBraceletUpsellVisible() &&
    !isConfirmMomentOpen() &&
    !isVibezAlertOpen()
  );
}

/** Verlopen abonnement volgens RevenueCat: de einddatum, of null. */
async function revenueCatLapsedExpiry(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getIAP } = require('@/services/iap');
    await getIAP().init();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Purchases = require('react-native-purchases').default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ENTITLEMENT_AUDIO_PRO } = require('@/services/iap-real');
    const info = await Purchases.getCustomerInfo();
    const ent = info?.entitlements?.all?.[ENTITLEMENT_AUDIO_PRO];
    if (!ent || ent.isActive || typeof ent.expirationDate !== 'string') return null;
    const end = Date.parse(ent.expirationDate);
    return Number.isFinite(end) && end < Date.now() ? ent.expirationDate : null;
  } catch {
    return null; /* SDK niet klaar / mock in dev → vangnet beslist */
  }
}

type Card = 'day-pass' | 'win-back';

export function SalesNudgeHost() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const sub = useSubscription();
  const braceletOwner = useBraceletOwner();
  const { getProduct } = useIAP();
  const dayPrice = getProduct('day')?.localizedPrice ?? DAY_PASS_FALLBACK_PRICE;

  const [card, setCard] = useState<Card | null>(null);
  const cardRef = useRef<Card | null>(null);
  cardRef.current = card;

  /* Laatste abonnementsstand voor de timers (geen verouderde closure). */
  const subRef = useRef(sub);
  subRef.current = sub;
  const braceletRef = useRef(braceletOwner);
  braceletRef.current = braceletOwner;

  /* Per app-opening: Day Pass opnieuw aanbieden (na 2× wegtikken) en
     Welcome Back (einddatum van het verlopen abonnement). */
  const reshowArmedRef = useRef(false);
  const winBackKeyRef = useRef<string | null>(null);
  const [openSeq, setOpenSeq] = useState(1);
  const lapseCheckedForRef = useRef(0);

  const onAppOpen = useCallback(() => {
    reshowArmedRef.current = hasDismissedPlansEnough();
    winBackKeyRef.current = null;
    setOpenSeq((n) => n + 1);
  }, []);

  /* Koude start + elke keer terug naar de voorgrond = een app-opening. */
  useEffect(() => {
    void ensureSalesNudgesLoaded().then(() => {
      reshowArmedRef.current = hasDismissedPlansEnough();
    });
    let prev = AppState.currentState;
    const s = AppState.addEventListener('change', (next) => {
      if (next === 'active' && prev !== 'active') onAppOpen();
      if (next !== 'active') reshowArmedRef.current = false;
      prev = next;
    });
    return () => s.remove();
  }, [onAppOpen]);

  /* Vangnet voor Welcome Back: het laatst geziene abonnement onthouden
     (maand/jaar, geen dagpas of bundle) voor DIT account. */
  useEffect(() => {
    if (sub.realIsPro && (sub.tier === 'monthly' || sub.tier === 'yearly') && sub.validUntil) {
      setWasPro(sub.validUntil, sub.email);
    }
  }, [sub.realIsPro, sub.tier, sub.validUntil, sub.email]);

  /* Eén keer per app-opening, zodra de abonnementsstand bekend is: is er
     een verlopen abonnement waarvoor Welcome Back nog niet kwam? */
  useEffect(() => {
    if (sub.isLoading) return;
    if (lapseCheckedForRef.current === openSeq) return;
    /* Ook bij Premium als gecontroleerd markeren: verloopt het abonnement
       terwijl de app open staat, dan pas bij de VOLGENDE opening. */
    lapseCheckedForRef.current = openSeq;
    if (sub.isPro) return;
    let alive = true;
    void (async () => {
      await ensureSalesNudgesLoaded();
      let key = await revenueCatLapsedExpiry();
      if (!key) {
        const was = getWasPro();
        const end = was ? Date.parse(was.until) : NaN;
        const email = subRef.current.email;
        if (was && was.email && email && was.email === email && Number.isFinite(end) && end < Date.now()) {
          /* Enkel voor een ingelogd account (een gast heeft geen e-mail). */
          if (await getToken()) key = was.until;
        }
      }
      if (!alive || !key || key === getWinBackShownFor()) return;
      winBackKeyRef.current = key;
    })();
    return () => {
      alive = false;
    };
  }, [openSeq, sub.isLoading, sub.isPro]);

  /** Probeer een kaart te tonen; enkel op een rustig moment. */
  const tryShow = useCallback(() => {
    if (cardRef.current) return;
    const s = subRef.current;
    if (s.isLoading || s.isPro) return;
    const path = pathRef.current;
    if (!isCalmBrowsing(path) || !nothingOnTop()) return;
    if (!salesQuietAllows()) return;

    const winKey = winBackKeyRef.current;
    if (winKey && winKey !== getWinBackShownFor()) {
      winBackKeyRef.current = null;
      markWinBackShown(winKey);
      setCard('win-back');
      return;
    }

    if (braceletRef.current || !dayPassCapAllows()) return;
    const first = !hasShownDayPass() && getActiveSeconds() >= DAY_PASS_FIRST_AFTER_SEC;
    const reshow = hasShownDayPass() && reshowArmedRef.current;
    if (!first && !reshow) return;
    reshowArmedRef.current = false;
    markDayPassShown();
    setCard('day-pass');
  }, []);

  /* De klok: actieve seconden tellen (enkel voor wie de kaart kan krijgen)
     en kijken of het moment rustig is. */
  useEffect(() => {
    const t = setInterval(() => {
      const s = subRef.current;
      if (!s.isLoading && !s.isPro && !braceletRef.current && isCalmBrowsing(pathRef.current) && !cardRef.current) {
        addActiveSeconds(TICK_MS / 1000);
      }
      tryShow();
    }, TICK_MS);
    return () => clearInterval(t);
  }, [tryShow]);

  /* Een tabwissel / nieuw scherm is het natuurlijke rustige moment. */
  useEffect(() => {
    const t = setTimeout(tryShow, 900);
    return () => clearTimeout(t);
  }, [pathname, tryShow]);

  /* Wordt iemand intussen Premium (bv. elders gekocht), dan weg ermee. */
  useEffect(() => {
    if (sub.isPro && card) setCard(null);
  }, [sub.isPro, card]);

  const close = () => setCard(null);
  const thenGo = (href: string) => {
    setCard(null);
    /* Eerst het blad echt dicht, dán navigeren (zelfde reden als in
       PremiumPaywallModal, 19 okt 2026). */
    afterGlassSheetClosed(() => router.push(href as never));
  };
  const buyDayPass = () => thenGo('/subscribe?tier=day&from=nudge');

  return (
    <GlassSheet visible={card !== null} onClose={close}>
      {card === 'win-back' ? (
        <NudgeCard
          title="Welcome Back"
          body="Your streak, plan and favorite sessions are waiting."
          primary={{ label: 'See Plans', onPress: () => thenGo('/subscribe?from=nudge') }}
          secondary={braceletOwner ? undefined : { label: `Try a Day Pass · ${dayPrice}`, onPress: buyDayPass }}
          onNotNow={close}
        />
      ) : card === 'day-pass' ? (
        <NudgeCard
          title={'Try Everything' + String.fromCharCode(10) + 'for 24 Hours'}
          body="Breathwork, State Control and the full Audio Library. One payment, no subscription."
          primary={{ label: `Get Day Pass · ${dayPrice}`, onPress: buyDayPass }}
          onNotNow={close}
        />
      ) : null}
    </GlassSheet>
  );
}

type Action = { label: string; onPress: () => void };

/** Het blad zelf: VIBEZCORE-glas, titel, één zin, witte CTA, "Not now".
 *  Geen X/Done (actieblad): sluiten via "Not now" of naar beneden vegen. */
function NudgeCard({
  title,
  body,
  primary,
  secondary,
  onNotNow,
}: {
  title: string;
  body: string;
  primary: Action;
  secondary?: Action;
  onNotNow: () => void;
}) {
  const insets = useSafeAreaInsets();
  /* Staggered reveal (UI-protocol): titel, tekst, knoppen na elkaar. */
  const parts = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      70,
      parts.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 380,
          delay: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [parts]);
  const reveal = (i: number) => ({
    opacity: parts[i],
    transform: [{ translateY: parts[i].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  });

  return (
    <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}>
      <VibezGlass
        radius={24}
        level="sheet"
        blurTarget={rootBlurRef}
        style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
      />
      <Pressable onPress={onNotNow} hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }} accessibilityLabel="Close">
        <View style={s.grip} />
      </Pressable>
      <Animated.View style={reveal(0)}>
        <Text style={s.eyebrow}>VIBEZCORE PREMIUM</Text>
        <BalancedText style={s.title} accessibilityRole="header">
          {title}
        </BalancedText>
      </Animated.View>
      <Animated.View style={reveal(1)}>
        <BalancedText style={s.body}>{body}</BalancedText>
      </Animated.View>
      <Animated.View style={reveal(2)}>
        <PressScale
          style={s.primary}
          onPress={primary.onPress}
          scaleTo={0.97}
          haptic
          accessibilityRole="button"
          accessibilityLabel={primary.label}
        >
          <Text style={s.primaryTxt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {primary.label}
          </Text>
        </PressScale>
        {secondary ? (
          <PressScale
            style={s.secondary}
            onPress={secondary.onPress}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel={secondary.label}
          >
            <Text style={s.secondaryTxt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {secondary.label}
            </Text>
          </PressScale>
        ) : null}
      </Animated.View>
      <Animated.View style={reveal(3)}>
        <PressScale
          style={s.notNow}
          onPress={onNotNow}
          scaleTo={0.94}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Text style={s.notNowTxt}>Not now</Text>
        </PressScale>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  grip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 18,
  },
  eyebrow: { fontFamily: BrandFonts.semibold, fontSize: 11, letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)' },
  title: { fontFamily: BrandFonts.bold, fontSize: 26, letterSpacing: -0.4, color: '#ffffff', marginTop: 8 },
  body: {
    fontFamily: BrandFonts.medium,
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 8,
  },
  primary: {
    marginTop: 24,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryTxt: { color: '#1D1D1F', fontSize: 17, fontFamily: BrandFonts.semibold },
  /* Tweede knop: zacht glas, rand ≤16% (pillen-regel, 19 okt 2026). */
  secondary: {
    marginTop: 10,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryTxt: { color: '#ffffff', fontSize: 16, fontFamily: BrandFonts.semibold },
  notNow: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20, marginTop: 6 },
  notNowTxt: { color: 'rgba(255,255,255,0.75)', fontFamily: BrandFonts.medium, fontSize: 15 },
});
