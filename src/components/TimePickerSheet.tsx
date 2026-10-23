/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — tijdkiezer (22 okt 2026, operator: het instellen van de tijden moet overal
   dezelfde stijl hebben, die van het Breathwork-instelscherm).

   Eén uiterlijk op iOS én Android: onderblad met titel + Done in de accentkleur, boven het wiel
   een digitale HH : MM-invoer (met AM/PM op een 12-uurstoestel) en daaronder het tijdwiel in
   kwartieren. Vroeger was dit op Android het kale systeemvenster en op iOS een draaiwiel.
   ───────────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState } from 'react';
import Tap from '@/components/Tap';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from '@/utils/safe-area';

import { GlassSheet } from '@/components/GlassSheetHost';
import TimeWheel from '@/components/TimeWheel';
import VibezGlass from '@/components/VibezGlass';
import { AudioAccent, BrandFonts } from '@/constants/theme';
import { hapticTap } from '@/utils/haptics';
import { rootBlurRef } from '@/utils/root-blur';

type Props = {
  visible: boolean;
  /** Minuten sinds middernacht. */
  value: number;
  title?: string;
  /** Accentkleur van titel, Done en wiel (standaard Bio-Teal). */
  accent?: string;
  /** Venster in minuten sinds middernacht (standaard de hele dag). */
  min?: number;
  max?: number;
  onChange: (minutes: number) => void;
  onClose: () => void;
};

const USES_12H = /AM|PM/i.test(new Date(2020, 0, 1, 13, 0, 0).toLocaleTimeString());
const fmt = (mins: number) => {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export default function TimePickerSheet({
  visible,
  value,
  title = 'Time',
  accent = AudioAccent,
  min = 0,
  max = 23 * 60 + 59,
  onChange,
  onClose,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [hourText, setHourText] = useState('');
  const [minuteText, setMinuteText] = useState('');

  const options = useMemo(() => {
    const out: number[] = [];
    for (let m = Math.ceil(min / 15) * 15; m <= max; m += 15) out.push(m);
    return out.length ? out : [value];
  }, [min, max, value]);

  const nearest = (target: number) =>
    options.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a), options[0]);

  const sync = (mins: number) => {
    const h24 = Math.floor(mins / 60);
    const h12 = ((h24 + 11) % 12) + 1;
    setHourText(String(USES_12H ? h12 : h24));
    setMinuteText(String(mins % 60).padStart(2, '0'));
  };

  useEffect(() => {
    if (!visible) return;
    const snapped = nearest(value);
    setDraft(snapped);
    sync(snapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const commitDigital = (h: string, m: string, pm: boolean) => {
    const hRaw = parseInt(h, 10);
    const mRaw = parseInt(m, 10);
    if (Number.isNaN(hRaw) || Number.isNaN(mRaw)) return;
    let h24 = USES_12H ? (hRaw % 12) + (pm ? 12 : 0) : hRaw;
    h24 = Math.max(0, Math.min(23, h24));
    /* Zelfde kwartier-raster als het wiel. */
    const mSnap = Math.round(Math.max(0, Math.min(59, mRaw)) / 15) * 15;
    const total = Math.max(min, Math.min(max, h24 * 60 + (mSnap === 60 ? 45 : mSnap)));
    const next = nearest(total);
    hapticTap();
    setDraft(next);
    sync(next);
  };

  const pmNow = Math.floor(draft / 60) >= 12;
  const done = () => {
    onChange(draft);
    onClose();
  };

  return (
    <GlassSheet visible={visible} onClose={onClose}>
      <SafeAreaView style={s.sheet} edges={['bottom']}>
        <VibezGlass
          radius={24}
          level="sheet"
          blurTarget={rootBlurRef}
          style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
        />
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={[s.title, { color: accent }]}>{title}</Text>
          <Tap onPress={done} hitSlop={10} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={[s.done, { color: accent }]}>Done</Text>
          </Tap>
        </View>
        <View style={s.body}>
          <View style={s.digitalRow}>
            <TextInput
              style={s.input}
              value={hourText}
              onChangeText={setHourText}
              onEndEditing={() => commitDigital(hourText, minuteText, pmNow)}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
            />
            <Text style={s.colon}>:</Text>
            <TextInput
              style={s.input}
              value={minuteText}
              onChangeText={setMinuteText}
              onEndEditing={() => commitDigital(hourText, minuteText, pmNow)}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
            />
            {USES_12H && (
              <View style={s.ampmGroup}>
                {(['AM', 'PM'] as const).map((label) => {
                  const on = (label === 'PM') === pmNow;
                  return (
                    <Tap
                      key={label}
                      onPress={() => commitDigital(hourText, minuteText, label === 'PM')}
                      style={[s.ampmBtn, on && { backgroundColor: accent }]}
                    >
                      <Text style={[s.ampmTxt, on && { color: '#0a0a0a' }]}>{label}</Text>
                    </Tap>
                  );
                })}
              </View>
            )}
          </View>
          {min > 0 || max < 23 * 60 + 59 ? (
            <Text style={s.hint}>
              Between {fmt(min)} and {fmt(max)}
            </Text>
          ) : (
            <View style={{ height: 14 }} />
          )}
          <TimeWheel
            options={options}
            value={draft}
            onChange={(m) => {
              setDraft(m);
              sync(m);
            }}
            accent={accent}
            trackColor="rgba(255,255,255,0.55)"
          />
        </View>
      </SafeAreaView>
    </GlassSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    opacity: 0.4,
    marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontFamily: BrandFonts.bold, fontSize: 18, textAlign: 'center' },
  done: { fontFamily: BrandFonts.semibold, fontSize: 15 },
  body: { flexShrink: 1, justifyContent: 'center' },
  digitalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 },
  input: {
    width: 56,
    textAlign: 'center',
    fontFamily: BrandFonts.bold,
    fontSize: 28,
    color: '#f4f4f4',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 6,
  },
  colon: { fontFamily: BrandFonts.bold, fontSize: 28, color: 'rgba(255,255,255,0.55)' },
  hint: {
    textAlign: 'center',
    marginBottom: 14,
    fontFamily: BrandFonts.medium,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.45)',
  },
  ampmGroup: { flexDirection: 'row', marginLeft: 10, borderRadius: 10, overflow: 'hidden' },
  ampmBtn: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  ampmTxt: { fontFamily: BrandFonts.semibold, fontSize: 13, color: 'rgba(255,255,255,0.65)' },
});
