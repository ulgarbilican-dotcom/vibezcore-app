/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Mini player (sticky balk boven tab-bar)

   Gemount in (tabs)/_layout zodat het over elke tab heen ligt maar onder
   de full-player modal. Render-conditie:
     - state.session != null         (er staat iets klaar)
     - usePathname() !== '/player'   (anders dubbel met full-player)
     - usePathname() !== '/welcome'  (niet op Welcome / onboarding)

   Tap-zones:
     - info-Pressable (series + title + progress): opent full-player
     - play-knop: togglePlay() — bij previewBlocked opent in plaats daarvan
       de full-player zodat de preview-upsell modal weer vanzelf verschijnt
     - close-knop: unload() (audio stopt, mini-player verdwijnt vanzelf)

   Styling: exact uit webapp `.player` + `.pl-*`.
   ─────────────────────────────────────────────────────────────────────── */

import { PlayPauseGlyph } from '@/components/PlayPauseGlyph';
import { SERIES_SUBTITLE } from '@/data/audio-library-data';
import {
  togglePlay,
  unload,
  usePlayerState,
} from '@/services/audio-player';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 64; // moet matchen met (tabs)/_layout
const GAP_ABOVE_TABBAR = 8;

const C = {
  border: 'rgba(58,143,255,0.15)',
  series: 'rgba(58,143,255,0.85)',
  text: '#fff',
  time: 'rgba(255,255,255,0.4)',
  trackBg: 'rgba(255,255,255,0.08)',
  close: 'rgba(255,255,255,0.5)',
  expand: 'rgba(255,255,255,0.4)',
};

function fmt(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function MiniPlayer() {
  const state = usePlayerState();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (!state.session) return null;
  /* Verstop op routes waar de mini-player niet thuishoort. usePathname is
     hier veiliger dan useSegments — modals worden door expo-router als
     ÉÉN pathname-segment ('/player') gerapporteerd. */
  if (pathname === '/player') return null;
  if (pathname === '/welcome') return null;

  const session = state.session;
  const pct =
    state.durationMs > 0
      ? Math.min(100, (state.positionMs / state.durationMs) * 100)
      : 0;

  const onExpand = () => {
    router.push({
      pathname: '/player',
      params: {
        title: session.title,
        series: session.series,
        url: session.url,
        free: session.isFree ? 'true' : 'false',
        desc: session.desc,
      },
    });
  };

  const onPlay = () => {
    /* PreviewBlocked: tap doet niet "speel verder" (zou direct opnieuw
       in cap lopen). In plaats daarvan: open full-player → preview-modal
       verschijnt weer + user kan upgrade. Operator-keuze Q1. */
    if (state.previewBlocked) {
      onExpand();
      return;
    }
    togglePlay();
  };

  const onClose = () => {
    unload();
  };

  return (
    <View
      style={[
        s.wrap,
        { bottom: insets.bottom + TAB_BAR_HEIGHT + GAP_ABOVE_TABBAR },
      ]}
      pointerEvents="box-none"
    >
      {/* Hele card = tap-zone voor expand. Inner Pressables voor play en
         close capturen taps (RN gesture system pakt de dichtstbijzijnde
         Pressable, dus expand vuurt niet wanneer je op play/close tikt). */}
      <Pressable
        onPress={onExpand}
        android_ripple={{ color: 'rgba(255,255,255,0.03)' }}
      >
        <LinearGradient
          colors={['#181a1f', '#101114']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.card}
        >
          {/* Expand-chevron top-right, omhoog (tap = uitklappen naar full). */}
          <Text style={s.expand}>⌃</Text>

          <Text style={s.series} numberOfLines={1}>
            {session.series.toUpperCase()}
          </Text>
          {/* FIX 12: pl-sub regel (subtitle) tussen series en title.
             Voor Soundscapes geeft dit de lange tag-string "Frequency
             Sessions · Theta · …". Voor andere series staat hier de
             "inspired by"-tag uit SERIES_SUBTITLE. Rendert null als
             het veld leeg is — geen lege ruimte. */}
          {SERIES_SUBTITLE[session.series] ? (
            <Text style={s.sub} numberOfLines={1}>
              {SERIES_SUBTITLE[session.series]}
            </Text>
          ) : null}
          <Text style={s.title} numberOfLines={1}>
            {session.title}
          </Text>
          <View style={s.progressTrack}>
            <LinearGradient
              colors={['#3a8fff', '#5ba4ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.progressFill, { width: `${pct}%` }]}
            />
          </View>

          <View style={s.bottomRow}>
            <Text style={s.time}>
              {fmt(state.positionMs)} / {fmt(state.durationMs)}
            </Text>
            <View style={s.btns}>
              <Pressable onPress={onPlay} hitSlop={8} style={s.playBtnWrap}>
                <LinearGradient
                  colors={['#3a8fff', '#2c7ae8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={s.playBtnBg}
                />
                <PlayPauseGlyph
                  size={14}
                  color="#ffffff"
                  playing={state.playing}
                />
              </Pressable>
              <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
                <Text style={s.closeGlyph}>✕</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  /* Absolute over tab-content. pointerEvents:box-none zodat tap onder
     het balkje door valt op het scherm eronder. */
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
    elevation: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 11,
    /* Donkere shadow boven het balkje (webapp shadow: 0 -8 32) */
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
  },

  /* Expand-chevron top-right — wijst omhoog: tap = uitklappen naar full.
     ⌃ (U+2303 UP ARROWHEAD) is een pure tekst-glyph, geen emoji-render. */
  expand: {
    position: 'absolute',
    top: 8,
    right: 12,
    color: C.expand,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  series: {
    color: C.series,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.24,
    marginRight: 16, // ruimte voor expand-chevron
  },
  /* FIX 12: pl-sub (subtitle). 9px / weight 500 / .04em letter-spacing /
     rgba(255,255,255,.32). marginBottom 3 zoals webapp. Ellipsis via
     numberOfLines op de <Text> JSX. */
  sub: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.36, // .04em op 9px
    marginTop: 2,
    marginBottom: 3,
    marginRight: 16,
  },
  title: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.14,
    lineHeight: 18,
    marginTop: 2,
  },
  progressTrack: {
    height: 3,
    backgroundColor: C.trackBg,
    borderRadius: 99,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    shadowColor: '#3a8fff',
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  time: {
    color: C.time,
    fontSize: 10,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  btns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playBtnWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#3a8fff',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  playBtnBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 21,
  },
  playGlyph: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  closeBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    color: C.close,
    fontSize: 14,
    fontWeight: '700',
  },
});
