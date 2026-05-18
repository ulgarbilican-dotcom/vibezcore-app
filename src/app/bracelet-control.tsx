/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Bracelet control screen

   Drives the bracelet via the BLE contract (§5). Today that's the
   spec-faithful SimulatedBracelet; later RealBracelet — this screen does
   not change. Shows ONLY what spec §11.3/§11.5 allows: mode name, bounded
   duration, and during a session: remaining time, battery, BLE status, stop.
   No PPS / burst_ms / amplitude / RTP anywhere (spec §11.5).

   Uiterlijk: MERK_ANKER — Brand-palet, Inter via _layout. Mode-kleuren
   blijven uit `getModeMeta` (CLAUDE.md §5), state-indicatoren gebruiken
   Brand.success / Brand.error.
   ─────────────────────────────────────────────────────────────────────────── */

import { Brand, BrandFonts } from '@/constants/theme';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    BleCommand,
    BleConnectionState,
    BleStatusPacket,
    BraceletMode,
    MODES,
    ModeMeta,
    clampDuration,
    getModeMeta,
} from '../services/ble-contract';
import { getBracelet, getSimHooks } from '../services/bracelet';

/* MERK_ANKER §2 levert geen "warn" kleur. Voor de battery-warn drempel
   (5–20%) gebruiken we de Sharp Focus oranje uit CLAUDE.md §5. */
const WARN = '#FF9F0A';

const POLL_MS = 5000; // spec §8.3/§11.4 — app polls status every 5s

