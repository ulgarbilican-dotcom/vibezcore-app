package com.ubili.vibezcoreapp.statehaptics

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — voorgrondservice die de State Control-hartslagcurve laat
   doorlopen met het scherm op slot.

   Gemeten 5 okt 2026 (Galaxy A16, dumpsys vibrator_manager): een lopende
   app-trilling eindigt bij het vergrendelen met `cancelled_by_screen_off`
   — Android breekt ze zelf af. Daarna start niets ze opnieuw, terwijl de
   sessietimer doorloopt (operator: "bij lockscreen stoppen haptics, bij
   terugkomen geen haptics meer").

   Oplossing, zelfde patroon als modules/breath-background (bewezen op dit
   toestel): een voorgrondservice houdt de app "voorgrond" voor het
   trilsysteem, en herstart de curve meteen na het vergrendelen vanaf de
   juiste positie. De curve zelf blijft in src/services/bracelet-haptics.ts
   berekend — deze service knipt enkel het nog resterende stuk eruit.
   ───────────────────────────────────────────────────────────────────────── */

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class StateHapticsService : Service() {

  companion object {
    const val CHANNEL_ID = "state_control_session"
    const val NOTIFICATION_ID = 8422
    const val ACTION_START = "com.ubili.vibezcoreapp.statehaptics.action.START"
    const val EXTRA_TIMINGS = "timings"
    const val EXTRA_AMPLITUDES = "amplitudes"
    const val EXTRA_TITLE = "title"

    fun vibratorOf(context: Context): Vibrator? =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      }
  }

  private val handler = Handler(Looper.getMainLooper())
  private var timings = LongArray(0)
  private var amplitudes = IntArray(0)
  private var totalMs = 0L
  private var startRealtime = 0L
  private var title = "State Control"
  private var wakeLock: PowerManager.WakeLock? = null
  private var receiverRegistered = false
  private val endRunnable = Runnable { stopSelfCleanly() }

  /* Kort na SCREEN_OFF herstarten: het systeem annuleert de lopende trilling
     als onderdeel van het uitschakelen, een nieuwe trilling NA dat moment
     (vanuit een voorgrondservice) blijft wel lopen. */
  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == Intent.ACTION_SCREEN_OFF) {
        handler.postDelayed({ playFromNow() }, 300L)
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ensureChannel()
    title = intent?.getStringExtra(EXTRA_TITLE) ?: "State Control"
    startForeground(NOTIFICATION_ID, buildNotification())

    val t = intent?.getLongArrayExtra(EXTRA_TIMINGS) ?: LongArray(0)
    val a = intent?.getIntArrayExtra(EXTRA_AMPLITUDES) ?: IntArray(0)
    if (t.isEmpty() || t.size != a.size) {
      stopSelfCleanly()
      return START_NOT_STICKY
    }
    timings = t
    amplitudes = a
    totalMs = t.sum()
    startRealtime = SystemClock.elapsedRealtime()

    acquireWakeLock()
    registerScreenReceiver()
    handler.removeCallbacks(endRunnable)
    handler.postDelayed(endRunnable, totalMs)
    playFromNow()
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    try {
      vibratorOf(this)?.cancel()
    } catch (_: Exception) {
    }
    unregisterScreenReceiver()
    releaseWakeLock()
    super.onDestroy()
  }

  /** Speelt het nog resterende deel van de curve vanaf de huidige positie. */
  private fun playFromNow() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || timings.isEmpty()) return
    val elapsed = SystemClock.elapsedRealtime() - startRealtime
    if (elapsed >= totalMs) {
      stopSelfCleanly()
      return
    }
    var acc = 0L
    var i = 0
    while (i < timings.size && acc + timings[i] <= elapsed) {
      acc += timings[i]
      i++
    }
    if (i >= timings.size) return
    val outT = ArrayList<Long>(timings.size - i)
    val outA = ArrayList<Int>(timings.size - i)
    val remainderOfCurrent = acc + timings[i] - elapsed
    /* Een halve tik heeft geen zin — midden in een tik start de rest stil. */
    outT.add(remainderOfCurrent)
    outA.add(if (amplitudes[i] > 0 && remainderOfCurrent < timings[i]) 0 else amplitudes[i])
    for (j in i + 1 until timings.size) {
      outT.add(timings[j])
      outA.add(amplitudes[j])
    }
    try {
      val v = vibratorOf(this) ?: return
      v.cancel()
      v.vibrate(VibrationEffect.createWaveform(outT.toLongArray(), outA.toIntArray(), -1))
    } catch (_: Exception) {
    }
  }

  private fun stopSelfCleanly() {
    handler.removeCallbacksAndMessages(null)
    try {
      vibratorOf(this)?.cancel()
    } catch (_: Exception) {
    }
    unregisterScreenReceiver()
    releaseWakeLock()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun registerScreenReceiver() {
    if (receiverRegistered) return
    ContextCompat.registerReceiver(
      this,
      screenReceiver,
      IntentFilter(Intent.ACTION_SCREEN_OFF),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )
    receiverRegistered = true
  }

  private fun unregisterScreenReceiver() {
    if (!receiverRegistered) return
    try {
      unregisterReceiver(screenReceiver)
    } catch (_: Exception) {
    }
    receiverRegistered = false
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    try {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      val lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "vibezcore:state_control")
      /* Veiligheidsgrens: langste modus is 50 min. */
      lock.acquire(2 * 60 * 60 * 1000L)
      wakeLock = lock
    } catch (_: Exception) {
    }
  }

  private fun releaseWakeLock() {
    try {
      wakeLock?.let { if (it.isHeld) it.release() }
    } catch (_: Exception) {
    }
    wakeLock = null
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val mgr = getSystemService(NotificationManager::class.java)
      if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
        val channel = NotificationChannel(CHANNEL_ID, "State Control haptics", NotificationManager.IMPORTANCE_LOW)
        channel.setShowBadge(false)
        mgr.createNotificationChannel(channel)
      }
    }
  }

  /* Verplicht voor een voorgrondservice. Bewust stil en niet op het
     vergrendelscherm (VISIBILITY_SECRET): de "X:XX left"-info komt al uit
     bracelet-session-monitor.ts — geen tweede, dubbele lockscreen-melding. */
  private fun buildNotification(): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pending = launch?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText("Haptic rhythm active")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setVisibility(NotificationCompat.VISIBILITY_SECRET)
      .setContentIntent(pending)
      .build()
  }
}
