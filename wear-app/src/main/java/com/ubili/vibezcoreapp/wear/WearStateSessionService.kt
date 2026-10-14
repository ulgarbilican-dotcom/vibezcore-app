package com.ubili.vibezcoreapp.wear

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control-haptiek LOKAAL op het horloge.

   Protocol: docs/WATCH_PROTOCOL.md. De telefoon stuurt één `state-start`
   met de parameters; het horloge rekent de volledige curve zelf uit met
   EXACT dezelfde formule als src/services/bracelet-haptics.ts
   (bpmAt / beatAt / buildWaveform) en speelt die af op een eigen klok.
   Een Bluetooth-hapering of een slapende telefoon raakt het ritme niet.

   Afspelen TIK PER TIK (zelfde aanpak als StateHapticsService op de
   telefoon, gemeten 5 okt 2026): één lange trilling voor de hele sessie
   wordt door Android afgebroken bij scherm-uit (cancelled_by_screen_off)
   en verdrongen door elke andere trilling (meldingen, tik-feedback). Pols
   omlaag = scherm uit, dus elke slag speelt als EIGEN korte waveform op
   zijn exacte moment (Handler + wake lock). Een verdringing kost hooguit
   één slag. Ritme en eind-signaal zijn identiek aan de ene lange waveform. */

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.os.Build
import android.media.SoundPool
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.PowerManager
import android.os.Process
import android.os.SystemClock
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import org.json.JSONObject
import kotlin.math.ceil
import kotlin.math.min
import kotlin.math.roundToLong

private const val CHANNEL_ID = "vibezcore_state"
private const val NOTIFICATION_ID = 1002

/* ── Het ritme — 1:1 uit bracelet-haptics.ts, niet afwijken ─────────────── */
/** Begintempo als de telefoon geen startBpm meestuurt (oudere versies). */
private const val DEFAULT_START_BPM = 75.0
private const val LUB_DUB_FRACTION = 0.3
private const val LUB_DUB_MAX_MS = 350.0
private const val LUB_MS = 45L
private const val DUB_MS = 35L

/** JS Math.round: halve waarden naar boven (ook bij negatieve getallen). */
private fun jsRound(x: Double): Long = Math.floor(x + 0.5).toLong()

private data class StateStart(
  val title: String,
  val colorHex: String,
  /** Rusthartslag van de gebruiker = begintempo ("Match your rhythm"). */
  val startBpm: Double,
  val targetBpm: Double,
  val holdSec: Double,
  val rampSec: Double,
  val curveOffsetSec: Double,
  /** Waar het slagenrooster van de telefoon begon (= de verzonden offset):
   *  de eerste tik valt op de eerstvolgende slag van dát rooster. */
  val gridOriginSec: Double = curveOffsetSec,
  /** Telefoonklok toen dit bericht vertrok (0 = onbekend). */
  val sentAtMs: Long = 0L,
  /** Op het horloge zelf gestart (geen telefoon die meespeelt). */
  val local: Boolean = false,
  /** Het oorspronkelijke bericht, om een horloge-sessie te kunnen hervatten. */
  val raw: String = "",
  val remainingSec: Double,
  val lubAmp: Int,
  val dubAmp: Int,
  val lubMsNoAmp: Long,
  val dubMsNoAmp: Long,
  /** Tikduur met amplitude-regeling — de telefoon stuurt hem mee volgens de
   *  gekozen sterkte (12 okt 2026); oudere telefoon-apps: 45/35 ms. */
  val lubMs: Long = LUB_MS,
  val dubMs: Long = DUB_MS,
  /** "Haptic + Audio" op de telefoon → hartslaggeluid op elke slag. */
  val sound: Boolean = false,
)

private fun bpmAt(s: StateStart, t: Double): Double {
  if (t < s.holdSec) return s.startBpm
  val rampElapsed = t - s.holdSec
  val progress = if (s.rampSec <= 0) 1.0 else min(1.0, rampElapsed / s.rampSec)
  return s.startBpm + (s.targetBpm - s.startBpm) * progress
}

/** (cycleMs, dubAt) */
private fun beatAt(s: StateStart, t: Double): Pair<Long, Long> {
  val cycleMs = jsRound(60000.0 / bpmAt(s, t))
  val dubAt = jsRound(min(cycleMs * LUB_DUB_FRACTION, LUB_DUB_MAX_MS))
  return cycleMs to dubAt
}

