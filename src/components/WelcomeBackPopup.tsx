/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Welcome-back popup

   Verschijnt ALLEEN op een cold app-start wanneer er een geldige
   last-played-entry is (< 7d oud, < 95% voltooid, ≥ 4s positie). Welkomt
   de terugkerende luisteraar en biedt twee opties:

     - "Continue listening"  → openSession + seek naar opgeslagen positie
                                + auto-play
     - "Not now" / ✕         → dismiss, library blijft staan

   Eenmaal weggetapt: niet opnieuw zichtbaar tot volgende cold-start. Zie
   `src/services/welcome-popup.ts` voor de cold-start-flag.

   Mount-locatie: ROOT layout (sibling van Stack, naast BraceletUpsellModal).
   Daardoor valt 'ie als overlay boven welke route dan ook — maar de
   trigger-logica beperkt zich tot de (tabs)-area zodat 'ie nooit over
   het welkomstscherm verschijnt (gast-flow: geen popup).

   GEEN React-Native <Modal>-wrapper: die heeft op Android een eigen
   native window die ALLE touches opvangt, waardoor swipe-down /
   tab-bar onder de overlay niet meer tikbaar zou zijn. We gebruiken
   een floating absolute View + eigen backdrop (touch closes popup).
   Identiek pattern aan BraceletUpsellModal.
   ─────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { SERIES_PHOTO, SERIES_SUBTITLE, SESSIONS } from '@/data/audio-library-data';
