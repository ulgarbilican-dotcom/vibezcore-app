package com.ubili.vibezcoreapp.statehaptics

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Sound timing: een vaste proefslag voor de correctie per
   Bluetooth-toestel (31 okt 2026, operator: "het moet voor alle toestellen
   met bluetooth connectie werken").

   Zelfde weg als een State Control-sessie (StateHapticsService): dezelfde
   SoundPool-opnames (koptelefoonversie, 30 %), dezelfde voorsprong
   (AudioLatency.extraMs, dus MET de bewaarde correctie) en dezelfde soort
   trilling. De app kent het moment van elke slag (firstBeatWallMs +
   k × periodMs): de trilling valt er exact op, het geluid start de
   voorsprong vroeger. Meetikken toont zo hoeveel later het geluid echt
   aankomt dan de oortjes melden.

   De voorsprong wordt per slag opnieuw gelezen: Earlier/Later is bij de
   volgende slag hoorbaar.
   ───────────────────────────────────────────────────────────────────────── */

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import android.os.SystemClock
import android.os.VibrationEffect

object CalibrationBeat {
  /** Elke slag zoveel vooruit inplannen (> de grootste voorsprong). */
  private const val PLAN_AHEAD_MS = 700L
  private const val LUB_MS = 60L
  private const val DUB_MS = 46L
  private const val VOLUME = 0.3f

  private var thread: HandlerThread? = null
  private var handler: Handler? = null
  private var pool: SoundPool? = null
  private var lubId = 0
  private var dubId = 0
  private val token = Any()
  @Volatile private var vibrate = false
  @Volatile private var running = false
  private var periodMs = 857L
  private var firstUp = 0L
  private var nextIndex = 0L

  /** Start de slag; geeft het wandklok-moment van slag 0 terug. */
  @Synchronized
  fun start(context: Context, period: Long, withVibration: Boolean): Long {
    stop()
    val app = context.applicationContext
    val t = HandlerThread("vibezcore-calibration", Process.THREAD_PRIORITY_URGENT_AUDIO).apply { start() }
    val h = Handler(t.looper)
    thread = t
    handler = h
    periodMs = period.coerceIn(400L, 2000L)
    vibrate = withVibration
    running = true
    ensurePool(app)
    /* Meteen de Bluetooth-stroom wekken (onhoorbaar), zodat slag 0 niet
       vóór de stroom loopt (gemeten 31 okt 2026). */
    h.post {
      try {
        if (lubId != 0) pool?.play(lubId, 0f, 0f, 0, 0, 1f)
      } catch (_: Exception) {
      }
    }
    val nowWall = System.currentTimeMillis()
    val nowUp = SystemClock.uptimeMillis()
    val lead = 1200L
    firstUp = nowUp + lead
    nextIndex = 0L
    planNext(app)
    return nowWall + lead
  }

  fun setVibrate(on: Boolean) {
    vibrate = on
  }

  @Synchronized
  fun stop() {
    running = false
    handler?.removeCallbacksAndMessages(null)
    thread?.quitSafely()
    thread = null
    handler = null
    try {
      pool?.release()
    } catch (_: Exception) {
    }
    pool = null
    lubId = 0
    dubId = 0
  }

  private fun ensurePool(context: Context) {
    if (pool != null) return
    try {
      val p = SoundPool.Builder()
        .setMaxStreams(3)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        .build()
      lubId = p.load(context, R.raw.heartbeat_headphones_lub, 1)
      dubId = p.load(context, R.raw.heartbeat_headphones_dub, 1)
      pool = p
    } catch (_: Exception) {
      pool = null
    }
  }

  /** De volgende slag (geluid + trilling) PLAN_AHEAD_MS vóór zijn moment inplannen. */
  private fun planNext(context: Context) {
    val h = handler ?: return
    val beatUp = firstUp + nextIndex * periodMs
    h.postAtTime({ scheduleBeat(context, beatUp) }, token, beatUp - PLAN_AHEAD_MS)
  }

  private fun scheduleBeat(context: Context, beatUp: Long) {
    if (!running) return
    val h = handler ?: return
    val dubAt = Math.round(minOf(periodMs * 0.3, 350.0))
    val extra = AudioLatency.extraMs(context)
    h.postAtTime({ playSound(lubId) }, token, beatUp - extra)
    h.postAtTime({ playSound(dubId) }, token, beatUp + dubAt - extra)
    h.postAtTime({
      if (running && vibrate) {
        try {
          StateHapticsService.vibrateForSession(
            context,
            StateHapticsService.vibratorOf(context),
            VibrationEffect.createWaveform(longArrayOf(0L, LUB_MS, dubAt - LUB_MS, DUB_MS), -1),
          )
        } catch (_: Exception) {
        }
      }
    }, token, beatUp)
    nextIndex++
    planNext(context)
  }

  private fun playSound(id: Int) {
    if (!running || id == 0) return
    try {
      pool?.play(id, VOLUME, VOLUME, 1, 0, 1f)
    } catch (_: Exception) {
    }
  }
}
