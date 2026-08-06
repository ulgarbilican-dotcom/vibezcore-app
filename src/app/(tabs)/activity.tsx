/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Activity

   Eigen tabblad (operator, 6 augustus 2026). Wat je gedaan hebt hoorde niet
   weggestopt te zitten achter een icoontje op de Breath-tab: het is de plek
   waar je terugkomt om te zien of het iets oplevert, en dat is de helft van
   waarom iemand een gewoonte volhoudt.

   ── Waarom ademsessies en bracelet gescheiden blijven ─────────────────
   Ze staan onder elkaar, niet door elkaar. Een ademsessie is iets wat je
   DOET — die telt mee als oefening en laat groei zien. Bracelet-gebruik is
   iets wat je KRIJGT; dat is gebruik, geen vooruitgang. Zet je die twee in
   dezelfde grafiek, dan suggereer je groei waar alleen consumptie is.

   Het bracelet-blok verschijnt alleen voor wie er een heeft. Wie er geen
   heeft ziet zijn ademhaling, en verder niets dat hem herinnert aan iets dat
   hij niet bezit.
   ───────────────────────────────────────────────────────────────────────── */

import Starfield from '@/components/Starfield';
import { Brand, BrandFonts } from '@/constants/theme';
import { BREATH_STATES } from '@/data/breath-states';
import { useSubscription } from '@/hooks/useSubscription';
import { goalByKey } from '@/data/goals';
import { useBreathHistory } from '@/utils/breath-history';
import { useSetting } from '@/utils/settings';
import { router } from 'expo-router';
import { ChevronRight, Settings } from 'lucide-react-native';
import { useMemo } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

