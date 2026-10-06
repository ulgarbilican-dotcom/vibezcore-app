/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — echte glas-sheets, ook op Android (7 okt 2026).

   Operator: "dat is niet glass effect". Klopt: op Android vervaagt
   expo-blur enkel wat in een `BlurTargetView` staat, en een React Native
   `Modal` tekent in een APART venster — daar kan het glas de app erachter
   nooit zien, dus viel het terug op bijna-dekkend donker.

   Oplossing, één keer centraal:
   - de root-layout zet de hele app (navigatie + lagen) in één
     `BlurTargetView` met `rootBlurRef`;
   - sheets worden NIET als Modal getoond maar hier, in hetzelfde venster,
     naast (niet ín) die target — en hun glas vervaagt `rootBlurRef`.
   iOS vervaagt sowieso echt (UIVisualEffectView); daar is de target een
   gewone View.

   Gebruik: `<GlassSheet visible onClose>…</GlassSheet>` waar je vroeger een
   `<Modal transparent animationType="slide">` had.
   ───────────────────────────────────────────────────────────────────────── */

import { createRef, useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

/** De hele app; het glas van een sheet vervaagt dit. */
export const rootBlurRef = createRef<View>();

type Entry = { id: number; node: ReactNode; onClose: () => void };
let entries: Entry[] = [];
const listeners = new Set<(e: Entry[]) => void>();
function emit() {
  listeners.forEach((l) => l(entries));
}

/** Toon `children` als sheet zolang `visible` waar is. */
export function GlassSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [id] = useState(() => Math.random());
  useEffect(() => {
    if (!visible) {
      if (entries.some((e) => e.id === id)) {
        entries = entries.filter((e) => e.id !== id);
        emit();
      }
      return;
    }
    const next = { id, node: children, onClose };
    entries = entries.some((e) => e.id === id)
      ? entries.map((e) => (e.id === id ? next : e))
      : [...entries, next];
    emit();
  });
  /* Weg bij unmount van de aanroeper. */
  useEffect(
    () => () => {
      entries = entries.filter((e) => e.id !== id);
      emit();
    },
    [id],
  );
  return null;
}

/** Eén keer in de root-layout, NA de BlurTargetView. */
export function GlassSheetHost() {
  const [list, setList] = useState<Entry[]>(entries);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  const top = list[list.length - 1];

  /* Android-terugknop sluit de bovenste sheet, zoals een Modal deed. */
  useEffect(() => {
    if (!top) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      top.onClose();
      return true;
    });
    return () => sub.remove();
  }, [top]);

  /* De host blijft altijd staan (leeg zonder sheet), anders kunnen de
     uitgaande animaties niet afspelen. */
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {top ? (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
          <Pressable style={s.backdrop} onPress={top.onClose} accessibilityLabel="Close" />
        </Animated.View>
      ) : null}
      {top ? (
        <Animated.View
          key={top.id}
          entering={SlideInDown.duration(340)}
          exiting={SlideOutDown.duration(240)}
          style={s.sheetWrap}
          pointerEvents="box-none"
        >
          {top.node}
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92%' },
});