private class Waveform(val timings: LongArray, val amplitudes: IntArray)

/** Port van buildWaveform() voor een eindige sessie (totalSec = remainingSec). */
private fun buildWaveform(s: StateStart, amplitudeControl: Boolean): Waveform {
  val timings = ArrayList<Long>()
  val amplitudes = ArrayList<Int>()
  val curveEnd = s.holdSec + s.rampSec
  val offset = s.curveOffsetSec
  val total = s.remainingSec
  var t = offset

  val lubMs = if (amplitudeControl) s.lubMs else s.lubMsNoAmp
  val dubMs = if (amplitudeControl) s.dubMs else s.dubMsNoAmp
  val lubAmp = if (amplitudeControl) s.lubAmp else 255
  val dubAmp = if (amplitudeControl) s.dubAmp else 255
  fun pushBeat(cycleMs: Long, dubAt: Long) {
    /* coerceAtLeast: Android weigert negatieve stappen; bij de echte
       parameters (≥ 40 bpm, ≤ 110 bpm) komt dit nooit voor. */
    timings.add(lubMs)
    timings.add((dubAt - lubMs).coerceAtLeast(0))
    timings.add(dubMs)
    timings.add((cycleMs - dubAt - dubMs).coerceAtLeast(0))
    amplitudes.add(lubAmp); amplitudes.add(0); amplitudes.add(dubAmp); amplitudes.add(0)
  }

  while (t < curveEnd && t - offset < total) {
    val (cycleMs, dubAt) = beatAt(s, t)
    pushBeat(cycleMs, dubAt)
    t += cycleMs / 1000.0
  }
  val (steadyCycle, steadyDub) = beatAt(s, curveEnd)
  while (t - offset < total) {
    pushBeat(steadyCycle, steadyDub)
    t += steadyCycle / 1000.0
  }
  /* Eind-signaal: 600 ms stilte, dan drie oplopende tikken. */
  fun strong(amp: Int) = if (amplitudeControl) amp else 255
  timings.addAll(listOf(600L, 70L, 120L, 90L, 120L, 160L))
  amplitudes.addAll(listOf(0, strong(90), 0, strong(130), 0, strong(180)))
  return Waveform(timings.toLongArray(), amplitudes.toIntArray())
}

/** Het trilpatroon voor de trilmotor, compact: de opbouw van het ritme en
 *  daarna één vaste slag die zichzelf herhaalt (repeat-index). Een volledig
 *  patroon van 5–50 min (duizenden stappen) liet de trildienst 0,4 s
 *  nadenken voor hij begon (meting 13 okt 2026). `skipMs` knipt het begin
 *  weg als we te laat starten; het eindsignaal speelt apart. */
private class VibPattern(val timings: LongArray, val amplitudes: IntArray, val repeat: Int)

private fun buildVibPattern(s: StateStart, amplitudeControl: Boolean, skipMs: Long): VibPattern {
  val lubMs = if (amplitudeControl) s.lubMs else s.lubMsNoAmp
  val dubMs = if (amplitudeControl) s.dubMs else s.dubMsNoAmp
  val lubAmp = if (amplitudeControl) s.lubAmp else 255
  val dubAmp = if (amplitudeControl) s.dubAmp else 255
  fun beat(cycleMs: Long, dubAt: Long, t: MutableList<Long>, a: MutableList<Int>) {
    t.add(lubMs); t.add((dubAt - lubMs).coerceAtLeast(0)); t.add(dubMs); t.add((cycleMs - dubAt - dubMs).coerceAtLeast(0))
    a.add(lubAmp); a.add(0); a.add(dubAmp); a.add(0)
  }
  val curveEnd = s.holdSec + s.rampSec
  val rt = ArrayList<Long>()
  val ra = ArrayList<Int>()
  var t = s.curveOffsetSec
  while (t < curveEnd) {
    val (c, d) = beatAt(s, t)
    beat(c, d, rt, ra)
    t += c / 1000.0
  }
  val st = ArrayList<Long>()
  val sa = ArrayList<Int>()
  val (sc, sd) = beatAt(s, curveEnd)
  beat(sc, sd, st, sa)
  val rampMs = rt.sum()
  if (skipMs < rampMs) {
    val (tt, aa) = trimStart(rt.toLongArray(), ra.toIntArray(), skipMs)
    return VibPattern(tt + st.toLongArray(), aa + sa.toIntArray(), tt.size)
  }
  val r = (skipMs - rampMs) % sc
  val (pt, pa) = trimStart(st.toLongArray(), sa.toIntArray(), r)
  return VibPattern(pt + st.toLongArray(), pa + sa.toIntArray(), pt.size)
}

