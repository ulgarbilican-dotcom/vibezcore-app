/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet tab

   Two modes (STRUCTUUR_en_BLE_contract_v2 §4):
     - ETALAGE  : marketing showcase (guest / not activated) — this file
     - BEDIENING: control screen (activated) — bracelet-control.tsx (next)

   For now the tab shows the ETALAGE. The 7-step story is taken verbatim from
   the existing web app (operator-approved content). Marked [OPERATOR] because
   operator finalises all marketing copy.

   Uiterlijk: MERK_ANKER — Brand-palet, Inter via _layout, wordmark in hero.
   ─────────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { Link } from 'expo-router';
import {
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

/* [OPERATOR] — verbatim from web app index.html (approved). Operator
   finalises wording / science language before launch. */
const STORY: { n: string; h: string; body: string; tags: string[] }[] = [
  {
    n: '01',
    h: 'What is it',
    body:
      'A modular Bead Bracelet built around a single intelligent core — the HapticCore. Swap bead sets to shift your look. One core. Many identities.',
    tags: ['HapticCore', '15 Editions', '8mm Beads'],
  },
  {
    n: '02',
    h: 'How it works',
    body:
      'The HapticCore delivers precisely calibrated pulses designed to guide your nervous system toward calm or focus. Most users notice a shift within 15 to 30 minutes — subtle, but felt.',
    tags: ['Haptic Pulses', '15–30 min', 'Nervous System'],
  },
  {
    n: '03',
    h: 'The intelligence inside',
    body:
      'At the center of every bracelet sits the HapticCore — a precision haptic engine grounded in applied neuroscience. It delivers calibrated pulses to your wrist, influencing your internal state in real time. No screen. No notification. Just direct, physical regulation.',
    tags: ['Bluetooth 5.0', 'USB-C', 'VIBEZCORE App'],
  },
  {
    n: '04',
    h: 'Materials & build',
    body:
      'Every bracelet is assembled by hand, one at a time. Crafted from premium natural 8mm gemstones and finished with a precision-engineered closure. No two stones are ever alike.',
    tags: ['8mm Gemstones', 'Handcrafted', 'Natural Stone'],
  },
  {
    n: '05',
    h: 'Interchangeable',
    body:
      'The bead set clicks in and out with a unique locking system — no tools, no effort. One HapticCore. Fifteen gemstone editions. Switch your stone to match your energy, your style, or your state of mind.',
    tags: ['Snap System', '15 Editions', 'No Tools'],
  },
  {
    n: '06',
    h: 'Made for you',
    body:
      'Individually sized to your wrist — from 16 to 21 cm. You select the gemstone. Not a product off a shelf — a piece built around you, from fit to finish.',
    tags: ['16–21 cm', 'Custom Fit', 'Your Choice'],
  },
  {
    n: '07',
    h: 'Guide your state',
    body:
      'Under pressure it guides you toward calm. In motion it supports deeper focus. Most users notice a shift within 15 to 30 minutes.',
    tags: ['State Guiding', 'Calm & Focus', '15–30 min'],
  },
];

export default function BraceletScreen() {
  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.ksBadge}>
            <Text style={s.ksBadgeText}>
              ⚡ KICKSTARTER — 1 AUGUST 2026
            </Text>
          </View>
          <Image
            source={require('../../../assets/vibezcore_wordmark.png')}
            style={s.heroWordmark}
            resizeMode="contain"
            accessibilityLabel="VIBEZCORE"
          />
          <Text style={s.heroTitle}>Smart Bead Bracelet</Text>
          <Text style={s.heroSub}>
            5 haptic modes. One clear outcome.{'\n'}
            You in control of your own state.
          </Text>
        </View>

        {/* Preview link into the (working) control screen — operator wanted
            visitors to see the activation/control page to get triggered. */}
        <Link href="/bracelet-control" asChild>
          <Pressable style={s.previewBtn}>
            <Text style={s.previewBtnText}>Preview the bracelet app →</Text>
          </Pressable>
        </Link>

        {/* 7-step story */}
        {STORY.map((step) => (
          <View key={step.n} style={s.card}>
            <Text style={s.cardNum}>{step.n}</Text>
            <Text style={s.cardH}>{step.h}</Text>
            <Text style={s.cardBody}>{step.body}</Text>
            <View style={s.tagRow}>
              {step.tags.map((t) => (
                <View key={t} style={s.tag}>
                  <Text style={s.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Register — honest waiting state until activation backend + KS */}
        <View style={s.registerBox}>
          <Text style={s.registerH}>Register your bracelet</Text>
          <Text style={s.registerBody}>
            Bracelet registration opens after the Kickstarter launch on
            1 August 2026. Once your bracelet arrives you’ll activate it
            here with the code in your package.
          </Text>
          <View style={s.registerBtnDisabled}>
            <Text style={s.registerBtnDisabledText}>
              Available after Kickstarter launch
            </Text>
          </View>
        </View>

        <Text style={s.footNote}>
          [OPERATOR] Marketing copy is provisional and finalised by operator
          before launch.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 16, paddingBottom: 48 },
  hero: { paddingVertical: 28, alignItems: 'center' },
  ksBadge: {
    backgroundColor: 'rgba(58,143,255,0.15)',
    borderColor: 'rgba(58,143,255,0.35)',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  ksBadgeText: {
    color: Brand.accent,
    fontSize: 10,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
  },
  heroWordmark: {
    width: 240,
    height: 40,
    marginBottom: 8,
  },
  heroTitle: {
    color: Brand.text,
    fontSize: 24,
    fontFamily: BrandFonts.extrabold,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  heroSub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 21,
  },
  previewBtn: {
    backgroundColor: Brand.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 22,
  },
  previewBtnText: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
  },
  card: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
  },
  cardNum: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 2,
    marginBottom: 6,
    opacity: 0.7,
  },
  cardH: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  cardBody: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    borderLeftColor: Brand.border,
    borderLeftWidth: 2,
    paddingLeft: 12,
    marginBottom: 14,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    backgroundColor: 'rgba(244,244,244,0.04)',
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tagText: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
  },
  registerBox: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginTop: 10,
  },
  registerH: {
    color: Brand.text,
    fontSize: 17,
    fontFamily: BrandFonts.extrabold,
    marginBottom: 8,
  },
  registerBody: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    lineHeight: 21,
    marginBottom: 16,
  },
  registerBtnDisabled: {
    backgroundColor: 'rgba(244,244,244,0.05)',
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  registerBtnDisabledText: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
  },
  footNote: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 22,
    fontStyle: 'italic',
    opacity: 0.6,
  },
});
