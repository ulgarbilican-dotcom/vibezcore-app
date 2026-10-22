/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — tijdkiezer (16 okt 2026).

   iOS-test build 20 ("instellen lukt niet, krijg extra knop onderaan die
   niet werkt — rommelig"): de systeem-tijdkiezer stond op iOS als draaiwiel
   IN de pagina, met donkere cijfers op donkere grond, zonder "Done", en
   ging nooit meer dicht. Zoals Apple's eigen apps: op iOS een onderblad met
   het draaiwiel en "Done" rechtsboven (onderblad-protocol: kiezer = Done
   rechtsboven); op Android het eigen tijdvenster van het systeem.
   ───────────────────────────────────────────────────────────────────────── */

import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from '@/utils/safe-area';

import { GlassSheet } from '@/components/GlassSheetHost';
import VibezGlass from '@/components/VibezGlass';
import { BrandFonts } from '@/constants/theme';
import { rootBlurRef } from '@/utils/root-blur';

type Props = {
  visible: boolean;
  /** Minuten sinds middernacht. */
  value: number;
  title?: string;
  onChange: (minutes: number) => void;
  onClose: () => void;
};

function toDate(minutes: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

export default function TimePickerSheet({ visible, value, title = 'Starts at', onChange, onClose }: Props) {
  const insets = useSafeAreaInsets();
  /* iOS: de keuze pas doorgeven bij Done, zoals de Klok-app. */
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  if (Platform.OS !== 'ios') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={toDate(value)}
        mode="time"
        display="spinner"
        onChange={(e, date) => {
          onClose();
          if (e.type === 'set' && date) onChange(date.getHours() * 60 + date.getMinutes());
        }}
      />
    );
  }

  return (
    <GlassSheet visible={visible} onClose={onClose}>
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <VibezGlass
          radius={24}
          level="sheet"
          blurTarget={rootBlurRef}
          style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
        />
        <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 14, left: 40, right: 40 }} accessibilityLabel="Close">
          <View style={s.grip} />
        </Pressable>
        <View style={s.head}>
          <Text style={s.title}>{title}</Text>
          <Pressable
            onPress={() => {
              onChange(draft);
              onClose();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={s.done}>Done</Text>
          </Pressable>
        </View>
        <DateTimePicker
          value={toDate(draft)}
          mode="time"
          display="spinner"
          themeVariant="dark"
          textColor="#ffffff"
          onChange={(_, date) => {
            if (date) setDraft(date.getHours() * 60 + date.getMinutes());
          }}
          style={s.picker}
        />
      </View>
    </GlassSheet>
  );
}

const s = StyleSheet.create({
  sheet: { paddingHorizontal: 20, paddingTop: 8, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  grip: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontFamily: BrandFonts.bold, fontSize: 20, color: '#ffffff' },
  done: { fontFamily: BrandFonts.semibold, fontSize: 17, color: '#ffffff' },
  picker: { alignSelf: 'stretch', height: 216 },
});
