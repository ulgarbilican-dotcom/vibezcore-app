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

private const val CLOCK_MARGIN_MS = 150L

private data class Phase(val key: String, val secs: Int, val pattern: LongArray, val via: String = "")

class WearBreathSessionService : Service() {
  private var thread: HandlerThread? = null
  private var handler: Handler? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var vibrator: Vibrator? = null
  private var generation = 0 // elke nieuwe START annuleert vorige geplande callbacks
  private var colorHex = "#00A3A3"
  /** Trilkracht 0–255 van de telefoon (Soft/Medium/Strong); 0 = standaard. */
  private var amp = 0
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
    amp = json.optInt("amp", 0).coerceIn(0, 255)
    val rounds = json.optInt("rounds", 1).coerceAtLeast(1)
    val phasesArr = json.getJSONArray("phases")
    val phases = (0 until phasesArr.length()).map { i ->
      val p = phasesArr.getJSONObject(i)
      val patternArr = p.getJSONArray("pattern")
      val pattern = LongArray(patternArr.length()) { j -> patternArr.getLong(j) }
      Phase(p.getString("key"), p.getInt("secs"), pattern, p.optString("via", ""))
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
    /* 13 okt 2026 (operator: "sessie niet synchroon met de telefoon"): de
       telefoon zegt wanneer hij dit bericht verstuurde (zijn klok); de
       Bluetooth-vertraging wordt van de eerste fase afgetrokken, zodat de
       pols op hetzelfde moment overgaat als de telefoon. Begrensd tot
       1,5 s — een horlogeklok die verder afwijkt vertrouwen we niet. */
    val sentAt = json.optLong("sentAtMs", 0L)
    /* Gemeten op Galaxy Watch4 + A16: een bericht doet er ~0,7–0,8 s over;
       de horlogeklok loopt ~0,1–0,2 s voor op die van de telefoon. Zonder
       correctie trilde de pols 0,65 s te laat, met de volle klokmeting
       0,2 s te vroeg — vandaar 150 ms marge voor klokverschil. */
    /* 13 okt 2026: na een koude start (app net geïnstalleerd of door het
       systeem gestopt) kwam het bericht ~2,5 s na versturen binnen — de
       oude grens van 1,5 s liet de pols dan 1,1 s achterlopen. Nu tot 8 s;
       is de vertraging langer dan de lopende fase, dan springt het horloge
       door naar de fase waar de telefoon nu is (stil, zonder trilling — de
       volgende overgang trilt weer gewoon). */
    val lag = if (sentAt > 0L) (System.currentTimeMillis() - sentAt - CLOCK_MARGIN_MS).coerceIn(0L, 8000L) else 0L
    val now = SystemClock.uptimeMillis()
    var round = startRound
    var idx = startPhase
    var midPhase = phaseRemainingMs in 0 until phases[startPhase].secs * 1000L
    var left = (if (midPhase) phaseRemainingMs else phases[startPhase].secs * 1000L) - lag
    var skipped = false
    while (left <= 150L) {
      idx = (idx + 1) % phases.size
      if (idx == 0) round++
      left += phases[idx].secs * 1000L
      skipped = true
    }
    if (round > rounds) {
      finishSession()
      return
    }
    runPhase(
      myGeneration, phases, rounds, modeName, round = round, phaseIdx = idx,
      startUptime = now,
      durMs = left,
      silentStart = midPhase || skipped,
    )
  }

