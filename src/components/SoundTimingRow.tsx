/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Sound timing in Audio & Haptics + eenmalige tip op het
   State Control-scherm (31 okt 2026, operator: "ja").

   · SoundTimingRow  — regel "Sound timing · <toestel>", enkel zolang het
                       geluid via Bluetooth gaat; opent het instelblad.
   · SoundTimingHint — één keer per Bluetooth-toestel, vóór Play, als het
                       geluid aan staat en dat toestel nog niet ingesteld is.
                       Blokkeert nooit: "Not now" en de tip is weg voor dat
                       toestel.
   ───────────────────────────────────────────────────────────────────────── */

import BalancedText from '@/components/BalancedText';
import Reveal from '@/components/Reveal';
import SoundTimingSheet from '@/components/SoundTimingSheet';
import Tap from '@/components/Tap';
import { BrandFonts } from '@/constants/theme';
import { dismissHint, getSoundOutput, isHintDismissed, type SoundOutput } from '@/services/sound-timing';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View, type ViewStyle } from 'react-native';

/** De huidige Bluetooth-uitgang, ververst elke 3 s en bij terugkomen. */
export function useSoundOutput(): SoundOutput | null {
  const [out, setOut] = useState<SoundOutput | null>(() => getSoundOutput());
  useEffect(() => {
    const check = () =>
      setOut((prev) => {
        const next = getSoundOutput();
        if (
          prev &&
          next &&
          prev.key === next.key &&
          prev.calibrated === next.calibrated &&
          prev.correctionMs === next.correctionMs &&
          prev.name === next.name
        ) {
          return prev;
        }
        return next;
      });
    const id = setInterval(check, 3000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  return out;
}

export default function SoundTimingRow({ separatorStyle }: { separatorStyle?: ViewStyle }) {
  const out = useSoundOutput();
  const [open, setOpen] = useState<SoundOutput | null>(null);
  if (!out && !open) return null;
  const shown = out ?? open!;
  return (
    <>
      {separatorStyle ? <View style={separatorStyle} /> : null}
      <Tap
        onPress={() => setOpen(shown)}
        style={rs.row}
        accessibilityRole="button"
        accessibilityLabel={`Sound timing for ${shown.name}`}
      >
        <View style={{ flex: 1 }}>
          <Text style={rs.title} numberOfLines={1}>
            Sound timing
          </Text>
          <Text style={rs.sub} numberOfLines={1}>
            {shown.name} · {shown.calibrated ? 'Set' : 'Not set'}
          </Text>
        </View>
        <View style={rs.btn}>
          <Text style={rs.btnTxt}>{shown.calibrated ? 'Adjust' : 'Set up'}</Text>
        </View>
      </Tap>
      {open ? <SoundTimingSheet visible output={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

/** `show`: het scherm wil de tip nu (vóór Play, geluid aan). */
export function SoundTimingHint({ show }: { show: boolean }) {
  const out = useSoundOutput();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [open, setOpen] = useState<SoundOutput | null>(null);
  const key = out?.key ?? null;
  useEffect(() => {
    let alive = true;
    setDismissed(null);
    if (!key) return;
    void isHintDismissed(key).then((d) => alive && setDismissed(d));
    return () => {
      alive = false;
    };
  }, [key]);

  const visible = show && !!out && !out.calibrated && dismissed === false;
  return (
    <>
      {visible && out ? (
        <Reveal i={0}>
          <View style={rs.hint}>
            <BalancedText style={rs.hintTxt}>
              Using {out.name}? Set the sound timing once so the heartbeat lands with every pulse.
            </BalancedText>
            <View style={rs.hintBtns}>
              <Tap
                onPress={() => {
                  void dismissHint(out.key);
                  setDismissed(true);
                }}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={rs.hintLater}>Not now</Text>
              </Tap>
              <Tap onPress={() => setOpen(out)} style={rs.btn} accessibilityRole="button">
                <Text style={rs.btnTxt}>Set up</Text>
              </Tap>
            </View>
          </View>
        </Reveal>
      ) : null}
      {open ? (
        <SoundTimingSheet
          visible
          output={open}
          onClose={(saved) => {
            if (saved) {
              void dismissHint(open.key);
              setDismissed(true);
            }
            setOpen(null);
          }}
        />
      ) : null}
    </>
  );
}

const rs = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  title: { color: '#ffffff', fontFamily: BrandFonts.semibold, fontSize: 16 },
  sub: { color: 'rgba(255,255,255,0.55)', fontFamily: BrandFonts.regular, fontSize: 13, marginTop: 2 },
  btn: { backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  btnTxt: { color: '#0a0a0a', fontFamily: BrandFonts.semibold, fontSize: 13 },
  hint: {
    alignSelf: 'stretch',
    marginHorizontal: 26,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  hintTxt: { color: 'rgba(255,255,255,0.82)', fontFamily: BrandFonts.regular, fontSize: 13.5, lineHeight: 19 },
  hintBtns: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 18, marginTop: 12 },
  hintLater: { color: 'rgba(255,255,255,0.6)', fontFamily: BrandFonts.medium, fontSize: 13 },
});