const DAY = 864e5;
const DAY_LABEL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function ActivityScreen() {
  const history = useBreathHistory();
  const [goal, setGoal] = useSetting('goal');
  const sub = useSubscription();

  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    /* Zeven dagen terug, oudste eerst. Per dag de minuten en de toestand die
       je die dag het meest deed — die bepaalt de kleur van het balkje. */
    const days = Array.from({ length: 7 }, (_, i) => {
      const start = today.getTime() - (6 - i) * DAY;
      const mine = history.filter((e) => e.ts >= start && e.ts < start + DAY);
      const perState: Record<string, number> = {};
      for (const e of mine) perState[e.key] = (perState[e.key] ?? 0) + e.durSec;
      const top = Object.entries(perState).sort((a, b) => b[1] - a[1])[0];
      const topState = top
        ? BREATH_STATES[top[0] as keyof typeof BREATH_STATES]
        : undefined;
      return {
        label: DAY_LABEL[new Date(start).getDay()],
        min: Math.round(mine.reduce((s, e) => s + e.durSec, 0) / 60),
        color: topState?.accent ?? null,
      };
    });

    const peak = Math.max(1, ...days.map((d) => d.min));

    /* Reeks: aaneengesloten dagen terug. Vandaag nog niets gedaan breekt hem
       niet — de dag is nog niet voorbij. */
    const done = new Set(history.map((e) => new Date(e.ts).toDateString()));
    let streak = 0;
    const cur = new Date(now);
    if (!done.has(cur.toDateString())) cur.setDate(cur.getDate() - 1);
    while (done.has(cur.toDateString())) {
      streak += 1;
      cur.setDate(cur.getDate() - 1);
    }

    const totalMin = Math.round(
      history.reduce((s, e) => s + e.durSec, 0) / 60,
    );

    /* Verdeling over de toestanden, hoogste eerst. */
    const byState = Object.values(BREATH_STATES)
      .map((st) => ({
        key: st.key,
        name: st.eyebrow,
        accent: st.accent,
        min: Math.round(
          history
            .filter((e) => e.key === st.key)
            .reduce((s, e) => s + e.durSec, 0) / 60,
        ),
      }))
      .filter((x) => x.min > 0)
      .sort((a, b) => b.min - a.min);

    return { days, peak, streak, totalMin, byState, count: history.length };
  }, [history]);

  /* De kleur van de toestand waar je het vaakst naartoe gaat. Die draagt het
     hele scherm — cijfers, balken, gloed. Zo ziet je activiteit eruit als
     JOUW activiteit en niet als een rapport (operator, 6 augustus 2026: "te
     saai en zakelijk"). Zonder historiek valt hij terug op het violet van
     CALM CONTROL. */
  const tone = stats.byState[0]?.accent ?? BREATH_STATES.calm.accent;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Starfield width={SCREEN_W} height={SCREEN_H} count={46} color={tone} />
      </View>

      {/* Een zachte lichtbron achter de kop. Zonder dit is het vlak zwart en
          leest alles eronder als een tabel. */}
      <View style={[s.halo, { backgroundColor: tone }]} pointerEvents="none" />

      <View style={s.bar}>
        <Text style={s.title}>ACTIVITY</Text>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          style={s.gear}
          accessibilityLabel="Settings"
        >
          <Settings size={19} color="rgba(255,255,255,0.6)" strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {stats.count === 0 ? (
          /* Geen lege grafiek met nullen: die zegt "je doet niets" tegen
             precies degene die nog moet beginnen. */
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Nothing here yet</Text>
            <Text style={s.emptyBody}>
              Your first session shows up here. Minutes, streak, and which
              states you return to.
            </Text>
            <Pressable
              onPress={() => router.navigate('/breath')}
              style={s.emptyCta}
            >
              <Text style={s.emptyCtaTxt}>START A SESSION</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.row3}>
              <Stat n={String(stats.streak)} l="DAY STREAK" c={tone} />
              <Stat n={String(stats.count)} l="SESSIONS" c={tone} />
              <Stat n={String(stats.totalMin)} l="MINUTES" c={tone} />
            </View>

            <Text style={s.section}>THIS WEEK</Text>
            <View style={s.chart}>
              {stats.days.map((d, i) => (
                <View key={i} style={s.col}>
                  <Text style={s.colMin}>{d.min > 0 ? d.min : ''}</Text>
                  <View style={s.track}>
                    <View
                      style={[
                        s.fill,
                        {
                          height: `${Math.round((d.min / stats.peak) * 100)}%`,
                          backgroundColor: d.color ?? 'rgba(255,255,255,0.10)',
                        },
                      ]}
                    />
                  </View>
                  <Text style={s.colDay}>{d.label}</Text>
                </View>
              ))}
            </View>

            <Text style={s.section}>BY STATE</Text>
            {stats.byState.map((b) => (
              <View key={b.key} style={s.stateRow}>
                <View style={[s.dot, { backgroundColor: b.accent }]} />
                <Text style={s.stateName}>{b.name}</Text>
                <View style={s.stateTrack}>
                  <View
                    style={[
                      s.stateFill,
                      {
                        width: `${Math.round(
                          (b.min / Math.max(1, stats.byState[0].min)) * 100,
                        )}%`,
                        backgroundColor: b.accent,
                      },
                    ]}
                  />
                </View>
                <Text style={s.stateMin}>{b.min}m</Text>
              </View>
            ))}
          </>
        )}

        {/* ── Waar je naartoe werkt ───────────────────────────────────
             Bovenaan de historiek en niet in Settings: een doel hoort bij je
             voortgang, niet bij je voorkeuren. Wie hier kijkt vraagt zich af
             of het ergens toe leidt — dan is dit de plek om te zeggen waar
             naartoe. */}
        {/* Twee echte pagina's in plaats van vensters (operator, 6 augustus
             2026). Een tabblad is een PLEK; alles wat een eigen pagina
             verdient wordt van hieruit gepusht. Zo krijgt elk onderdeel
             ruimte om zichzelf uit te leggen zonder dat de balk volloopt. */}
        <Text style={s.section}>YOUR PRACTICE</Text>
        <Pressable style={s.link} onPress={() => router.push('/goal' as never)}>
          <View>
            <Text style={s.linkTxt}>
              {goalByKey(goal)?.name ?? 'Choose a goal'}
            </Text>
            <Text style={s.linkSub}>
              {goalByKey(goal)?.hint ??
                'Shapes what gets suggested, and when'}
            </Text>
          </View>
          <ChevronRight size={17} color="rgba(255,255,255,0.35)" />
        </Pressable>

        <Pressable style={s.link} onPress={() => router.push('/plan' as never)}>
          <View>
            <Text style={s.linkTxt}>Your plan</Text>
            <Text style={s.linkSub}>Two moments a day, and what you did</Text>
          </View>
          <ChevronRight size={17} color="rgba(255,255,255,0.35)" />
        </Pressable>

        <Text style={s.section}>HISTORY</Text>
        <Pressable
          style={s.link}
          onPress={() => router.push('/breath-history')}
        >
          <Text style={s.linkTxt}>Breathwork sessions</Text>
          <ChevronRight size={17} color="rgba(255,255,255,0.35)" />
        </Pressable>

        {/* De bracelet staat er ALTIJD, ook zonder (operator, 6 augustus
            2026). Weglaten leek netjes — geen dode knoppen — maar het maakt
            de helft van het product onzichtbaar voor precies de mensen die
            hem nog moeten leren kennen. Wie er geen heeft ziet dat er iets
            komt; wie er wel een heeft tikt erop. */}
        <Pressable
          style={[s.link, !sub.hasBracelet && s.linkLocked]}
          disabled={!sub.hasBracelet}
          onPress={() => router.push('/bracelet-history')}
        >
          <View>
            <Text
              style={[s.linkTxt, !sub.hasBracelet && s.linkTxtLocked]}
            >
              Bracelet sessions
            </Text>
            {!sub.hasBracelet && (
              <Text style={s.linkSub}>Available Fall 2026</Text>
            )}
          </View>
          <ChevronRight
            size={17}
            color={
              sub.hasBracelet ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)'
            }
          />
        </Pressable>
      </ScrollView>

    </SafeAreaView>
  );
}