export default function BraceletControl() {
  const bracelet = getBracelet();
  const sim = getSimHooks(); // null on real hardware

  const [conn, setConn] = useState<BleConnectionState>(
    bracelet.getConnectionState()
  );
  const [selectedMode, setSelectedMode] = useState<BraceletMode>(
    BraceletMode.Alpha
  );
  const meta = getModeMeta(selectedMode);
  const [duration, setDuration] = useState<number>(meta.minMinutes);
  const [status, setStatus] = useState<BleStatusPacket | null>(null);
  const [busy, setBusy] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Connection state subscription. */
  useEffect(() => {
    const off = bracelet.onConnectionChange(setConn);
    return off;
  }, [bracelet]);

  /* When mode changes, reset duration to that mode's minimum (spec §11.2:
     default = minimum). Keep it clamped to the new mode's bounds. */
  useEffect(() => {
    setDuration(getModeMeta(selectedMode).minMinutes);
  }, [selectedMode]);

  /* Poll status every 5s while connected (spec §8.3/§11.4). */
  useEffect(() => {
    if (conn !== 'connected') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    let alive = true;
    const tick = async () => {
      try {
        const st = await bracelet.requestStatus();
        if (alive) setStatus(st);
      } catch {
        /* transient — next tick retries */
      }
    };
    tick();
    pollRef.current = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [conn, bracelet]);

  const onConnect = async () => {
    setBusy(true);
    try {
      await bracelet.connect();
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    setBusy(true);
    try {
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: clampDuration(selectedMode, duration),
        command: BleCommand.Start,
      });
      const st = await bracelet.requestStatus();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

  const onStop = async () => {
    setBusy(true);
    try {
      await bracelet.sendCommand({
        mode: selectedMode,
        duration: 0,
        command: BleCommand.Stop,
      });
      const st = await bracelet.requestStatus();
      setStatus(st);
    } finally {
      setBusy(false);
    }
  };

  const sessionActive = status?.sessionActive ?? false;
  const battery = status?.batteryPercent ?? null;
  const batteryColor =
    battery == null
      ? Brand.textDim
      : battery < 5
      ? Brand.error
      : battery < 20
      ? WARN
      : Brand.success;

  return (
    <View style={st.root}>
      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={st.title}>Bracelet</Text>
        <Text style={st.subtitle}>
          {conn === 'connected'
            ? 'Connected'
            : conn === 'connecting'
            ? 'Connecting…'
            : conn === 'scanning'
            ? 'Searching…'
            : 'Not connected'}
        </Text>

        {/* Connect */}
        {conn !== 'connected' && (
          <Pressable
            style={[st.primaryBtn, busy && st.btnDisabled]}
            onPress={onConnect}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={Brand.text} />
            ) : (
              <Text style={st.primaryBtnText}>Connect bracelet</Text>
            )}
          </Pressable>
        )}

        {conn === 'connected' && (
          <>
            {/* Status strip */}
            <View style={st.statusStrip}>
              <View style={st.statusCell}>
                <Text style={st.statusLabel}>Battery</Text>
                <Text style={[st.statusValue, { color: batteryColor }]}>
                  {battery == null ? '—' : `${battery}%`}
                </Text>
              </View>
              <View style={st.statusCell}>
                <Text style={st.statusLabel}>Connection</Text>
                <Text style={[st.statusValue, { color: Brand.success }]}>
                  Live
                </Text>
              </View>
              <View style={st.statusCell}>
                <Text style={st.statusLabel}>State</Text>
                <Text style={st.statusValue}>
                  {status?.charging
                    ? 'Charging'
                    : status?.fault
                    ? 'Fault'
                    : sessionActive
                    ? 'Active'
                    : 'Idle'}
                </Text>
              </View>
            </View>

            {sessionActive ? (
              /* ── Active session view (spec §11.3) ── */
              <View style={st.sessionBox}>
                <Text style={st.sessionMode}>
                  {getModeMeta(status!.currentMode).name}
                </Text>
                <Text style={st.sessionRemain}>
                  {status!.remainingMinutes} min remaining
                </Text>
                <View
                  style={[
                    st.modeDot,
                    {
                      backgroundColor: getModeMeta(status!.currentMode)
                        .color,
                    },
                  ]}
                />
                <Pressable
                  style={[st.stopBtn, busy && st.btnDisabled]}
                  onPress={onStop}
                  disabled={busy}
                >
                  <Text style={st.stopBtnText}>Stop session</Text>
                </Pressable>
              </View>
            ) : (
              /* ── Mode + duration picker ── */
              <>
                <Text style={st.sectionLabel}>Choose a mode</Text>
                {MODES.map((m: ModeMeta) => {
                  const active = m.mode === selectedMode;
                  return (
                    <Pressable
                      key={m.mode}
                      style={[
                        st.modeCard,
                        active && {
                          borderColor: m.color,
                          backgroundColor: 'rgba(244,244,244,0.03)',
                        },
                      ]}
                      onPress={() => setSelectedMode(m.mode)}
                    >
                      <View
                        style={[st.modeDot, { backgroundColor: m.color }]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={st.modeName}>{m.name}</Text>
                        <Text style={st.modeBlurb}>{m.blurb}</Text>
                      </View>
                      {active && (
                        <Text style={[st.modeCheck, { color: m.color }]}>
                          ●
                        </Text>
                      )}
                    </Pressable>
                  );
                })}

                {/* Duration — bounded per mode (spec §11.2). Stepper keeps
                    the value strictly within [min,max]; default = min. */}
                <Text style={st.sectionLabel}>Duration</Text>
                <View style={st.durRow}>
                  <Pressable
                    style={st.durBtn}
                    onPress={() =>
                      setDuration((d: number) =>
                        clampDuration(selectedMode, d - 1)
                      )
                    }
                  >
                    <Text style={st.durBtnText}>–</Text>
                  </Pressable>
                  <View style={st.durValueBox}>
                    <Text style={st.durValue}>{duration}</Text>
                    <Text style={st.durUnit}>min</Text>
                  </View>
                  <Pressable
                    style={st.durBtn}
                    onPress={() =>
                      setDuration((d: number) =>
                        clampDuration(selectedMode, d + 1)
                      )
                    }
                  >
                    <Text style={st.durBtnText}>+</Text>
                  </Pressable>
                </View>
                <Text style={st.durHint}>
                  {meta.name}: {meta.minMinutes}–{meta.maxMinutes} min
                </Text>

                <Pressable
                  style={[st.primaryBtn, busy && st.btnDisabled]}
                  onPress={onStart}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color={Brand.text} />
                  ) : (
                    <Text style={st.primaryBtnText}>Start session</Text>
                  )}
                </Pressable>
              </>
            )}

            {/* Sim-only demo controls — clearly labelled, removed when
                running on real hardware (getSimHooks() → null). */}
            {sim && (
              <View style={st.demoBox}>
                <Text style={st.demoTitle}>
                  Demo controls (simulation only)
                </Text>
                <View style={st.demoRow}>
                  <Pressable
                    style={st.demoBtn}
                    onPress={() => sim.simSetBattery(18)}
                  >
                    <Text style={st.demoBtnText}>Low battery</Text>
                  </Pressable>
                  <Pressable
                    style={st.demoBtn}
                    onPress={() => sim.simSetCharging(true)}
                  >
                    <Text style={st.demoBtnText}>Charging</Text>
                  </Pressable>
                  <Pressable
                    style={st.demoBtn}
                    onPress={() => sim.simTriggerFault()}
                  >
                    <Text style={st.demoBtnText}>Fault</Text>
                  </Pressable>
                </View>
                <Pressable
                  style={[st.demoBtn, { marginTop: 8 }]}
                  onPress={() => {
                    sim.simSetCharging(false);
                    sim.simSetBattery(87);
                  }}
                >
                  <Text style={st.demoBtnText}>Reset demo state</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: 16, paddingBottom: 48 },
  title: {
    color: Brand.text,
    fontSize: 26,
    fontFamily: BrandFonts.extrabold,
    letterSpacing: -0.5,
    marginTop: 12,
  },
  subtitle: {
    color: Brand.textDim,
    fontSize: 13,
    fontFamily: BrandFonts.regular,
    marginTop: 4,
    marginBottom: 22,
  },
  primaryBtn: {
    backgroundColor: Brand.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryBtnText: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
  },
  btnDisabled: { opacity: 0.5 },
  statusStrip: {
    flexDirection: 'row',
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  statusCell: { flex: 1, alignItems: 'center' },
  statusLabel: {
    color: Brand.textDim,
    fontSize: 10,
    fontFamily: BrandFonts.semibold,
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  statusValue: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
  },
  sectionLabel: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.bold,
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  modeDot: { width: 12, height: 12, borderRadius: 6 },
  modeName: {
    color: Brand.text,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
  },
  modeBlurb: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    marginTop: 2,
  },
  modeCheck: { fontSize: 12 },
  durRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginTop: 4,
  },
  durBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durBtnText: {
    color: Brand.text,
    fontSize: 24,
    fontFamily: BrandFonts.bold,
  },
  durValueBox: { alignItems: 'center', minWidth: 80 },
  durValue: {
    color: Brand.text,
    fontSize: 34,
    fontFamily: BrandFonts.extrabold,
  },
  durUnit: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
  },
  durHint: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.regular,
    textAlign: 'center',
    marginTop: 8,
  },
  sessionBox: {
    backgroundColor: Brand.panel,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 26,
    alignItems: 'center',
  },
  sessionMode: {
    color: Brand.text,
    fontSize: 22,
    fontFamily: BrandFonts.extrabold,
  },
  sessionRemain: {
    color: Brand.textDim,
    fontSize: 15,
    fontFamily: BrandFonts.regular,
    marginTop: 8,
  },
  stopBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.4)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 24,
  },
  stopBtnText: {
    color: Brand.error,
    fontSize: 15,
    fontFamily: BrandFonts.bold,
  },
  demoBox: {
    marginTop: 30,
    padding: 14,
    borderRadius: 12,
    borderColor: Brand.border,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  demoTitle: {
    color: Brand.textDim,
    fontSize: 11,
    fontFamily: BrandFonts.bold,
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  demoRow: { flexDirection: 'row', gap: 8 },
  demoBtn: {
    flex: 1,
    backgroundColor: 'rgba(244,244,244,0.04)',
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  demoBtnText: {
    color: Brand.textDim,
    fontSize: 12,
    fontFamily: BrandFonts.semibold,
  },
});
