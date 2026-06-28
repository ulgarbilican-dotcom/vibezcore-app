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
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
        <View style={s.card}>
          <Text style={s.title}>{current.title}</Text>
          {current.message ? (
            <Text style={s.message}>{current.message}</Text>
          ) : null}
          <View
            style={[
              s.buttonRow,
              buttons.length > 2 && s.buttonColumn,
            ]}
          >
            {buttons.map((b, idx) => {
              const isCancel = b.style === 'cancel';
              const isDestructive = b.style === 'destructive';
              return (
                <Pressable
                  key={idx}
                  style={[
                    s.button,
                    isCancel && s.buttonCancel,
                    isDestructive && s.buttonDestructive,
                    !isCancel && !isDestructive && s.buttonPrimary,
                    buttons.length > 2 && s.buttonFull,
                  ]}
                  onPress={() => {
                    try {
                      b.onPress?.();
                    } catch {
                      /* swallow caller errors */
                    }
                    dismiss(idx);
                  }}
                >
                  <Text
                    style={[
                      s.buttonText,
                      isCancel && s.buttonCancelText,
                      isDestructive && s.buttonDestructiveText,
                      !isCancel && !isDestructive && s.buttonPrimaryText,
                    ]}
                  >
                    {b.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Pressable>
    </Modal>
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
    backgroundColor: Brand.bg,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    color: Brand.text,
    fontFamily: BrandFonts.extrabold,
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  message: {
    color: Brand.textDim,
    fontFamily: BrandFonts.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
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
  buttonPrimary: {
    backgroundColor: Brand.accent,
  },
  buttonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Brand.border,
  },
  buttonDestructive: {
    backgroundColor: Brand.error,
  },
  buttonText: {
    fontFamily: BrandFonts.bold,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  buttonPrimaryText: { color: '#ffffff' },
  buttonCancelText: { color: Brand.textDim },
  buttonDestructiveText: { color: '#ffffff' },
});
