/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Puntenveld, PROTOTYPE

   Los scherm, naast het bestaande sessiescherm. Dat blijft ongemoeid tot de
   operator zegt dat dit beter is; zo kost proberen niets.

   Wat je hier beoordeelt is één ding: het GEVOEL. Trekken de punten bij het
   inademen overtuigend samen, valt het bij het uitademen mooi uiteen, en
   voel je onbewust dat elke modus zijn eigen beweging heeft? Alles eromheen
   — duurkeuze, stem, historiek, bracelet — staat er bewust niet in.

   Het ademritme is echt: het leest dezelfde toestanden als de sessie, dus
   BOOST jaagt en REST kruipt, precies zoals straks in het echt.

   ── Nog te leveren door de operator ───────────────────────────────────
   Het EINDBEELD is nu een tijdelijke: de illustratie van de toestand zelf.
   Zodra het portret op Bunny staat, wijst PORTRAIT daarheen en trekken de
   punten samen tot een gezicht — dat is één regel hieronder, verder verandert
   er niets.
   ───────────────────────────────────────────────────────────────────────── */

import SplatField from '@/components/SplatField';
import Starfield from '@/components/Starfield';
import { SESSION_ART } from '@/components/SessionArt';
import { Brand, BrandFonts } from '@/constants/theme';
import {
  BREATH_STATES,
  nextPhase,
  phaseAt,
  type BreathStateKey,
  type PhaseKey,
} from '@/data/breath-states';
import { router, Stack } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const FIELD = Math.min(SCREEN_W, 420);

/* Het eindbeeld: één foto met beide gezichten (operator, 3 augustus 2026).
   Bewust de ORIGINELE en niet de uitgeknipte versie. Deze techniek plakt het
   beeld nergens overheen — ze leest alleen helderheid — dus een verwijderde
   achtergrond levert niets op. De originele staat al op zwart, heeft ruim
   twee keer zoveel detail (1535×1024 tegen 612×408, en dat is de reserve
   voor méér punten), en mist de halfdoorzichtige waas die het uitknippen
   langs de randen achterliet. */
const PORTRAIT: string | null =
  'https://vibezcore-audio.b-cdn.net/images/faces.png';

const ORDER: BreathStateKey[] = ['boost', 'focus', 'calm', 'clarity', 'rest'];

export default function BreathSplatScreen() {
  const [stateKey, setStateKey] = useState<BreathStateKey>('calm');
  const st = BREATH_STATES[stateKey];

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<PhaseKey>('inhale');
  const [secsLeft, setSecsLeft] = useState(0);

  /* Dezelfde ene waarde die het hele veld stuurt: 0 = uiteen, 1 = samen. */
  const breath = useSharedValue(0);

  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const hop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  const clear = useCallback(() => {
    if (tick.current) clearInterval(tick.current);
    if (hop.current) clearTimeout(hop.current);
    tick.current = null;
    hop.current = null;
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    clear();
    cancelAnimation(breath);
    /* Rustig terug naar uiteen, niet met een klap. */
    breath.value = withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) });
    setPhase('inhale');
    setSecsLeft(0);
  }, [breath, clear]);

  const runPhase = useCallback(
    (k: PhaseKey) => {
      if (!runningRef.current) return;
      const def = phaseAt(st, k);
      setPhase(k);
      setSecsLeft(def.secs);

      /* Alleen in- en uitademen bewegen het veld. Tijdens vasthouden blijft
         de wolk staan waar hij staat — dat is wat vasthouden ís, en het is
         precies het moment waarop de vorm van de modus even blijft hangen. */
      if (k === 'inhale' || k === 'exhale') {
        breath.value = withTiming(k === 'inhale' ? 1 : 0, {
          duration: def.secs * 1000,
          easing: Easing.inOut(Easing.sin),
        });
      }

      let left = def.secs;
      if (tick.current) clearInterval(tick.current);
      tick.current = setInterval(() => {
        left -= 1;
        setSecsLeft(left);
        if (left <= 0) {
          if (tick.current) clearInterval(tick.current);
          tick.current = null;
          hop.current = setTimeout(() => runPhase(nextPhase(st, k).key), 0);
        }
      }, 1000);
    },
    [breath, st],
  );

  const start = useCallback(() => {
    runningRef.current = true;
    setRunning(true);
    cancelAnimation(breath);
    breath.value = 0;
    runPhase('inhale');
  }, [breath, runPhase]);

  useEffect(() => () => clear(), [clear]);

  /* Van toestand wisselen tijdens het draaien zou het ritme halverwege
     omgooien; dan stopt hij eerst. */
  const pick = (k: BreathStateKey) => {
    if (running) stop();
    setStateKey(k);
  };

  const label = phaseAt(st, phase).label;
  const via = phaseAt(st, phase).via;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Starfield width={SCREEN_W} height={SCREEN_H} count={50} color="#C9A7FF" />
      </View>

      <View style={s.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.icon}>
          <X size={18} color="rgba(255,255,255,0.72)" strokeWidth={2.2} />
        </Pressable>
        <Text style={[s.eyebrow, { color: st.accent }]}>{st.eyebrow}</Text>
        <View style={s.icon} />
      </View>

      <View style={s.stage}>
        <SplatField
          orderedUri={PORTRAIT ?? SESSION_ART[st.art]}
          modeUri={SESSION_ART[st.art]}
          breath={breath}
          size={FIELD}
          color={st.accent}
        />
      </View>

      <Text style={[s.phase, { color: st.accent }]}>
        {running ? `${label}${via ? ` · ${via.toUpperCase()}` : ''}` : 'READY'}
      </Text>
      <Text style={s.secs}>{running ? `${Math.max(0, secsLeft)}` : st.technique}</Text>

      <View style={s.modes}>
        {ORDER.map((k) => {
          const t = BREATH_STATES[k];
          const on = k === stateKey;
          return (
            <Pressable
              key={k}
              onPress={() => pick(k)}
              style={[
                s.mode,
                on && { borderColor: t.accent, backgroundColor: t.accentSoft },
              ]}
            >
              <Text
                style={[
                  s.modeTxt,
                  { color: on ? t.accent : 'rgba(255,255,255,0.5)' },
                ]}
                numberOfLines={1}
              >
                {t.eyebrow.split(' ')[0]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={running ? stop : start}
        style={[s.cta, { borderColor: st.accent }]}
      >
        <Text style={[s.ctaTxt, { color: st.accent }]}>
          {running ? 'STOP' : 'START'}
        </Text>
      </Pressable>

      <Text style={s.note}>
        Prototype — the portrait replaces the figure once it is uploaded.
      </Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: BrandFonts.bold, fontSize: 12, letterSpacing: 3.6 },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  phase: {
    fontFamily: BrandFonts.bold,
    fontSize: 15,
    letterSpacing: 2.4,
    textAlign: 'center',
  },
  secs: {
    marginTop: 4,
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },

  modes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 22,
    paddingHorizontal: 12,
  },
  mode: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modeTxt: { fontFamily: BrandFonts.bold, fontSize: 10, letterSpacing: 0.6 },

  cta: {
    alignSelf: 'center',
    marginTop: 18,
    paddingHorizontal: 40,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTxt: { fontFamily: BrandFonts.bold, fontSize: 13, letterSpacing: 2.2 },

  note: {
    marginTop: 14,
    marginBottom: 18,
    fontFamily: BrandFonts.regular,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
});