import {
  dismissWelcomePopup,
  useWelcomePopupVisible,
} from '@/services/welcome-popup';
import { useShowableLastPlayed, type LastPlayed } from '@/utils/last-played';
import { openSession } from '@/utils/openSession';
import { setSavedPosition } from '@/utils/vzp';
import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';
import {
  BackHandler,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/* Logo / brand mark — exact identiek aan welcome.tsx en welke header
   dan ook. Lokaal asset, geen netwerk-roundtrip.
   Pad: assets/ live op project-root, niet onder assets/images/. */
const VZ_WORDMARK = require('../../assets/vibezcore_wordmark.png');

/* "mm:ss"-formatter — alleen voor de "You stopped at X:XX"-regel. */
function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export function WelcomeBackPopup() {
  const visible = useWelcomePopupVisible();
  const lastPlayed = useShowableLastPlayed();
  const segments = useSegments() as string[];

  /* Trigger-logica: cold-start + lastPlayed + in (tabs) → showWelcomePopup.
     De segment-check zorgt dat 'ie nooit op /welcome verschijnt (gast-
     flow). De service zelf bewaakt "al getoond"-status, dus deze effect
     mag rustig vaker firen — meer dan één show binnen dezelfde process
     is fysiek onmogelijk. */
  useEffect(() => {
    if (!lastPlayed) return;
    const inTabs = segments[0] === '(tabs)';
    if (!inTabs) return;
    // Import dynamically to avoid circular dep risk; service is tiny.
    const { showWelcomePopup } = require('@/services/welcome-popup');
    showWelcomePopup();
  }, [lastPlayed, segments]);

  /* Android hardware-back = dismiss (UX-conventie: back nooit door een
     overlay heen laten propaganderen — anders zou hij ook de tab-bar of
     onderliggende route triggeren). */
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissWelcomePopup();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  if (!visible || !lastPlayed) return null;

  return (
    <View style={s.root} pointerEvents="box-none">
      {/* Backdrop — tap-anywhere-to-dismiss. Iets transparanter dan een
          klassieke modal-backdrop (35% ipv 50-60%) zodat je de library
          ZIET achter het popup-blokje; voelt warmer / minder gegrendeld. */}
      <Pressable style={s.backdrop} onPress={dismissWelcomePopup} />

      <View style={s.card}>
        {/* ✕ rechtsboven. Pressable hitSlop voor mobile-tap-target ≥44dp. */}
        <Pressable
          style={s.close}
          onPress={dismissWelcomePopup}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          accessibilityLabel="Close welcome message"
        >
          <Text style={s.closeText}>✕</Text>
        </Pressable>

        <Image source={VZ_WORDMARK} style={s.logo} resizeMode="contain" />

        <Text style={s.welcome}>Welcome back.</Text>

        <View style={s.sessionRow}>
          {SERIES_PHOTO[lastPlayed.series] ? (
            <Image
              source={{ uri: SERIES_PHOTO[lastPlayed.series] }}
              style={s.cover}
              resizeMode="cover"
            />
          ) : (
            <View style={[s.cover, s.coverFallback]} />
          )}
          <View style={s.sessionMeta}>
            <Text style={s.eyebrow} numberOfLines={1}>
              {SERIES_SUBTITLE[lastPlayed.series] ?? lastPlayed.series}
            </Text>
            <Text style={s.title} numberOfLines={2}>
              {lastPlayed.title}
            </Text>
            <Text style={s.stopLine}>
              You stopped at {fmtTime(lastPlayed.positionSec)}
            </Text>
          </View>
        </View>

        <Pressable
          style={s.primary}
          onPress={() => onContinue(lastPlayed)}
          android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
          accessibilityLabel="Continue listening where you stopped"
        >
          <Text style={s.primaryText}>Continue listening</Text>
        </Pressable>

        <Pressable
          style={s.secondary}
          onPress={dismissWelcomePopup}
          accessibilityLabel="Dismiss welcome message, stay on library"
        >
          <Text style={s.secondaryText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ── Action handler ─────────────────────────────────────────────────────
   "Continue listening" — bridge naar vzp + openSession-flow. Identieke
   bridge-stap als de oude Continue-card op de library: vzp_v1 wordt
   normaal alléén op een echte pauze-event gevuld; bij abrupte close
   (background-kill, app-kill) heeft 'ie geen entry. last-played heeft
   wél de positie via de periodieke write. Eerst vzp updaten, dan
   openSession → player ziet de resume-state en toont z'n "Continue
   from X:XX / Start over"-prompt (= bestaande in-player flow,
   ongewijzigd zoals operator gevraagd). */
async function onContinue(lp: LastPlayed): Promise<void> {
  await setSavedPosition(lp.url, lp.positionSec);

  const sess = SESSIONS.find((x) => x.url === lp.url);
  if (sess) {
    openSession(sess);
  } else {
    /* Fallback: lastPlayed-data direct doorgeven. Treedt alleen op als
       de library na de save een refactor heeft gehad waardoor URLs
       gewijzigd zijn — defensief, niet de happy-path. */
    router.push({
      pathname: '/player',
      params: {
        title: lp.title,
        series: lp.series,
        url: lp.url,
        free: lp.isFree ? 'true' : 'false',
        desc: '',
      },
    });
  }

  dismissWelcomePopup();
}

/* ── Styles ─────────────────────────────────────────────────────────────
   Brand-consistente paneel-style: dark card op een lichte backdrop.
   16px border-radius, royale padding, generous spacing tussen secties
   (MERK_ANKER §look "royale spacing"). */
const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    width: '88%',
    maxWidth: 420,
    backgroundColor: Brand.panel,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 20,
    alignItems: 'stretch',
  },
  close: {
    position: 'absolute',
    top: 10,
    right: 12,
    padding: 4,
  },
  closeText: {
    color: Brand.textDim,
    fontSize: 18,
    fontFamily: BrandFonts.medium,
  },
  /* Font-keys in BrandFonts zijn lowercase (extrabold / semibold). */
  logo: {
    width: 110,
    height: 22,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  welcome: {
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 32,
    marginBottom: 18,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: Brand.bg,
    marginRight: 14,
  },
  coverFallback: {
    backgroundColor: Brand.bg,
  },
  sessionMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  eyebrow: {
    color: Brand.accent,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    color: Brand.text,
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    lineHeight: 20,
    marginBottom: 4,
  },
  stopLine: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
  },
  primary: {
    backgroundColor: Brand.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 4,
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.2,
  },
  secondary: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
  },
});
