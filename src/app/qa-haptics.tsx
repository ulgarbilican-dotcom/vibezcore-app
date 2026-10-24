/* QA-haptiektest (alleen testbuild): vuurt vijf haptische varianten af en logt het JS-moment ([QAH] naam t=ms), zodat we het
   commando-moment van de trilmotor (dumpsys vibrator_manager) ertegen kunnen meten. Zie docs/KWALITEITSPROTOCOL.md. */
import * as Haptics from 'expo-haptics';
import { Redirect } from 'expo-router';
import { Pressable, Text, Vibration, View } from 'react-native';
import { QA_ENABLED } from '@/utils/qa';

const TESTS: { name: string; run: () => void }[] = [
  { name: 'selectionAsync', run: () => void Haptics.selectionAsync() },
  { name: 'impactLight', run: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) },
  { name: 'impactMedium', run: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) },
  { name: 'androidKeyboardTap', run: () => void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Keyboard_Tap) },
  { name: 'vibrate8ms', run: () => Vibration.vibrate(8) },
];

export default function QaHaptics() {
  if (!QA_ENABLED) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 24, gap: 14 }}>
      {TESTS.map((t, i) => (
        <Pressable
          key={t.name}
          accessibilityLabel={`QAH ${t.name}`}
          onPress={() => {
            console.log(`[QAH] ${t.name} t=${Date.now()}`);
            t.run();
          }}
          style={{ height: 70, borderRadius: 12, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 18 }}>{`${i + 1}. ${t.name}`}</Text>
        </Pressable>
      ))}
    </View>
  );
}
