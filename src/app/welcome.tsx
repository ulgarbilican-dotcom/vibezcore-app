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

import { AUDIO_ENABLED } from '@/constants/features';
import { Brand, BrandFonts } from '@/constants/theme';
import { getToken } from '@/services/auth';
import {
  awaitDevUserOverrideLoaded,
  getDevUserOverride,
} from '@/utils/dev-user-override';
import { LinearGradient } from 'expo-linear-gradient';
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
   FINETUNE-KNOPPEN voor de operator
   ──────────────────────────────────────────────────────────────── */
/* Iter 9ai (2026-05-31): Calm/Headspace-style full-bleed welcome.
   Cover + slimme crop. Foto vloeit via een lange zachte gradient over
   in Brand.bg — geen harde randen, wereldklasse-gevoel.

   Iter 9an (2026-05-31): nieuwe "zoom out zonder zwarte randen" knop —
   FOTO_HEIGHT bepaalt hoeveel SCHERMHOOGTE de foto inneemt (top-anchored,
   cover binnen die ruimte). Bij FOTO_HEIGHT < 100% is het onderdeel boven
   de buttons een rustig dark vlak dat door de bottom-gradient wordt
   opgevangen — geen randen om de foto, want links/rechts blijft 'cover'
   de wrapper netjes vullen.

   FOTO_Y: translateY-shift binnen de wrapper. Negatief = focal point
   omhoog, positief = omlaag.

   FOTO_SCALE: extra zoom binnen de wrapper. ≥1.0 garandeert geen zwarte
   randen aan zijkanten. <1.0 NIET aanraden (geeft randen). */
const FOTO_HEIGHT = 75;   // % van schermhoogte, top-anchored
const FOTO_Y = -20;        // pixels: negatief = omhoog
const FOTO_SCALE = 1.0;    // ≥1.0 om randen te vermijden

type Status = 'checking' | 'show';

