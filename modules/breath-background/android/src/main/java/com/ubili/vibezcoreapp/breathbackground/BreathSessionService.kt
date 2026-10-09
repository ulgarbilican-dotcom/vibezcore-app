package com.ubili.vibezcoreapp.breathbackground

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Foreground service die de ademsessie op de klok houdt
   terwijl het scherm op slot staat.

   Waarom een foreground service: Android's Doze-modus bevriest de React
   Native JS-thread na verloop van tijd, ongeacht audio (zie de toelichting
   in modules/breath-background/index.ts en breath-session.tsx).

   Waarom een PARTIAL_WAKE_LOCK + Handler i.p.v. AlarmManager (operator, 15
   augustus 2026: "boost werkt niet correct in lockscreen. voice haptics
   timing kloppen niet, veel te traag"). De eerste versie van deze service
   plande twee AlarmManager.setExactAndAllowWhileIdle()-wekkers per
   fase-overgang. Voor Calm Control (fasen van 4s) werkte dat; voor Boost
   (fasen van 2s — Energize-techniek) betekent dat een nieuwe exacte wekker
   zowat elke seconde, en Android throttlet herhaalde exacte wekkers van
   dezelfde app — precies zichtbaar als een sessie die "te traag" aanvoelt.
   Een gehouden PARTIAL_WAKE_LOCK voor de hele sessieduur houdt de CPU
   simpelweg wakker, dus gewone Handler.postDelayed()-timers blijven exact
   lopen, ongeacht Doze — geen PendingIntent-omweg, geen throttling, geen
   losse BroadcastReceiver meer nodig.

   De ECHTE staat (welke fase, welke ronde) woont in een companion object:
   één proces, dus een gewoon (volatile) veld volstaat, geen IPC nodig.

   De melding is nu de ENIGE lockscreen-aanwezigheid van een achtergrond-
   sessie op Android (operator, 15 augustus 2026: "de visuals tijdens
   lockscreen lijken nu audio sessies... kunnen we juiste informatie geven?
   duurtijd, animatie en teller?"). Voorheen registreerde het stille
   audio-anker (session-keepalive.ts) ZELF een actieve mediasessie via
   expo-audio's setActiveForLockScreen — die widget toonde de modusnaam
   als titel maar een voortgangsbalk van de onderliggende 1-seconde-stilte-
   lus (00:00/00:01), los van de echte sessieduur.

   BELANGRIJKE LES (operator, 15 augustus 2026: "nog altijd niets te zien in
   lockscreen" — ook mét POST_NOTIFICATIONS verleend en VISIBILITY_PUBLIC
   gezet): een GEWONE NotificationCompat-melding bleek op het testtoestel
   (Samsung/OneUI) simpelweg niet te verschijnen op het vergrendelscherm,
   terwijl het EERDERE, mediasessie-gedreven venster van expo-audio dat wél
   deed. OneUI's vergrendelscherm behandelt actieve media-mededingen
   (MediaStyle + een echte MediaSessionCompat) zichtbaar anders — een eigen
   widget-plek, niet onderhevig aan de gewone "mededelingen op
   vergrendelscherm"-instelling. Deze service registreert daarom nu ZELF
   een MediaSessionCompat (geen speler eronder, alleen de sessie-metadata en
   playback-status) i.p.v. te vertrouwen op een gewone melding — dezelfde
   betrouwbare zichtbaarheid als voorheen, nu met de juiste modus, fase,
   duur en voortgang in plaats van de misleidende stilte-lus. */

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat as MediaNotificationCompat

data class BgPhase(val key: String, val secs: Int)

class BreathSessionService : Service() {

  companion object {
    const val CHANNEL_ID = "breath_background_session"
    const val NOTIFICATION_ID = 8421

    const val ACTION_START = "com.ubili.vibezcoreapp.breathbackground.action.START"
    const val ACTION_STOP = "com.ubili.vibezcoreapp.breathbackground.action.STOP"

    const val EXTRA_PHASE_KEYS = "phaseKeys"
    const val EXTRA_PHASE_SECS = "phaseSecs"
    const val EXTRA_ROUNDS = "rounds"
    const val EXTRA_INHALE_URI = "inhaleUri"
    const val EXTRA_HOLD_URI = "holdUri"
    const val EXTRA_EXHALE_URI = "exhaleUri"
    const val EXTRA_CUE_LEAD_MS = "cueLeadMs"
    /* Meegegeven zodra native pas bewapend wordt NADAT de sessie al een
       tijdje in de voorgrond liep (operator, 13 augustus 2026: "dubbele
       stem"). Native start dan MIDDEN in een fase, niet bij fase 0. */
    const val EXTRA_START_PHASE_IDX = "startPhaseIdx"
    const val EXTRA_START_ROUND = "startRound"
    const val EXTRA_START_REMAINING_MS = "startRemainingMs"
    /* Voor de melding — cosmetisch/informatief, geen cyclus-logica (operator,
       15 augustus 2026: "juiste informatie, duurtijd, teller"). */
    const val EXTRA_MODE_NAME = "modeName"
    const val EXTRA_TOTAL_DURATION_MS = "totalDurationMs"
    const val EXTRA_SESSION_REMAINING_MS = "sessionRemainingMs"

    /* ── Gedeelde sessiestaat ─────────────────────────────────────────ᅟ
       @Volatile: gelezen/geschreven vanuit de service (main thread) én
       vanuit de Handler-runnables (ook main thread, maar volatile kost
       niets en sluit een race meteen uit). */
    @Volatile var phases: List<BgPhase> = emptyList()
    @Volatile var rounds: Int = 0
    @Volatile var phaseIdx: Int = 0
    @Volatile var round: Int = 1
    @Volatile var inhaleUri: String = ""
    @Volatile var holdUri: String = ""
    @Volatile var exhaleUri: String = ""
    @Volatile var cueLeadMs: Long = 400L
    @Volatile var running: Boolean = false
    @Volatile var modeName: String = "Breathwork"
    @Volatile var totalDurationMs: Long = 0L
    @Volatile var elapsedMs: Long = 0L

    /** Welk bestand hoort bij welke fase-sleutel — hold-in en hold-out
     *  delen hetzelfde bestand, precies zoals playBreathCue() in
     *  breath-voice.ts. */
    fun cueUriFor(key: String): String? = when (key) {
      "inhale" -> inhaleUri
      "hold-in", "hold-out" -> holdUri
      "exhale" -> exhaleUri
      else -> null
    }

    /** Menselijk leesbare fasenaam voor de melding. */
    fun phaseLabel(key: String): String = when (key) {
      "inhale" -> "Inhale"
      "exhale" -> "Exhale"
      "hold-in", "hold-out" -> "Hold"
      else -> "Breathe"
    }
  }

  private var wakeLock: PowerManager.WakeLock? = null
  private val handler = Handler(Looper.getMainLooper())
  private var cueRunnable: Runnable? = null
  private var transitionRunnable: Runnable? = null
  private var mediaSession: MediaSessionCompat? = null
  /* Wanneer (SystemClock.elapsedRealtime()) de HUIDIGE fase begon, gecorrigeerd
     voor een eventuele resterende tijd bij een midden-in-de-fase-overname —
     zie scheduleTimersWithRemaining(). Samen met `elapsedMs` (de reeds
     VOLTOOIDE fasen) geeft dit op elk moment de live sessie-voortgang. */
  private var phaseStartRealtime: Long = 0L
  private var tickRunnable: Runnable? = null

  /** OneUI's vergrendelscherm-widget bleek de PlaybackState-positie NIET
   *  zelf te interpoleren tussen twee `setPlaybackState()`-aanroepen, EN
   *  bleek ook niet te verversen op een kale sessie-status-update zonder
   *  een nieuwe melding erbij (operator, 15 augustus 2026: "nog altijd geen
   *  werkende timing" — ook na de sessie-only tikker). Dus toch een echte
   *  `notify()` elke seconde — `setOnlyAlertOnce(true)` op de builder
   *  voorkomt dat dit opnieuw geluid/trilling of een heropvallende melding
   *  geeft, het is puur een still-content-update. Kost een lichte notify-
   *  aanroep per seconde, verwaarloosbaar naast de toch al gehouden
   *  wake lock. */
  private fun startTicking() {
    stopTicking()
    val tick = object : Runnable {
      override fun run() {
        if (!running) return
        updateNotification()
        handler.postDelayed(this, 1000L)
      }
    }
    tickRunnable = tick
    handler.postDelayed(tick, 1000L)
  }

  private fun stopTicking() {
    tickRunnable?.let { handler.removeCallbacks(it) }
    tickRunnable = null
  }

  private fun currentPhaseLabel(): String =
    if (phases.isNotEmpty() && phaseIdx < phases.size) {
      phaseLabel(phases[phaseIdx].key)
    } else {
      "Getting ready"
    }

  private fun liveElapsedMs(): Long {
    val inPhase = (SystemClock.elapsedRealtime() - phaseStartRealtime).coerceAtLeast(0L)
    return (elapsedMs + inPhase).coerceAtMost(if (totalDurationMs > 0) totalDurationMs else Long.MAX_VALUE)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    ensureChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    /* `startForeground` moet ALTIJD snel volgen op `startForegroundService`
       — ook op het stop-pad, want stop() roept ook startForegroundService()
       aan om de service wakker te maken als hij al gestopt was. */
    startForeground(NOTIFICATION_ID, buildNotification())

    if (intent?.action == ACTION_STOP) {
      stopSessionInternal()
      return START_NOT_STICKY
    }

    val keys = intent?.getStringArrayListExtra(EXTRA_PHASE_KEYS) ?: arrayListOf()
    val secs = intent?.getIntegerArrayListExtra(EXTRA_PHASE_SECS) ?: arrayListOf()
    if (keys.isEmpty()) {
      /* Geen fasen meegekregen — er valt niets te draaien. */
      stopSessionInternal()
      return START_NOT_STICKY
    }

    acquireWakeLock()

    phases = keys.indices.map { BgPhase(keys[it], secs.getOrElse(it) { 0 }) }
    rounds = intent?.getIntExtra(EXTRA_ROUNDS, 0) ?: 0
    inhaleUri = intent?.getStringExtra(EXTRA_INHALE_URI) ?: ""
    holdUri = intent?.getStringExtra(EXTRA_HOLD_URI) ?: ""
    exhaleUri = intent?.getStringExtra(EXTRA_EXHALE_URI) ?: ""
    cueLeadMs = (intent?.getIntExtra(EXTRA_CUE_LEAD_MS, 400) ?: 400).toLong()
    modeName = intent?.getStringExtra(EXTRA_MODE_NAME) ?: "Breathwork"
    totalDurationMs = (intent?.getLongExtra(EXTRA_TOTAL_DURATION_MS, 0L) ?: 0L)
    val sessionRemainingMs = intent?.getLongExtra(EXTRA_SESSION_REMAINING_MS, totalDurationMs)
      ?: totalDurationMs
    elapsedMs = (totalDurationMs - sessionRemainingMs).coerceAtLeast(0L)
    running = true

    /* `startRemainingMs >= 0` betekent: JS liep al een tijdje in de
       voorgrond en draagt de sessie nu over omdat het scherm op slot gaat
       (operator, 13 augustus 2026: "dubbele stem"). Dan NIET opnieuw bij
       fase 0 beginnen en NIET de cue/haptiek van de huidige fase herhalen
       — JS speelde die al toen de fase begon. Alleen de timer voor wat NA
       deze fase komt overnemen, met de resterende tijd. */
    val startRemainingMs = intent?.getIntExtra(EXTRA_START_REMAINING_MS, -1) ?: -1
    if (startRemainingMs >= 0) {
      phaseIdx = intent?.getIntExtra(EXTRA_START_PHASE_IDX, 0) ?: 0
      round = intent?.getIntExtra(EXTRA_START_ROUND, 1) ?: 1
      val fullMs = phases.getOrNull(phaseIdx)?.secs?.times(1000L) ?: startRemainingMs.toLong()
      scheduleTimersWithRemaining(startRemainingMs.toLong(), fullMs)
    } else {
      phaseIdx = 0
      round = 1
      /* De ALLEREERSTE cue kan per definitie niet vooruitlopen — er is geen
         fase vóór deze. Klinkt dus gelijk met de start, zelfde als
         `speak(techRef.current.phases[0])` vóór de eerste `runPhase()`-
         aanroep in breath-session.tsx. */
      val first = phases[0]
      playCueFile(cueUriFor(first.key) ?: "")
      playHapticForPhase(this, first.key, first.secs)
      scheduleTimersWithRemaining(first.secs * 1000L, first.secs * 1000L)
    }
    startTicking()

    startForeground(NOTIFICATION_ID, buildNotification())
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    cancelTimers()
    stopTicking()
    releaseWakeLock()
    releaseMediaSession()
    running = false
    super.onDestroy()
  }

  /** Twee timers voor de fase die NU loopt: één voor de stem-cue van de
   *  KOMENDE fase (cueLeadMs vóór het einde — dezelfde voorsprong als
   *  CUE_LEAD_MS in breath-session.tsx), één voor de ECHTE overgang.
   *  `remainingMs` is de tijd tot die overgang — de volle fase-duur bij een
   *  verse fase, of minder wanneer native MIDDEN in een fase overneemt.
   *  `phaseFullMs` is de VOLLE duur van die fase (gelijk aan `remainingMs`
   *  behalve bij een midden-in-de-fase-overname) — bepaalt `phaseStartRealtime`
   *  voor de live-tikker hierboven. */
  private fun scheduleTimersWithRemaining(remainingMs: Long, phaseFullMs: Long = remainingMs) {
    cancelTimers()
    val cueDelay = maxOf(0L, remainingMs - cueLeadMs)
    val transitionDelay = maxOf(0L, remainingMs)
    phaseStartRealtime = SystemClock.elapsedRealtime() - (phaseFullMs - remainingMs)

    val cue = Runnable { handleCue() }
    val transition = Runnable { handleTransition() }
    cueRunnable = cue
    transitionRunnable = transition
    handler.postDelayed(cue, cueDelay)
    handler.postDelayed(transition, transitionDelay)
  }

  private fun cancelTimers() {
    cueRunnable?.let { handler.removeCallbacks(it) }
    transitionRunnable?.let { handler.removeCallbacks(it) }
    cueRunnable = null
    transitionRunnable = null
  }

  /** Speelt de stem-cue voor de fase die NA de huidige komt — zelfde
   *  `nextOf(k)`-logica als runPhase() in breath-session.tsx: gewoon de
   *  eerstvolgende fase in de lijst, wrappend naar fase 0 van een nieuwe
   *  ronde als de huidige de laatste is. */
  private fun handleCue() {
    if (!running || phases.isEmpty()) return
    val nextIdx = (phaseIdx + 1) % phases.size
    val upcoming = phases[nextIdx]
    playCueFile(cueUriFor(upcoming.key) ?: "")
  }

  private fun handleTransition() {
    if (!running || phases.isEmpty()) return

    val curIdx = phaseIdx
    val curSecs = phases[curIdx].secs
    val isLastOfRound = curIdx == phases.size - 1
    val newIdx: Int
    val newRound: Int

    if (isLastOfRound) {
      newRound = round + 1
      if (newRound > rounds) {
        /* Sessie klaar — geen nieuwe timers, service stopt zichzelf net als
           finish() aan de JS-kant. */
        elapsedMs = totalDurationMs
        stopSessionInternal()
        return
      }
      newIdx = 0
    } else {
      newRound = round
      newIdx = curIdx + 1
    }

    elapsedMs = (elapsedMs + curSecs * 1000L).coerceAtMost(totalDurationMs)
    phaseIdx = newIdx
    round = newRound

    val phase = phases[newIdx]
    playHapticForPhase(this, phase.key, phase.secs)
    scheduleTimersWithRemaining(phase.secs * 1000L, phase.secs * 1000L)
    updateNotification()
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    try {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      val lock = pm.newWakeLock(
        PowerManager.PARTIAL_WAKE_LOCK,
        "vibezcore:breath_session",
      )
      /* Veiligheidsgrens, geen verwachte sessieduur — de langste sessie is
         twintig minuten; twee uur is ruim genoeg om nooit tijdens een
         legitieme sessie te vervallen, en voorkomt een vergeten wake lock
         bij een onverwacht proces-einde. */
      lock.acquire(2 * 60 * 60 * 1000L)
      wakeLock = lock
    } catch (_: Exception) {
      /* stil — zonder wake lock valt terug op wat het OS toestaat */
    }
  }

  private fun releaseWakeLock() {
    try {
      wakeLock?.let { if (it.isHeld) it.release() }
    } catch (_: Exception) {
      /* stil */
    }
    wakeLock = null
  }

  private fun stopSessionInternal() {
    cancelTimers()
    stopTicking()
    releaseWakeLock()
    releaseMediaSession()
    try {
      getVibrator(this)?.cancel()
    } catch (_: Exception) {
      /* stil */
    }
    running = false
    phases = emptyList()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  /** Eigen MediaSessionCompat, geen echte speler eronder — alleen metadata
   *  (titel/duur) en playback-status (PLAYING, positie, snelheid 1.0x) zodat
   *  het systeem de voortgang zelf interpoleert tussen twee updates, precies
   *  zoals de chronometer hierboven maar dan via het media-pad dat OneUI
   *  wél op het vergrendelscherm toont. */
  private fun ensureMediaSession(): MediaSessionCompat {
    mediaSession?.let { return it }
    val session = MediaSessionCompat(this, "VibezcoreBreathSession")
    session.isActive = true
    mediaSession = session
    return session
  }

  private fun releaseMediaSession() {
    try {
      mediaSession?.isActive = false
      mediaSession?.release()
    } catch (_: Exception) {
      /* stil */
    }
    mediaSession = null
    lastMetaKey = null
  }

  /* Operator, 8 okt 2026 ("de tekst op het vergrendelscherm blijft
     haperen"): de ARTIST-regel was fase + "m:ss left" en werd elke seconde
     opnieuw gezet — OneUI's Now Bar laat lange tekst als lichtkrant lopen
     en herstart die bij elke nieuwe tekst → continu haperen. Nu vaste tekst
     (Apple Music/Spotify-patroon: titel + ondertitel, tijd via de balk), en
     enkel opnieuw zetten als er echt iets wijzigt. */
  private var lastMetaKey: String? = null

  /* Operator, 8 okt 2026 ("muzieknoot op het vergrendelscherm, moet het
     VIBEZCORE-logo V zijn"): OneUI toont de albumhoes van de mediasessie;
     zonder hoes valt het terug op een muzieknoot. Het app-icoon (de V)
     als hoes — geen extra asset nodig, één keer omgezet en bewaard. */
  private var appIconBitmap: Bitmap? = null

  private fun appIcon(): Bitmap? {
    appIconBitmap?.let { return it }
    return try {
      val d = packageManager.getApplicationIcon(packageName)
      val size = 256
      val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val c = Canvas(bmp)
      d.setBounds(0, 0, size, size)
      d.draw(c)
      appIconBitmap = bmp
      bmp
    } catch (_: Exception) {
      null
    }
  }

  private var lockscreenArtBitmap: Bitmap? = null

  private fun lockscreenArt(): Bitmap? {
    lockscreenArtBitmap?.let { return it }
    return try {
      val bmp = android.graphics.BitmapFactory.decodeResource(resources, R.drawable.vibezcore_lockscreen_art)
      lockscreenArtBitmap = bmp
      bmp
    } catch (_: Exception) {
      appIcon()
    }
  }

  @Suppress("UNUSED_PARAMETER")
  private fun updateMediaSession(phaseText: String) {
    val session = ensureMediaSession()
    /* Operator, 10 okt 2026 ("we hadden gezegd: sessienaam + timer die
       aftelt, maar vast — niet bewegend"): titel = sessienaam, tweede regel =
       enkel de resterende tijd (M:SS). Kort genoeg om in het Now Bar-balkje
       te passen, dus geen lichtkrant; per seconde verandert alleen het getal.
       (Eerder stond hier vast "Guided breathwork".) */
    val remainingSec = if (totalDurationMs > 0) {
      ((totalDurationMs - liveElapsedMs()).coerceAtLeast(0L) / 1000).toInt()
    } else {
      -1
    }
    val timeLabel = if (remainingSec >= 0) "%d:%02d".format(remainingSec / 60, remainingSec % 60) else ""
    val metaKey = "$modeName|$totalDurationMs|$timeLabel"
    if (metaKey != lastMetaKey) {
      val metadata = MediaMetadataCompat.Builder()
        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, modeName)
        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, timeLabel)
        .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "VIBEZCORE")
        .apply {
          /* Operator, 10 okt 2026 ("uitvergroot op het lockscreen is de V
             veel te groot — toon de V en VIBEZCORE zoals op het
             welkomstscherm"): eigen beeld i.p.v. het app-icoon; het kleine
             icoon blijft het app-icoon. */
          lockscreenArt()?.let {
            putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it)
            putBitmap(MediaMetadataCompat.METADATA_KEY_ART, it)
          }
          appIcon()?.let { putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, it) }
          if (totalDurationMs > 0) {
            putLong(MediaMetadataCompat.METADATA_KEY_DURATION, totalDurationMs)
          }
        }
        .build()
      session.setMetadata(metadata)
      lastMetaKey = metaKey
    }

    /* Geen ACTION_PLAY_PAUSE/ACTION_SEEK_TO: er zit geen echte speler
       achter, dus geen knoppen die iets zouden doen — alleen ACTION_STOP,
       zodat "sluiten" op het vergrendelscherm de sessie ook echt stopt.
       `liveElapsedMs()` i.p.v. het statische `elapsedMs` (operator, 15
       augustus 2026: "timer telt niet") — dit toestel interpoleerde de
       positie zelf niet tussen twee updates, dus de seconde-tikker
       hierboven roept deze functie elke seconde opnieuw aan met een verse,
       berekende positie. */
    val state = PlaybackStateCompat.Builder()
      .setActions(PlaybackStateCompat.ACTION_STOP)
      .setState(
        PlaybackStateCompat.STATE_PLAYING,
        liveElapsedMs(),
        1.0f,
        SystemClock.elapsedRealtime(),
      )
      .build()
    session.setPlaybackState(state)
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val mgr = getSystemService(NotificationManager::class.java)
      if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
        val channel = NotificationChannel(
          CHANNEL_ID,
          "Breathwork session",
          NotificationManager.IMPORTANCE_LOW,
        )
        channel.setShowBadge(false)
        mgr.createNotificationChannel(channel)
      }
    }
  }

  /** Echte, eerlijke sessie-info i.p.v. de vroegere mediasessie-illusie
   *  (operator, 15 augustus 2026 — zie de toelichting bovenaan dit bestand).
   *  MediaStyle + een echte MediaSessionCompat: dat is het pad dat OneUI's
   *  vergrendelscherm betrouwbaar toont (een gewone melding bleek dat niet
   *  te zijn, zelfs met VISIBILITY_PUBLIC en POST_NOTIFICATIONS verleend).
   *  De chronometer/voortgangsbalk in de gewone melding hieronder tikt zelf
   *  (systeemklok); de mediasessie-positie bleek dat op dit toestel NIET te
   *  doen, vandaar de expliciete seconde-tikker (zie startTicking()). */
  private fun buildNotification(): Notification {
    /* Operator, 28 september 2026 ("aantal minuten laten aftellen ook"):
       de systeem-chronometer (`setUsesChronometer`/`setChronometerCountDown`
       hieronder) rendert op OneUI's MediaStyle-lockscreen-weergave niet
       altijd zichtbaar — de tekstregel zelf wordt sowieso elke seconde
       herbouwd (zie startTicking()), dus de resterende tijd hier expliciet
       INLIJVEN garandeert dat 'ie zichtbaar aftelt, ongeacht of de systeem-
       chronometer zelf op het vergrendelscherm doorkomt. Zelfde "· M:SS
       left"-patroon als de app's eigen sessieschermen. */
    val remainingMs = if (totalDurationMs > 0) {
      (totalDurationMs - liveElapsedMs()).coerceAtLeast(0L)
    } else {
      0L
    }
    val remainingLabel = if (totalDurationMs > 0) {
      val totalSec = (remainingMs / 1000).toInt()
      val mm = totalSec / 60
      val ss = totalSec % 60
      " · %d:%02d left".format(mm, ss)
    } else {
      ""
    }
    val phaseText = (
      if (phases.isNotEmpty() && phaseIdx < phases.size) {
        phaseLabel(phases[phaseIdx].key)
      } else {
        "Getting ready"
      }
    ) + remainingLabel
    updateMediaSession(phaseText)
    val session = mediaSession

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(modeName)
      .setContentText(phaseText)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      /* Zonder dit expliciet PUBLIC te zetten valt deze melding terug op de
         standaard PRIVATE-zichtbaarheid. Er staat niets gevoeligs in
         (modusnaam + fase), dus PUBLIC is hier gewoon correct. */
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(contentPendingIntent())

    if (session != null) {
      builder.setStyle(
        MediaNotificationCompat.MediaStyle()
          .setMediaSession(session.sessionToken),
      )
    }

    if (totalDurationMs > 0) {
      /* `liveElapsedMs()`, niet het fase-grove `elapsedMs` — dit bouwt nu
         elke seconde een nieuwe melding (zie startTicking()), en met het
         statische veld zou `remainingMs` alleen bij een fase-overgang
         kloppen: `setWhen(now + remainingMs)` zou dan elke seconde verder
         VOORUIT schuiven omdat `now` wel stijgt maar `remainingMs` niet
         daalt — de aftelling zou nooit aankomen. */
      builder
        .setWhen(System.currentTimeMillis() + remainingMs)
        .setUsesChronometer(true)
        .setChronometerCountDown(true)
        .setProgress(totalDurationMs.toInt(), liveElapsedMs().toInt(), false)
    }

    return builder.build()
  }

  private fun updateNotification() {
    val mgr = getSystemService(NotificationManager::class.java)
    mgr?.notify(NOTIFICATION_ID, buildNotification())
  }

  private fun contentPendingIntent(): PendingIntent? {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    return PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }
}
