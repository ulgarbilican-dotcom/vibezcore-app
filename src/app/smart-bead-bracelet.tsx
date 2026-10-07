/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Smart Bead Bracelet (productpagina in de app)

   GEWIJZIGD 7 oktober 2026 (operator: "de bracelet moet al gepromoot worden
   … alles moet zonder scroll zichtbaar zijn en de link moet naar de
   bracelet-pagina op de website"). Strategie (CLAUDE.md §3): de app +
   horloge zijn de kern, de bracelet is de premium upgrade, "nature meets
   tech". Deze pagina is één scherm zonder scrollen: foto, belofte, drie
   punten en één knop naar https://www.vibezcore.com/smart-bead-bracelet.
   Alle details (edelstenen, specs, prijzen, wachtlijst) staan op de website
   — één plek om actueel te houden. De vorige, lange etalage (3.900 regels:
   collectie, specs, prijzen) staat in de git-geschiedenis vóór deze commit.

   Beweringen kloppen met wat vastligt: ritme op je hartslag + zelfstandig
   draaien (BLE-contract §6, Match Your Rhythm), verwisselbare kralensets en
   echte edelstenen (CLAUDE.md §3). Edelstenen nooit met helende/energetische
   kracht. Geen breathwork-belofte (wacht op firmware).
   ─────────────────────────────────────────────────────────────────────── */

import PressScale from '@/components/PressScale';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { BrandDark, BrandFonts, TypeScale } from '@/constants/theme';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Gem, HeartPulse, Timer, type LucideIcon } from 'lucide-react-native';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const C = BrandDark;
const WEBSITE_URL = 'https://www.vibezcore.com/smart-bead-bracelet';
const HERO = 'https://vibezcore-audio.b-cdn.net/images/pic%20hero%20bracelet%20app.png';

const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: HeartPulse, title: 'Feel it', body: 'A haptic rhythm matched to your heart rate.' },
  { icon: Gem, title: 'Wear it', body: 'Natural gemstones. Interchangeable bead sets.' },
  { icon: Timer, title: 'Let go', body: 'Runs on its own once started. No screen.' },
];

async function openWebsite(): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(WEBSITE_URL);
  } catch {
    await Linking.openURL(WEBSITE_URL);
  }
}

export default function SmartBeadBraceletScreen() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={['left', 'right']} style={s.root}>
      <Stack.Screen
        options={{
          title: 'Smart Bead Bracelet',
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton />,
        }}
      />

      {/* Foto vult de ruimte die overblijft — zo past alles op elk scherm
          zonder scrollen. Tekst staat ONDER de foto (Content-Card-regel). */}
      <View style={s.photoWrap}>
        <Image source={{ uri: HERO }} style={s.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>

      <View style={[s.body, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}>
        <Text style={s.eyebrow}>LAUNCHING FALL 2026</Text>
        <Text style={s.title}>Smart Bead Bracelet</Text>
        <Text style={s.lead}>Nature meets tech. Your State Control rhythm, felt on your wrist.</Text>

        <View style={s.points}>
          {POINTS.map(({ icon: Icon, title, body }) => (
            <View key={title} style={s.point}>
              <View style={s.pointIcon}>
                <Icon size={20} color={C.text} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.pointTitle}>{title}</Text>
                <Text style={s.pointBody}>{body}</Text>
              </View>
            </View>
          ))}
        </View>

        <PressScale style={s.cta} haptic scaleTo={0.97} onPress={() => void openWebsite()} accessibilityRole="link">
          <Text style={s.ctaTxt}>Discover the bracelet</Text>
        </PressScale>
        <Text style={s.ctaNote}>Opens vibezcore.com</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  photoWrap: {
    flex: 1,
    minHeight: 140,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: C.panel,
  },
  photo: { width: '100%', height: '100%' },
  body: { paddingHorizontal: 24, paddingTop: 22 },
  eyebrow: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.6,
  },
  title: {
    color: C.text,
    fontSize: 30,
    fontFamily: BrandFonts.bold,
    letterSpacing: -0.4,
    marginTop: 6,
  },
  lead: {
    color: 'rgba(244,244,244,0.72)',
    fontSize: 16,
    lineHeight: 22,
    fontFamily: BrandFonts.regular,
    marginTop: 8,
  },
  points: { marginTop: 18, gap: 14 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointTitle: { color: C.text, fontSize: 15, fontFamily: BrandFonts.semibold },
  pointBody: { color: C.textDim, fontSize: 14, lineHeight: 19, fontFamily: BrandFonts.regular, marginTop: 1 },
  cta: {
    marginTop: 24,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: { ...TypeScale.ctaLabel, color: '#0a0a0a' },
  ctaNote: {
    color: C.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 8,
  },
});
