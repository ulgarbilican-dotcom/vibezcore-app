/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Global error boundary

   Vangt unchecked render-errors in de hele app op. Zonder boundary zou
   een crash in bv. de actieve bracelet-sessie (timer, state-mutatie) de
   héle tab killen en de user op een zwart scherm achterlaten. Met
   boundary tonen we een nette fallback + "Try again"-knop die de tree
   reset.

   Plek: root <_layout.tsx>, sibling van Stack/SafeArea. Class-component
   omdat React error boundaries (componentDidCatch / getDerivedStateFrom-
   Error) alleen op classes werken — geen hook-equivalent.

   Mochten we later Sentry / Crashlytics toevoegen: één plek (componentDid-
   Catch) om het te initiëren.
   ─────────────────────────────────────────────────────────────────── */

import { AudioAccent, Brand, BrandFonts } from '@/constants/theme';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Class components can't use hooks, so the press-scale lives in this small
   functional wrapper — mirrors StartCard's pattern in breath-welcome.tsx. */
function PressScaleButton({
  style,
  textStyle,
  text,
  onPress,
  accessibilityLabel,
  scaleTo = 0.95,
}: {
  style: object;
  textStyle: object;
  text: string;
  onPress: () => void;
  accessibilityLabel: string;
  scaleTo?: number;
}) {
  const pressScale = useSharedValue(1);
  const onPressIn = () => {
    pressScale.value = withTiming(scaleTo, { duration: 80 });
  };
  const onPressOut = () => {
    pressScale.value = withSpring(1, { duration: 220, dampingRatio: 0.73 });
  };
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <AnimatedPressable
      style={[style, pressStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={textStyle}>{text}</Text>
    </AnimatedPressable>
  );
}

const SUPPORT_URL = 'https://www.vibezcore.com/support';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    /* Dev: gewoon naar console zodat we 'm in Metro zien. Prod: stub —
       later naar Sentry / Crashlytics als die geïntegreerd worden. */
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={s.root}>
          <View style={s.card}>
            <View style={s.iconCircle}>
              <Text style={s.iconText}>!</Text>
            </View>
            <Text style={s.title}>Something went wrong</Text>
            <Text style={s.sub}>
              An unexpected error occurred. You can try again — if it keeps
              happening, please contact support.
            </Text>
            {__DEV__ && this.state.error && (
              <Text style={s.devError} numberOfLines={6}>
                {this.state.error.message}
              </Text>
            )}
            <PressScaleButton
              style={s.btn}
              textStyle={s.btnText}
              text="Try again"
              onPress={this.reset}
              accessibilityLabel="Try again"
              scaleTo={0.96}
            />
            {/* Iter v159 (2026-06-26): Contact support knop → opent
                webformulier op vibezcore.com/support. Niet meer email-app. */}
            <PressScaleButton
              style={s.linkBtn}
              textStyle={s.linkText}
              text="Contact support"
              onPress={() => {
                void Linking.openURL(SUPPORT_URL);
              }}
              accessibilityLabel="Contact support"
            />
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.4)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  iconText: {
    color: Brand.error,
    fontSize: 32,
    fontFamily: BrandFonts.extrabold,
    lineHeight: 36,
  },
  title: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 10,
  },
  sub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.regular,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  devError: {
    color: 'rgba(255,180,180,0.85)',
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderColor: 'rgba(239,68,68,0.25)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 11,
    fontFamily: 'monospace',
    width: '100%',
    marginBottom: 18,
  },
  /* Huisstijl v4.4: CTA op donkere ondergrond = witte knop, donkere tekst.
     Brand.accent (Signal Blue) is nooit een knop-achtergrond of link-kleur. */
  btn: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 160,
    alignItems: 'center',
  },
  btnText: {
    color: '#0a0a0a',
    fontSize: 15,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.3,
  },
  linkBtn: {
    marginTop: 16,
    paddingVertical: 8,
  },
  linkText: {
    color: AudioAccent,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    letterSpacing: 0.2,
  },
});
