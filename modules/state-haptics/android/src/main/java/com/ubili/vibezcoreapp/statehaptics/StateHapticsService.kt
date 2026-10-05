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
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.media.AudioAttributes
import android.os.Build
import android.os.HandlerThread
import android.os.Process
import android.os.VibrationAttributes
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
    /** Een tik die meer dan dit te laat zou komen, wordt overgeslagen. */
    const val LATE_SKIP_MS = 150L
    private const val END_MARGIN_MS = 400L
    /** Bio-Teal, de VIBEZCORE-accentkleur, voor de voortgangsbalk. */
    private const val ACCENT = 0xFF00A3A3.toInt()

    /* Expliciet MEDIA i.p.v. het afgeleide TOUCH (gemeten 5 okt 2026): als
       aanraakfeedback volgen de tikken de instelling "trillen bij aanraken"
       — staat die uit, dan viel de hele sessie stil. */
    fun vibrateAsMedia(v: Vibrator?, effect: VibrationEffect) {
      if (v == null) return
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        v.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_MEDIA))
      } else {
        @Suppress("DEPRECATION")
        v.vibrate(
          effect,
          AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).build(),
        )
      }
    }

    fun vibratorOf(context: Context): Vibrator? =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      }
  }

  private val handler = Handler(Looper.getMainLooper())
  /* Eigen thread met hoge prioriteit enkel voor het ritme (5 okt 2026):
     op de hoofdthread schoof elke tik mee met UI-werk (animaties, ringen,
     tikken) — gemeten tot ±90 ms afwijking. */
  private val beatThread = HandlerThread("vibezcore-beats", Process.THREAD_PRIORITY_URGENT_AUDIO).apply { start() }
  private val beatHandler = Handler(beatThread.looper)
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
  private val endRunnable = Runnable { stopSelfCleanly() }

  /* TIK PER TIK (operator, 5 okt 2026: "de sessie mag in geen enkel geval
     onderbroken of beïnvloed worden door andere handelingen op de
     telefoon"). Gemeten: elke andere trilling — tik-feedback, gebaren,
     toetsenbord, meldingen, ontgrendelen — VERDRINGT een lopende app-
     trilling (cancelled_superseded), en vergrendelen breekt ze af
     (cancelled_by_screen_off). Eén lange trilling voor de hele sessie viel
     daardoor telkens stil tot de volgende herstart (gaten tot 19 s).
     Nu speelt elke tik als EIGEN korte trilling op zijn exacte moment
     (Handler + wake lock, zelfde aanpak als BreathSessionService): een
     verdringing kost hooguit één tik, de volgende komt gewoon. */
  private class Unit(val offsetMs: Long, val t: LongArray, val a: IntArray)

  private var units: List<Unit> = emptyList()
  private var nextUnit = 0
  private var startUptime = 0L

  private val beatRunnable = object : Runnable {
    override fun run() {
      playDueUnitAndScheduleNext()
    }
  }

  /** Curve (lub, gap, dub, rust)×N [+ eind-signaal van 6 stappen] →
   *  losse tikken met hun begintijd. */
  private fun buildUnits(t: LongArray, a: IntArray): List<Unit> {
    val out = ArrayList<Unit>()
    val sigStart =
      if (t.size >= 6 && (t.size - 6) % 4 == 0 && a[t.size - 6] == 0) t.size - 6 else t.size
    var acc = 0L
    var i = 0
    while (i + 3 < sigStart) {
      out.add(Unit(acc, longArrayOf(t[i], t[i + 1], t[i + 2]), intArrayOf(a[i], 0, a[i + 2])))
      acc += t[i] + t[i + 1] + t[i + 2] + t[i + 3]
      i += 4
    }
    if (sigStart < t.size) {
      out.add(Unit(acc, t.copyOfRange(sigStart, t.size), a.copyOfRange(sigStart, t.size)))
    }
    return out
  }

  private fun playDueUnitAndScheduleNext() {
    if (nextUnit >= units.size) return
    val now = SystemClock.uptimeMillis()
    val u = units[nextUnit]
    /* Te laat (bv. CPU was even bezet)? Die tik overslaan i.p.v. hem uit de
       maat te spelen. */
    if (now - (startUptime + u.offsetMs) <= LATE_SKIP_MS) {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrateAsMedia(vibratorOf(this), VibrationEffect.createWaveform(u.t, u.a, -1))
        }
      } catch (_: Exception) {
      }
    }
    nextUnit++
    scheduleNextUnit()
  }

  private fun scheduleNextUnit() {
    beatHandler.removeCallbacks(beatRunnable)
    val now = SystemClock.uptimeMillis()
    while (nextUnit < units.size && startUptime + units[nextUnit].offsetMs < now - LATE_SKIP_MS) {
      nextUnit++
    }
    if (nextUnit >= units.size) return
    beatHandler.postAtTime(beatRunnable, startUptime + units[nextUnit].offsetMs)
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
    units = buildUnits(t, a)
    nextUnit = 0
    startUptime = SystemClock.uptimeMillis()
    /* Stoppen op dezelfde klok als de tikken, met marge: anders kan de stop
       net vóór de laatste tik van het eindsignaal vallen en die afkappen
       (audit 5 okt 2026). */
    handler.removeCallbacks(endRunnable)
    handler.postAtTime(endRunnable, startUptime + totalMs + END_MARGIN_MS)
    scheduleNextUnit()
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    beatHandler.removeCallbacksAndMessages(null)
    beatThread.quitSafely()
    try {
      vibratorOf(this)?.cancel()
    } catch (_: Exception) {
    }
    releaseWakeLock()
    releaseMediaSession()
    super.onDestroy()
  }

  private fun stopSelfCleanly() {
    handler.removeCallbacksAndMessages(null)
    beatHandler.removeCallbacksAndMessages(null)
    try {
      vibratorOf(this)?.cancel()
    } catch (_: Exception) {
    }
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
    /* Android 16+: een Live Update (operator, 5 okt 2026: "de tekst moet
       mooi gecentreerd staan"). Als media-melding zet OneUI de tekst
       bovenaan de Now Bar en houdt eronder plaats vrij voor afspeelknoppen
       die een haptische sessie niet heeft. Een Live Update is het Android-
       equivalent van Apple's Live Activity: Now Bar en statusbalk tonen
       modus, resterende tijd en voortgang zonder lege rij. */
    if (Build.VERSION.SDK_INT >= 36) return buildLiveUpdate(pending)
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

  @androidx.annotation.RequiresApi(36)
  private fun buildLiveUpdate(pending: PendingIntent?): Notification {
    val total = sessionTotalMs.coerceAtLeast(1L)
    val elapsed = sessionElapsedNowMs()
    val remSec = ((total - elapsed) / 1000L).coerceAtLeast(0L)
    val clock = "%d:%02d".format(remSec / 60, remSec % 60)
    val style = Notification.ProgressStyle()
      .setStyledByProgress(false)
      .setProgressSegments(listOf(Notification.ProgressStyle.Segment(1000).setColor(ACCENT)))
      .setProgress(((elapsed * 1000L) / total).toInt().coerceIn(0, 1000))
    val b = Notification.Builder(this, CHANNEL_ID)
      .setSmallIcon(smallIconRes())
      .setContentTitle(title)
      .setContentText("$clock left")
      .setShortCriticalText(clock)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_PROGRESS)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(pending)
      .setStyle(style)
    artBitmap?.let { b.setLargeIcon(android.graphics.drawable.Icon.createWithBitmap(it)) }
    /* Vraagt de promotie tot Live Update aan (vereist
       POST_PROMOTED_NOTIFICATIONS in het manifest). */
    b.extras.putBoolean("android.requestPromotedOngoing", true)
    return b.build()
  }
}
