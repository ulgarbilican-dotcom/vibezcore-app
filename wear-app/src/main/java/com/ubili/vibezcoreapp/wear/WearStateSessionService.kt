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
private const val ASSUMED_RESTING_BPM = 75.0
private const val LUB_DUB_FRACTION = 0.3
private const val LUB_DUB_MAX_MS = 350.0
private const val LUB_MS = 45L
private const val DUB_MS = 35L

/** JS Math.round: halve waarden naar boven (ook bij negatieve getallen). */
private fun jsRound(x: Double): Long = Math.floor(x + 0.5).toLong()

private data class StateStart(
  val title: String,
  val colorHex: String,
  val targetBpm: Double,
  val holdSec: Double,
  val rampSec: Double,
  val curveOffsetSec: Double,
  val remainingSec: Double,
  val lubAmp: Int,
  val dubAmp: Int,
  val lubMsNoAmp: Long,
  val dubMsNoAmp: Long,
)

private fun bpmAt(s: StateStart, t: Double): Double {
  if (t < s.holdSec) return ASSUMED_RESTING_BPM
  val rampElapsed = t - s.holdSec
  val progress = if (s.rampSec <= 0) 1.0 else min(1.0, rampElapsed / s.rampSec)
  return ASSUMED_RESTING_BPM + (s.targetBpm - ASSUMED_RESTING_BPM) * progress
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

  val lubMs = if (amplitudeControl) LUB_MS else s.lubMsNoAmp
  val dubMs = if (amplitudeControl) DUB_MS else s.dubMsNoAmp
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

  private val beatRunnable = Runnable { playDueUnitAndScheduleNext() }
  /** startId van de lopende START — een natuurlijk einde stopt de service
   *  enkel als er intussen geen nieuwere opdracht binnenkwam. */
  private var sessionStartId = 0
  private val endRunnable = Runnable { finish(sessionStartId) }
  private val tickRunnable = object : Runnable {
    override fun run() {
      publish()
      beatHandler.postDelayed(this, 1000L)
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
      targetBpm = j.getDouble("targetBpm"),
      holdSec = j.optDouble("holdSec", 10.0),
      rampSec = j.optDouble("rampSec", 0.0),
      curveOffsetSec = j.optDouble("curveOffsetSec", 0.0).coerceAtLeast(0.0),
      remainingSec = j.getDouble("remainingSec"),
      lubAmp = j.optInt("lubAmp", 45).coerceIn(1, 255),
      dubAmp = j.optInt("dubAmp", 32).coerceIn(1, 255),
      lubMsNoAmp = j.optLong("lubMsNoAmp", 50L).coerceAtLeast(1L),
      dubMsNoAmp = j.optLong("dubMsNoAmp", 40L).coerceAtLeast(1L),
    ).takeIf { it.targetBpm > 0 }
  } catch (_: Exception) {
    null
  }

  /* ── Op beatThread ───────────────────────────────────────────────────── */

  private fun start(s: StateStart, startId: Int) {
    clearScheduled()
    cancelVibration()
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
    val waveform = buildWaveform(s, amplitudeControl)
    units = splitIntoUnits(waveform)
    nextUnit = 0
    val totalMs = waveform.timings.sum()
    startUptime = SystemClock.uptimeMillis() + 50L
    sessionEndUptime = startUptime + (s.remainingSec * 1000).roundToLong()
    acquireWakeLock(totalMs + 5_000L)
    scheduleNextUnit()
    /* Natuurlijk einde: de curve + het eind-signaal uitspelen, dan stoppen.
       Minstens remainingSec + 1,5 s (protocol). */
    val endDelay = maxOf(totalMs + 300L, (s.remainingSec * 1000).roundToLong() + 1500L)
    beatHandler.postAtTime(endRunnable, startUptime + endDelay)
    beatHandler.post(tickRunnable)
    PhoneLink.send(this, PhoneLink.PATH_STATE_ACK, """{"playing":true}""".toByteArray(Charsets.UTF_8))
  }

  private fun pause(startId: Int) {
    if (session == null) return finish(startId)
    if (paused) return
    pausedRemainingMs = (sessionEndUptime - SystemClock.uptimeMillis()).coerceAtLeast(0L)
    paused = true
    clearScheduled()
    cancelVibration()
    releaseWakeLock()
    publish()
  }

  /** stopSelf(startId): stopt enkel als dit de laatste opdracht was — een
   *  START die intussen binnenkwam blijft dus gewoon spelen. */
  private fun finish(startId: Int) {
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

  private fun clearScheduled() {
    beatHandler.removeCallbacks(beatRunnable)
    beatHandler.removeCallbacks(endRunnable)
    beatHandler.removeCallbacks(tickRunnable)
  }

  private fun playDueUnitAndScheduleNext() {
    if (paused || nextUnit >= units.size) return
    val u = units[nextUnit]
    if (SystemClock.uptimeMillis() - (startUptime + u.offsetMs) <= LATE_SKIP_MS) {
      vibrate(u.t, u.a)
    }
    nextUnit++
    scheduleNextUnit()
  }

  private fun scheduleNextUnit() {
    beatHandler.removeCallbacks(beatRunnable)
    val now = SystemClock.uptimeMillis()
    /* Te late slagen (CPU even bezet) overslaan i.p.v. uit de maat spelen —
       het eind-signaal (laatste stuk) wordt nooit overgeslagen. */
    while (nextUnit < units.size - 1 && startUptime + units[nextUnit].offsetMs < now - LATE_SKIP_MS) {
      nextUnit++
    }
    if (nextUnit >= units.size) return
    beatHandler.postAtTime(beatRunnable, startUptime + units[nextUnit].offsetMs)
  }

  private fun vibrate(t: LongArray, a: IntArray) {
    val v = vibrator ?: return
    try {
      val effect = VibrationEffect.createWaveform(t, a, -1)
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
    )
    StateSessionState.update(snapshot)
    if (before != snapshot) {
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

  private fun buildNotification(text: String, title: String): Notification {
    val pendingIntent = PendingIntent.getActivity(
      this,
      1,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_IMMUTABLE,
    )
    return Notification.Builder(this, CHANNEL_ID)
      .setContentTitle(title.ifBlank { "VIBEZCORE" })
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setOngoing(true)
      .setContentIntent(pendingIntent)
      .build()
  }

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
    releaseWakeLock()
    if (StateSessionState.current.active) StateSessionState.update(StateSessionState.IDLE)
    beatThread.quitSafely()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    const val ACTION_START = "com.ubili.vibezcoreapp.wear.action.STATE_START"
    const val ACTION_PAUSE = "com.ubili.vibezcoreapp.wear.action.STATE_PAUSE"
    const val ACTION_STOP = "com.ubili.vibezcoreapp.wear.action.STATE_STOP"
    const val EXTRA_START_JSON = "stateStartJson"
    private const val LATE_SKIP_MS = 150L
    private const val MAX_WAKE_LOCK_MS = 60 * 60 * 1000L

    /** De draaiende service of null — pauze/stop zonder lopende sessie
     *  hoeven dan geen service te starten. */
    @Volatile
    var instance: WearStateSessionService? = null
      private set
  }
}
