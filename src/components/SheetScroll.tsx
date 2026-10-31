/* ScrollView voor in een onderblad dat precies zo hoog wordt als zijn inhoud (tot een maximum).
   Waarom (22 okt 2026): een `flexShrink`-ScrollView in een blad zonder vaste hoogte werd op Android
   te vroeg gemeten, waardoor de laatste kaart halverwege werd afgesneden. Hier volgt de hoogte
   de gemeten inhoud (`onContentSizeChange`).
   31 okt 2026: een draaiwiel erin zet het scrollen even uit zolang de vinger erop staat (WheelScrollLock);
   de ref gaat door naar de ScrollView (vanzelf naar een opengeklapt tijdwiel scrollen). */
import { forwardRef, useState, type ComponentProps } from 'react';
import { Dimensions, ScrollView } from 'react-native';
import { useWheelScrollLock, WheelScrollLockContext } from '@/components/WheelScrollLock';

const SheetScroll = forwardRef<ScrollView, ComponentProps<typeof ScrollView> & { maxRatio?: number }>(function SheetScroll(
  { maxRatio = 0.62, style, onContentSizeChange, scrollEnabled = true, ...rest },
  ref,
) {
  const [h, setH] = useState<number | null>(null);
  const max = Dimensions.get('window').height * maxRatio;
  const wheel = useWheelScrollLock();
  return (
    <WheelScrollLockContext.Provider value={wheel.lock}>
      <ScrollView
        {...rest}
        ref={ref}
        scrollEnabled={scrollEnabled && wheel.scrollEnabled}
        style={[style, { flexGrow: 0, height: h === null ? undefined : Math.min(h, max), maxHeight: max }]}
        onContentSizeChange={(w, ch) => {
          setH((prev) => (prev === ch ? prev : ch));
          onContentSizeChange?.(w, ch);
        }}
      />
    </WheelScrollLockContext.Provider>
  );
});

export default SheetScroll;
