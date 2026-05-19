/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Welcome screen (eerste scherm, NIET-blokkerend)

   CLAUDE.md §3 + SPEC DEEL 0 (operator-beslissing 19 mei 2026):
   - Géén poort, géén keuzescherm — alleen een entree die de bezoeker een
     vertrekpunt geeft. Beide knoppen leiden naar volledig vrije tabs.
   - "Reeds ingelogd" → welkomstscherm overslaan, direct de app in.
   - Audio en Bracelet zijn GELIJKWAARDIGE productkernen (SPEC §1.1):
     beide knoppen bewust even prominent.
   - Alle zichtbare teksten op dit scherm zijn EXACT zoals door operator
     voorgeschreven. Verzin hier niets bij — overige copy = [OPERATOR].
   ─────────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { getToken } from '@/services/auth';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Status = 'checking' | 'show';

export default function WelcomeScreen() {
  const [status, setStatus] = useState<Status>('checking');

  /* Reeds ingelogd? → welkomstscherm overslaan, direct de tabs in.
     Tijdens de check tonen we alleen de merk-achtergrondkleur (geen flits). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (cancelled) return;
      if (token) {
        router.replace('/');
      } else {
        setStatus('show');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking') {
    return <View style={s.checking} />;
  }

  return (
    <View style={s.root}>
      {/* Achtergrondfoto (1080×2400, waas/fade al ingebakken) vult het hele scherm.
         GEEN extra overlay — die maakt het te donker. */}
      <Image
        source={require('../../assets/welcome_bg.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.top}>
          <Image
            source={require('../../assets/vibezcore_wordmark.png')}
            style={s.wordmark}
            resizeMode="contain"
            accessibilityLabel="VIBEZCORE"
          />
        </View>

        <View style={s.middle}>
          <Text style={s.header}>
            Stop being a passenger in your own life.
          </Text>
          <Text style={s.subheader}>
            Change the game. Unlock your full potential.
          </Text>
        </View>

        <View style={s.bottom}>
          {/* Twee gelijkwaardige knoppen — bewust identiek qua gewicht. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/bracelet')}
            style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
          >
            <Text style={s.btnLabel}>Explore Smart Bead Bracelet</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/')}
            style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
          >
            <Text style={s.btnLabel}>Explore Audio Library</Text>
          </Pressable>

          {/* Losse kleine gedimde regel onder knop 2 — GEEN knop. */}
          <Text style={s.freeHint}>listen free sessions</Text>

          {/* Ondergeschikte regel — kleiner, niet even zwaar als de knoppen. */}
          <Pressable
            accessibilityRole="link"
            onPress={() => router.replace('/account')}
            hitSlop={12}
            style={s.signinHit}
          >
            <Text style={s.signinText}>Already have a product? Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  checking: { flex: 1, backgroundColor: Brand.bg },
  root: { flex: 1, backgroundColor: Brand.bg },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  top: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  wordmark: {
    width: 220,
    height: 36,
    /* Wordmark is een PNG — textShadow werkt niet op een Image, dus iOS-shadow
       props + Android-elevation voor leesbaarheid op de foto. */
    shadowColor: '#000',
    shadowOpacity: 0.85,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  header: {
    color: Brand.text,
    fontFamily: BrandFonts.extrabold,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  subheader: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  bottom: {
    gap: 10,
  },
  btn: {
    backgroundColor: Brand.accent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    backgroundColor: Brand.accentHover,
  },
  btnLabel: {
    color: Brand.text,
    fontFamily: BrandFonts.bold,
    fontSize: 16,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  freeHint: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    textAlign: 'center',
    marginTop: -2,
  },
  signinHit: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 2,
  },
  signinText: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
