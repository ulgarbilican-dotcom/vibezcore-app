package com.ubili.vibezcoreapp.wear

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Draait de ademsessie volledig LOKAAL op het horloge.

   Geen enkel bericht per fase over Bluetooth — de telefoon stuurde bij
   START al de volledige lijst fasen + hun kant-en-klare haptic-patroon
   (zelfde array als phaseHapticPattern() op de telefoon). Deze service
   speelt ze gewoon na elkaar af op een eigen klok, dus een BLE-hobbel of
   een telefoon die in slaap valt kan deze lus niet meer raken — dezelfde
   autonomie als de bracelet (spec §8). */

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import org.json.JSONObject

private const val CHANNEL_ID = "vibezcore_breath"
private const val NOTIFICATION_ID = 1001

private data class Phase(val key: String, val secs: Int, val pattern: LongArray)

class WearBreathSessionService : Service() {
  private var thread: HandlerThread? = null
  private var handler: Handler? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var vibrator: Vibrator? = null
  private var generation = 0 // elke nieuwe START annuleert vorige geplande callbacks
  private var colorHex = "#00A3A3"
  /** Waterpeil op het scherm: stijgt bij inademen, zakt bij uitademen. */
  private var level = 0.3f

  override fun onCreate() {
    super.onCreate()
    vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    thread = HandlerThread("vibezcore-breath-loop").also { it.start() }
    handler = Handler(thread!!.looper)
    ensureChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> startSession(intent.getStringExtra(EXTRA_SESSION_JSON) ?: return START_NOT_STICKY)
      ACTION_STOP -> stopSession()
      ACTION_PAUSE -> pauseSession()
    }
    return START_NOT_STICKY
  }

  private fun startSession(sessionJson: String) {
    val json = JSONObject(sessionJson)
    val modeName = json.optString("modeName", "Breathwork")
    colorHex = json.optString("colorHex", "#00A3A3")
    val rounds = json.optInt("rounds", 1).coerceAtLeast(1)
    val phasesArr = json.getJSONArray("phases")
    val phases = (0 until phasesArr.length()).map { i ->
      val p = phasesArr.getJSONObject(i)
      val patternArr = p.getJSONArray("pattern")
      val pattern = LongArray(patternArr.length()) { j -> patternArr.getLong(j) }
      Phase(p.getString("key"), p.getInt("secs"), pattern)
    }
    if (phases.isEmpty()) return
    /* Hervatten (6 okt 2026): verder op exact de plek waar de telefoon
       pauzeerde — ronde, fase en wat er van die fase nog over was. */
    val startRound = json.optInt("startRound", 1).coerceIn(1, rounds)
    val startPhase = json.optInt("startPhase", 0).coerceIn(0, phases.size - 1)
    val phaseRemainingMs = json.optLong("phaseRemainingMs", -1L)

    acquireWakeLock()
    val notification = buildNotification("Starting…", modeName)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }

    val myGeneration = ++generation
    instance = this
    val midPhase = phaseRemainingMs in 0 until phases[startPhase].secs * 1000L
    runPhase(
      myGeneration, phases, rounds, modeName, round = startRound, phaseIdx = startPhase,
      firstDelayMs = if (midPhase) phaseRemainingMs else null,
    )
  }

  private fun runPhase(
    gen: Int,
    phases: List<Phase>,
    totalRounds: Int,
    modeName: String,
    round: Int,
    phaseIdx: Int,
    /** Hervatten midden in een fase: die fase is al aangekondigd en getrild,
     *  dus enkel de resterende tijd afwachten. */
    firstDelayMs: Long? = null,
  ) {
    if (gen != generation) return // een nieuwere START (of STOP) heeft dit overruled
    if (round > totalRounds) {
      finishSession()
      return
    }
    val phase = phases[phaseIdx]
    val label = phaseDisplayLabel(phase.key)

    if (firstDelayMs == null) {
      try {
        vibrator?.vibrate(VibrationEffect.createWaveform(phase.pattern, -1))
      } catch (_: Exception) {
        /* een toestel/emulator zonder trilmotor mag de lus niet stoppen */
      }
      BeatBus.beat(true)
    }

    val durMs = firstDelayMs ?: (phase.secs * 1000L)
    val target = when {
      phase.key.startsWith("inhale") -> 0.85f
      phase.key.startsWith("exhale") -> 0.18f
      else -> level
    }
    val now = SystemClock.uptimeMillis()
    BreathSessionState.update(
      BreathSessionState.Snapshot(
        label, modeName, round, totalRounds, running = true, paused = false, colorHex = colorHex,
        levelFrom = level, levelTo = target, phaseStartUptime = now, phaseEndUptime = now + durMs,
      ),
    )
    level = target
    updateNotification(label, modeName, round, totalRounds)

    val nextPhaseIdx = (phaseIdx + 1) % phases.size
    val nextRound = if (nextPhaseIdx == 0) round + 1 else round

    handler?.postDelayed(
      { runPhase(gen, phases, totalRounds, modeName, nextRound, nextPhaseIdx) },
      firstDelayMs ?: (phase.secs * 1000L),
    )
  }

  private fun phaseDisplayLabel(key: String): String = when (key) {
    "inhale", "inhale-2" -> "Breathe in"
    "exhale", "exhale-2" -> "Breathe out"
    else -> "Hold"
  }

  /** Pauze: het ritme stopt, het scherm toont Resume. Hervatten komt als een
   *  nieuwe START van de telefoon, met de plek in de sessie. */
  private fun pauseSession() {
    generation++
    handler?.removeCallbacksAndMessages(null)
    try {
      vibrator?.cancel()
    } catch (_: Exception) {
    }
    val cur = BreathSessionState.current
    /* Het water blijft staan waar het nu is. */
    val now = SystemClock.uptimeMillis()
    val span = (cur.phaseEndUptime - cur.phaseStartUptime).coerceAtLeast(1L)
    val k = ((now - cur.phaseStartUptime).toFloat() / span).coerceIn(0f, 1f)
    val here = cur.levelFrom + (cur.levelTo - cur.levelFrom) * k
    level = here
    BreathSessionState.update(
      cur.copy(phaseLabel = "Paused", running = false, paused = true, levelFrom = here, levelTo = here),
    )
    releaseWakeLock()
    stopForeground(STOP_FOREGROUND_REMOVE)
    instance = null
    stopSelf()
  }

  private fun stopSession() {
    generation++ // annuleert elke geplande runPhase()
    finishSession()
  }

  private fun finishSession() {
    handler?.removeCallbacksAndMessages(null)
    try {
      vibrator?.cancel()
    } catch (_: Exception) {
    }
    BreathSessionState.update(
      BreathSessionState.Snapshot("Waiting for phone…", "", 0, 0, running = false),
    )
    releaseWakeLock()
    stopForeground(STOP_FOREGROUND_REMOVE)
    instance = null
    stopSelf()
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "vibezcore:breath-wear")
    wakeLock?.setReferenceCounted(false)
    wakeLock?.acquire(30 * 60 * 1000L) // hard plafond van 30 min — nooit onbeperkt vasthouden
  }

  private fun releaseWakeLock() {
    if (wakeLock?.isHeld == true) wakeLock?.release()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Breathwork session", NotificationManager.IMPORTANCE_LOW),
    )
  }

  private fun buildNotification(phaseLabel: String, modeName: String): Notification {
    val openIntent = Intent(this, MainActivity::class.java)
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      openIntent,
      PendingIntent.FLAG_IMMUTABLE,
    )
    return Notification.Builder(this, CHANNEL_ID)
      .setContentTitle(if (modeName.isNotBlank()) modeName else "VIBEZCORE")
      .setContentText(phaseLabel)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setOngoing(true)
      .setContentIntent(pendingIntent)
      .build()
  }

  private fun updateNotification(phaseLabel: String, modeName: String, round: Int, totalRounds: Int) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, buildNotification("$phaseLabel · round $round/$totalRounds", modeName))
  }

  override fun onDestroy() {
    if (instance === this) instance = null
    releaseWakeLock()
    thread?.quitSafely()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    const val ACTION_START = "com.ubili.vibezcoreapp.wear.action.START"
    const val ACTION_STOP = "com.ubili.vibezcoreapp.wear.action.STOP"
    const val ACTION_PAUSE = "com.ubili.vibezcoreapp.wear.action.PAUSE"

    /** De lopende service, of null — dan is er niets te pauzeren/stoppen. */
    @Volatile
    var instance: WearBreathSessionService? = null
    const val EXTRA_SESSION_JSON = "sessionJson"
  }
}
