/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Heart Rate (operator, 10 okt 2026: eerst "Your Rhythm", daarna "doe maar Heart Rate, dat gebruikt iedereen")

   "Een ingang via Activity: huidig ritme, aanpassingen, wanneer en hoe laat
   gemeten — en van daaruit een nieuwe meting." Naam: "Heart Rate", de
   gangbare term. Bovenaan wat nu geldt, dezelfde twee acties
   als het blad achter de bpm-pil, daaronder de volledige historiek.
   Welzijnstaal: geen diagnose, geen nauwkeurigheidsclaim.
   ─────────────────────────────────────────────────────────────────────── */

import { HeaderBackButton } from '@/components/HeaderBackButton';
import { HistoryGroup, HistoryRow, HistorySectionLabel } from '@/components/HistoryList';
import PressScale from '@/components/PressScale';
import RhythmSheet, { useRestingPulse } from '@/components/RhythmSheet';
import { AudioAccentLight, Brand, BrandFonts } from '@/constants/theme';
import { BraceletMode } from '@/services/ble-contract';
import { getPulseHistory, type PulseHistoryEntry } from '@/services/resting-pulse';
import { Stack } from 'expo-router';
import { ChevronRight, HeartPulse, PencilLine, Timer } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function fmtWhen(at: number): string {
  const d = new Date(at);
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} · ${time}`;
}

function rowTitle(e: PulseHistoryEntry): string {
  if (e.kind === 'session') return 'For a session';
  if (e.kind === 'entered') return 'Entered by you';
  return 'Resting · measured';
}

export default function HeartRateScreen() {
  const pulse = useRestingPulse();
  const [sheet, setSheet] = useState(false);
  /* Herberekend bij elke wijziging van de rusthartslag of een sessiemeting. */
  const history = useMemo(() => getPulseHistory(), [pulse]);

  /* Het tijdstip van de waarde die GEBRUIKT wordt (niet van de laatste
     meting) — anders stond er 81 bpm met het uur van een latere 87. */
  const inUse = history.find((e) => e.inUse);
  const source =
    pulse.source === 'average'
      ? 'Average — not measured yet'
      : pulse.source === 'manual'
        ? `Entered by you${inUse ? ` · ${fmtWhen(inUse.at)}` : ''}`
        : `Measured${inUse ? ` · ${fmtWhen(inUse.at)}` : ''}`;
  /* Meerdere metingen: zeggen waarom niet de laatste telt. */
  const measuredCount = history.filter((e) => e.kind === 'measured').length;

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Heart Rate',
          headerTitleAlign: 'center',
          headerBackVisible: false,
          headerLeft: () => <HeaderBackButton />,
        }}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Wat nu geldt — zelfde opbouw als het blad achter de bpm-pil. */}
        <View style={s.card}>
          {/* Operator, 10 okt 2026: het hart in Bio-Teal, de accentkleur. */}
          <View style={s.icon}>
            <HeartPulse size={34} color={AudioAccentLight} strokeWidth={1.7} />
          </View>
          <Text style={s.label}>RESTING HEART RATE</Text>
          <Text style={s.num}>
            {pulse.bpm}
            <Text style={s.unit}> bpm</Text>
          </Text>
          <Text style={s.source}>{source}</Text>
          {pulse.source === 'measured' && measuredCount > 1 ? (
            <Text style={s.why}>Your calmest recent measurement</Text>
          ) : null}
          {pulse.liveBpm !== null ? (
            <Text style={s.live}>Next session starts at {pulse.liveBpm} bpm</Text>
          ) : null}
          <PressScale style={s.cta} haptic scaleTo={0.97} onPress={() => setSheet(true)} accessibilityRole="button">
            <Text style={s.ctaTxt}>Measure or Update</Text>
          </PressScale>
        </View>

        <HistorySectionLabel>History</HistorySectionLabel>
        {history.length === 0 ? (
          <Text style={s.empty}>Your measurements appear here.</Text>
        ) : (
          <HistoryGroup>
            {history.map((e, i) => (
              <HistoryRow
                key={`${e.kind}-${e.at}`}
                first={i === 0}
                icon={
                  e.kind === 'session' ? (
                    <Timer size={16} color="#ffffff" strokeWidth={1.9} />
                  ) : e.kind === 'entered' ? (
                    <PencilLine size={16} color="#ffffff" strokeWidth={1.9} />
                  ) : (
                    <HeartPulse size={16} color="#ffffff" strokeWidth={1.9} />
                  )
                }
                title={rowTitle(e)}
                sub={fmtWhen(e.at)}
                value={`${e.bpm} bpm`}
                flag={e.inUse ? 'In use' : null}
              />
            ))}
          </HistoryGroup>
        )}
        <Text style={s.note}>For wellness only, not a medical measurement.</Text>
      </ScrollView>

      <RhythmSheet
        visible={sheet}
        mode={BraceletMode.Alpha}
        now
        nextLabel="Done"
        onClose={() => setSheet(false)}
        onDone={() => setSheet(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  card: {
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 26,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  icon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0,163,163,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: BrandFonts.bold, letterSpacing: 1.2 },
  num: { color: '#ffffff', fontSize: 64, fontFamily: BrandFonts.extrabold, letterSpacing: -1.5, marginTop: 2 },
  unit: { color: 'rgba(255,255,255,0.6)', fontSize: 22, fontFamily: BrandFonts.semibold, letterSpacing: 0 },
  source: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: BrandFonts.medium, marginTop: 2 },
  why: { color: 'rgba(255,255,255,0.45)', fontSize: 13.5, fontFamily: BrandFonts.medium, marginTop: 4 },
  live: { color: '#ffffff', fontSize: 15, fontFamily: BrandFonts.semibold, marginTop: 8 },
  cta: {
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  ctaTxt: { color: '#1D1D1F', fontSize: 17, fontFamily: BrandFonts.bold },
  empty: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontFamily: BrandFonts.medium, marginTop: 6 },
  note: { color: 'rgba(255,255,255,0.4)', fontSize: 12.5, fontFamily: BrandFonts.medium, textAlign: 'center', marginTop: 24 },
});
