/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — laag waarin de ademsessie leeft (zie
   services/breath-session-host.ts). Ligt boven de hele app; geminimaliseerd
   schuift ze naar onder buiten beeld en laat ze geen tikken meer door,
   maar de sessie blijft gemonteerd en loopt door.
   ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BreathSession } from '@/app/breath-session';
import {
  cancelPendingBreathOpen,
  confirmPendingBreathOpen,
  getBreathHost,
  getPendingBreathOpen,
  subscribeBreathHost,
} from '@/services/breath-session-host';
import ConfirmCard from './ConfirmCard';
import { BreathHostContext } from './breath-host-context';

export function BreathSessionHost() {
  const [host, setHost] = useState(getBreathHost());
  const [pending, setPending] = useState(getPendingBreathOpen());
  useEffect(
    () =>
      subscribeBreathHost(() => {
        setHost(getBreathHost());
        setPending(getPendingBreathOpen());
      }),
    [],
  );
  const { height: winHeight } = useWindowDimensions();
  /* 20 okt 2026: de laag schoof maar `winHeight` omlaag; op Android (3-knops
     navigatie, edge-to-edge) is het scherm hoger dan het "window" — de bovenkant
     van de sessie (CALM CONTROL · Box Breathing + chevron/tandwiel) bleef als een
     strook onderaan zichtbaar over Settings en andere schermen (Test Lab A10).
     Ruim buiten beeld parkeren. */
  const height = winHeight + 240;
  const offset = useSharedValue(height);

  const minimized = host?.minimized ?? false;
  const open = host !== null;
  useEffect(() => {
    offset.value = withTiming(open && !minimized ? 0 : height, {
      duration: open && !minimized ? 320 : 260,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, minimized, height]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  /* De vraag kan ook komen zonder ademlaag: State Control loopt en er
     start een ademsessie (19 okt 2026). */
  const confirm = (
    <ConfirmCard
      visible={pending !== null}
      title="End current session?"
      body={
        pending?.kind === 'state'
          ? `Your ${pending.label} session ends. Your time is saved.`
          : `Your ${pending?.label ?? 'Breathwork'} session ends. The time you breathed is saved.`
      }
      confirmLabel="End & Start New"
      onCancel={cancelPendingBreathOpen}
      onConfirm={confirmPendingBreathOpen}
    />
  );
  if (!host) return confirm;
  return (
    <>
      <Animated.View
        style={[StyleSheet.absoluteFill, s.layer, style]}
        pointerEvents={minimized ? 'none' : 'auto'}
      >
        <BreathHostContext.Provider value={{ params: host.params, minimized }}>
          <BreathSession key={host.id} />
        </BreathHostContext.Provider>
      </Animated.View>
      {confirm}
    </>
  );
}

const s = StyleSheet.create({
  layer: { zIndex: 60, elevation: 60, backgroundColor: '#000000' },
});
