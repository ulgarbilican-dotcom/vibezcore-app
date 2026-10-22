/* De regel onder een start-knop ("30 seconds of this rhythm. Full session with Premium"):
   tikbaar als het om de proef gaat, en opent dan het plannen-blad (22 okt 2026, operator).
   Is het de regel van de gratis volledige sessie, dan blijft het gewone tekst. */
import { useState, type ReactNode } from 'react';
import { Pressable, Text, type StyleProp, type TextStyle } from 'react-native';
import PremiumPaywallModal from '@/components/PremiumPaywallModal';

export default function PremiumNote({
  style,
  preview,
  context = 'breathwork',
  children,
}: {
  style: StyleProp<TextStyle>;
  /** true = proefregel (tikbaar, opent de plannen). */
  preview: boolean;
  context?: 'breathwork' | 'state-control' | 'audio';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!preview) return <Text style={style}>{children}</Text>;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="See Premium plans">
        <Text style={style}>{children}</Text>
      </Pressable>
      <PremiumPaywallModal visible={open} onClose={() => setOpen(false)} context={context} />
    </>
  );
}
