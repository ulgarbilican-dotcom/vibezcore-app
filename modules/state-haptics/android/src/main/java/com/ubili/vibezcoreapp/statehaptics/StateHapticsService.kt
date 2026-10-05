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
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.media.app.NotificationCompat as MediaNotificationCompat

class StateHapticsService : Service() {

  companion object {
    const val CHANNEL_ID = "state_control_session"
    const val NOTIFICATION_ID = 8422
    const val ACTION_START = "com.ubili.vibezcoreapp.statehaptics.action.START"
    const val EXTRA_TIMINGS = "timings"
    const val EXTRA_AMPLITUDES = "amplitudes"
    const val EXTRA_TITLE = "title"
    /* Voor de vergrendelscherm-melding: volledige sessieduur + al verstreken
       tijd bij de start van deze curve (de curve zelf = de resterende tijd). */
    const val EXTRA_SESSION_TOTAL_MS = "sessionTotalMs"
    const val EXTRA_SESSION_ELAPSED_MS = "sessionElapsedMs"
    const val LATE_TOLERANCE_MS = 40L

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
  private var sessionTotalMs = 0L
  private var sessionElapsedAtStartMs = 0L
  private var mediaSession: MediaSessionCompat? = null
  private val tickRunnable = object : Runnable {
    override fun run() {
      updateNotification()
      handler.postDelayed(this, 1000L)
    }
  }
  private var wakeLock: PowerManager.WakeLock? = null
  private var receiverRegistered = false
  private val endRunnable = Runnable { stopSelfCleanly() }

  /* Kort na SCREEN_OFF herstarten: het systeem annuleert de lopende trilling
     als onderdeel van het uitschakelen, een nieuwe trilling NA dat moment
     (vanuit een voorgrondservice) blijft wel lopen. */
  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      when (intent?.action) {
        Intent.ACTION_SCREEN_OFF -> handler.postDelayed({ playFromNow() }, 300L)
        /* Gemeten 5 okt 2026: het eigen ontgrendel-tikje van het systeem
           VERDRINGT onze trilling (cancelled_superseded) — daarna opnieuw
           oppakken. */
        Intent.ACTION_SCREEN_ON, Intent.ACTION_USER_PRESENT ->
          handler.postDelayed({ playFromNow() }, 600L)
      }
    }
  }

  /* Elke andere trilling (melding, toetsenbord) kan de onze verdringen, en
     Android meldt dat niet. Dus om de ~30 s opnieuw aanbieden — telkens
     PRECIES op het begin van een tik, zodat er geen halve tik wegvalt. */
  private val resyncRunnable = object : Runnable {
    override fun run() {
      playFromNow()
      scheduleResync()
    }
  }

  private fun scheduleResync() {
    handler.removeCallbacks(resyncRunnable)
    val elapsed = SystemClock.elapsedRealtime() - startRealtime
    val target = elapsed + 30_000L
    var acc = 0L
    var i = 0
    while (i < timings.size && (acc < target || i % 4 != 0)) {
      acc += timings[i]
      i++
    }
    if (i >= timings.size) return
    handler.postDelayed(resyncRunnable, (acc - elapsed).coerceAtLeast(0L))
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ensureChannel()
    title = intent?.getStringExtra(EXTRA_TITLE) ?: "State Control"
    val t = intent?.getLongArrayExtra(EXTRA_TIMINGS) ?: LongArray(0)
    val a = intent?.getIntArrayExtra(EXTRA_AMPLITUDES) ?: IntArray(0)
    timings = t
    amplitudes = a
    totalMs = t.sum()
    startRealtime = SystemClock.elapsedRealtime()
    sessionElapsedAtStartMs = intent?.getLongExtra(EXTRA_SESSION_ELAPSED_MS, 0L) ?: 0L
    sessionTotalMs = intent?.getLongExtra(EXTRA_SESSION_TOTAL_MS, sessionElapsedAtStartMs + totalMs)
      ?: (sessionElapsedAtStartMs + totalMs)
    startForeground(NOTIFICATION_ID, buildNotification())

    if (t.isEmpty() || t.size != a.size) {
      stopSelfCleanly()
      return START_NOT_STICKY
    }
    handler.removeCallbacks(tickRunnable)
    handler.postDelayed(tickRunnable, 1000L)

    acquireWakeLock()
    registerScreenReceiver()
    handler.removeCallbacks(endRunnable)
    handler.postDelayed(endRunnable, totalMs)
    playFromNow()
    scheduleResync()
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
    releaseMediaSession()
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
    val into = elapsed - acc
    if (amplitudes[i] > 0 && into <= LATE_TOLERANCE_MS) {
      /* Net (enkele ms) te laat op het begin van een tik — de Handler is
         nooit exact. Speel de tik dan volledig i.p.v. hem te laten vallen. */
      outT.add(timings[i])
      outA.add(amplitudes[i])
    } else {
      /* Een halve tik heeft geen zin — midden in een tik start de rest stil. */
      outT.add(timings[i] - into)
      outA.add(if (amplitudes[i] > 0) 0 else amplitudes[i])
    }
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
    releaseMediaSession()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun sessionElapsedNowMs(): Long =
    (sessionElapsedAtStartMs + (SystemClock.elapsedRealtime() - startRealtime))
      .coerceIn(0L, sessionTotalMs.coerceAtLeast(0L))

  private fun remainingLabel(): String {
    val remSec = ((sessionTotalMs - sessionElapsedNowMs()) / 1000L).coerceAtLeast(0L)
    return "%d:%02d left".format(remSec / 60, remSec % 60)
  }

  /* Operator, 5 okt 2026 ("op lockscreen zie ik een muzieknoot, daar moet
     het V-icoon komen"): zonder album-art toont OneUI een muzieknoot. Het
     app-icoon (V) als art + de witte V (notification_icon, zelfde als
     expo-notifications gebruikt) als klein icoon. */
  private val artBitmap: Bitmap? by lazy {
    try {
      val d = packageManager.getApplicationIcon(packageName)
      val w = d.intrinsicWidth.coerceAtLeast(1)
      val h = d.intrinsicHeight.coerceAtLeast(1)
      val b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
      val c = Canvas(b)
      d.setBounds(0, 0, w, h)
      d.draw(c)
      b
    } catch (_: Exception) {
      null
    }
  }

  private fun smallIconRes(): Int {
    val id = resources.getIdentifier("notification_icon", "drawable", packageName)
    return if (id != 0) id else applicationInfo.icon
  }

  private fun ensureMediaSession(): MediaSessionCompat {
    mediaSession?.let { return it }
    val s = MediaSessionCompat(this, "VibezcoreStateControl")
    s.isActive = true
    mediaSession = s
    return s
  }

  private fun releaseMediaSession() {
    try {
      mediaSession?.isActive = false
      mediaSession?.release()
    } catch (_: Exception) {
    }
    mediaSession = null
  }

  /* Zelfde aanpak als BreathSessionService: OneUI interpoleert de positie
     niet zelf, dus elke seconde verse metadata + status. */
  private fun updateMediaSession(text: String) {
    val s = ensureMediaSession()
    s.setMetadata(
      MediaMetadataCompat.Builder()
        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, text)
        .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "VIBEZCORE")
        .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, sessionTotalMs)
        .apply {
          artBitmap?.let {
            putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it)
            putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, it)
          }
        }
        .build(),
    )
    s.setPlaybackState(
      PlaybackStateCompat.Builder()
        .setActions(0L)
        .setState(PlaybackStateCompat.STATE_PLAYING, sessionElapsedNowMs(), 1.0f, SystemClock.elapsedRealtime())
        .build(),
    )
  }

  private fun updateNotification() {
    try {
      getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, buildNotification())
    } catch (_: Exception) {
    }
  }

  private fun registerScreenReceiver() {
    if (receiverRegistered) return
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_SCREEN_OFF)
      addAction(Intent.ACTION_SCREEN_ON)
      addAction(Intent.ACTION_USER_PRESENT)
    }
    ContextCompat.registerReceiver(this, screenReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
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

  /* Operator, 5 okt 2026 ("bij lockscreen zie ik enkel een V-icoon — welke
     sessie actief en hoe lang nog"): DE lockscreen-melding van een lopende
     State Control-sessie. MediaStyle + eigen MediaSessionCompat, want een
     gewone melding verschijnt op OneUI niet op het vergrendelscherm (zelfde
     les als BreathSessionService). bracelet-session-monitor.ts toont zijn
     eigen melding dan NIET, zodat er geen dubbele is. */
  private fun buildNotification(): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pending = launch?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val text = "VIBEZCORE · ${remainingLabel()}"
    updateMediaSession(remainingLabel())
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(smallIconRes())
      .setLargeIcon(artBitmap)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(pending)
      .setStyle(MediaNotificationCompat.MediaStyle().setMediaSession(ensureMediaSession().sessionToken))
    if (sessionTotalMs > 0) {
      builder.setProgress(sessionTotalMs.toInt(), sessionElapsedNowMs().toInt(), false)
    }
    return builder.build()
  }
}