/** Eind-signaal: 600 ms stilte, dan drie oplopende tikken. */
private fun endSignal(amplitudeControl: Boolean): Pair<LongArray, IntArray> {
  fun strong(amp: Int) = if (amplitudeControl) amp else 255
  return longArrayOf(600L, 70L, 120L, 90L, 120L, 160L) to intArrayOf(0, strong(90), 0, strong(130), 0, strong(180))
}

/** Eén af te spelen stuk met zijn begintijd t.o.v. de start. */
private class BeatUnit(val offsetMs: Long, val t: LongArray, val a: IntArray)

/** Curve (lub, gap, dub, rust)×N + eind-signaal (6 stappen) → losse slagen. */
private fun splitIntoUnits(w: Waveform): List<BeatUnit> {
  val t = w.timings
  val a = w.amplitudes
  val sigStart = t.size - 6
  val out = ArrayList<BeatUnit>()
  var acc = 0L
  var i = 0
  while (i < sigStart) {
    /* De rust na de dub hoeft niet mee in de trilling: de volgende slag
       krijgt zijn eigen begintijd. */
    out.add(BeatUnit(acc, longArrayOf(t[i], t[i + 1], t[i + 2]), intArrayOf(a[i], 0, a[i + 2])))
    acc += t[i] + t[i + 1] + t[i + 2] + t[i + 3]
    i += 4
  }
  out.add(BeatUnit(acc, t.copyOfRange(sigStart, t.size), a.copyOfRange(sigStart, t.size)))
  return out
}

/** Klokverschil horloge − telefoon, plus de reactietijd van de motoren.
 *  Gemeten ~0,1 s (± 0,1 s, adb), daarna op gevoel bijgesteld door de
 *  operator (13 okt 2026): met 100 liep de pols een fractie voor t.o.v. de
 *  oude telefoonstart, met de echte telefoonstart (+160) een fractie achter
 *  → het midden (20). Vervolg 21:44 (meting andere sessie, klokverschil
 *  5× gemeten ≈ +140 ms ±50): pols nog 20–30 ms achter → −5. 14 okt
 *  15:12 (operator: "horloge lijkt fractie van seconde voor te lopen"):
 *  gevoel wint van de adb-meting → terug naar 20, de waarde die goed voelde. */
private const val WATCH_CLOCK_AHEAD_MS = 20L

/** Knip de eerste `skipMs` van een patroon weg (stappen die al voorbij zijn
 *  vallen weg, de lopende stap wordt korter). */
private fun trimStart(t: LongArray, a: IntArray, skipMs: Long): Pair<LongArray, IntArray> {
  if (skipMs <= 0L) return t to a
  var left = skipMs
  var i = 0
  while (i < t.size && left >= t[i]) {
    left -= t[i]
    i++
  }
  if (i >= t.size) return LongArray(0) to IntArray(0)
  val nt = t.copyOfRange(i, t.size)
  val na = a.copyOfRange(i, a.size)
  nt[0] = nt[0] - left
  /* een half afgeknipte tik niet als stomp laten trillen */
  if (na[0] > 0 && nt[0] < 20L) na[0] = 0
  return nt to na
}

class WearStateSessionService : Service() {
  private lateinit var beatThread: HandlerThread
  private lateinit var beatHandler: Handler
  private var wakeLock: PowerManager.WakeLock? = null
  private var vibrator: Vibrator? = null

  private var session: StateStart? = null
  private var units: List<BeatUnit> = emptyList()
  private var nextUnit = 0
  private var startUptime = 0L
  /** Uptime waarop de sessietijd (remainingSec) op is. */
  private var sessionEndUptime = 0L
  private var paused = false
  private var pausedRemainingMs = 0L
  /** Langste resterende tijd binnen deze sessie = de totale duur (voor het
   *  waterpeil op het scherm; hervatten stuurt enkel wat er nog over is). */
  private var sessionTotalSec = 0