  private fun runPhase(
    gen: Int,
    phases: List<Phase>,
    totalRounds: Int,
    modeName: String,
    round: Int,
    phaseIdx: Int,
    /** Gepland begin van deze fase (uptime). Elke fase begint op het geplande
     *  EINDE van de vorige — zo loopt er over een sessie niets op. */
    startUptime: Long,
    /** Duur van deze fase vanaf `startUptime`. */
    durMs: Long,
    /** Hervatten midden in een fase: die fase is al aangekondigd en getrild,
     *  dus enkel de resterende tijd afwachten. */
    silentStart: Boolean = false,
  ) {
    if (gen != generation) return // een nieuwere START (of STOP) heeft dit overruled
    if (round > totalRounds) {
      finishSession()
      return
    }
    val phase = phases[phaseIdx]
    val label = phaseDisplayLabel(phase.key)

    if (!silentStart) {
      try {
        /* 13 okt 2026 (operator: "zacht blijft te hard"): met de gekozen
           kracht i.p.v. altijd de standaardkracht van het horloge. */
        val effect = if (amp > 0 && vibrator?.hasAmplitudeControl() == true) {
          VibrationEffect.createWaveform(phase.pattern, IntArray(phase.pattern.size) { if (it % 2 == 1) amp else 0 }, -1)
        } else {
          VibrationEffect.createWaveform(phase.pattern, -1)
        }
        vibrateOutsideTouch(effect)
      } catch (_: Exception) {
        /* een toestel/emulator zonder trilmotor mag de lus niet stoppen */
      }
      BeatBus.beat(true)
    }

    val endUptime = startUptime + durMs
    val target = when {
      phase.key.startsWith("inhale") -> 0.85f
      phase.key.startsWith("exhale") -> 0.18f
      else -> level
    }
    /* Einde van de hele sessie: de rest van deze ronde + de volle rondes erna. */
    var sessionEnd = endUptime
    for (i in phaseIdx + 1 until phases.size) sessionEnd += phases[i].secs * 1000L
    sessionEnd += (totalRounds - round).coerceAtLeast(0) * phases.sumOf { it.secs * 1000L }
    BreathSessionState.update(
      BreathSessionState.Snapshot(
        label, modeName, round, totalRounds, via = phase.via, running = true, paused = false, colorHex = colorHex,
        levelFrom = level, levelTo = target, phaseStartUptime = startUptime, phaseEndUptime = endUptime,
        sessionEndUptime = sessionEnd,
      ),
    )
    level = target
    updateNotification(label, modeName, round, totalRounds)

    val nextPhaseIdx = (phaseIdx + 1) % phases.size
    val nextRound = if (nextPhaseIdx == 0) round + 1 else round

    val nextDur = phases[nextPhaseIdx].secs * 1000L
    handler?.postAtTime(
      { runPhase(gen, phases, totalRounds, modeName, nextRound, nextPhaseIdx, startUptime = endUptime, durMs = nextDur) },
      endUptime,
    )
  }

  private fun phaseDisplayLabel(key: String): String = when (key) {
    /* 12 okt 2026: dezelfde woorden als de app (INHALE · NOSE); de
       neus/mond-regel staat klein eronder (via in de Snapshot). */
    "inhale", "inhale-2" -> "Inhale"
    "exhale", "exhale-2" -> "Exhale"
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
      cur.copy(
        phaseLabel = "Paused", running = false, paused = true, levelFrom = here, levelTo = here, pausedProgress = k,
        pausedSessionLeftMs = (cur.sessionEndUptime - now).coerceAtLeast(0L),
      ),
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

  /* 13 okt 2026 (operator: "als het scherm donker wordt stoppen de
     haptics"): zonder attributen telt een trilling als TOUCH, en die legt
     Wear OS stil zodra het scherm uitgaat. Zoals State Control: MEDIA, en
     in batterijbesparing of stille modus ALARM (wordt nergens stilgelegd). */
  private fun vibrateOutsideTouch(effect: VibrationEffect) {
    val v = vibrator ?: return
    val asAlarm = try {
      val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
      val am = getSystemService(Context.AUDIO_SERVICE) as? android.media.AudioManager
      (pm?.isPowerSaveMode == true) || (am?.ringerMode == android.media.AudioManager.RINGER_MODE_SILENT)
    } catch (_: Exception) {
      false
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      v.vibrate(
        effect,
        android.os.VibrationAttributes.createForUsage(
          if (asAlarm) android.os.VibrationAttributes.USAGE_ALARM else android.os.VibrationAttributes.USAGE_MEDIA,
        ),
      )
    } else {
      @Suppress("DEPRECATION")
      v.vibrate(
        effect,
        android.media.AudioAttributes.Builder()
          .setUsage(if (asAlarm) android.media.AudioAttributes.USAGE_ALARM else android.media.AudioAttributes.USAGE_MEDIA)
          .build(),
      )
    }
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

  private fun buildNotification(phaseLabel: String, modeName: String): Notification =
    buildOngoingNotification(this, CHANNEL_ID, NOTIFICATION_ID, modeName, phaseLabel)

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
