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
import { SESSION_ART } from '@/components/SessionArt';
import { assetUri } from '@/services/asset-cache';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import { Brand, BrandFonts } from '@/constants/theme';
import { BREATH_STATES } from '@/data/breath-states';
import { useSubscription } from '@/hooks/useSubscription';
import { goalsByKeys } from '@/data/goals';
import { useBreathHistory } from '@/utils/breath-history';
import { suggestBreath } from '@/utils/breath-suggestion';
import { useSetting } from '@/utils/settings';
import { router } from 'expo-router';
import {
  CalendarDays,
  ChevronRight,
  Clock,
  Flame,
  Settings,
  Target,
  Watch,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo } from 'react';
import {
  Dimensions,
  Image as RNImage,
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

/* Kopbeeld, aangeleverd door de operator. */
const HERO =
  'https://vibezcore-audio.b-cdn.net/images/activity%20header.png';
const HERO_H = Math.round(SCREEN_W * 0.52);
const DAY_LABEL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function ActivityScreen() {
  const history = useBreathHistory();
  const [goals] = useSetting('goals');
  const sub = useSubscription();

  /* De suggestie van dit moment — dezelfde bron als de Breath-tab, zodat de
     twee schermen nooit iets anders voorstellen. */
  const suggestion = useMemo(
    () => (history.length > 0 ? suggestBreath(history, new Date(), goals) : null),
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [history.length > 0, goals],
  );
  const sugState = BREATH_STATES[suggestion?.state ?? 'calm'];

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
      const dd = new Date(start);
      return {
        letter: DAY_LABEL[dd.getDay()],
        today: i === 6,
        label: DAY_LABEL[dd.getDay()],
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

    /* Beste reeks OOIT — maakt een teruggevallen reeks minder pijnlijk: je
       ziet dat je het al eens verder hebt geschopt in plaats van alleen dat
       je nu op 1 staat. */
    const uniqueDays = [
      ...new Set(history.map((e) => new Date(e.ts).toDateString())),
    ]
      .map((d) => new Date(d).setHours(0, 0, 0, 0))
      .sort((x, y) => x - y);
    let best = 0;
    let run = 0;
    let prev = 0;
    for (const d of uniqueDays) {
      run = prev && d - prev === DAY ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }

    /* Deze week apart van het totaal: "24 sessies ooit" zegt weinig over of
       je het NU volhoudt. */
    const weekAgo = now.getTime() - 7 * DAY;
    const wk = history.filter((e) => e.ts >= weekAgo);

    const totalStateMin = Math.max(
      1,
      byState.reduce((acc, x) => acc + x.min, 0),
    );

    return {
      days,
      peak,
      streak,
      totalMin,
      best,
      weekSessions: wk.length,
      weekMinutes: Math.round(wk.reduce((acc, e) => acc + e.durSec, 0) / 60),
      byState: byState.map((x) => ({
        ...x,
        pct: Math.round((x.min / totalStateMin) * 100),
      })),
      count: history.length,
    };
  }, [history]);

  /* De kleur van de toestand waar je het vaakst naartoe gaat. Die draagt het
     hele scherm — cijfers, balken, gloed. Zo ziet je activiteit eruit als
     JOUW activiteit en niet als een rapport (operator, 6 augustus 2026: "te
     saai en zakelijk"). Zonder historiek valt hij terug op het violet van
     CALM CONTROL. */
  const tone = stats.byState[0]?.accent ?? BREATH_STATES.calm.accent;

  const goalNames = goalsByKeys(goals)
    .map((g) => g.name)
    .join(' · ');

  /* Bracelet-cijfers. Er wordt nog niets weggeschreven over bracelet-gebruik,
     dus dit blijft leeg tot dat gebouwd is — maar het blok staat er wel, zodat
     het scherm niet verspringt zodra de eerste sessie binnenkomt. */
  const bracelet = { sessions: 0, minutes: 0, topMode: null as string | null };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Kopbeeld met verloop eronder, zodat de tekst erin ligt in plaats van
          erop. Zonder dat verloop liep het beeld door tot achter de eerste kop
          en was die nauwelijks te lezen. */}
      <View style={s.heroWrap} pointerEvents="none">
        <RNImage
          source={{ uri: assetUri(HERO) }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <ExpoGradient
          colors={['rgba(10,10,10,0.15)', 'rgba(10,10,10,0.7)', Brand.bg]}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={s.bar}>
        <Text style={s.title}>ACTIVITY</Text>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          style={s.gear}
        >
          <Settings size={19} color="rgba(255,255,255,0.75)" strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ══ BREATHWORK ══════════════════════════════════════════════ */}
        <View style={s.head}>
          <Wind size={15} color={tone} strokeWidth={2.4} />
          <Text style={[s.headTxt, { color: tone }]}>BREATHWORK</Text>
        </View>

        {stats.count === 0 ? (
          <View style={s.card}>
            <Text style={s.emptyT}>No breathwork sessions yet</Text>
            <Text style={s.emptyB}>
              Start your first breathwork session to see your activity
              insights.
            </Text>
            <Pressable
              onPress={() => router.navigate('/breath')}
              style={[s.cta, { backgroundColor: tone }]}
            >
              <Text style={s.ctaTxt}>GO TO BREATH</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.statRow}>
              <Stat
                Icon={Flame}
                n={String(stats.streak)}
                l="DAYS IN A ROW"
                sub={'Best: ' + stats.best}
                c={tone}
              />
              <Stat
                Icon={Waves}
                n={String(stats.weekSessions)}
                l="SESSIONS"
                sub="This week"
                c={tone}
              />
              <Stat
                Icon={Clock}
                n={fmtMin(stats.weekMinutes)}
                l="MINUTES"
                sub="This week"
                c={tone}
              />
            </View>

            <View style={s.card}>
              <Text style={s.cardHead}>MINUTES PER DAY · LAST 7 DAYS</Text>
              <View style={s.chart}>
                {stats.days.map((d, i) => (
                  <View key={i} style={s.col}>
                    <Text style={s.colMin}>{d.min > 0 ? d.min : ''}</Text>
                    <View style={s.track}>
                      <View
                        style={[
                          s.fill,
                          {
                            height: `${Math.round((d.min / stats.peak) * 100)}%` as const,
                            backgroundColor:
                              d.color ?? 'rgba(255,255,255,0.07)',
                          },
                        ]}
                      />
                    </View>
                    <Text style={[s.colDay, d.today && { color: tone }]}>
                      {d.letter}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.cardHead}>MINUTES PER STATE</Text>
              {stats.byState.map((x) => (
                <View key={x.key} style={s.stateRow}>
                  <View
                    style={[
                      s.stateIcon,
                      {
                        borderColor: x.accent + '66',
                        backgroundColor: x.accent + '18',
                      },
                    ]}
                  >
                    <View style={[s.stateDot, { backgroundColor: x.accent }]} />
                  </View>
                  <Text style={s.stateName} numberOfLines={1}>
                    {x.name}
                  </Text>
                  <View style={s.stateTrack}>
                    <View
                      style={[
                        s.stateFill,
                        {
                          width: `${Math.max(
                            4,
                            Math.round(
                              (x.min / Math.max(1, stats.byState[0].min)) * 100,
                            ),
                          )}%` as const,
                          backgroundColor: x.accent,
                        },
                      ]}
                    />
                  </View>
                  <Text style={s.stateMin}>{fmtMin(x.min)}</Text>
                  <Text style={s.statePct}>{x.pct}%</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Row
          Icon={Target}
          title="Goal"
          sub={goalNames || 'Not set'}
          onPress={() => router.push('/goal' as never)}
        />
        <Row
          Icon={CalendarDays}
          title="Daily plan"
          sub="Two moments a day"
          onPress={() => router.push('/plan' as never)}
        />
        <Row
          Icon={Wind}
          title="All breathwork sessions"
          sub="View your session history"
          onPress={() => router.push('/breath-history')}
        />

        {/* ══ SMART BEAD BRACELET ═════════════════════════════════════ */}
        <View style={[s.head, { marginTop: 22 }]}>
          <Watch size={15} color="rgba(255,255,255,0.6)" strokeWidth={2.4} />
          <Text style={[s.headTxt, { color: 'rgba(255,255,255,0.8)' }]}>
            SMART BEAD BRACELET
          </Text>
        </View>

        {sub.hasBracelet ? (
          <>
            <View style={s.statRow}>
              <Stat
                Icon={Waves}
                n={String(bracelet.sessions)}
                l="SESSIONS"
                sub="This week"
                c="rgba(255,255,255,0.85)"
              />
              <Stat
                Icon={Clock}
                n={fmtMin(bracelet.minutes)}
                l="MINUTES"
                sub="This week"
                c="rgba(255,255,255,0.85)"
              />
              <Stat
                Icon={Watch}
                n={bracelet.topMode ?? '—'}
                l="TOP MODE"
                sub="Most used"
                c="rgba(255,255,255,0.85)"
              />
            </View>
            <Row
              Icon={Watch}
              title="All bracelet sessions"
              sub="View your bracelet session history"
              onPress={() => router.push('/bracelet-history')}
            />
          </>
        ) : (
          <View style={s.card}>
            <Text style={s.emptyT}>Bracelet sessions coming soon</Text>
            <Text style={s.emptyB}>
              Track your state with the VIBEZCORE Smart Bead Bracelet. Counted
              separately from breathwork: one you practise, the other the
              bracelet does for you.
            </Text>
            <View style={s.soonPill}>
              <Text style={s.soonTxt}>AVAILABLE FALL 2026</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  Icon,
  n,
  l,
  sub,
  c,
}: {
  Icon: LucideIcon;
  n: string;
  l: string;
  sub?: string;
  c: string;
}) {
  return (
    <View style={s.stat}>
      <Icon size={13} color={c} strokeWidth={2.4} />
      <Text style={[s.statNum, { color: c }]} numberOfLines={1}>
        {n}
      </Text>
      <Text style={s.statLbl} numberOfLines={1}>
        {l}
      </Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

function Row({
  Icon,
  title,
  sub,
  onPress,
}: {
  Icon: LucideIcon;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={s.row} onPress={onPress}>
      <Icon size={17} color="rgba(255,255,255,0.55)" strokeWidth={2.2} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowSub}>{sub}</Text>
      </View>
      <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
    </Pressable>
  );
}

/* Uren zodra het er genoeg zijn: "8h 45m" leest sneller dan "525m". */
function fmtMin(m: number): string {
  if (m < 60) return m + 'm';
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}

const CARD_BG = 'rgba(255,255,255,0.035)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  heroWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_H,
  },

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  title: {
    fontFamily: BrandFonts.regular,
    fontSize: 16,
    letterSpacing: 4.2,
    color: '#ffffff',
  },
  gear: { position: 'absolute', right: 12, padding: 6 },
  scroll: { paddingHorizontal: 14, paddingBottom: 28 },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    marginBottom: 8,
  },
  headTxt: { fontFamily: BrandFonts.bold, fontSize: 11.5, letterSpacing: 2.6 },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    padding: 13,
    marginBottom: 8,
  },
  cardHead: {
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 12,
  },

  statRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
  },
  statNum: {
    marginTop: 5,
    fontFamily: BrandFonts.bold,
    fontSize: 21,
    letterSpacing: -0.4,
  },
  statLbl: {
    marginTop: 1,
    fontFamily: BrandFonts.bold,
    fontSize: 7.5,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.5)',
  },
  statSub: {
    marginTop: 1,
    fontFamily: BrandFonts.regular,
    fontSize: 8.5,
    color: 'rgba(255,255,255,0.32)',
  },

  chart: { flexDirection: 'row', gap: 6, height: 96 },
  col: { flex: 1, alignItems: 'center' },
  colMin: {
    fontFamily: BrandFonts.semibold,
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    height: 12,
  },
  track: {
    flex: 1,
    width: '100%',
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%', borderRadius: 5, minHeight: 3 },
  colDay: {
    marginTop: 5,
    fontFamily: BrandFonts.bold,
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
  },

  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 30 },
  stateIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateDot: { width: 7, height: 7, borderRadius: 4 },
  stateName: {
    width: 88,
    fontFamily: BrandFonts.semibold,
    fontSize: 10,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.85)',
  },
  stateTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  stateFill: { height: 4, borderRadius: 2 },
  stateMin: {
    width: 46,
    textAlign: 'right',
    fontFamily: BrandFonts.semibold,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.75)',
  },
  statePct: {
    width: 32,
    textAlign: 'right',
    fontFamily: BrandFonts.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD_BG,
    marginBottom: 8,
  },
  rowTitle: { fontFamily: BrandFonts.semibold, fontSize: 13, color: Brand.text },
  rowSub: {
    marginTop: 1,
    fontFamily: BrandFonts.regular,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.35)',
  },

  emptyT: {
    fontFamily: BrandFonts.bold,
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: -0.1,
  },
  emptyB: {
    marginTop: 5,
    fontFamily: BrandFonts.regular,
    fontSize: 11.5,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.5)',
  },
  cta: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: '#0a0a0a',
  },
  soonPill: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  soonTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 8.5,
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.5)',
  },
});