  private val beatRunnable = Runnable { playDueUnitAndScheduleNext() }
  /** startId van de lopende START — een natuurlijk einde stopt de service
   *  enkel als er intussen geen nieuwere opdracht binnenkwam. */
  private var sessionStartId = 0
  private val endRunnable = Runnable { finish(sessionStartId) }
  private val tickRunnable = object : Runnable {
    override fun run() {
      publish()
      /* Net NA de wissel van elke seconde verversen (zoals de telefoon) —
         een vrij interval van 1 s liet het getal tot bijna 1 s achterlopen
         (operator 13 okt: "seconden op horloge lopen 2 s achter"). */
      val rem = sessionEndUptime - SystemClock.uptimeMillis()
      val delay = if (!paused && rem > 0) (rem % 1000L) + 15L else 1000L
      beatHandler.postDelayed(this, delay)
    }
  }

  override fun onCreate() {
    super.onCreate()
    instance = this
    vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
    beatThread = HandlerThread("vibezcore-state-beats", Process.THREAD_PRIORITY_URGENT_AUDIO).also { it.start() }
    beatHandler = Handler(beatThread.looper)
    ensureChannel()
    ensureSound()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        val json = intent.getStringExtra(EXTRA_START_JSON)
        /* startForeground MOET na startForegroundService volgen, ook als de
           inhoud onbruikbaar is — anders crasht het proces na 5–10 s. */
        goForeground(buildNotification("Starting…", "VIBEZCORE"))
        val parsed = json?.let { parse(it) }
        if (parsed == null || parsed.remainingSec <= 0) {
          beatHandler.post { finish(startId) }
        } else {
          beatHandler.post { start(parsed, startId) }
        }
      }
      ACTION_PAUSE -> beatHandler.post { pause(startId) }
      ACTION_STOP -> beatHandler.post { finish(startId) }
    }
    return START_NOT_STICKY
  }

  private fun parse(raw: String): StateStart? = try {
    val j = JSONObject(raw)
    StateStart(
      title = j.optString("title", "State Control"),
      colorHex = j.optString("colorHex", "#00A3A3"),
      startBpm = j.optDouble("startBpm", DEFAULT_START_BPM).takeIf { it in 35.0..110.0 } ?: DEFAULT_START_BPM,
      targetBpm = j.getDouble("targetBpm"),
      holdSec = j.optDouble("holdSec", 10.0),
      rampSec = j.optDouble("rampSec", 0.0),
      curveOffsetSec = j.optDouble("curveOffsetSec", 0.0).coerceAtLeast(0.0),
      remainingSec = j.getDouble("remainingSec"),
      lubAmp = j.optInt("lubAmp", 45).coerceIn(1, 255),
      dubAmp = j.optInt("dubAmp", 32).coerceIn(1, 255),
      lubMsNoAmp = j.optLong("lubMsNoAmp", 50L).coerceAtLeast(1L),
      dubMsNoAmp = j.optLong("dubMsNoAmp", 40L).coerceAtLeast(1L),
      lubMs = j.optLong("lubMs", LUB_MS).coerceIn(20L, 120L),
      dubMs = j.optLong("dubMs", DUB_MS).coerceIn(15L, 100L),
      sound = j.optBoolean("sound", false),
    ).takeIf { it.targetBpm > 0 }?.copy(sentAtMs = j.optLong("sentAtMs", 0L), local = j.optBoolean("local", false), raw = raw)
  } catch (_: Exception) {
    null
  }

  /* ── Op beatThread ───────────────────────────────────────────────────── */

  private fun start(s: StateStart, startId: Int) {
    clearScheduled()
    cancelVibration()
    if (StateSessionState.current.active.not() || StateSessionState.current.title != s.title) sessionTotalSec = 0
    sessionTotalSec = maxOf(sessionTotalSec, s.remainingSec.roundToLong().toInt())
    session = s
    sessionStartId = startId
    paused = false
    /* Opnieuw voorgrond: een eerder ingeplande finish() kan de melding net
       weggehaald hebben (start na stop in snelle opvolging). */
    goForeground(buildNotification("Playing", s.title))
    val amplitudeControl = try {
      vibrator?.hasAmplitudeControl() == true
    } catch (_: Exception) {
      false
    }
    /* 13 okt 2026 — synchroon met de telefoon (gemeten met VZSync/[sync]):
       de telefoon speelt slag 0 van zijn rooster op `sentAtMs` (curve =
       curveOffsetSec). We rekenen HIER, vlak voor het plannen, uit waar de
       telefoon nu in de curve zit (Bluetooth-vertraging + de tijd dat dit
       horloge nog bezig was), en starten op de eerstvolgende slag van
       datzelfde rooster, op het juiste moment op de klok. De klok van het
       horloge loopt ~0,1 s voor op de telefoon (gemeten). */
    val origin = s.curveOffsetSec
    val nowWall = System.currentTimeMillis()
    val nowUp = SystemClock.uptimeMillis()
    val phoneCurve = if (s.sentAtMs > 0L) {
      origin + ((nowWall - WATCH_CLOCK_AHEAD_MS - s.sentAtMs).coerceIn(0L, 10 * 60_000L)) / 1000.0
    } else {
      origin
    }
    var gridT = origin
    if (s.sentAtMs > 0L) while (gridT < phoneCurve + 0.08) gridT += beatAt(s, gridT).first / 1000.0
    val targetWall = if (s.sentAtMs > 0L) {
      s.sentAtMs + WATCH_CLOCK_AHEAD_MS + ((gridT - origin) * 1000).roundToLong()
    } else {
      /* horloge-sessie: meteen (na het opbouwen van het scherm) */
      nowWall + 120L
    }
    val aligned = s.copy(curveOffsetSec = gridT, remainingSec = s.remainingSec - (gridT - origin))
    if (aligned.remainingSec <= 0.5) return finish(startId)
    localResumeJson = null
    android.util.Log.d("VZSync", "start sentAt=${s.sentAtMs} now=$nowWall phoneCurve=${"%.3f".format(phoneCurve)} firstBeat=${"%.3f".format(gridT)} in=${targetWall - nowWall}ms")
    session = aligned
    val waveform = buildWaveform(aligned, amplitudeControl)
    units = splitIntoUnits(waveform)
    nextUnit = 0
    val totalMs = waveform.timings.sum()
    startUptime = nowUp + (targetWall - nowWall)
    sessionEndUptime = startUptime + (aligned.remainingSec * 1000).roundToLong()
    acquireWakeLock(totalMs + 5_000L)
    /* 13 okt 2026 (operator: "stopt regelmatig, mag gewoon niet stoppen"):
       met het scherm uit schakelt Wear OS onze wakelock uit (DISABLED in
       dumpsys power, ook als voorgronddienst) — de processor slaapt en een
       tik-per-tik-planning lag tot 100 s stil. Daarom krijgt de trilmotor
       het HELE patroon in één keer: de trildienst van het systeem houdt het
       toestel zelf wakker zolang het patroon loopt, en speelt de timing
       exact af. De slagplanning hieronder doet nog enkel beeld/geluid. */
    val amp = amplitudeControl
    beatHandler.postAtTime({
      if (session === aligned && !paused) {
        /* Liep deze draad wat achter (melding/scherm opbouwen), dan het al
           verstreken stukje van het begin wegknippen — elke volgende tik
           valt zo toch exact op het rooster. */
        val late = (SystemClock.uptimeMillis() - startUptime).coerceAtLeast(0L)
        val pat = buildVibPattern(aligned, amp, late)
        android.util.Log.d("VZSync", "vibrate pattern steps=${pat.timings.size} repeat=${pat.repeat} late=${late}ms")
        vibrate(pat.timings, pat.amplitudes, pat.repeat)
      }
    }, wholeVibrationToken, startUptime)
    scheduleNextUnit()
    /* Natuurlijk einde: de curve + het eind-signaal uitspelen, dan stoppen.
       Minstens remainingSec + 1,5 s (protocol). */
    /* Op het einde van de sessietijd: de herhalende slag stoppen, het
       eindsignaal spelen, en 1,5 s later afsluiten. */
    val sessionMs = (aligned.remainingSec * 1000).roundToLong()
    beatHandler.postAtTime({
      if (session === aligned && !paused) {
        val (et, ea) = endSignal(amp)
        vibrate(et, ea)
      }
    }, wholeVibrationToken, startUptime + sessionMs)
    beatHandler.postAtTime(endRunnable, startUptime + sessionMs + 1500L)
    beatHandler.post(tickRunnable)
    PhoneLink.send(this, PhoneLink.PATH_STATE_ACK, """{"playing":true}""".toByteArray(Charsets.UTF_8))
    /* Nog eens na 3 s (meting 13 okt: na een koude start kwam de eerste
       bevestiging niet aan, en dan trilden telefoon én horloge elk apart). */
    beatHandler.postDelayed({
      if (session === aligned && !paused) {
        PhoneLink.send(this, PhoneLink.PATH_STATE_ACK, """{"playing":true}""".toByteArray(Charsets.UTF_8))
      }
    }, 3000L)
  }

  private fun pause(startId: Int) {
    if (session == null) return finish(startId)
    if (paused) return
    val now = SystemClock.uptimeMillis()
    pausedRemainingMs = (sessionEndUptime - now).coerceAtLeast(0L)
    paused = true
    session?.let { cur ->
      if (cur.local && cur.raw.isNotEmpty()) {
        /* Horloge-sessie: hervatten doet het horloge zelf, op dezelfde plek
           in de curve (13 okt 2026). */
        val curveNow = cur.curveOffsetSec + ((now - startUptime).coerceAtLeast(0L)) / 1000.0
        localResumeJson = try {
          org.json.JSONObject(cur.raw).apply {
            put("curveOffsetSec", curveNow)
            put("remainingSec", pausedRemainingMs / 1000.0)
          }.toString()
        } catch (_: Exception) {
          null
        }
      }
    }
    clearScheduled()
    cancelVibration()
    releaseWakeLock()
    publish()
  }

  /** stopSelf(startId): stopt enkel als dit de laatste opdracht was — een
   *  START die intussen binnenkwam blijft dus gewoon spelen. */
  private fun finish(startId: Int) {
    session?.takeIf { it.local }?.let { cur ->
      val remainingMs = if (paused) pausedRemainingMs else (sessionEndUptime - SystemClock.uptimeMillis()).coerceAtLeast(0L)
      logLocal(cur, remainingMs)
    }
    localResumeJson = null
    clearScheduled()
    /* Bij een natuurlijk einde is het eind-signaal al uitgespeeld; cancel
       is dan een no-op. */
    cancelVibration()
    session = null
    units = emptyList()
    StateSessionState.update(StateSessionState.IDLE)
    releaseWakeLock()
    try {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } catch (_: Exception) {
    }
    stopSelf(startId)
  }

  private val wholeVibrationToken = Any()

  private fun clearScheduled() {
    beatHandler.removeCallbacksAndMessages(wholeVibrationToken)
    beatHandler.removeCallbacks(beatRunnable)
    beatHandler.removeCallbacks(endRunnable)
    beatHandler.removeCallbacks(tickRunnable)
  }

  private fun playDueUnitAndScheduleNext() {
    if (paused || nextUnit >= units.size) return
    val u = units[nextUnit]
    val lateMs = SystemClock.uptimeMillis() - (startUptime + u.offsetMs)
    if (lateMs > 40) android.util.Log.d("VZSync", "late unit=$nextUnit by=${lateMs}ms${if (lateMs > LATE_SKIP_MS) " SKIPPED" else ""}")
    if (lateMs <= LATE_SKIP_MS) {
      /* De trilling zelf speelt de trilmotor (zie start(): het hele patroon
         in één keer); hier enkel beeld, geluid en meting per slag. */
      /* Meting synchronisatie (13 okt 2026): wandklok + plek in de curve per
         slag; de telefoon logt hetzelfde ([sync] in ReactNativeJS). */
      if (nextUnit < 40) {
        android.util.Log.d("VZSync", "lub wall=${System.currentTimeMillis()} curve=${"%.3f".format((session?.curveOffsetSec ?: 0.0) + u.offsetMs / 1000.0)}")
      }
      if (nextUnit < units.size - 1) {
        /* 12 okt 2026: hartslaggeluid op de luidspreker van het horloge,
           op exact dezelfde slag als de trilling. */
        if (session?.sound == true) playHeart()
        BeatBus.beat(true)
        val dubDelay = u.t[0] + u.t[1]
        beatHandler.postDelayed({ if (!paused) BeatBus.beat(false) }, dubDelay)
      }
    }
    nextUnit++
    scheduleNextUnit()
  }

  /* ── Hartslaggeluid (Feel & Hear op het horloge) ── SoundPool: lage
     vertraging; zelfde opname als de telefoon (speaker-versie). */
  private var soundPool: SoundPool? = null
  private var heartId = 0
  private fun ensureSound() {
    if (soundPool != null) return
    try {
      val pool = SoundPool.Builder()
        .setMaxStreams(2)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        .build()
      /* 12 okt 2026: eigen horloge-versie — de telefoonopname zit voor 97 %
         onder 150 Hz, wat een horlogeluidspreker niet kan weergeven. Deze
         versie draagt dezelfde lub-dub in boventonen (400–1000 Hz), zodat
         je oor de diepe slag nog hoort ("missing fundamental"). */
      heartId = pool.load(this, R.raw.heartbeat_watch, 1)
      soundPool = pool
    } catch (_: Exception) {
      soundPool = null
    }
  }
  private fun playHeart() {
    try {
      val pool = soundPool ?: return
      if (heartId != 0) pool.play(heartId, 1f, 1f, 1, 0, 1f)
    } catch (_: Exception) {
    }
  }

  private fun scheduleNextUnit() {
    beatHandler.removeCallbacks(beatRunnable)
    val now = SystemClock.uptimeMillis()
    /* Te late slagen (CPU even bezet) overslaan i.p.v. uit de maat spelen —
       het eind-signaal (laatste stuk) wordt nooit overgeslagen. */
    while (nextUnit < units.size - 1 && startUptime + units[nextUnit].offsetMs < now - LATE_SKIP_MS) {
      android.util.Log.d("VZSync", "skip unit=$nextUnit (scheduler ${now - startUptime - units[nextUnit].offsetMs}ms late)")
      nextUnit++
    }
    if (nextUnit >= units.size) return
    beatHandler.postAtTime(beatRunnable, startUptime + units[nextUnit].offsetMs)
  }

  private fun vibrate(t: LongArray, a: IntArray, repeat: Int = -1) {
    val v = vibrator ?: return
    try {
      val effect = VibrationEffect.createWaveform(t, a, repeat)
      /* Expliciet MEDIA (niet TOUCH: dat volgt "trillen bij aanraken");
         in batterijbesparing/stil als ALARM, dat wordt nergens stilgelegd —
         zelfde regel als StateHapticsService op de telefoon. */
      val asAlarm = mustBypassQuietModes()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        v.vibrate(
          effect,
          VibrationAttributes.createForUsage(
            if (asAlarm) VibrationAttributes.USAGE_ALARM else VibrationAttributes.USAGE_MEDIA,
          ),
        )
      } else {
        @Suppress("DEPRECATION")
        v.vibrate(
          effect,
          AudioAttributes.Builder()
            .setUsage(if (asAlarm) AudioAttributes.USAGE_ALARM else AudioAttributes.USAGE_MEDIA)
            .build(),
        )
      }
    } catch (_: Exception) {
      /* horloge/emulator zonder trilmotor mag de sessie niet breken */
    }
  }

  private fun mustBypassQuietModes(): Boolean = try {
    val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
    val am = getSystemService(Context.AUDIO_SERVICE) as? android.media.AudioManager
    (pm?.isPowerSaveMode == true) || (am?.ringerMode == android.media.AudioManager.RINGER_MODE_SILENT)
  } catch (_: Exception) {
    false
  }

  private fun cancelVibration() {
    try {
      vibrator?.cancel()
    } catch (_: Exception) {
    }
  }

  /** Schermtoestand + melding bijwerken (elke seconde tijdens het spelen). */
  private fun publish() {
    val s = session ?: return
    val remainingMs = if (paused) {
      pausedRemainingMs
    } else {
      (sessionEndUptime - SystemClock.uptimeMillis()).coerceAtLeast(0L)
    }
    val minutes = ceil(remainingMs / 60000.0).toInt()
    val before = StateSessionState.current
    val snapshot = StateSessionState.Snapshot(
      active = true,
      paused = paused,
      title = s.title,
      colorHex = s.colorHex,
      remainingMinutes = minutes,
      /* naar beneden afronden, zoals de telefoon (was ceil: +1 s) */
      remainingSec = (remainingMs / 1000L).toInt(),
      totalSec = sessionTotalSec,
    )
    StateSessionState.update(snapshot)
    if (before.remainingMinutes != snapshot.remainingMinutes || before.paused != snapshot.paused || !before.active) {
      val text = if (paused) "Paused · $minutes min left" else "$minutes min left"
      notify(buildNotification(text, s.title))
    }
  }

  /* ── Voorgrond / melding / wake lock ─────────────────────────────────── */

  private fun goForeground(notification: Notification) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Exception) {
      /* geen voorgrond toegestaan: dan zonder — het ritme kan dan wel door
         het systeem gestopt worden */
    }
  }

  private fun acquireWakeLock(durationMs: Long) {
    releaseWakeLock()
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "vibezcore:state-wear").apply {
      setReferenceCounted(false)
      /* Hard plafond van 60 min — nooit onbeperkt vasthouden. */
      acquire(durationMs.coerceIn(1_000L, MAX_WAKE_LOCK_MS))
    }
  }

  private fun releaseWakeLock() {
    try {
      if (wakeLock?.isHeld == true) wakeLock?.release()
    } catch (_: Exception) {
    }
    wakeLock = null
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "State Control session", NotificationManager.IMPORTANCE_LOW),
    )
  }

  private fun buildNotification(text: String, title: String): Notification =
    buildOngoingNotification(this, CHANNEL_ID, NOTIFICATION_ID, title, text)

  private fun notify(notification: Notification) {
    try {
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notification)
    } catch (_: Exception) {
    }
  }

  override fun onDestroy() {
    if (instance === this) instance = null
    beatHandler.removeCallbacksAndMessages(null)
    cancelVibration()
    try {
      soundPool?.release()
    } catch (_: Exception) {
    }
    soundPool = null
    releaseWakeLock()
    if (StateSessionState.current.active) StateSessionState.update(StateSessionState.IDLE)
    beatThread.quitSafely()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  /** Een horloge-sessie in de geschiedenis op de telefoon (via de Data
   *  Layer; de telefoon neemt hem op bij het openen). Enkel ≥ 10 s. */
  private fun logLocal(cur: StateStart, remainingMs: Long) {
    try {
      val j = org.json.JSONObject(cur.raw)
      val planned = j.optInt("plannedSec", 0)
      val active = (planned - remainingMs / 1000.0).coerceAtLeast(0.0)
      if (active < 10.0) return
      CatalogStore.logSession(
        this,
        org.json.JSONObject().apply {
          put("kind", "state")
          put("mode", j.optInt("mode"))
          put("startedAt", j.optLong("startedAt", System.currentTimeMillis()))
          put("endedAt", System.currentTimeMillis())
          put("activeSec", active)
          put("plannedSec", planned)
          put("completed", remainingMs <= 1500L)
        },
      )
    } catch (_: Exception) {
    }
  }

  companion object {
    const val ACTION_START = "com.ubili.vibezcoreapp.wear.action.STATE_START"
    const val ACTION_PAUSE = "com.ubili.vibezcoreapp.wear.action.STATE_PAUSE"
    const val ACTION_STOP = "com.ubili.vibezcoreapp.wear.action.STATE_STOP"
    const val EXTRA_START_JSON = "stateStartJson"

    /** Gepauzeerde horloge-sessie: het bericht om te hervatten (null = geen). */
    @Volatile
    var localResumeJson: String? = null

    /** Draait er een State Control-sessie die op het horloge zelf startte? */
    val isLocalSession: Boolean get() = instance?.session?.local == true
    private const val LATE_SKIP_MS = 150L
    private const val MAX_WAKE_LOCK_MS = 60 * 60 * 1000L

    /** De draaiende service of null — pauze/stop zonder lopende sessie
     *  hoeven dan geen service te starten. */
    @Volatile
    var instance: WearStateSessionService? = null
      private set
  }
}
