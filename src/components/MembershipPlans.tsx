/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — de abonnementskaart (7 okt 2026).

   Operator: "de subscribe-kaart is heel slecht, moet zoals de kaart in
   Audio Library maar aangepast met Apple-voorwaarden". Eén component voor
   beide plekken (Library-kopen-blok en /subscribe), zodat ze nooit meer
   uit elkaar lopen. Uiterlijk = het Library-blok (huisstijl v5.7 .plan):
   twee tikbare tegels, wit omlijnd als gekozen, Bio-Teal vinkje, witte CTA.

   Apple-voorwaarden (App Store Review Guidelines 3.1.2, Schedule 2):
   - het BEDRAG DAT AFGESCHREVEN WORDT is het grootste prijselement — dus
     €69,99/year groot, de maandprijs ervan klein eronder (niet andersom);
   - proefperiode: duur en wat het daarna kost, vlak bij de knop;
   - introprijs: wat het na de introperiode kost;
   - automatische verlenging + hoe opzeggen, vóór de aankoop;
   - werkende links naar Terms of Use en Privacy Policy, plus Restore.

   Alle bedragen komen uit de store (localizedPrice, freeTrialDays,
   regularPriceLabel) — niets verzonnen; zonder store-data de vaste
   EUR-standaard, zoals de rest van de app.
   ───────────────────────────────────────────────────────────────────────── */

import { AudioAccent, AudioAccentLight, BrandFonts } from '@/constants/theme';
import { SESSIONS } from '@/data/audio-library-data';
import { useIAP } from '@/hooks/useIAP';
import { getEffectiveTier } from '@/utils/access-tier';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/* 10 gratis + 17 trial-sessies — afgeleid uit de data, blijft kloppen. */
const TRIAL_SESSION_COUNT = SESSIONS.filter((x) => {
  const t = getEffectiveTier(x);
  return t === 'public' || t === 'account';
}).length;

export type MembershipPlan = 'monthly' | 'yearly';

const TEXT = '#ffffff';
const DIM = 'rgba(255,255,255,0.5)';
const FAINT = 'rgba(255,255,255,0.32)';

/** Zelfde valuta-teken als de store-prijs, ander bedrag ("€69,99" → "€5,83"). */
function withSymbol(sample: string, currency: string, value: number): string {
  const formatted = value.toFixed(2);
  const comma = /\d,\d{2}(?!\d)/.test(sample);
  const num = comma ? formatted.replace('.', ',') : formatted;
  const leading = sample.match(/^([^\d\s]+)/);
  if (leading) return `${leading[1]}${num}`;
  const trailing = sample.match(/([^\d\s.,]+)\s*$/);
  if (trailing) return `${num} ${trailing[1]}`;
  return `${num} ${currency}`;
}

