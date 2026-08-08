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
import {
  getAllSessions,
  useBraceletStats,
} from '@/utils/bracelet-history';
import { goalsByKeys } from '@/data/goals';
import { useBreathHistory, useBreathTotals } from '@/utils/breath-history';
import { suggestBreath } from '@/utils/breath-suggestion';
import { useSetting } from '@/utils/settings';
import { router } from 'expo-router';
import {
  BarChart3,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

const DAY = 864e5;


/* De vijf bracelet-modi in de volgorde van het BLE-contract (index 0-4). Ze
   dragen sinds 5 augustus dezelfde namen en kleuren als de ademtoestanden. */
const ORDER_MODES = [
  BREATH_STATES.boost,
  BREATH_STATES.focus,
  BREATH_STATES.calm,
  BREATH_STATES.clarity,
  BREATH_STATES.rest,
];

/* Kopbeeld, aangeleverd door de operator. */
const HERO =
  'https://vibezcore-audio.b-cdn.net/images/activity%20header.png';
/* Hoger dan eerst (operator, 7 augustus 2026: "moet meer ademen en groter").
   De inhoud begint eronder in plaats van eroverheen — zie `scroll`, dat
   precies deze hoogte vrijhoudt. Een kop waar tekst overheen loopt is geen
   kop maar een achtergrond. */
const HERO_H = Math.round(SCREEN_W * 0.66);
/* Hoogte van de titelbalk. Het beeld begint hierONDER, zodat "ACTIVITY" boven
   de gezichten staat en niet in het haar van de man (operator, 7 augustus
   2026). Eén getal, op drie plekken gebruikt — anders schuift het beeld weg
   onder de kop zodra er iets aan verandert. */
const BAR_H = 34;
const DAY_LABEL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const history = useBreathHistory();
  const lifetime = useBreathTotals();
  const [goals] = useSetting('goals');
  const [profile] = useSetting('profile');
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
      const dd = new Date(start);
      /* ELKE toestand van die dag, niet alleen de langste (operator,
         8 augustus 2026: "ik heb zondag rest en reset en calm control gedaan
         maar in de balk staat alleen groen").

         De balk kleurde naar de toestand die het langst duurde, en de rest
         verdween. Op een dag met twee sessies is dat gewoon onwaar: je ziet
         tien minuten staan waarvan je er zes ergens anders aan besteedde.

         Nu draagt de balk segmenten, in dezelfde volgorde als de vijf
         toestanden op de keuzepagina — zo staat groen altijd op dezelfde
         plek, welke dag je ook bekijkt. Seconden en niet minuten als maat:
         een sessie van veertig seconden is een streepje, geen nul. */
      const segments = ORDER_MODES.map((st) => ({
        key: st.key,
        color: st.accent,
        sec: perState[st.key] ?? 0,
      })).filter((x) => x.sec > 0);
      return {
        letter: DAY_LABEL[dd.getDay()],
        today: i === 6,
        label: DAY_LABEL[dd.getDay()],
        min: Math.round(mine.reduce((s, e) => s + e.durSec, 0) / 60),
        sec: mine.reduce((s, e) => s + e.durSec, 0),
        segments,
      };
    });

    /* Vol = een VOLWAARDIGE dag, niet "de hoogste dag van deze week".
       Stond hier Math.max(1, …), dan is op een lege week die ene minuut
       meteen de hoogste — en dus een volle balk. Dat leest als "dag gehaald"
       terwijl je één minuut deed.
       Tien minuten is de ondergrens van de schaal; heb je meer gedaan, dan
       schaalt hij mee met je beste dag. */
    const peak = Math.max(10, ...days.map((d) => d.min));

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
  /* ECHTE cijfers. De opslag bestond al — bracelet-control roept
     `recordSession` aan bij elk sessie-einde en `useBraceletStats` rekent de
     totalen uit. Er viel dus niets te bouwen, alleen aan te sluiten; het blok
     stond alleen op nullen omdat ik ze nooit had opgehaald. */
  const bStats = useBraceletStats();
  const bracelet = useMemo(() => {
    const all = getAllSessions();
    const perModeMin: Record<number, number> = {};
    for (const r of all) {
      perModeMin[r.mode] = (perModeMin[r.mode] ?? 0) + r.durationMin;
    }
    const total = Math.max(
      1,
      Object.values(perModeMin).reduce((a, x) => a + x, 0),
    );
    /* De modi staan in dezelfde volgorde als de ademtoestanden, en dragen
       sinds 5 augustus dezelfde namen en kleuren. Index 0-4 = BOOST t/m
       REST & RESET, zoals in het BLE-contract. */
    const per = ORDER_MODES.map((st, i) => ({
      name: st.eyebrow,
      color: st.accent,
      min: perModeMin[i] ?? 0,
      pct: Math.round(((perModeMin[i] ?? 0) / total) * 100),
    }));
    const top = [...per].sort((a, b) => b.min - a.min)[0];
    return {
      sessions: bStats.weekSessions,
      minutes: bStats.weekMinutes,
      topMode: top && top.min > 0 ? top.name.split(' ')[0] : null,
      perMode: per,
    };
  }, [bStats]);

  const braceletUnused = {
    sessions: 0,
    minutes: 0,
    topMode: null as string | null,
    /* De vijf modi dragen dezelfde namen en kleuren als de ademtoestanden —
       dat is sinds 5 augustus één tabel. Minuten blijven nul tot
       bracelet-gebruik wordt weggeschreven. */
    perMode: [] as { name: string; color: string; min: number; pct: number }[],
  };
  void braceletUnused;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Kopbeeld met verloop eronder, zodat de tekst erin ligt in plaats van
          erop. Zonder dat verloop liep het beeld door tot achter de eerste kop
          en was die nauwelijks te lezen. */}
      <View
        style={[s.heroWrap, { top: insets.top + BAR_H }]}
        pointerEvents="none"
      >
        <RNImage
          source={{ uri: assetUri(HERO) }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        {/* Alleen nog een uitdoving onderaan, geen sluier over het hele beeld
            (operator, 7 augustus 2026: "overlay mag weg, is te donker"). Die
            sluier lag er om tekst leesbaar te houden die er nu niet meer
            overheen ligt — de kop staat erboven. Wat blijft is de onderrand:
            zonder die overgang houdt de foto met een harde lijn op tegen het
            zwart, en dat leest als een fout in plaats van als een ontwerp. */}
        <ExpoGradient
          colors={['transparent', 'transparent', Brand.bg]}
          locations={[0, 0.62, 1]}
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
          <Text style={[s.headTxt, { color: tone }]}>Breathwork</Text>
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
                l="Days in a row"
                /* De hoogste van twee: wat er in de lijst staat, en wat er
                   ooit bewaard is. Kort de lijst ooit in, dan blijft je beste
                   reeks staan — een record dat zakt is geen record. */
                sub={'Best: ' + Math.max(stats.best, lifetime.bestStreak)}
                c={tone}
              />
              <Stat
                Icon={Waves}
                n={String(stats.weekSessions)}
                l="Sessions"
                sub="This week"
                c={tone}
              />
              <Stat
                Icon={Clock}
                n={fmtMin(stats.weekMinutes)}
                l="Minutes"
                sub="This week"
                c={tone}
              />
            </View>

            <View style={s.card}>
              <Text style={s.cardHead}>Minutes per day · last 7 days</Text>
              <View style={s.chart}>
                {stats.days.map((d, i) => (
                  <View key={i} style={s.col}>
                    <Text style={s.colMin}>{d.min > 0 ? d.min : ''}</Text>
                    <View style={[s.track, s.barSlot]}>
                      {/* Gestapeld, onderaan beginnend. De hoogte van de hele
                          balk blijft de dag; de segmenten verdelen hem naar
                          rato van de tijd per toestand. */}
                      <View
                        style={[
                          s.fill,
                          {
                            height: `${Math.round((d.min / stats.peak) * 100)}%` as const,
                            backgroundColor: 'transparent',
                          },
                        ]}
                      >
                        {d.segments.map((seg, k) => (
                          <View
                            key={seg.key}
                            style={{
                              flexGrow: seg.sec,
                              flexBasis: 0,
                              backgroundColor: seg.color,
                              /* Alleen het bovenste segment krijgt de ronding
                                 van de balk; de rest sluit vlak op elkaar aan,
                                 anders ontstaan er witte kieren. */
                              borderTopLeftRadius: k === 0 ? 5 : 0,
                              borderTopRightRadius: k === 0 ? 5 : 0,
                              borderBottomLeftRadius:
                                k === d.segments.length - 1 ? 5 : 0,
                              borderBottomRightRadius:
                                k === d.segments.length - 1 ? 5 : 0,
                            }}
                          />
                        ))}
                      </View>
                    </View>
                    <Text style={[s.colDay, d.today && { color: tone }]}>
                      {d.letter}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.cardHead}>Minutes per state</Text>
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
          /* "Set goal" zolang er geen staat (operator, 8 augustus 2026):
             een rij die "Goal · Not set" zegt beschrijft een toestand, een
             rij die "Set goal" zegt nodigt uit. Zodra er een doel is, is
             "Goal" met de naam eronder weer de juiste vorm. */
          title={goalNames ? 'Goal' : 'Set goal'}
          sub={goalNames || 'Choose what you are working toward'}
          onPress={() => router.push('/goal' as never)}
        />
        <Row
          Icon={CalendarDays}
          title="Daily plan"
          sub={
            (profile.preferredSlots ?? []).includes('midday')
              ? 'Three moments a day'
              : 'Two moments a day'
          }
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
            Smart Bead Bracelet
          </Text>
          {!sub.hasBracelet && (
            <View style={s.soonPill}>
              <Text style={s.soonTxt}>FALL 2026</Text>
            </View>
          )}
        </View>

        {/* De vier kaarten staan er ALTIJD (operator, 7 augustus 2026). Ze
            zaten achter een controle op bezit, dus wie geen bracelet heeft zag
            ze nooit — terwijl de mockup ze juist toont. Zonder bracelet staan
            ze op nul; dat laat zien wat er komt in plaats van het te verbergen. */}
        <>
          <View style={s.statRow}>
              <Stat
                Icon={Waves}
                n={String(bracelet.sessions)}
                l="Sessions"
                sub="This week"
                c="rgba(255,255,255,0.85)"
              />
              <Stat
                Icon={Clock}
                n={fmtMin(bracelet.minutes)}
                l="Minutes"
                sub="This week"
                c="rgba(255,255,255,0.85)"
              />
              <Stat
                Icon={Watch}
                n={bracelet.topMode ?? '—'}
                l="Top mode"
                sub="Most used"
                c="rgba(255,255,255,0.85)"
              />
              {/* Vierde kaart met staafjes in plaats van een cijfer — precies
                  zoals in de mockup. Vier kaarten op één rij, geen losse kaart
                  eronder. */}
              <View style={s.stat}>
                <BarChart3
                  size={13}
                  color="rgba(255,255,255,0.85)"
                  strokeWidth={2.4}
                />
                <View style={s.miniBars}>
                  {bracelet.perMode.map((m) => (
                    <View
                      key={m.name}
                      style={[
                        s.miniBar,
                        {
                          height: Math.max(4, Math.round(m.pct * 0.26)) + 4,
                          backgroundColor: m.min > 0 ? m.color : 'rgba(255,255,255,0.16)',
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={s.statLbl} numberOfLines={2}>
                  Minutes per mode
                </Text>
              </View>
            </View>
            <View style={s.hiddenPerMode}>
              {bracelet.perMode.map((m) => (
                <View key={m.name} style={s.stateRow}>
                  <View
                    style={[
                      s.stateIcon,
                      {
                        borderColor: m.color + '66',
                        backgroundColor: m.color + '18',
                      },
                    ]}
                  >
                    <View style={[s.stateDot, { backgroundColor: m.color }]} />
                  </View>
                  <Text style={s.stateName} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <View style={s.stateTrack}>
                    <View
                      style={[
                        s.stateFill,
                        {
                          width: `${Math.max(2, m.pct)}%` as const,
                          backgroundColor: m.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={s.stateMin}>{fmtMin(m.min)}</Text>
                  <Text style={s.statePct}>{m.pct}%</Text>
                </View>
              ))}
            </View>

          {/* Altijd zichtbaar (operator, 7 augustus 2026). Ook zonder bracelet
              hoort deze rij er te staan: de lijst bestaat, hij is alleen leeg,
              en verbergen maakt onvindbaar wat er straks is. */}
          <Row
            Icon={Watch}
            title="All bracelet sessions"
            sub="View your bracelet session history"
            onPress={() => router.push('/bracelet-history')}
          />
        </>

        {!sub.hasBracelet && (
          <View style={s.card}>
            <Text style={s.emptyT}>Bracelet sessions coming soon</Text>
            <Text style={s.emptyB}>
              Track your state with the VIBEZCORE Smart Bead Bracelet. Counted
              separately from breathwork: one you practise, the other the
              bracelet does for you.
            </Text>
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
    /* Onder de statusbalk beginnen (operator, 7 augustus 2026: de bovenkant
       verdween achter de camera). Wordt bij het renderen gezet met de echte
       inzet van het toestel — een vast getal klopt op geen enkel scherm. */
    top: 0,
    left: 0,
    right: 0,
    height: HERO_H,
  },

  bar: {
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  title: {
    fontFamily: BrandFonts.regular,
    fontSize: 16,
    letterSpacing: 4.2,
    color: '#ffffff',
  },
  gear: { position: 'absolute', right: 12, padding: 6 },
  scroll: {
    paddingHorizontal: 14,
    paddingBottom: 28,
    /* De titelbalk ligt IN het beeld; de rest begint eronder. Het verloop
       onderaan de foto loopt daar nog even in door, dus er is geen harde
       rand waar het beeld ophoudt. */
    paddingTop: HERO_H + BAR_H - 44,
  },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    marginBottom: 8,
  },
  headTxt: { fontFamily: BrandFonts.bold, fontSize: 15, letterSpacing: 0 },

  /* Zonder rand (operator, 8 augustus 2026). Zes omlijnde vakken onder
     elkaar maakten van dit scherm een dashboard; de achtergrond alleen is
     genoeg om te tonen wat bij elkaar hoort. */
  card: {
    borderRadius: 14,
    backgroundColor: CARD_BG,
    padding: 13,
    marginBottom: 8,
  },
  /* Zie de toelichting bij `sectionEyebrow` in breath-session.tsx: gewone
     tekst in plaats van gespatieerde kapitalen (operator, 8 augustus 2026). */
  cardHead: {
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
    letterSpacing: 0,
    color: 'rgba(255,255,255,0.4)',
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
    marginTop: 2,
    fontFamily: BrandFonts.medium,
    fontSize: 11,
    letterSpacing: 0,
    color: 'rgba(255,255,255,0.45)',
  },
  statSub: {
    marginTop: 1,
    fontFamily: BrandFonts.regular,
    fontSize: 8.5,
    color: 'rgba(255,255,255,0.32)',
  },

  chart: { flexDirection: 'row', gap: 6, height: 96 },
  col: { flex: 1, alignItems: 'center' },
  /* De staaf is smaller dan zijn kolom (operator: "te bruut"). Een balk die
     de volle breedte pakt leest als een blok; met lucht ernaast leest hij als
     een meting. */
  barSlot: { flex: 1, width: '58%', alignSelf: 'center' },
  colMin: {
    fontFamily: BrandFonts.semibold,
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    height: 12,
  },
  track: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  /* `overflow: hidden` houdt de segmenten binnen de ronding; zonder dat
     steken de hoeken van het onderste segment onder de balk uit. */
  fill: { width: '100%', borderRadius: 6, minHeight: 3, overflow: 'hidden' },
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

  hiddenPerMode: { display: 'none' },
  miniBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 26,
    marginTop: 6,
  },
  miniBar: { width: 4, borderRadius: 2 },
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
    alignSelf: 'center',
    borderColor: 'rgba(224,179,65,0.45)',
    backgroundColor: 'rgba(224,179,65,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  soonTxt: {
    fontFamily: BrandFonts.bold,
    fontSize: 8.5,
    letterSpacing: 1.4,
    /* Goud, niet grijs. Grijs leest als "uitgeschakeld"; dit is geen defect
       maar een aankondiging, en die mag opvallen. Zelfde tint als de
       COMING FALL 2026-badge in de onboarding. */
    color: '#E0B341',
  },
});
