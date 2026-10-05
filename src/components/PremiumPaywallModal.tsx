/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Premium-popup (gedeeld)

   Losgetrokken uit breath-session.tsx (operator, 13 augustus 2026: "er moet
   een popup op de welcome page zelf open gaan zodat user indien sluiten
   gewoon op dezelfde pagina blijft") — welcome.tsx had dezelfde popup nodig,
   en een tweede kopie van ~150 regels JSX + stijlen zou vroeg of laat uit
   elkaar gaan lopen. Nu ÉÉN component, twee schermen die 'm aanroepen.

   In VIBEZCORE-stijl, nooit een systeem-alert. Wegklikbaar via het kruisje
   of de achtergrond; wie sluit, staat gewoon weer op het scherm waar hij al
   was — dat is puur een kwestie van `onClose` aanroepen zonder te
   navigeren, wat hier al zo werkte. De prijzen komen uit de store zelf
   (getProduct), dus er staat exact wat iemand gaat betalen — of niets,
   zolang de store ze nog niet gegeven heeft.

   Operator, 7 september 2026: "licht thema, Apple-achtig" — omgezet naar
   het lichte palet dat de rest van de app inmiddels gebruikt (zelfde
   `#7FB2E5` als welcome.tsx/breath-welcome.tsx, niet opnieuw verzonnen).

   Operator, 7 september 2026: "per ongeluk Monthly getikt, kan niet meer
   terug naar Yearly" — elke kaart navigeerde vroeger METEEN weg zodra je
   'm aantikte (`onClose(); router.push(...)`), dus er was geen "selectie",
   enkel een onomkeerbare tik. Nu is tikken op een kaart puur KIEZEN
   (lokale state, kan je altijd nog een keer wisselen) en is er één
   bevestigingsknop die pas dan wegnavigeert — hetzelfde patroon als elke
   bekende abonnement-paywall (kies, bevestig, geen losse acties). */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Crown, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { BrandFonts } from '@/constants/theme';
import { useIAP } from '@/hooks/useIAP';
/* GEWIJZIGD 4 oktober 2026: PRICING verhuisd van (tabs)/bracelet.tsx naar
   smart-bead-bracelet.tsx (marketing/showcase-content verplaatst uit de
   Bracelet-tab, die nu altijd Session Control toont — zie smart-bead-
   bracelet.tsx's bovenste comment-blok voor de volledige uitleg). */
import { PRICING } from '@/app/smart-bead-bracelet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ProductInfo = ReturnType<ReturnType<typeof useIAP>['getProduct']>;

/* Uit de `.map()` getrokken (hooks-regel — press-scale heeft een eigen
   shared value per kaart nodig, dat mag niet inline in een loop) — zelfde
   patroon als `StartCard` in breath-welcome.tsx. */
function TierOption({
  tier,
  prod,
  savePct,
  yearlyMonthlyEquiv,
  isSelected,
  onSelect,
}: {
  tier: Tier;
  prod: ProductInfo;
  savePct: number;
  yearlyMonthlyEquiv: string | null;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onSelect}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[s.payTier, isSelected && s.payTierMain, pressStyle]}
      android_ripple={{ color: 'rgba(127,178,229,0.15)' }}
    >
      <View style={[s.payRadio, isSelected && s.payRadioOn]}>
        {isSelected && <View style={s.payRadioDot} />}
      </View>
      {/* Operator-verzoek (Apple-paywall-tips, 11 sep 2026): SAVE-
         badge niet meer plakkend achter de naam proppen — los in
         de rechterbovenhoek van de kaart, en beide kaarten krijgen
         exact dezelfde tweeregelige prijskolom (Monthly reserveert
         evenveel hoogte als Yearly's "€X,XX/mo"-regel, ook als hij
         leeg blijft) zodat de vakken niet meer verspringen. */}
      {savePct > 0 && (
        <View style={s.paySave}>
          <Text style={s.paySaveTxt}>SAVE {savePct}%</Text>
        </View>
      )}
      <View style={s.payTierLeft}>
        <Text style={s.payTierName}>
          {tier === 'yearly' ? 'Yearly' : 'Monthly'}
        </Text>
      </View>
      {prod ? (
        prod.freeTrialDays ? (
          <View style={s.payTrialCol}>
            <Text style={s.payTrialLead}>
              {prod.freeTrialDays} days free
            </Text>
            {/* Operator, 24 september 2026 ("maandbedrag groot, jaarbedrag
               klein"): ook in de trial-regel het maandbedrag leidend maken
               voor Yearly — mensen rekenen onbewust in maandbedragen. */}
            <Text style={s.payTrialThen}>
              {tier === 'yearly' && yearlyMonthlyEquiv
                ? `then ${yearlyMonthlyEquiv}/mo · billed ${prod.localizedPrice} yearly`
                : `then ${prod.localizedPrice}/mo`}
            </Text>
          </View>
        ) : tier === 'yearly' && yearlyMonthlyEquiv ? (
          /* Operator, 24 september 2026: maandbedrag groot en leidend,
             jaarbedrag klein eronder — omgekeerd van voorheen (was
             jaarbedrag groot, maandequivalent klein). */
          <View style={s.payTrialCol}>
            <Text style={s.payTierPrice}>{yearlyMonthlyEquiv}/mo</Text>
            <Text style={s.payTrialThen}>
              billed {prod.localizedPrice} yearly
            </Text>
          </View>
        ) : (
          <View style={s.payTrialCol}>
            <Text style={s.payTierPrice}>
              {prod.localizedPrice}
              {tier === 'yearly' ? '/yr' : '/mo'}
            </Text>
            <Text style={s.payTrialThen}> </Text>
          </View>
        )
      ) : null}
    </AnimatedPressable>
  );
}

