/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — VibezAlert (brand-styled replacement for Alert.alert)

   Iter v167 (2026-06-28): operator-feedback "popups moeten ook allemaal
   vibezcore stijl zijn en niet generiek". OS Alert.alert produces a white
   box with system-font and iOS-blue buttons — breaks the brand-immersion.

   Replacement contract:
     showVibezAlert({ title, message, buttons })
   Mirrors Alert.alert's API but renders an in-app modal styled in
   Brand colors with BrandFonts. Mount <VibezAlertHost /> once at root
   (already done in _layout.tsx); each showVibezAlert() call queues a
   dialog and waits for the user to tap a button.

   `confirmDestructive` helper for the common "delete X — Cancel / Delete"
   pattern: returns a Promise<boolean>.

   This component handles only APP-EMITTED alerts. Native store popups
   (Google Play "Fout", Apple StoreKit) stay untouched — we have no
   control over those (see memory: vibezcore-styled-popups).
   ─────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import VibezGlass from './VibezGlass';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type VibezAlertButton = {
  text: string;
  /** 'primary' = accent-blue filled. 'destructive' = red filled.
   *  'cancel' = dim ghost. Default 'primary'. */
  style?: 'primary' | 'destructive' | 'cancel';
  onPress?: () => void;
};

export type VibezAlertConfig = {
  title: string;
  message?: string;
  buttons?: VibezAlertButton[];
  /** Operator, 12 september 2026: breath-setup/breath-session.tsx zijn
     omgezet naar light — hun eigen alerts (bv. de bracelet-popup) mogen
     niet meer op de vaste, donkere `Brand`-kaart vallen. Optioneel en
     standaard `false`: de rest van de (nog grotendeels donkere) app
     blijft ongewijzigd, dit raakt enkel wie 'm expliciet meegeeft. */
  light?: boolean;
};

type QueueEntry = VibezAlertConfig & { resolve: (idx: number) => void };

let queue: QueueEntry[] = [];
let listener: ((entry: QueueEntry | null) => void) | null = null;

/** Show a VIBEZCORE-styled alert. API mirrors Alert.alert but no native popup. */
export function showVibezAlert(config: VibezAlertConfig): Promise<number> {
  return new Promise((resolve) => {
    const entry: QueueEntry = { ...config, resolve };
    queue.push(entry);
    if (queue.length === 1 && listener) listener(entry);
  });
}

/** Convenience for confirm/cancel dialogs that need a boolean result.
 *  Resolves true when user taps the confirm button, false on cancel. */
export function confirmVibezAlert(opts: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return showVibezAlert({
    title: opts.title,
    message: opts.message,
    buttons: [
      { text: opts.cancelText ?? 'Cancel', style: 'cancel' },
      {
        text: opts.confirmText ?? 'Confirm',
        style: opts.destructive ? 'destructive' : 'primary',
      },
    ],
  }).then((idx) => idx === 1);
}

/** Mount once at root. Renders the queued dialog as a brand-styled modal. */
export function VibezAlertHost() {
  const [current, setCurrent] = useState<QueueEntry | null>(null);

  useEffect(() => {
    listener = setCurrent;
    if (queue.length > 0) setCurrent(queue[0]);
    return () => {
      listener = null;
    };
  }, []);

  const dismiss = (idx: number) => {
    const entry = current;
    if (!entry) return;
    setCurrent(null);
    queue.shift();
    entry.resolve(idx);
    /* Defer next entry to next tick so dismissal animation can play. */
    setTimeout(() => {
      if (queue.length > 0) setCurrent(queue[0]);
    }, 50);
  };

  if (!current) return null;

  const buttons = current.buttons?.length
    ? current.buttons
    : [{ text: 'OK', style: 'primary' as const }];
  const light = !!current.light;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        /* Android back-button: treat as cancel if any cancel-style button. */
        const cancelIdx = buttons.findIndex((b) => b.style === 'cancel');
        dismiss(cancelIdx >= 0 ? cancelIdx : 0);
      }}
      statusBarTranslucent
    >
      <Pressable style={s.scrim} onPress={() => { /* tap outside = no dismiss */ }}>
        <View style={[s.card, light && s.cardLight]}>
          {/* Operator, 10 okt 2026 ("popupkaarten moeten allemaal glas"):
              zelfde VIBEZCORE-glas als de kaarten in de ademsessie. */}
          {!light ? <VibezGlass radius={20} level="sheet" style={StyleSheet.absoluteFill} /> : null}
          <Text style={[s.title, light && s.titleLight]}>{current.title}</Text>
          {current.message ? (
            <Text style={[s.message, light && s.messageLight]}>{current.message}</Text>
          ) : null}
          <View
            style={[
              s.buttonRow,
              buttons.length > 2 && s.buttonColumn,
            ]}
          >
            {buttons.map((b, idx) => (
              <AlertButton
                key={idx}
                button={b}
                light={light}
                multiline={buttons.length > 2}
                onPress={() => {
                  try {
                    b.onPress?.();
                  } catch {
                    /* swallow caller errors */
                  }
                  dismiss(idx);
                }}
              />
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

/** One alert button. Own component (not inline in the .map()) so the
 *  press-scale hooks don't run inside a loop. */
function AlertButton({
  button,
  light,
  multiline,
  onPress,
}: {
  button: VibezAlertButton;
  light: boolean;
  multiline: boolean;
  onPress: () => void;
}) {
  const isCancel = button.style === 'cancel';
  const isDestructive = button.style === 'destructive';

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
      style={[
        s.button,
        isCancel && s.buttonCancel,
        isCancel && light && s.buttonCancelLight,
        isDestructive && s.buttonDestructive,
        !isCancel && !isDestructive && s.buttonPrimary,
        multiline && s.buttonFull,
        pressStyle,
      ]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Text
        style={[
          s.buttonText,
          isCancel && s.buttonCancelText,
          isCancel && light && s.buttonCancelTextLight,
          isDestructive && s.buttonDestructiveText,
          !isCancel && !isDestructive && s.buttonPrimaryText,
        ]}
      >
        {button.text}
      </Text>
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 22,
    width: '100%',
    maxWidth: 360,
  },
  /* Operator, 12 september 2026: light-only override — de rest van de
     kaart (knop-kleuren: accent/error) blijft ongewijzigd, die werken al
     op beide achtergronden. */
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(10,10,12,0.12)',
  },
  title: {
    color: Brand.text,
    fontFamily: BrandFonts.extrabold,
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  titleLight: { color: '#0a0a0c' },
  message: {
    color: Brand.textDim,
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  messageLight: { color: '#4a4a4e' },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  buttonColumn: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFull: {
    flex: 0,
    width: '100%',
  },
  /* Huisstijl v4.4: CTA op donkere ondergrond = witte knop, donkere tekst.
     Brand.accent (Signal Blue) is nooit een knop-achtergrond. */
  buttonPrimary: {
    backgroundColor: '#ffffff',
  },
  buttonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Brand.border,
  },
  buttonCancelLight: { borderColor: 'rgba(10,10,12,0.16)' },
  buttonDestructive: {
    backgroundColor: Brand.error,
  },
  buttonText: {
    fontFamily: BrandFonts.bold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  buttonPrimaryText: { color: '#0a0a0a' },
  buttonCancelText: { color: Brand.textDim },
  buttonCancelTextLight: { color: '#4a4a4e' },
  buttonDestructiveText: { color: '#ffffff' },
});
