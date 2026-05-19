/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Audio player

   GEDRAG (exact het model uit webapp index_2_correct.html, GEEN preview):
     - gratis sessie (free=true)         → speelt VOLLEDIG af, geen account
     - premium zonder abonnement         → speelt NIET; upgrade-scherm
     - premium met abonnement            → speelt VOLLEDIG af

   Letterlijke teksten uit de bron (regel 2763-2765), niets verzonnen:
     badge : "Free — No Account Needed"
     kop   : "Listen Free. No Limits."
     p     : "One session from each series. No credit card. Just press play."

   Geen 30s-preview, geen timer. Premium zonder abo komt nooit tot spelen.

   Audio: expo-av → Claude Code: npx expo install expo-av
   (NIET npm audit fix --force.)

   Plaatsing: src/app/player.tsx (expo-router). Sessie via router params:
   title, series, url, free, desc.
   ─────────────────────────────────────────────────────────────────────────── */

import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  bg: '#0a0a0a',
  text: '#ffffff',
  dim: 'rgba(255,255,255,0.5)',
  faint: 'rgba(255,255,255,0.32)',
  accent: '#3a8fff',
  free: '#3ad07a',
  border: '#1a1a1a',
};

/* [OPERATOR] — echte Gumroad-abonnementscheck hoort hier.
   Webapp-equivalent: window.VIBEZCORE.hasSubscription === true. Nu: false. */
function useSubscription(): boolean {
  return false;
}

export default function PlayerScreen() {
  const router = useRouter();
  const p = useLocalSearchParams<{
    title?: string;
    series?: string;
    url?: string;
    free?: string;
    desc?: string;
  }>();

  const title = p.title ?? '';
  const series = p.series ?? '';
  const url = p.url ?? '';
  const isFree = p.free === 'true';
  const desc = p.desc ?? '';

  const hasSubscription = useSubscription();
  const canPlay = isFree || hasSubscription;

  /* Sluit de player en ga terug naar de Audio Library. Eerste keus = back()
     (popt het modal en houdt scroll/expand-state van /(tabs) intact). Als er
     om welke reden dan ook geen back-history is (deep-link, hot-reload),
     navigeren we expliciet naar `/` zodat de gebruiker NOOIT vastzit
     (blauwdruk-prioriteit #2). */
  const closePlayer = () => {
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

  const soundRef = useRef<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(canPlay);
  const [playing, setPlaying] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(0);

  useEffect(() => {
    // Premium zonder abonnement: niets laden, geen audio. Upgrade-scherm.
    if (!canPlay || !url) return;

    let mounted = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          (st: any) => {
            if (!st?.isLoaded) return;
            setPlaying(st.isPlaying);
            setPosMs(st.positionMillis ?? 0);
            setDurMs(st.durationMillis ?? 0);
          }
        );
        if (!mounted) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        setLoading(false);
      } catch {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      soundRef.current?.unloadAsync();
    };
  }, [url, canPlay]);

  async function toggle() {
    const snd = soundRef.current;
    if (!snd) return;
    if (playing) await snd.pauseAsync();
    else await snd.playAsync();
  }

  const fmt = (ms: number) => {
    const t = Math.floor(ms / 1000);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };
  const pct = durMs > 0 ? Math.min(100, (posMs / durMs) * 100) : 0;

  /* ── PREMIUM ZONDER ABONNEMENT → upgrade-scherm, geen player ── */
  if (!canPlay) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <Pressable style={s.back} onPress={closePlayer} hitSlop={14}>
          <Text style={s.backTxt}>‹ Back</Text>
        </Pressable>
        <View style={s.center}>
          <Text style={s.lockGlyph}>🔒</Text>
          <Text style={s.series}>{series.toUpperCase()}</Text>
          <Text style={s.title}>{title}</Text>
          <Text style={s.pwP}>
            This is a premium session. Unlock the full VIBEZCORE Audio
            Library to listen.
          </Text>
          {/* [OPERATOR] — koppel aan de echte Gumroad upgrade-flow. */}
          <Pressable
            style={s.pwBtn}
            onPress={() => router.push('/(tabs)/account')}
          >
            <Text style={s.pwBtnTxt}>See subscription options</Text>
          </Pressable>
          <Pressable onPress={closePlayer} hitSlop={14}>
            <Text style={s.pwBack}>Back to library</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ── GRATIS (of abonnee) → volledige player ── */
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Pressable style={s.back} onPress={closePlayer} hitSlop={14}>
        <Text style={s.backTxt}>‹ Back</Text>
      </Pressable>
      <View style={s.center}>
        <Text style={s.series}>{series.toUpperCase()}</Text>
        <Text style={s.title}>{title}</Text>
        {desc ? <Text style={s.desc}>{desc}</Text> : null}
        {isFree ? (
          <Text style={s.freeTag}>Free — No Account Needed</Text>
        ) : null}

        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${pct}%` }]} />
        </View>
        <View style={s.timeRow}>
          <Text style={s.time}>{fmt(posMs)}</Text>
          <Text style={s.time}>{fmt(durMs)}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={C.accent} style={{ marginTop: 28 }} />
        ) : (
          <Pressable style={s.playBtn} onPress={toggle}>
            <Text style={s.playBtnTxt}>{playing ? '❚❚' : '▶'}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, padding: 20 },
  back: { paddingVertical: 10, paddingHorizontal: 8, alignSelf: 'flex-start' },
  backTxt: { color: C.dim, fontSize: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lockGlyph: { fontSize: 40, marginBottom: 18, opacity: 0.7 },
  series: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 10,
  },
  title: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  desc: {
    color: C.dim,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  freeTag: {
    color: C.free,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 16,
  },
  progressTrack: {
    height: 4,
    width: '100%',
    backgroundColor: C.border,
    borderRadius: 2,
    marginTop: 32,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: C.accent },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  time: { color: C.faint, fontSize: 11 },
  playBtn: {
    marginTop: 28,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnTxt: { color: '#001226', fontSize: 24, fontWeight: '800' },
  pwP: {
    color: C.dim,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 21,
    paddingHorizontal: 16,
  },
  pwBtn: {
    marginTop: 26,
    backgroundColor: C.accent,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  pwBtnTxt: { color: '#001226', fontSize: 15, fontWeight: '800' },
  pwBack: { color: C.dim, fontSize: 13, marginTop: 18 },
});
