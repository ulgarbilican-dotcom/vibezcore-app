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

import { QaPressable } from '@/components/QaPressable';
import { SPRING_SHEET, isReduceMotion } from '@/constants/motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Dimensions, Easing, PanResponder, Pressable, StyleSheet, View } from 'react-native';

type Entry = { id: number; node: ReactNode; onClose: () => void; fullHeight?: boolean };
/* Een stapel i.p.v. één plek (audit 16 okt 2026): staan er twee bladen
   tegelijk open (bv. een ademsessie die op de achtergrond eindigt terwijl
   je elders een blad open hebt), dan won vroeger wie het laatst hertekende
   en raakte de ander zoek. Nu: het laatst geopende ligt bovenaan; sluit het,
   dan komt het vorige terug. Hertekenen werkt de inhoud bij zonder de
   volgorde te veranderen. */
let stack: Entry[] = [];
let current: Entry | null = null;
const listeners = new Set<(e: Entry | null) => void>();
function emit() {
  current = stack.length ? stack[stack.length - 1] : null;
  listeners.forEach((l) => l(current));
}

/** Staat er nu een blad open? (Voor terugknop-afhandeling elders.) */
export function isGlassSheetOpen(): boolean {
  return stack.length > 0;
}

/** Na het sluiten van een blad pas verder (19 okt 2026, operator: "Back op
 *  /subscribe toonde dezelfde saleskaart opnieuw"). Een blad verdwijnt pas
 *  in een effect NA de volgende render van zijn scherm — navigeer je meteen,
 *  dan bevriest dat scherm (achtergrond) vóór het blad weg is, en staat de
 *  kaart er bij Back nog. Dus: wachten tot het blad echt uit de stapel is
 *  en de uitgaande animatie (220 ms) voorbij is; vangnet na 500 ms. */
export function afterGlassSheetClosed(cb: () => void): void {
  const startLen = stack.length;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    listeners.delete(onEmit);
    clearTimeout(fallback);
    setTimeout(cb, 240);
  };
  const onEmit = () => {
    if (stack.length < startLen) finish();
  };
  listeners.add(onEmit);
  const fallback = setTimeout(finish, 500);
}

/** Toon `children` als sheet zolang `visible` waar is. */
export function GlassSheet({
  visible,
  onClose,
  children,
  fullHeight = false,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Tot helemaal bovenaan het scherm (i.p.v. max 92%). */
  fullHeight?: boolean;
}) {
  const [id] = useState(() => Math.random());
  useEffect(() => {
    const i = stack.findIndex((e) => e.id === id);
    if (visible) {
      const entry = { id, node: children, onClose, fullHeight };
      if (i >= 0) {
        stack[i] = entry;
        if (i === stack.length - 1) emit();
      } else {
        stack = [...stack, entry];
        emit();
      }
    } else if (i >= 0) {
      stack = stack.filter((e) => e.id !== id);
      emit();
    }
  });
  useEffect(
    () => () => {
      if (stack.some((e) => e.id === id)) {
        stack = stack.filter((e) => e.id !== id);
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
  /* Naar beneden vegen sluit het blad (audit 16 okt 2026): elk blad toont
     Apple's grijze streepje bovenaan, en dat belooft precies dit. Het blad
     volgt de vinger; ver genoeg of snel genoeg = sluiten, anders veert het
     terug. Lijsten en schuifjes in het blad houden hun eigen beweging. */
  const drag = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 110 || g.vy > 0.9) {
          current?.onClose();
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    }),
  ).current;

  useEffect(() => {
    const onChange = (e: Entry | null) => {
      const was = shownRef.current;
      if (e) {
        shownRef.current = e;
        setShown(e);
        if (!was || was.id !== e.id) {
          drag.setValue(0);
          progress.stopAnimation();
          progress.setValue(0);
          /* 23 okt 2026 (animatie-optimalisatie): een veer i.p.v. een tijd-curve — onderbreekbaar en met een
             zachte uitloop, zoals een iOS-blad. */
          if (isReduceMotion()) progress.setValue(1);
          else
            Animated.spring(progress, {
              toValue: 1,
              stiffness: SPRING_SHEET.stiffness,
              damping: SPRING_SHEET.damping,
              mass: SPRING_SHEET.mass,
              useNativeDriver: true,
            }).start();
        }
      } else if (was) {
        Animated.spring(progress, {
          toValue: 0,
          stiffness: 320,
          damping: 36,
          mass: 1,
          overshootClamping: true,
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
  }, [progress, drag]);

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
            <QaPressable style={s.backdrop} onPress={() => current?.onClose()} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View
            style={[
              s.sheetWrap,
              shown.fullHeight ? s.sheetWrapFull : null,
              {
                transform: [
                  {
                    translateY: Animated.add(
                      progress.interpolate({ inputRange: [0, 1], outputRange: [H, 0] }),
                      drag,
                    ),
                  },
                ],
              },
            ]}
            pointerEvents="box-none"
            /* VoiceOver: enkel het blad is bereikbaar; twee-vinger-Z sluit. */
            accessibilityViewIsModal
            onAccessibilityEscape={() => current?.onClose()}
            {...pan.panHandlers}
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
  sheetWrapFull: { top: 0, maxHeight: '100%' },
});
