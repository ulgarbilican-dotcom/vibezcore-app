/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — echte glas-sheets, ook op Android (7 okt 2026).

   Operator: "dat is niet glass effect". Op Android vervaagt expo-blur enkel
   wat in een `BlurTargetView` staat, en een React Native `Modal` tekent in
   een APART venster — daar ziet het glas de app erachter nooit.

   - de root-layout zet de hele app in één `BlurTargetView` (rootBlurRef,
     utils/root-blur.ts);
   - sheets worden hier getekend, in hetzelfde venster maar NAAST die
     target, en hun glas vervaagt rootBlurRef.

   Animatie bewust met de kern-`Animated` (native driver) en pas
   wegnemen NA de uitgaande animatie: Reanimated-`exiting` gaf op Android
   de crash "SafeAreaProvider contains null child … the view may have been
   removed" (7 okt 2026).

   Gebruik: `<GlassSheet visible onClose>…</GlassSheet>` waar je vroeger een
   `<Modal transparent animationType="slide">` had.
   ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Dimensions, Easing, Pressable, StyleSheet, View } from 'react-native';

type Entry = { id: number; node: ReactNode; onClose: () => void };
let current: Entry | null = null;
const listeners = new Set<(e: Entry | null) => void>();
function emit() {
  listeners.forEach((l) => l(current));
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
    if (visible) {
      current = { id, node: children, onClose };
      emit();
    } else if (current?.id === id) {
      current = null;
      emit();
    }
  });
  useEffect(
    () => () => {
      if (current?.id === id) {
        current = null;
        emit();
      }
    },
    [id],
  );
  return null;
}

/** Eén keer in de root-layout, NA (naast) de BlurTargetView. */
export function GlassSheetHost() {
  const [shown, setShown] = useState<Entry | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const shownRef = useRef<Entry | null>(null);
  const H = Dimensions.get('window').height;

  useEffect(() => {
    const onChange = (e: Entry | null) => {
      const was = shownRef.current;
      if (e) {
        shownRef.current = e;
        setShown(e);
        if (!was || was.id !== e.id) {
          progress.stopAnimation();
          progress.setValue(0);
          Animated.timing(progress, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      } else if (was) {
        Animated.timing(progress, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          /* Pas weg als er intussen geen nieuwe sheet kwam. */
          if (finished && !current) {
            shownRef.current = null;
            setShown(null);
          }
        });
      }
    };
    listeners.add(onChange);
    if (current) onChange(current);
    return () => {
      listeners.delete(onChange);
    };
  }, [progress]);

  /* Android-terugknop sluit de sheet, zoals een Modal deed. */
  useEffect(() => {
    if (!shown) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      current?.onClose();
      return true;
    });
    return () => sub.remove();
  }, [shown]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={shown ? 'box-none' : 'none'}>
      {shown ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
            <Pressable style={s.backdrop} onPress={() => current?.onClose()} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View
            style={[
              s.sheetWrap,
              { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [H, 0] }) }] },
            ]}
            pointerEvents="box-none"
          >
            {shown.node}
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  /* Operator, 7 okt 2026: de pagina erachter dieper dimmen. */
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.74)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92%' },
});
