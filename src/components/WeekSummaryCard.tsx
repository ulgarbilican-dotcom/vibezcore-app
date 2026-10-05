/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — weekkaart bovenaan een geschiedenispagina

   Operator, 5 okt 2026 ("Your Practice volledig herstructureren zoals Apple,
   te veel kleuren, moet superduidelijk"): dezelfde kaart als de State
   Control-geschiedenis, nu gedeeld zodat beide pagina's één taal spreken.
   Zoals Apple Fitness / Mindfulness: één groot getal (minuten deze week),
   sessies en reeks klein eronder, een grafiek met een vaste, ronde schaal
   en hulplijnen (één dag is dus nooit "vol" omdat hij je beste dag is), en
   één accentkleur. Totaal ooit als stille voetregel.
   ───────────────────────────────────────────────────────────────────────── */

import { AudioAccent, AudioAccentLight, Brand, BrandFonts } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

export type WeekDay = {
  key: string;
  /** Eén letter (M, T, …); de laatste dag toont "Today". */
  letter: string;
  minutes: number;
};

/* Ronde schaal met een rond middengetal (0 · 30 · 60 …). */
const AXIS_STEPS = [30, 60, 90, 120, 180, 240];

function niceAxisMax(maxDay: number): number {
  return AXIS_STEPS.find((v) => v >= maxDay) ?? Math.ceil(maxDay / 60) * 60;
}

/** "42 min" onder het uur, "5.2 h" erboven. */
export function formatMinutesTotal(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  return `${(min / 60).toFixed(1)} h`;
}

export function WeekSummaryCard({
  days,
  sessions,
  streak,
  allTimeMinutes,
}: {
  /** Zeven dagen, oud → nieuw, vandaag laatst. */
  days: WeekDay[];
  sessions: number;
  streak: number;
  allTimeMinutes: number;
}) {
  const weekMinutes = days.reduce((sum, d) => sum + d.minutes, 0);
  const axisMax = niceAxisMax(Math.max(0, ...days.map((d) => d.minutes)));
  const sub = [
    `${sessions} ${sessions === 1 ? 'session' : 'sessions'}`,
    streak > 0 ? `${streak}-day streak` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>THIS WEEK</Text>
      <View style={s.headline}>
        <Text style={s.number}>{Math.round(weekMinutes)}</Text>
        <Text style={s.unit}>min</Text>
      </View>
      <Text style={s.sub}>{sub}</Text>

      <View style={s.chart}>
        {/* Hulplijnen + schaal rechts (0 · midden · max), zoals Apple. */}
        {[1, 0.5, 0].map((f) => (
          <View key={f} style={[s.gridLine, { bottom: `${f * 100}%` }]}>
            <View style={s.gridRule} />
            <Text style={s.gridLabel}>{Math.round(axisMax * f)}</Text>
          </View>
        ))}
        <View style={s.bars}>
          {days.map((d, i) => {
            const isToday = i === days.length - 1;
            const pct = d.minutes > 0 ? Math.max(3, (d.minutes / axisMax) * 100) : 0;
            return (
              <View key={d.key} style={s.barCol}>
                <View style={s.barSlot}>
                  {pct > 0 && (
                    <View
                      style={[
                        s.barFill,
                        {
                          height: `${pct}%`,
                          backgroundColor: isToday ? AudioAccentLight : AudioAccent,
                        },
                      ]}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <View style={s.dayRow}>
        {days.map((d, i) => (
          <Text
            key={d.key}
            style={[s.dayLabel, i === days.length - 1 && s.dayLabelToday]}
            numberOfLines={1}
          >
            {i === days.length - 1 ? 'Today' : d.letter}
          </Text>
        ))}
      </View>

      <View style={s.footer}>
        <Text style={s.footerLabel}>All time</Text>
        <Text style={s.footerValue}>{formatMinutesTotal(allTimeMinutes)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: Brand.panel,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 18,
  },
  eyebrow: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1.5,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginTop: 8,
  },
  number: {
    color: Brand.text,
    fontSize: 44,
    lineHeight: 48,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: Brand.textDim,
    fontSize: 18,
    fontFamily: BrandFonts.semibold,
  },
  sub: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
    marginTop: 4,
  },
  chart: {
    height: 140,
    marginTop: 22,
    paddingRight: 30,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
    marginBottom: -7,
  },
  gridRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  gridLabel: {
    width: 30,
    textAlign: 'right',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: BrandFonts.medium,
    fontVariant: ['tabular-nums'],
  },
  bars: {
    ...StyleSheet.absoluteFillObject,
    right: 30,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barSlot: {
    width: '46%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  dayRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingRight: 30,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontFamily: BrandFonts.semibold,
  },
  dayLabelToday: { color: Brand.text },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  footerLabel: {
    color: Brand.textDim,
    fontSize: 14,
    fontFamily: BrandFonts.medium,
  },
  footerValue: {
    color: Brand.text,
    fontSize: 14,
    fontFamily: BrandFonts.semibold,
    fontVariant: ['tabular-nums'],
  },
});
