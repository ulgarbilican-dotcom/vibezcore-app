/* Effen strook onder de systeemnavigatie (21 okt 2026): op schermen zonder tabbalk liep inhoud
   onder de Android-navigatieknoppen door, zodat de knoppen over tekst stonden. Dit vlak
   (hoogte = onderste veilige zone) maakt die zone overal effen zwart, zoals op de tabs. */
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from '@/utils/safe-area';
import { Brand } from '@/constants/theme';

export default function BottomSystemScrim() {
  const insets = useSafeAreaInsets();
  if (insets.bottom <= 0) return null;
  return <View pointerEvents="none" style={[s.bar, { height: insets.bottom }]} />;
}

const s = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Brand.bg, zIndex: 9999, elevation: 9999 },
});
