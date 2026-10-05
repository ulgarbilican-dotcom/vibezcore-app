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
import { getBreathHost, subscribeBreathHost } from '@/services/breath-session-host';
import { BreathHostContext } from './breath-host-context';

export function BreathSessionHost() {
  const [host, setHost] = useState(getBreathHost());
  useEffect(() => subscribeBreathHost(() => setHost(getBreathHost())), []);
  const { height } = useWindowDimensions();
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

  if (!host) return null;
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, s.layer, style]}
      pointerEvents={minimized ? 'none' : 'auto'}
    >
      <BreathHostContext.Provider value={{ params: host.params, minimized }}>
        <BreathSession key={host.id} />
      </BreathHostContext.Provider>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  layer: { zIndex: 60, elevation: 60, backgroundColor: '#000000' },
});