/* Zelfde lichte accentblauw als de rest van de app (welcome.tsx/
   breath-welcome.tsx: `HAPTIC_BLUE`/`LIGHT_BLUE`) — niet opnieuw
   verzinnen, dit is het vastgelegde lichte-thema-accent. */
const LIGHT_BLUE = '#7FB2E5';

type Tier = 'yearly' | 'monthly';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Waar de popup opengaat — bepaalt enkel de eyebrow en waar de gebruiker
   *  na aankoop terugkomt. Het pakket zelf is overal hetzelfde (operator,
   *  5 okt 2026: audio, breathwork en State Control zijn één pakket). */
  context?: PaywallContext;
};

export type PaywallContext = 'breathwork' | 'state-control' | 'audio';

/** Voordelen in volgorde van relevantie: het eigen product eerst. Operator,
 *  1 okt 2026: 64 = 15 technieken × hun benoemde duur-varianten. */
function benefitLines(context: PaywallContext, audioWorth: string | undefined): string[] {
  const audio = audioWorth
    ? `Full Audio Library included — worth ${audioWorth}/mo`
    : 'Full VIBEZCORE Audio Library included';
  const stateControl = [
    'State Control — every haptic state, any duration',
    'Keeps running with your screen locked',
  ];
  const breathwork = [
    'All 64 guided sessions — five states, every rhythm and duration',
    'Voice, haptic and visual guidance',
    'Soundscapes, goals and your daily plan',
  ];
  const breathworkShort = 'All 64 guided breathwork sessions';
  const stateControlShort = 'State Control — every haptic state, any duration';
  if (context === 'state-control') return [...stateControl, breathworkShort, audio];
  if (context === 'audio') return ['Full VIBEZCORE Audio Library', breathworkShort, stateControlShort];
  return [...breathwork, stateControlShort, audio];
}

