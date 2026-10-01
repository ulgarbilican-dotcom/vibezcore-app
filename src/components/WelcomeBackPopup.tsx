/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Welcome-back popup

   Operator ("haal die popup gewoon weg, en als gebruiker op 'Last
   Listened' klikt gaat de popup open"): GEEN automatische cold-start-
   trigger meer (zie git-historie voor die aanpak + de throttle-poging
   die het te-vaak-verschijnen-probleem probeerde te temperen — bleek
   uiteindelijk de verkeerde oplossing voor de verkeerde klacht). De
   popup toont nu UITSLUITEND wanneer de gebruiker zelf op de "Last
   Listened"-snelkoppeling tikt in de Audio Library ((tabs)/index.tsx,
   vervangt daar de oude "Free Sessions"-positie zodra er een geldige
   last-played-entry is).

     - "Continue listening"  → openSession + seek naar opgeslagen positie
                                + auto-play
     - "Not now" / ✕         → dismiss, library blijft staan

   Mount-locatie: ROOT layout (sibling van Stack, naast BraceletUpsellModal).
   Daardoor valt 'ie als overlay boven welke route dan ook.

   GEEN React-Native <Modal>-wrapper: die heeft op Android een eigen
   native window die ALLE touches opvangt, waardoor swipe-down /
   tab-bar onder de overlay niet meer tikbaar zou zijn. We gebruiken
   een floating absolute View + eigen backdrop (touch closes popup).
   Identiek pattern aan BraceletUpsellModal.
   ─────────────────────────────────────────────────────────────────────── */

import { AudioAccent, Brand, BrandFonts } from '@/constants/theme';
import {
  PILLAR_META,
  SERIES_PHOTO,
  SERIES_PILLAR,
  SERIES_SUBTITLE,
  SESSIONS,
} from '@/data/audio-library-data';
import {
  dismissWelcomePopup,
  useWelcomePopupVisible,
} from '@/services/welcome-popup';
import {
  clearLastPlayed,
  useShowableLastPlayed,
  type LastPlayed,
} from '@/utils/last-played';
import { openSession } from '@/utils/openSession';
import { urlEq } from '@/utils/url-eq';
import { setSavedPosition } from '@/utils/vzp';
import { router } from 'expo-router';
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

  /* Operator, 26 september 2026 (crash-jacht, definitieve oorzaak): beide
     knoppen hieronder verbergen dit hele popup ONMIDDELLIJK na een tap
     (dismissWelcomePopup / onContinue). Een gedeelde pressStyle over twee
     knoppen was al een bug (eerder hier gefixt), maar de eigenlijke
     crash-trigger is dieper: een Reanimated press-out `withSpring` die
     nog op de UI-thread doorloopt terwijl Fabric de AnimatedPressable-node
     al aan het afbreken is, geeft "Perhaps you are trying to pass an
     animated style to a non-animated component" → cascadeert naar de
     "Should not already be working"-reconciler-crash (het zwarte scherm
     dat steeds terugkwam na "Continue listening"). Zelfde fix als de
     resume-knoppen in player.tsx: plain Pressable zonder Reanimated hier
     — de knop verdwijnt toch meteen. */
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
          {/* Operator ("in de popup staan de fotos ook niet juist"):
             zelfde pijler-foto-bron als overal elders (grid, pillar-
             scherm, player, mini-player, library-rijen) i.p.v. de oude
             losse reeks-foto. */}
          {(() => {
            const photo =
              PILLAR_META[SERIES_PILLAR[lastPlayed.series]]?.img ??
              SERIES_PHOTO[lastPlayed.series];
            return photo ? (
              <Image source={{ uri: photo }} style={s.cover} resizeMode="cover" />
            ) : (
              <View style={[s.cover, s.coverFallback]} />
            );
          })()}
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
          android_ripple={{ color: 'rgba(10,10,10,0.12)' }}
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
  const sess = SESSIONS.find((x) => urlEq(x.url, lp.url));

  if (sess) {
    /* Happy path: sessie bestaat nog in de library. Sla positie op en
       laat openSession() de player openen mét volledige metadata
       (desc, subseries, etc.) zoals welke andere library-tap dan ook.
       Iter 9dq v157: vóór de player-push expliciet eerst naar de Audio
       Library-tab navigeren. Reden: bracelet-owners worden bij cold-
       start automatisch naar /bracelet geredirect; als de player daar
       bovenop pusht en daarna sluit, valt user terug op bracelet ipv
       audio. Door eerst naar '/' te navigeren, landt user na de player
       weer op Audio Library — natuurlijker voor wie "Continue listening"
       koos. */
    await setSavedPosition(lp.url, lp.positionSec);
    /* Operator, 26 september 2026 (crash-jacht vervolg): `router.navigate`
       hier was ZELF nog een synchrone navigatie-call, vóór openSession()'s
       eigen setTimeout-defer ooit aan de beurt kwam — precies dezelfde
       "React tekent dit scherm synchroon af terwijl de AnimatedPressable's
       press-out-animatie nog op de UI-thread draait"-crash die elders al
       gefixt is, maar dan één stap eerder in de keten. Beide navigatie-
       calls nu in dezelfde macrotask-defer zodat de huidige commit
       (incl. de nog actieve spring-animatie op de knop) eerst afrondt. */
    setTimeout(() => {
      router.navigate('/' as never);
      openSession(sess);
    }, 0);
  } else {
    /* Stale entry: deze URL bestaat niet meer in SESSIONS — kan na een
       library-refactor (URLs gewijzigd) of als een seizoen-content uit
       de library getrokken is. We forceren GEEN player-push met lege
       metadata (lege desc → halve title-card → gebroken UX). Stille
       opruim + dismiss; de gebruiker valt terug op de library en kan
       opnieuw een sessie kiezen. */
    if (__DEV__) {
      console.warn('[welcome-back] stale last-played, clearing:', lp.url);
    }
    await clearLastPlayed();
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
  /* Operator, 26 september 2026 (accentkleur-wissel, audio): eyebrow
     gebruikt nu AudioAccent (Bio-Teal) i.p.v. AccentTextOnDark — zelfde
     patroon als player.tsx. Primaire knop blijft de v4.4 CTA (donkere
     ondergrond → wit vlak, donkere tekst), ongewijzigd. */
  eyebrow: {
    color: AudioAccent,
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 4,
  },
  primaryText: {
    color: '#0a0a0a',
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
