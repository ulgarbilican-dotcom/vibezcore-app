/* ScrollView voor in een onderblad dat precies zo hoog wordt als zijn inhoud (tot een maximum).
   Waarom (22 okt 2026): een `flexShrink`-ScrollView in een blad zonder vaste hoogte werd op Android
   te vroeg gemeten, waardoor de laatste kaart halverwege werd afgesneden. Hier volgt de hoogte
   de gemeten inhoud (`onContentSizeChange`). */
import { useState, type ComponentProps } from 'react';
import { Dimensions, ScrollView } from 'react-native';

export default function SheetScroll({ maxRatio = 0.62, style, onContentSizeChange, ...rest }: ComponentProps<typeof ScrollView> & { maxRatio?: number }) {
  const [h, setH] = useState<number | null>(null);
  const max = Dimensions.get('window').height * maxRatio;
  return (
    <ScrollView
      {...rest}
      style={[style, { flexGrow: 0, height: h === null ? undefined : Math.min(h, max), maxHeight: max }]}
      onContentSizeChange={(w, ch) => {
        setH((prev) => (prev === ch ? prev : ch));
        onContentSizeChange?.(w, ch);
      }}
    />
  );
}