export default function WelcomeScreen() {
  const [status, setStatus] = useState<Status>('checking');

  /* Reeds ingelogd? → welkomstscherm overslaan, direct de tabs in.
     Tijdens de check tonen we alleen de merk-achtergrondkleur (geen flits).
     Iter 9ar (2026-05-31): respecteert nu OOK de dev user-override
     'guest' — operator kan zo de welcome-flow testen zonder daadwerkelijk
     uit te loggen. We wachten eerst tot de override-cache geladen is om
     een race-conditie te vermijden waarbij de token-check eerder klaar
     is dan de override-load. In prod is awaitDevUserOverrideLoaded()
     een no-op (resolved direct). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await awaitDevUserOverrideLoaded();
      if (cancelled) return;
      const override = getDevUserOverride();
      const token = await getToken();
      if (cancelled) return;
      /* Iter 9dj (2026-05-31): override 'audio' / 'bracelet' / 'pro'
         simuleren ingelogde state → ook zonder echte token welcome
         overslaan, anders blijft welcome hangen op cold-start tests. */
      const treatAsGuest = override === 'guest';
      const treatAsSignedIn =
        override === 'audio' || override === 'bracelet' || override === 'pro';
      const isSignedIn = treatAsSignedIn || (!!token && !treatAsGuest);
      if (isSignedIn) {
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
      {/* Iter 9ai (2026-05-31): Calm/Headspace-style full-bleed photo.
         Wrapper-View met overflow:hidden zorgt dat de cover-image netjes
         binnen het scherm valt; FOTO_Y translateY tilt de focal point.
         Iter 9al (2026-05-31): operator probeert "master-mental-clarity"
         als welcome — testen of de "arrival energy" sterker leest dan
         de vorige Sharp Focus / Beta crop. */}
      <View style={s.bgPhotoWrap}>
        <Image
          source={{
            uri: 'https://vibezcore-audio.b-cdn.net/images/master-mental-clarity.jpg',
          }}
          style={s.bgPhoto}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </View>

      {/* Top scrim — subtiele donkere fade voor status bar + wordmark.
         15% van scherm, transparant → 35% zwart. Houdt de tekst leesbaar
         tegen lichte fotozones bovenaan zonder de foto te dempen. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(10,10,10,0.55)', 'rgba(10,10,10,0)']}
        locations={[0, 1]}
        style={s.topScrim}
      />

      {/* Iter 9ao (2026-05-31): bottom-gradient afgestemd op FOTO_HEIGHT.
         Gradient bereikt 100% opacity exact bij de wrapper-onderkant
         (FOTO_HEIGHT% van scherm) zodat foto onmerkbaar in zwart over­
         vloeit. Geen "harde lijn" meer. Cubic-like curve over 8 stops
         voor maximaal zachte transitie. Gradient strekt naar boven uit
         tot 10% van scherm zodat 65% van gradient-zone benut wordt voor
         de fade — vergeleken met 50% eerder. */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(10,10,10,0)',
          'rgba(10,10,10,0.04)',
          'rgba(10,10,10,0.12)',
          'rgba(10,10,10,0.25)',
          'rgba(10,10,10,0.45)',
          'rgba(10,10,10,0.70)',
          'rgba(10,10,10,0.92)',
          Brand.bg,
          Brand.bg,
        ]}
        locations={[0, 0.15, 0.30, 0.45, 0.55, 0.63, 0.70, 0.72, 1]}
        style={s.bottomFade}
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
          <Text style={s.header} numberOfLines={2}>
            Stop Drifting.
          </Text>
          <Text style={s.header} numberOfLines={2}>
            Start Directing.
          </Text>
          {/* Accent-streepje tussen hoofdregel en caps-ondertekst (#3a8fff). */}
          <View style={s.accentBar} />
          <Text style={s.subheader}>
            CHANGE THE GAME · UNLOCK YOUR FULL POTENTIAL
          </Text>
        </View>

        <View style={s.bottom}>
          {/* Twee gelijkwaardige knoppen naast elkaar — halve breedte,
             identiek qua gewicht. Volgorde per BLAUWDRUK §2:
             Audio eerst, Bracelet tweede. */}
          {/* Twee gelijkwaardige knoppen zolang audio meedoet; staat die uit,
              dan zijn Breath en Bracelet de twee kernen en krijgen zij de
              volle breedte. Geen halflege rij met één knop erin — dat leest
              als een scherm waar iets van weggehaald is. */}
          {/* De bracelet is de HOOFDROL (operator, 5 augustus 2026). Twee
              even grote knoppen zeiden dat beide even belangrijk waren; dat
              was waar toen audio meedeed, en het is niet meer waar nu het
              product de bracelet is. Eén volle knop en één ondergeschikte
              regel zeggen in één oogopslag wat je hier komt doen. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/bracelet')}
            style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
          >
            <Text style={s.btnLabel} numberOfLines={1}>
              Smart Bead Bracelet
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/breath')}
            style={s.secondaryBtn}
            hitSlop={8}
          >
            <Text style={s.secondaryLabel} numberOfLines={1}>
              Explore Breathwork
            </Text>
          </Pressable>

          <View style={s.linksDivider} />
          <View style={s.linksGroup}>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.navigate('/account')}
              hitSlop={10}
              style={s.linkRow}
            >
              <Text style={s.linkRowText}>Already a member? Sign in</Text>
              <Text style={s.linkRowSub}>Existing VIBEZCORE account</Text>
            </Pressable>
            <View style={s.linkRowSep} />
            <Pressable
              accessibilityRole="link"
              onPress={() => router.navigate('/activate-bracelet' as never)}
              hitSlop={10}
              style={s.linkRow}
            >
              <Text style={s.linkRowText}>Have a Bracelet or Full Bundle?</Text>
              <Text style={s.linkRowSub}>Bracelet + Audio · Activate here</Text>
            </Pressable>
            <View style={s.linkRowSep} />
            <Pressable
              accessibilityRole="link"
              onPress={() => router.navigate('/breath')}
              hitSlop={10}
              style={s.linkRow}
            >
              <Text style={s.linkRowText}>Reset in minutes</Text>
              <Text style={s.linkRowSub}>Guided breathwork sessions</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  checking: { flex: 1, backgroundColor: Brand.bg },
  root: { flex: 1, backgroundColor: Brand.bg },
  /* Iter 9an (2026-05-31): wrapper is TOP-anchored met FOTO_HEIGHT%.
     Foto vult de wrapper (cover, geen randen aan zijkanten). Onder de
     wrapper is Brand.bg, naadloos opgepakt door de bottom-gradient. */
  bgPhotoWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: `${FOTO_HEIGHT}%`,
    overflow: 'hidden',
    backgroundColor: Brand.bg,
  },
  bgPhoto: {
    width: '100%',
    height: '100%',
    transform: [{ scale: FOTO_SCALE }, { translateY: FOTO_Y }],
  },
  /* Top scrim — 15% van scherm. Subtiel zwart-fade voor status bar +
     wordmark leesbaarheid, dempt de foto niet onnodig. */
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '15%',
  },
  /* Iter 9ao (2026-05-31): bottom-fade strekt nu 90% van schermhoogte
     (was 68%). Maakt de fade veel gradueler én laat de gradient 100%
     opacity bereiken precies op de foto-wrapper onderkant (FOTO_HEIGHT).
     Resultaat: foto en zwart vlak vloeien onmerkbaar in elkaar over. */
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '90%',
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
    /* Iter 9ao (2026-05-31): 1 cm naar beneden geschoven (≈38px op
       standaard density). Houdt de headline weg van VIBEZCORE-wordmark
       en geeft de foto meer eigen ademruimte boven de tekst. */
    transform: [{ translateY: 38 }],
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
    /* Iter 9ao (2026-05-31): kleur naar wit (was Brand.textDim #8a8a8a).
       Door de zachtere gradient is de fotozone op die hoogte te druk
       voor de gedimde grijs-tekst — wit met text-shadow leest altijd. */
    color: Brand.text,
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
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnHalf: {
    flex: 1,
    paddingHorizontal: 8,
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
  /* Iter v237f (2026-07-09): 3 links in nette grouped card met dividers.
     Voorheen was 't 3 losse text-links wat te druk oogde. Nu: 1 pill met
     3 rijen gescheiden door hairline dividers — leest als een menu-lijstje. */
  secondaryBtn: { alignSelf: 'center', paddingVertical: 14 },
  secondaryLabel: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  linksDivider: {
    height: 1,
    marginTop: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  linksGroup: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  linkRow: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  linkRowText: {
    color: Brand.text,
    fontFamily: BrandFonts.semibold,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  linkRowSub: {
    color: Brand.textDim,
    fontFamily: BrandFonts.medium,
    fontSize: 11,
    marginTop: 1,
    letterSpacing: 0.15,
    opacity: 0.75,
  },
  linkRowSep: {
    height: 1,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  /* Legacy — nog gerefereerd door oude code paths, houd voor safety. */
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
