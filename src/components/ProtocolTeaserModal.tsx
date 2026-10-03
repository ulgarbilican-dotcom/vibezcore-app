/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Protocol-teaser (gratis proef op)

   Operator, 13 augustus 2026: "niet naar paywall, altijd eerst naar
   popup" — wie zijn ene gratis protocol al gebruikt heeft en een nieuw
   protocol probeert te bouwen, ziet EERST deze zachte uitleg (waarom dit nu
   premium is, wat het oplevert), niet meteen de prijzen. Pas als iemand
   hier zelf "See Premium" kiest, gaat de echte betaal-paywall
   (PremiumPaywallModal) open. Twee stappen, geen verrassing.
   ───────────────────────────────────────────────────────────────────────── */

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Crown, RefreshCw, Sparkles, X } from 'lucide-react-native';
import { AudioAccent, BrandFonts } from '@/constants/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  /** "Maybe later" — anders dan de X/achtergrond (die alleen sluiten): dit
   *  stuurt door naar select mode, consistent met "Maybe later" op de
   *  breathwork-onboarding (operator, 13 augustus 2026). Valt terug op
   *  `onClose` als niet meegegeven. */
  onMaybeLater?: () => void;
};

export default function ProtocolTeaserModal({
  visible,
  onClose,
  onUpgrade,
  onMaybeLater,
}: Props) {
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

  const laterPressScale = useSharedValue(1);
  const onLaterPressIn = () => {
    laterPressScale.value = withTiming(0.94, { duration: 80 });
  };
  const onLaterPressOut = () => {
    laterPressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const laterPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: laterPressScale.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Backdrop — full-screen tap-dismiss overlay: geen press-scale
         (zou de hele achtergrond laten "krimpen"), zie CLAUDE.md-taak
         uitzondering voor full-screen backdrops. */}
      <Pressable style={s.backdrop} onPress={onClose}>
        {/* Dummy stop-propagation Pressable — vangt enkel taps op de kaart
           op zodat ze niet doorborrelen naar de backdrop; geen eigen
           onPress-actie, dus geen press-scale nodig hier. */}
        <Pressable style={s.card} onPress={() => {}}>
          <AnimatedPressable
            style={[s.close, closePressStyle]}
            onPress={onClose}
            onPressIn={onClosePressIn}
            onPressOut={onClosePressOut}
            hitSlop={12}
          >
            <X size={18} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
          </AnimatedPressable>

          <View style={s.badge}>
            <Sparkles size={13} color={AudioAccent} strokeWidth={2.4} />
            <Text style={s.badgeTxt}>You've tried your free protocol</Text>
          </View>

          <Text style={s.title}>Build unlimited protocols</Text>
          <Text style={s.body}>
            You already felt how a real protocol works — a goal, a schedule,
            reminders that follow through. Premium unlocks a new protocol any
            time your goal changes, no limits.
          </Text>

          <View style={s.row}>
            <RefreshCw size={16} color={AudioAccent} strokeWidth={2.2} />
            <Text style={s.rowTxt}>Rebuild your protocol whenever your goal shifts</Text>
          </View>
          <View style={s.row}>
            <Crown size={16} color={AudioAccent} strokeWidth={2.2} />
            {/* Operator, 1 okt 2026 ("fout getal bij breathwork popup na
               30 sec"): was "49", nergens in de data te vinden. Correcte,
               geverifieerde telling: 15 technieken (5 states × 3 niveaus)
               × hun benoemde duur-varianten = 64, zie de toelichting bij
               "guided sessions" elders in de app/marketing-copy. */}
            <Text style={s.rowTxt}>Full access to all 64 guided sessions</Text>
          </View>

          <AnimatedPressable
            style={[s.cta, ctaPressStyle]}
            onPress={onUpgrade}
            onPressIn={onCtaPressIn}
            onPressOut={onCtaPressOut}
          >
            <Text style={s.ctaTxt}>SEE PREMIUM</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={laterPressStyle}
            onPress={onMaybeLater ?? onClose}
            onPressIn={onLaterPressIn}
            onPressOut={onLaterPressOut}
            hitSlop={10}
          >
            <Text style={s.later}>Maybe later</Text>
          </AnimatedPressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: '#141018',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 24,
  },
  close: { position: 'absolute', top: 16, right: 16, zIndex: 2 },

  /* Huisstijl v4.4: Brand.accent (#3a8fff, Signal Blue) is enkel voor
     haptic-pulse/"nu actief" — nooit badges/tekst. AudioAccent is
     de badge-/eyebrow-kleur op donker. */
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(110, 133, 196, 0.4)',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  badgeTxt: { fontFamily: BrandFonts.semibold, fontSize: 11.5, color: AudioAccent },

  title: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: '#ffffff',
  },
  body: {
    marginTop: 10,
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.72)',
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  rowTxt: {
    flex: 1,
    fontFamily: BrandFonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.82)',
  },

  cta: {
    marginTop: 22,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: { fontFamily: BrandFonts.bold, fontSize: 13, letterSpacing: 1.4, color: '#0a0a0a' },
  later: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: BrandFonts.semibold,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.45)',
  },
});
