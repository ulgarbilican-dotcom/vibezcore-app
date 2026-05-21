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

/* ────────────────────────────────────────────────────────────────
   FINETUNE-KNOP voor de operator — verticale positie van de foto.
   Verander alleen het getal hieronder en reload de app.
   ──────────────────────────────────────────────────────────────── */
const FOTO_Y = 0;   // negatief = foto omhoog, positief = foto omlaag, in pixels

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
      {/* Achtergrondfoto (1080×2400, waas/fade al ingebakken).
         Schaalt op SCHERMBREEDTE met native aspect ratio (1080/2400) →
         geen zoom, geen horizontale crop. Bovenkant foto = bovenkant scherm.
         Als het scherm langer is dan de aspect toelaat, blijft onderaan
         Brand.bg (#0a0a0a) over — naadloos zwart, geen overlay nodig. */}
      <Image
        source={require('../../assets/welcome_bg.png')}
        style={s.bgPhoto}
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
          <Text style={s.header} numberOfLines={1} adjustsFontSizeToFit>
            Stop Drifting.
          </Text>
          <Text style={s.header} numberOfLines={1} adjustsFontSizeToFit>
            Start Directing.
          </Text>
          {/* Accent-streepje tussen hoofdregel en caps-ondertekst (#3a8fff). */}
          <View style={s.accentBar} />
          <Text style={s.subheader}>
            CHANGE THE GAME · UNLOCK YOUR FULL POTENTIAL
          </Text>
        </View>

        <View style={s.bottom}>
          {/* Twee gelijkwaardige knoppen — bewust identiek qua gewicht.
             Volgorde per BLAUWDRUK §2: Audio eerst, Bracelet tweede. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/')}
            style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
          >
            <Text style={s.btnLabel}>Explore Audio Library</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/bracelet')}
            style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
          >
            <Text style={s.btnLabel}>Explore Smart Bead Bracelet</Text>
          </Pressable>

          {/* Ondergeschikte regel — kleiner, niet even zwaar als de knoppen. */}
          <Pressable
            accessibilityRole="link"
            onPress={() => router.navigate('/account')}
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
  bgPhoto: {
    /* Foto schaalt op breedte met native aspect ratio. Top-positie wordt
       door de operator gefinetuned via FOTO_Y bovenaan dit bestand. */
    position: 'absolute',
    top: FOTO_Y,
    left: 0,
    width: '100%',
    aspectRatio: 1080 / 2400,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 18,
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
  accentBar: {
    width: 34,
    height: 3,
    backgroundColor: Brand.accent,
    alignSelf: 'center',
    marginTop: 22,
    marginBottom: 16,
  },
  header: {
    /* Hoofdregel = visuele baas. Inter 900 + lichte negatieve letter-spacing
       voor strakke koppen. fontSize gekozen zodat "Start Directing." (de
       langste regel) op telefoon-breedtes op één regel past;
       numberOfLines={1} + adjustsFontSizeToFit op de <Text> beschermt
       extra-smalle toestellen tegen wrap. */
    color: Brand.text,
    fontFamily: BrandFonts.black,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  subheader: {
    /* Caps-ondertekst = rustig, gedimd, ondergeschikt aan de hoofdregel. */
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 2.4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
  bottom: {
    gap: 10,
  },
  btn: {
    /* Halftransparante accentkleur: bracelet schijnt er onderdoor heen.
       Brand.accent = #3a8fff = rgb(58,143,255), 0.55 alpha. Lichte rand
       houdt de knop-vorm helder tegen de foto. */
    backgroundColor: 'rgba(58,143,255,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    /* Brand.accentHover = #2a7fee = rgb(42,127,238), iets minder transparant
       voor duidelijke pressed-feedback. */
    backgroundColor: 'rgba(42,127,238,0.78)',
  },
  btnLabel: {
    color: Brand.text,
    fontFamily: BrandFonts.bold,
    fontSize: 16,
    letterSpacing: 0.2,
    textAlign: 'center',
    /* Tekstschaduw voor leesbaarheid over zowel donkere als lichte fotozones. */
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
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