function Stat({ n, l, c }: { n: string; l: string; c: string }) {
  return (
    <View style={[s.stat, { borderColor: `${c}33` }]}>
      <Text style={[s.statNum, { color: c }]}>{n}</Text>
      <Text style={s.statLbl}>{l}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  halo: {
    position: 'absolute',
    top: -190,
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.16,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  title: {
    fontFamily: BrandFonts.regular,
    fontSize: 17,
    letterSpacing: 4.4,
    color: '#ffffff',
  },
  gear: { position: 'absolute', right: 14, padding: 6 },
  scroll: { paddingHorizontal: 16, paddingBottom: 28 },

  row3: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  statNum: {
    fontFamily: BrandFonts.bold,
    fontSize: 26,
    letterSpacing: -0.5,
    color: '#ffffff',
  },
  statLbl: {
    marginTop: 3,
    fontFamily: BrandFonts.bold,
    fontSize: 8.5,
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.42)',
  },

  section: {
    marginTop: 26,
    marginBottom: 10,
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: 'rgba(255,255,255,0.4)',
  },

  chart: { flexDirection: 'row', gap: 8, height: 132 },
  col: { flex: 1, alignItems: 'center' },
  colMin: {
    fontFamily: BrandFonts.semibold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 4,
    height: 13,
  },
  track: {
    flex: 1,
    width: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%', borderRadius: 8, minHeight: 3 },
  colDay: {
    marginTop: 6,
    fontFamily: BrandFonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.34)',
  },

  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 30 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  stateName: {
    width: 96,
    fontFamily: BrandFonts.semibold,
    fontSize: 10.5,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.8)',
  },
  stateTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  stateFill: { height: 5, borderRadius: 3 },
  stateMin: {
    width: 38,
    textAlign: 'right',
    fontFamily: BrandFonts.semibold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },

  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 8,
  },
  linkTxt: {
    fontFamily: BrandFonts.semibold,
    fontSize: 14,
    color: Brand.text,
  },
  linkLocked: { opacity: 0.55 },
  linkTxtLocked: { color: 'rgba(255,255,255,0.6)' },
  linkSub: {
    marginTop: 2,
    fontFamily: BrandFonts.regular,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.34)',
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#141018',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  sheetTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 20,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  sheetSub: {
    marginTop: 6,
    marginBottom: 16,
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.55)',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    marginBottom: 8,
  },
  goalDot: { width: 9, height: 9, borderRadius: 5 },
  goalName: {
    fontFamily: BrandFonts.semibold,
    fontSize: 15,
    color: Brand.text,
  },
  goalHint: {
    marginTop: 2,
    fontFamily: BrandFonts.regular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.5)',
  },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  emptyTitle: {
    fontFamily: BrandFonts.bold,
    fontSize: 20,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  emptyBody: {
    marginTop: 8,
    fontFamily: BrandFonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: 22,
    paddingHorizontal: 26,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 12,
    letterSpacing: 2,
    color: '#ffffff',
  },
});