/** Kaart met de veer van de rest van de app (scale .96 → 1, lichte tik). */
function Bounce({
  children,
  style,
  onPress,
  accessibilityLabel,
  selected,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  accessibilityLabel: string;
  selected?: boolean;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      style={style}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 90 });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { duration: 260, dampingRatio: 0.78 });
      }}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[{ flex: 1 }, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

export default function MembershipPlans({
  initialPlan = 'yearly',
  onContinue,
  onRestore,
  showHero = true,
}: {
  initialPlan?: MembershipPlan;
  /** Tik op de knop onderaan, met het gekozen plan. */
  onContinue: (plan: MembershipPlan) => void;
  onRestore: () => void;
  /** De titel + "One VIBEZCORE membership…" bovenaan. */
  showHero?: boolean;
}) {
  const [plan, setPlan] = useState<MembershipPlan>(initialPlan);
  const { getProduct } = useIAP();
  const monthly = getProduct('monthly');
  const yearly = getProduct('yearly');

  /* Operator, 7 okt 2026 (account-audit, WYSIWYG): enkel de prijs die de
     store voor DEZE klant geeft — geen vaste euro-bedragen of verzonnen
     besparing/proefperiode zolang de store nog niet geantwoord heeft. */
  const monthlyPrice = monthly?.localizedPrice ?? '—';
  const yearlyPrice = yearly?.localizedPrice ?? '—';
  const yearlyPerMonth = yearly?.priceAmountMicros
    ? withSymbol(yearly.localizedPrice, yearly.currency, yearly.priceAmountMicros / 12 / 1_000_000)
    : '—';
  const savePercent = (() => {
    if (!monthly?.priceAmountMicros || !yearly?.priceAmountMicros) return null;
    const m = monthly.priceAmountMicros / 1_000_000;
    const y = yearly.priceAmountMicros / 12 / 1_000_000;
    const p = Math.round((1 - y / m) * 100);
    return m > 0 && p > 0 ? p : null;
  })();
  /* Proefperiode enkel als de store hem voor DEZE klant meldt. */
  const trialDays = yearly?.freeTrialDays ?? 0;
  const hasTrial = trialDays > 0;

  /* Introprijs (eerste jaar): wat het daarna kost — Apple wil dat vóór de aankoop zien. */
  const monthlyAfter = monthly?.regularPriceLabel;
  const yearlyAfter = yearly?.regularPriceLabel;

  const summary =
    plan === 'yearly'
      ? hasTrial
        ? `Free for ${trialDays} days, then ${yearlyPrice} per year${yearlyAfter ? ` for the first year, ${yearlyAfter} per year after` : ''}. Cancel anytime.`
        : `${yearlyPrice} per year${yearlyAfter ? ` for the first year, ${yearlyAfter} per year after` : ''}. Cancel anytime.`
      : `${monthlyPrice} per month${monthlyAfter ? ` for the first year, ${monthlyAfter} per month after` : ''}. Cancel anytime.`;
  /* Operator, 8 okt 2026: de kop belooft "Audio Library" — maak vóór de
     knop duidelijk dat de trial 27 sessies opent, niet alle (kort, Apple-
     stijl; Breathwork/State Control staan al in de kop). */
  const trialScope =
    plan === 'yearly' && hasTrial
      ? `${TRIAL_SESSION_COUNT} audio sessions during your trial. After that, everything stays and all ${SESSIONS.length} unlock.`
      : null;
  const cta = plan === 'yearly' && hasTrial ? 'Start free trial' : 'Subscribe';
  /* Operator, 8 okt 2026: kleine lettertjes per store, actief geformuleerd.
     iOS = Apple's vaste tekst (24-uursregel, App Store-accountinstellingen);
     Android = Google Play (geen 24-uursregel, opzeggen via Play › Subscriptions).
     Met trial wordt pas aangerekend wanneer de trial eindigt. */
  const chargeMoment = plan === 'yearly' && hasTrial ? 'when your free trial ends' : 'when you confirm your purchase';
  const disclosure =
    Platform.OS === 'ios'
      ? `Your Apple ID is charged ${chargeMoment}. Your subscription renews automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store account settings.`
      : `Your Google Play account is charged ${chargeMoment}. Your subscription renews automatically until you cancel. Manage or cancel anytime in Google Play › Subscriptions.`;

  return (
    <View>
      {showHero && (
        <>
          <Text style={s.hero}>Unlock your potential</Text>
          <Text style={s.heroSub}>
            One VIBEZCORE membership unlocks Breathwork, State Control and the Audio Library
          </Text>
        </>
      )}

      <View style={s.row}>
        <Bounce
          style={s.cardOuter}
          onPress={() => setPlan('monthly')}
          selected={plan === 'monthly'}
          accessibilityLabel={`Monthly, ${monthlyPrice} per month`}
        >
          <View style={[s.card, plan === 'monthly' && s.cardOn]}>
            <Text style={s.planLabel}>Monthly</Text>
            <Text style={s.badgeNeutral}>Flexible</Text>
            <View style={s.priceRow}>
              <Text style={s.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {monthlyPrice}
              </Text>
              <Text style={s.per}>/month</Text>
            </View>
            <Text style={s.meta}>{monthlyAfter ? `${monthlyAfter}/month after year 1` : 'Cancel anytime'}</Text>
            <View style={[s.sel, plan === 'monthly' && s.selOn]} pointerEvents="none">
              {plan === 'monthly' && <Text style={s.selCheck}>✓</Text>}
            </View>
          </View>
        </Bounce>

        <Bounce
          style={s.cardOuter}
          onPress={() => setPlan('yearly')}
          selected={plan === 'yearly'}
          accessibilityLabel={`Yearly, ${yearlyPrice} per year${hasTrial ? `, ${trialDays}-day free trial` : ''}`}
        >
          <View style={[s.card, plan === 'yearly' && s.cardOn]}>
            <Text style={s.planLabel}>Yearly</Text>
            {savePercent !== null ? (
              <Text style={s.badgeSave}>{`Save ${savePercent}%`}</Text>
            ) : (
              <Text style={s.badgeNeutral}> </Text>
            )}
            {/* Apple: het afgeschreven bedrag is het grootste prijselement. */}
            <View style={s.priceRow}>
              <Text style={s.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {yearlyPrice}
              </Text>
              <Text style={s.per}>/year</Text>
            </View>
            <Text style={s.meta}>{`${yearlyPerMonth}/month`}</Text>
            {hasTrial && <Text style={s.trial}>{`${trialDays} days free`}</Text>}
            <View style={[s.sel, plan === 'yearly' && s.selOn]} pointerEvents="none">
              {plan === 'yearly' && <Text style={s.selCheck}>✓</Text>}
            </View>
          </View>
        </Bounce>
      </View>

      <Text style={s.summary}>{summary}</Text>
      {trialScope && <Text style={s.trialScope}>{trialScope}</Text>}

      <Bounce style={s.cta} onPress={() => onContinue(plan)} accessibilityLabel={cta}>
        <View style={s.ctaInner}>
          <Text style={s.ctaTxt}>{cta}</Text>
        </View>
      </Bounce>

      {/* Schedule 2: verlenging + opzeggen vóór de aankoop. */}
      <Text style={s.disclosure}>
        {disclosure}
      </Text>

      <View style={s.links}>
        <Pressable onPress={() => router.push('/legal/terms')} hitSlop={8} accessibilityRole="link">
          <Text style={s.link}>Terms of Use</Text>
        </Pressable>
        <Text style={s.sep}>·</Text>
        <Pressable onPress={() => router.push('/legal/privacy')} hitSlop={8} accessibilityRole="link">
          <Text style={s.link}>Privacy Policy</Text>
        </Pressable>
        <Text style={s.sep}>·</Text>
        <Pressable onPress={onRestore} hitSlop={8} accessibilityLabel="Restore previous purchases">
          <Text style={s.link}>Restore Purchases</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { color: TEXT, fontFamily: BrandFonts.bold, fontSize: 34, letterSpacing: -0.6, marginBottom: 6 },
  heroSub: { color: DIM, fontFamily: BrandFonts.medium, fontSize: 15, lineHeight: 21, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 10 },
  cardOuter: { flex: 1 },
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardOn: { borderColor: 'rgba(244,244,244,0.45)', backgroundColor: 'rgba(0,0,0,0.28)' },
  planLabel: { color: '#a1a1a6', fontSize: 15, fontFamily: BrandFonts.semibold, paddingRight: 28 },
  badgeNeutral: { color: '#a1a1a6', fontSize: 12, fontFamily: BrandFonts.semibold, marginTop: 4 },
  badgeSave: { color: AudioAccentLight, fontSize: 12, fontFamily: BrandFonts.semibold, marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 },
  price: { color: TEXT, fontSize: 30, fontFamily: BrandFonts.bold, letterSpacing: -0.6, flexShrink: 1 },
  per: { color: DIM, fontSize: 12, fontFamily: BrandFonts.semibold, marginLeft: 4, marginBottom: 4 },
  meta: { color: DIM, fontSize: 12, fontFamily: BrandFonts.semibold, marginTop: 6 },
  trial: { color: AudioAccentLight, fontSize: 13, fontFamily: BrandFonts.semibold, marginTop: 6 },
  sel: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#5a5a5a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selOn: { borderColor: AudioAccent, backgroundColor: AudioAccent },
  selCheck: { color: '#ffffff', fontSize: 11, fontWeight: '800', lineHeight: 13 },
  summary: { color: DIM, fontFamily: BrandFonts.medium, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 18 },
  trialScope: { color: DIM, fontFamily: BrandFonts.medium, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  cta: { marginTop: 12 },
  ctaInner: {
    backgroundColor: '#ffffff',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: { color: '#1D1D1F', fontSize: 17, fontFamily: BrandFonts.semibold },
  /* Wit (operator, 7 okt 2026): de voorwaarden moeten duidelijk leesbaar zijn. */
  disclosure: { color: 'rgba(255,255,255,0.85)', fontFamily: BrandFonts.regular, fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 14 },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 },
  link: { color: '#ffffff', fontSize: 12, fontFamily: BrandFonts.medium },
  sep: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
});
