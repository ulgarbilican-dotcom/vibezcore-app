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
    /* "Session complete" (operator, 5 okt 2026: "op het einde geen melding
       gekregen van sessie voldaan"). Eigen kanaal: zichtbaar als gewone
       melding, zonder geluid of trilling (het eind-signaal trilde al). */
    const val DONE_CHANNEL_ID = "state_control_done"
    const val DONE_NOTIFICATION_ID = 8423

    fun dismissCompletionNotice(context: Context) {
      try {
        androidx.core.app.NotificationManagerCompat.from(context).cancel(DONE_NOTIFICATION_ID)
      } catch (_: Exception) {
      }
    }
    const val ACTION_START = "com.ubili.vibezcoreapp.statehaptics.action.START"
    /* Knoppen op het vergrendelscherm / in de melding (Android < 13 gebruikt
       deze acties; 13+ stuurt dezelfde knoppen via de MediaSession). */
    const val ACTION_REMOTE_PAUSE = "com.ubili.vibezcoreapp.statehaptics.action.REMOTE_PAUSE"
    const val ACTION_REMOTE_RESUME = "com.ubili.vibezcoreapp.statehaptics.action.REMOTE_RESUME"

    /** De draaiende service (of null) — de module pauzeert hem rechtstreeks. */
    @Volatile var instance: StateHapticsService? = null
    /** Meldt een knop op het vergrendelscherm aan JS ("pause"/"resume"),
     *  zodat de sessie-monitor (bron van waarheid) meegaat. */
    @Volatile var remoteListener: ((String) -> kotlin.Unit)? = null

    /* Opdrachten die binnenkomen terwijl de service nog opstart (start is
       asynchroon; `instance` is pas na onCreate gezet). Alles hier wordt
       enkel op de hoofdthread gelezen en geschreven (module: Queues.MAIN). */
    @Volatile var startPending = false
    @Volatile var pendingPause = false
    @Volatile var pendingStop = false

    /** "none" | "starting" | "running" | "paused" — de ENIGE bron voor JS om
     *  te weten of er een service-sessie bestaat (ook na een JS-herlaad). */
    fun status(): String {
      val s = instance
      return when {
        s != null && !s.stopping -> if (s.paused || pendingPause) "paused" else "running"
        startPending -> if (pendingPause) "paused" else "starting"
        else -> "none"
      }
    }
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

    /* Expliciet MEDIA i.p.v. het afgeleide TOUCH (gemeten 5 okt 2026): als
       aanraakfeedback volgen de tikken de instelling "trillen bij aanraken"
       — staat die uit, dan viel de hele sessie stil. */
    fun vibrateAsMedia(v: Vibrator?, effect: VibrationEffect) = vibrateForSession(null, v, effect)

    /* Standaard Android negeert MEDIA-trillingen in batterijbesparing (enkel
       beltoon/alarm/communicatie mogen dan), en mogelijk ook in de stille
       modus. Gemeten op een Galaxy A16 (5 okt 2026): Samsung laat ze in
       beide standen wél door, maar andere merken volgen standaard Android.
       Daarom in die twee standen als ALARM — die categorie wordt nergens
       stilgelegd. Buiten die standen MEDIA, zodat de sterkte de ingestelde
       media-trilsterkte volgt waarop de modi afgesteld zijn. */
    fun vibrateForSession(context: Context?, v: Vibrator?, effect: VibrationEffect) {
      if (v == null) return
      val asAlarm = context != null && mustBypassQuietModes(context)
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
    }

    private fun mustBypassQuietModes(context: Context): Boolean =
      try {
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? android.media.AudioManager
        (pm?.isPowerSaveMode == true) ||
          (am?.ringerMode == android.media.AudioManager.RINGER_MODE_SILENT)
      } catch (_: Exception) {
        false
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
  /* Pauze (5 okt 2026, operator: "bouw wat nodig is om bug proof te
     worden"): de service blijft voorgrond zodat de sessie op het
     vergrendelscherm zichtbaar blijft en daar hervat kan worden. */
  @Volatile private var paused = false
  /** Na stopSelfCleanly: geen opdrachten meer aannemen (de module start dan
   *  een nieuwe service i.p.v. deze stervende bij te sturen). */
  @Volatile private var stopping = false
  private var pausedSessionElapsedMs = 0L
  private var pausedCurveElapsedMs = 0L
  private val tickRunnable = object : Runnable {
    override fun run() {
      if (remainingLabel() != lastLabel) updateNotification()
      handler.postDelayed(this, 1000L)
    }
  }
  private var wakeLock: PowerManager.WakeLock? = null
  /* Natuurlijk einde: eerst de "Session complete"-melding (de app kan op
     dit moment bevroren zijn op slot, deze service niet), dan stoppen. De
     app haalt die melding weg zodra ze zelf de afsluiting toont. */
  private val endRunnable = Runnable {
    postCompletionNotice()
    stopSelfCleanly()
  }

  private fun postCompletionNotice() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val mgr = getSystemService(NotificationManager::class.java)
        if (mgr.getNotificationChannel(DONE_CHANNEL_ID) == null) {
          val ch = NotificationChannel(DONE_CHANNEL_ID, "State Control completed", NotificationManager.IMPORTANCE_DEFAULT)
          ch.setSound(null, null)
          ch.enableVibration(false)
          ch.setShowBadge(false)
          mgr.createNotificationChannel(ch)
        }
      }
      val minutes = ((sessionTotalMs + 30_000L) / 60_000L).coerceAtLeast(1L)
      val open = Intent(
        Intent.ACTION_VIEW,
        android.net.Uri.parse("vibezcoreapp://bracelet?open=${System.currentTimeMillis()}"),
      ).apply {
        setPackage(packageName)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      }
      val pending = PendingIntent.getActivity(
        this, 3, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      val n = NotificationCompat.Builder(this, DONE_CHANNEL_ID)
        .setSmallIcon(smallIconRes())
        .setLargeIcon(artBitmap)
        .setContentTitle("Session complete")
        .setContentText("$title · $minutes min")
        .setAutoCancel(true)
        .setSilent(true)
        .setCategory(NotificationCompat.CATEGORY_STATUS)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(pending)
        .build()
      androidx.core.app.NotificationManagerCompat.from(this).notify(DONE_NOTIFICATION_ID, n)
    } catch (_: SecurityException) {
      /* geen meldingstoestemming — de app toont de afsluiting bij openen */
    } catch (_: Exception) {
    }
  }

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
          vibrateForSession(this, vibratorOf(this), VibrationEffect.createWaveform(u.t, u.a, -1))
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

  override fun onCreate() {
    super.onCreate()
    instance = this
    startPending = false
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ensureChannel()
    when (intent?.action) {
      ACTION_REMOTE_PAUSE -> {
        remotePause()
        return START_NOT_STICKY
      }
      ACTION_REMOTE_RESUME -> {
        remoteResume()
        return START_NOT_STICKY
      }
    }
    applySession(intent)
    /* Opdrachten die binnenkwamen terwijl de service nog opstartte. */
    if (pendingStop) {
      pendingStop = false
      pendingPause = false
      stopSelfCleanly()
    } else if (pendingPause) {
      pendingPause = false
      enterPaused()
    }
    return START_NOT_STICKY
  }

  /** Nieuwe curve toepassen — ook op een al draaiende service, rechtstreeks
   *  vanuit de module: met het scherm op slot mag een app een voorgrond-
   *  service niet opnieuw STARTEN (Android 12+), wel een draaiende bijsturen. */
  fun applySession(intent: Intent?) {
    paused = false
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
      return
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
  }

  override fun onDestroy() {
    if (instance === this) instance = null
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
    stopping = true
    if (instance === this) instance = null
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

  /* De drie opdrachten van de module — altijd op de hoofdthread
     aangeroepen (Queues.MAIN), dus in volgorde en nooit tegelijk met een
     stop of een tik op het vergrendelscherm. */
  fun applyFromApp(intent: Intent) {
    if (stopping) return
    applySession(intent)
  }

  /** Pauze gevraagd door de app (sessie-monitor). Ritme en klok stoppen,
   *  de melding blijft en toont "Paused" met een hervat-knop. */
  fun pauseFromApp() {
    if (stopping) return
    enterPaused()
  }

  fun stopFromApp() {
    if (stopping) return
    stopSelfCleanly()
  }

  private fun enterPaused() {
    if (paused || units.isEmpty()) return
    pausedSessionElapsedMs = sessionElapsedNowMs()
    pausedCurveElapsedMs = (SystemClock.uptimeMillis() - startUptime).coerceAtLeast(0L)
    paused = true
    beatHandler.removeCallbacks(beatRunnable)
    handler.removeCallbacks(endRunnable)
    handler.removeCallbacks(tickRunnable)
    try {
      vibratorOf(this)?.cancel()
    } catch (_: Exception) {
    }
    releaseWakeLock()
    updateNotification()
  }

  /** Hervat het eigen ritme meteen vanaf de pauzeplek. De app vervangt de
   *  curve daarna door de zijne (na een lange pauze opnieuw vanaf de
   *  basislijn), maar de gebruiker voelt nooit een gat. */
  private fun leavePaused() {
    if (!paused) return
    paused = false
    sessionElapsedAtStartMs = pausedSessionElapsedMs
    startRealtime = SystemClock.elapsedRealtime()
    startUptime = SystemClock.uptimeMillis() - pausedCurveElapsedMs
    acquireWakeLock()
    handler.removeCallbacks(endRunnable)
    handler.postAtTime(endRunnable, startUptime + totalMs + END_MARGIN_MS)
    handler.removeCallbacks(tickRunnable)
    handler.postDelayed(tickRunnable, 1000L)
    scheduleNextUnit()
    updateNotification()
  }

  private fun remotePause() {
    if (paused || stopping) return
    enterPaused()
    remoteListener?.invoke("pause")
  }

  private fun remoteResume() {
    if (!paused || stopping) return
    leavePaused()
    remoteListener?.invoke("resume")
  }

  private fun sessionElapsedNowMs(): Long =
    if (paused) pausedSessionElapsedMs
    else (sessionElapsedAtStartMs + (SystemClock.elapsedRealtime() - startRealtime))
      .coerceIn(0L, sessionTotalMs.coerceAtLeast(0L))

  /* Per MINUUT, niet per seconde (operator, 5 okt 2026: het logo in de
     vergrote Now Bar "wisselt tussen vierkant en bijna rond"). Elke nieuwe
     tekst = nieuwe metadata, en OneUI tekent dan de art opnieuw met een
     overgang. De seconden toont de tijdsbalk van het systeem zelf, die het
     uit positie + duur van de PlaybackState doortelt. */
  private fun remainingLabel(): String {
    val remMs = (sessionTotalMs - sessionElapsedNowMs()).coerceAtLeast(0L)
    val min = ((remMs + 59_999L) / 60_000L).coerceAtLeast(1L)
    val clock = "$min min left"
    return if (paused) "Paused · $clock" else clock
  }

  private var lastLabel: String? = null

  /* Operator, 5 okt 2026 ("op lockscreen zie ik een muzieknoot, daar moet
     het V-icoon komen"): zonder album-art toont OneUI een muzieknoot. Het
     app-icoon (V) als art + de witte V (notification_icon, zelfde als
     expo-notifications gebruikt) als klein icoon.
     Vervolg ("logo V heel onduidelijk" in de vergrote Now Bar): niet het
     kleine, al afgeronde launcher-icoon, maar de V-laag zelf op groot
     formaat op een VIERKANT donker vlak — het systeem rondt zelf af. */
  private val artBitmap: Bitmap? by lazy { brandArt() ?: launcherIconArt() }

  private fun brandArt(): Bitmap? =
    try {
      val id = resources.getIdentifier("ic_launcher_foreground", "mipmap", packageName)
      if (id == 0) null
      else {
        val size = 512
        val b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        c.drawColor(0xFF0A0A0A.toInt())
        val d = androidx.core.content.res.ResourcesCompat.getDrawable(resources, id, null)
        if (d == null) null
        else {
          d.setBounds(0, 0, size, size)
          d.isFilterBitmap = true
          d.draw(c)
          b
        }
      }
    } catch (_: Exception) {
      null
    }

  private fun launcherIconArt(): Bitmap? {
    return try {
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
    /* Android 13+ tekent de knoppen van de mediakaart zelf uit de
       PlaybackState en stuurt een tik hierheen. */
    s.setCallback(object : MediaSessionCompat.Callback() {
      /* Hardwareknoppen (oordopjes, headset, een oordopje uitnemen) NIET
         doorlaten: die zijn voor muziek bedoeld en mogen een sessie nooit
         stil pauzeren. Het vergrendelscherm roept onPause/onPlay
         rechtstreeks aan en gaat hier niet langs. */
      override fun onMediaButtonEvent(mediaButtonEvent: Intent?): Boolean = true

      override fun onPause() {
        handler.post { remotePause() }
      }
      override fun onPlay() {
        handler.post { remoteResume() }
      }
    })
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
        .setActions(
          if (paused) PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PLAY_PAUSE
          else PlaybackStateCompat.ACTION_PAUSE or PlaybackStateCompat.ACTION_PLAY_PAUSE,
        )
        .setState(
          if (paused) PlaybackStateCompat.STATE_PAUSED else PlaybackStateCompat.STATE_PLAYING,
          sessionElapsedNowMs(),
          if (paused) 0f else 1.0f,
          SystemClock.elapsedRealtime(),
        )
        .build(),
    )
  }

  private fun updateNotification() {
    if (stopping) return
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
    /* Tik op de melding = rechtstreeks naar de lopende sessie (zelfde
       `open`-parameter als openStateControl in de app), niet naar het
       scherm waar de app toevallig stond. */
    val launch = Intent(
      Intent.ACTION_VIEW,
      android.net.Uri.parse("vibezcoreapp://bracelet?open=${System.currentTimeMillis()}"),
    ).apply {
      setPackage(packageName)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val pending = launch?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    /* EEN weergave op elk toestel (operator, 5 okt 2026: "niet alleen bij
       mij maar op alle toestellen"): de mediakaart, die op het vergrendel-
       scherm van elke Android-fabrikant verschijnt. Een Android 16 Live
       Update werd op Samsung genegeerd (Now Bar enkel voor partner-apps,
       gemeten Galaxy A16 / OneUI 8.5); een tweede weergave zou een
       ongeteste tweede weg zijn. */
    val label = remainingLabel()
    lastLabel = label
    val text = "VIBEZCORE · $label"
    updateMediaSession(label)
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
      .addAction(
        if (paused) {
          NotificationCompat.Action(android.R.drawable.ic_media_play, "Resume", remotePending(ACTION_REMOTE_RESUME))
        } else {
          NotificationCompat.Action(android.R.drawable.ic_media_pause, "Pause", remotePending(ACTION_REMOTE_PAUSE))
        },
      )
      .setStyle(
        MediaNotificationCompat.MediaStyle()
          .setMediaSession(ensureMediaSession().sessionToken)
          .setShowActionsInCompactView(0),
      )
    if (sessionTotalMs > 0) {
      builder.setProgress(sessionTotalMs.toInt(), sessionElapsedNowMs().toInt(), false)
    }
    return builder.build()
  }

  private fun remotePending(action: String): PendingIntent =
    PendingIntent.getService(
      this,
      if (action == ACTION_REMOTE_PAUSE) 1 else 2,
      Intent(this, StateHapticsService::class.java).setAction(action),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}