export default function PremiumPaywallModal({ visible, onClose, context = 'breathwork' }: Props) {
  const { getProduct } = useIAP();
  const [selected, setSelected] = useState<Tier>('yearly');

  const selectedProduct = getProduct(selected);

  /* Operator, 24 september 2026 ("wij hebben hier duidelijke regels voor,
     kijk naar de andere popups"): teruggezet — exact hetzelfde patroon als
     ProtocolTeaserModal.tsx (zelfde popup-type: gecentreerde fade-kaart,
     backdrop-tap-sluit). Géén `sheetGrip`-streepje hier — dat hoort bij de
     ONDERAAN-uitschuivende instellingen-sheets in breath-session.tsx, een
     ander UI-patroon dan deze gecentreerde kaart. */
  const closePressScale = useSharedValue(1);
  const onClosePressIn = () => {
    closePressScale.value = withTiming(0.92, { duration: 80 });
  };
  const onClosePressOut = () => {
    closePressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const closePressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: closePressScale.value }],
  }));

  const ctaPressScale = useSharedValue(1);
  const onCtaPressIn = () => {
    ctaPressScale.value = withTiming(0.96, { duration: 80 });
  };
  const onCtaPressOut = () => {
    ctaPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const ctaPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaPressScale.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop — full-screen tap-dismiss overlay: geen press-scale
         (zou de hele achtergrond laten "krimpen"), zie CLAUDE.md-taak
         uitzondering voor full-screen backdrops. */}
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        {/* Dummy stop-propagation Pressable — vangt enkel taps op de kaart
           op zodat ze niet doorborrelen naar de backdrop; geen eigen
           onPress-actie, dus geen press-scale nodig hier. */}
        <Pressable style={s.payCard} onPress={() => {}}>
          <AnimatedPressable
            style={[s.payClose, closePressStyle]}
            onPress={onClose}
            onPressIn={onClosePressIn}
            onPressOut={onClosePressOut}
            hitSlop={12}
          >
            <X size={18} color="rgba(10,10,12,0.45)" strokeWidth={2.2} />
          </AnimatedPressable>
          <Text style={s.payEyebrow}>
            {context === 'state-control'
              ? 'VIBEZCORE STATE CONTROL'
              : context === 'audio'
                ? 'VIBEZCORE AUDIO LIBRARY'
                : 'VIBEZCORE BREATHWORK'}
          </Text>
          <Text style={s.payTitle}>Unlock every session</Text>
          <View style={s.payList}>
            {[
              /* Operator, 5 okt 2026 ("elke popup moet beginnen met het eigen
                 relevante product"): eerst de voordelen van het product waar
                 de gebruiker vandaan komt, daarna de andere twee. */
              ...benefitLines(context, getProduct('monthly')?.regularPriceLabel),
            ].map((line) => (
              <View key={line} style={s.payRow}>
                <View style={s.payCheck}>
                  <Check size={11} color="#ffffff" strokeWidth={3.2} />
                </View>
                <Text style={s.payRowTxt}>{line}</Text>
              </View>
            ))}
          </View>
          <View style={s.payCrownRow}>
            <Crown size={16} color="#B8842A" strokeWidth={2.2} />
            <Text style={s.payCrownTxt}>
              Bracelet price locked: {PRICING.bracelet.eur} at launch
              (not {PRICING.bracelet.eurOld})
            </Text>
          </View>
          {(['yearly', 'monthly'] as const).map((tier) => {
            const prod = getProduct(tier);
            const yr = getProduct('yearly')?.priceAmountMicros;
            const mo = getProduct('monthly')?.priceAmountMicros;
            const savePct =
              tier === 'yearly' && yr && mo
                ? Math.round((1 - yr / (mo * 12)) * 100)
                : 0;
            /* Yearly-tier toont ook de maandelijkse tegenwaarde ("€5,83/mo")
               zodat 'ie direct te vergelijken is met de Monthly-kaart eronder
               — anders moet de user zelf door 12 delen. */
            const yearlyMonthlyEquiv =
              tier === 'yearly' && prod?.priceAmountMicros && prod.currency
                ? new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: prod.currency,
                  }).format(prod.priceAmountMicros / 1_000_000 / 12)
                : null;
            const isSelected = tier === selected;
            return (
              <TierOption
                key={tier}
                tier={tier}
                prod={prod}
                savePct={savePct}
                yearlyMonthlyEquiv={yearlyMonthlyEquiv}
                isSelected={isSelected}
                onSelect={() => setSelected(tier)}
              />
            );
          })}

          {/* Operator, 7 september 2026: "kan niet meer terug naar Yearly"
             — één bevestigingsknop i.p.v. dat elke kaart zelf al wegnavigeert.
             Zolang je hier niet op tikt, kan je altijd nog wisselen. */}
          <AnimatedPressable
            onPress={() => {
              onClose();
              /* Operator, 10 september 2026: "hoe weten wij of user audio
                 of breathwork wil" — beide huidige aanroepers van deze
                 modal (breath-session.tsx, goal.tsx) zitten in breathwork-
                 context, dus vast `returnTo=breathwork` i.p.v. dat te
                 gissen uit onboarding-status (onbetrouwbaar — zie
                 toelichting in subscribe.tsx). */
              router.push(`/subscribe?tier=${selected}&returnTo=${context}` as never);
            }}
            onPressIn={onCtaPressIn}
            onPressOut={onCtaPressOut}
            style={[s.payCta, ctaPressStyle]}
            android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
          >
            {/* Operator, 24 september 2026 ("Apple-paywall-tips"): CTA
               actiegerichter dan de administratieve "Continue with X" —
               welke kaart geselecteerd is, is al zichtbaar via de radio-
               knop op de kaart zelf. */}
            <Text style={s.payCtaTxt}>
              {selectedProduct?.freeTrialDays
                ? `Start ${selectedProduct.freeTrialDays}-day free trial`
                : 'Unlock All Sessions'}
            </Text>
          </AnimatedPressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    /* Apple-paywall-tip (11 sep 2026): achtergrond veel donkerder zodra de
       pop-up open is, anders schemeren de paarse "TRY 30 SECONDS FREE" /
       "Unlock all sessions" knoppen eronder nog door en leiden ze af. */
    backgroundColor: 'rgba(6,6,8,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  payCard: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(10,10,12,0.08)',
    padding: 22,
    paddingTop: 24,
    overflow: 'hidden',
  },
  payClose: { position: 'absolute', top: 16, right: 16, zIndex: 2 },
  payEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: LIGHT_BLUE,
    marginBottom: 6,
  },
  payTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 26,
    color: '#0a0a0c',
    letterSpacing: -0.5,
    marginBottom: 14,
    paddingRight: 26,
  },
  payList: { gap: 9, marginBottom: 18 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: LIGHT_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payRowTxt: {
    flex: 1,
    fontFamily: BrandFonts.regular,
    fontSize: 15,
    lineHeight: 20,
    color: 'rgba(10,10,12,0.68)',
  },
  payCrownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(224,179,65,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(224,179,65,0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  payCrownTxt: {
    flex: 1,
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: '#8a5f14',
  },
  payTier: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(10,10,12,0.12)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 9,
    gap: 12,
    position: 'relative',
  },
  payTierMain: {
    borderColor: LIGHT_BLUE,
    backgroundColor: 'rgba(127,178,229,0.1)',
  },
  /* Radioknop i.p.v. enkel een randkleur — maakt "dit is een keuze, geen
     losse knop" meteen duidelijk, zelfde principe als een gewone
     abonnement-paywall. */
  payRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(10,10,12,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payRadioOn: { borderColor: LIGHT_BLUE },
  payRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LIGHT_BLUE,
  },
  payTierLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  /* Vaste hoogte zodat Yearly (prijs + "€X,XX/mo"-regel) en Monthly (prijs +
     lege regel) exact dezelfde blokhoogte krijgen — geen verspringende
     vakken meer. */
  payTrialCol: { alignItems: 'flex-end', minHeight: 36, justifyContent: 'center' },
  payTrialLead: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    color: '#0a0a0c',
  },
  payTrialThen: {
    marginTop: 1,
    fontFamily: BrandFonts.regular,
    fontSize: 12,
    color: 'rgba(10,10,12,0.5)',
  },
  /* Los in de rechterbovenhoek van de kaart i.p.v. plakkend achter de naam
     (Apple-paywall-tip, 11 sep 2026). */
  paySave: {
    position: 'absolute',
    top: -9,
    right: 14,
    borderRadius: 999,
    backgroundColor: LIGHT_BLUE,
    paddingHorizontal: 9,
    paddingVertical: 3,
    zIndex: 1,
  },
  paySaveTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: '#ffffff',
  },
  payTierName: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    color: '#0a0a0c',
  },
  payTierPrice: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
    color: '#0a0a0c',
  },
  /* Operator, 24 september 2026: "geen blauwe CTA meer" — EERST naar de
     witte `introCtaMatch`-stijl gezet (tab-intro's elders), maar die stijl
     veronderstelt een DONKERE app-achtergrond eronder. `payCard` hier is
     zelf al wit ("licht thema, Apple-achtig") — wit-op-wit is vrijwel
     onzichtbaar. Op een lichte kaart is het omgekeerde de juiste keuze:
     een donkere/zwarte CTA voor contrast, zoals Apple-paywalls op een
     lichte kaart doen. */
  payCta: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0c',
  },
  payCtaTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 17,
    color: '#ffffff',
  },
});
