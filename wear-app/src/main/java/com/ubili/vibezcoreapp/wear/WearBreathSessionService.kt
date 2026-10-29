package com.ubili.vibezcoreapp.wear

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Draait de ademsessie volledig LOKAAL op het horloge.

   Geen enkel bericht per fase over Bluetooth — de telefoon stuurde bij
   START al de volledige lijst fasen + hun kant-en-klare haptic-patroon
   (zelfde array als phaseHapticPattern() op de telefoon). Deze service
   speelt ze gewoon na elkaar af op een eigen klok, dus een BLE-hobbel of
   een telefoon die in slaap valt kan deze lus niet meer raken — dezelfde
   autonomie als de bracelet (spec §8).

   13 okt 2026 (zelfde les als State Control): met het scherm uit zet Wear
   OS onze wakelock op DISABLED (dumpsys power), ook als voorgronddienst —
   een trilling per fase via Handler.postAtTime kon dan tot 100 s stilliggen.
   Daarom krijgt de trilmotor bij de start het HELE ritme in één patroon:
   de rest van de lopende ronde, daarna één volle ronde die zichzelf
   herhaalt (repeat-index). De trildienst houdt het toestel zelf wakker
   zolang het patroon loopt; de faseplanning hieronder doet enkel nog beeld
   en melding. */

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
import kotlin.math.min

private const val CHANNEL_ID = "vibezcore_breath"
private const val NOTIFICATION_ID = 1001

/* 13 okt 2026 (operator: "breathwork op het horloge loopt een fractie te
   traag") — zelfde tijdsbasis als State Control (WearStateSessionService):
   - de telefoon stuurt sentAtMs net NA het starten van zijn fase, maar zijn
     trildienst begint pas ~160 ms na de aanroep (gemeten 145–178 ms, zie
     NATIVE_START_LAG_MS in bracelet-haptics.ts) → dát is het gevoelde begin;
   - de horlogeklok + de reactietijd van de horlogemotor: 20 ms, voor State
     Control op gevoel bijgesteld door de operator ("nu lijkt het goed"). */
private const val PHONE_VIBRATOR_LAG_MS = 160L
/* 20 okt 2026: het klokverschil wordt per horloge gemeten (ClockSync).
   Op gevoel goed was 160 + 20 bij een gemeten verschil van 93 ms → los van
   de klok blijft 160 + 20 − 93 = 87 ms over. */
private const val MARGIN_AFTER_CLOCK_MS = PHONE_VIBRATOR_LAG_MS + 20L - ClockSync.LEGACY_AHEAD_MS
/* 13 okt 2026 (meting: bericht kwam na een koude start pas na 10,5 s aan;
   de oude grens van 8 s liet de pols 2,5 s achter). De klokken verschillen
   maar ~0,2 s (netwerktijd), dus de volle vertraging aftrekken is veilig;
   deze grens vangt enkel een kapotte klok op. */
private const val MAX_LAG_MS = 10 * 60_000L

private data class Phase(val key: String, val secs: Int, val pattern: LongArray, val via: String = "")

/** Eén stuk trilpatroon: stappen + kracht per stap. */
private class Seg(val t: LongArray, val a: IntArray)

/** Het patroon van één fase ([wacht, aan, uit, aan, …], oneven = aan),
 *  afgeknipt of met stilte aangevuld tot precies `durMs`. `onAmp` = kracht
 *  van de "aan"-stappen (DEFAULT_AMPLITUDE = standaardkracht). */
private fun phaseSeg(pattern: LongArray, durMs: Long, onAmp: Int): Seg {
  val t = ArrayList<Long>()
  val a = ArrayList<Int>()
  var used = 0L
  for (i in pattern.indices) {
    if (used >= durMs) break
    val step = min(pattern[i].coerceAtLeast(0L), durMs - used)
    if (step > 0L) {
      t.add(step)
      a.add(if (i % 2 == 1) onAmp else 0)
    }
    used += step
  }
  if (used < durMs) {
    t.add(durMs - used)
    a.add(0)
  }
  return Seg(t.toLongArray(), a.toIntArray())
}

private fun silence(durMs: Long) = Seg(longArrayOf(durMs), intArrayOf(0))

/** Knip de eerste `skipMs` weg (zelfde regel als trimStart in State
 *  Control): al voorbije stappen vallen weg, de lopende wordt korter. */
private fun trimHead(seg: Seg, skipMs: Long): Seg {
  if (skipMs <= 0L) return seg
  var left = skipMs
  var i = 0
  while (i < seg.t.size && left >= seg.t[i]) {
    left -= seg.t[i]
    i++
  }
  if (i >= seg.t.size) return Seg(LongArray(0), IntArray(0))
  val t = seg.t.copyOfRange(i, seg.t.size)
  val a = seg.a.copyOfRange(i, seg.a.size)
  t[0] -= left
  /* een half afgeknipte tik niet als stomp laten trillen */
  if (a[0] != 0 && t[0] < 20L) a[0] = 0
  return Seg(t, a)
}

class WearBreathSessionService : Service() {
  private var thread: HandlerThread? = null
  private var handler: Handler? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var vibrator: Vibrator? = null
  private var generation = 0 // elke nieuwe START annuleert vorige geplande callbacks
  private var colorHex = "#00A3A3"
  /** Trilkracht 0–255 van de telefoon (Soft/Medium/Strong); 0 = standaard. */
  private var amp = 0
  /* 13 okt 2026 — sessie die op het horloge zelf gestart is ("local"):
     pauze/hervatten zonder telefoon, en bij het einde in de geschiedenis. */
  private var localJson: JSONObject? = null
  private var activeMs = 0L
  private var runStartUptime = 0L
  private var curRound = 1
  private var curIdx = 0
  private var curTotalRounds = 1
  /* 14 okt 2026 (operator: "scherm uit, trilling weg"): Wear OS breekt een
     lopende trilling af als het scherm uitgaat door een knop of een
     polsbeweging (dumpsys vibrator_manager: "cancelled_by_screen_off" — ook
     voor ALARM; bij een time-out niet). Daarom zet de dienst de trilling
     meteen opnieuw in, op exact dezelfde plek in het ritme. */
  private val screenOffReceiver = object : android.content.BroadcastReceiver() {
    override fun onReceive(c: Context?, i: Intent?) {
      handler?.postDelayed({ rearmVibration() }, 300L)
    }
  }

  /** Lopende fase (voor het herstarten na scherm uit). */
  private var curPhases: List<Phase> = emptyList()
  private var curPhaseEndUptime = 0L
  private var playing = false

  /** Waterpeil op het scherm: stijgt bij inademen, zakt bij uitademen. */
  private var level = 0.3f

  override fun onCreate() {
    super.onCreate()
    VzLog.init(this)
    vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    thread = HandlerThread("vibezcore-breath-loop").also { it.start() }
    handler = Handler(thread!!.looper)
    androidx.core.content.ContextCompat.registerReceiver(
      this, screenOffReceiver, android.content.IntentFilter(Intent.ACTION_SCREEN_OFF),
      androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED,
    )
    ensureChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        val sessionJson = intent.getStringExtra(EXTRA_SESSION_JSON) ?: return START_NOT_STICKY
        val recvUp = intent.getLongExtra(EXTRA_RECV_UP, 0L)
        /* 29 okt 2026: eerst de klok vers meten (max 0,7 s, zie ClockSync.measureNow), dan pas de start uitrekenen. Meteen in de voorgrond:
           Android geeft daar maar een paar seconden voor. */
        goForegroundStarting(sessionJson)
        ClockSync.measureNow(this) { startSession(sessionJson, recvUp) }
      }
      ACTION_STOP -> stopSession()
      ACTION_PAUSE -> pauseSession()
    }
    return START_NOT_STICKY
  }

  private fun goForegroundStarting(sessionJson: String) {
    val modeName = try { JSONObject(sessionJson).optString("modeName", "Breathwork") } catch (_: Exception) { "Breathwork" }
    val notification = buildNotification("Starting…", modeName)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun startSession(sessionJson: String, recvUp: Long = 0L) {
    /* 14 okt 2026 (audit): startForeground meteen, vóór het lezen van de
       sessie — anders crasht het proces na startForegroundService als de
       inhoud onbruikbaar is. */
    val json = try {
      JSONObject(sessionJson)
    } catch (_: Exception) {
      JSONObject()
    }
    val modeName = json.optString("modeName", "Breathwork")
    val notification = buildNotification("Starting…", modeName)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    if (!json.has("phases") || (json.optJSONArray("phases")?.length() ?: 0) == 0) {
      /* onbruikbaar bericht: een lopende sessie laten doorlopen */
      if (!playing && pausedLocal == null) finishSession(completed = false)
      return
    }
    colorHex = json.optString("colorHex", "#00A3A3")
    amp = json.optInt("amp", 0).coerceIn(0, 255)
    val rounds = json.optInt("rounds", 1).coerceAtLeast(1)
    val phases = try {
      val phasesArr = json.getJSONArray("phases")
      (0 until phasesArr.length()).map { i ->
        val p = phasesArr.getJSONObject(i)
        val patternArr = p.getJSONArray("pattern")
        val pattern = LongArray(patternArr.length()) { j -> patternArr.getLong(j) }
        Phase(p.getString("key"), p.getInt("secs").coerceAtLeast(1), pattern, p.optString("via", ""))
      }
    } catch (_: Exception) {
      emptyList()
    }
    if (phases.isEmpty()) {
      if (!playing && pausedLocal == null) finishSession(completed = false)
      return
    }
    /* Hervatten (6 okt 2026): verder op exact de plek waar de telefoon
       pauzeerde — ronde, fase en wat er van die fase nog over was. */
    val startRound = json.optInt("startRound", 1).coerceIn(1, rounds)
    val startPhase = json.optInt("startPhase", 0).coerceIn(0, phases.size - 1)
    val phaseRemainingMs = json.optLong("phaseRemainingMs", -1L)
    localJson = if (json.optBoolean("local", false)) json else null
    activeMs = json.optLong("activeMs", 0L)
    runStartUptime = SystemClock.uptimeMillis()
    pausedLocal = null

    acquireWakeLock()

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
       0,2 s te vroeg — vandaar een marge (sinds 13 okt: CLOCK_MARGIN_MS,
       zelfde tijdsbasis als State Control). */
    /* 13 okt 2026: na een koude start (app net geïnstalleerd of door het
       systeem gestopt) kwam het bericht ~2,5 s na versturen binnen — de
       oude grens van 1,5 s liet de pols dan 1,1 s achterlopen. Nu tot 8 s;
       is de vertraging langer dan de lopende fase, dan springt het horloge
       door naar de fase waar de telefoon nu is (en speelt van die fase het
       stuk dat de telefoon nu voelt, zie startVibration). */
    /* 28 okt 2026: ZONDER klokken (zie WearStateSessionService.start): de wandklok van sommige horloges springt (Galaxy Watch4: seconden), dus
       het verschil tussen twee kloktijden is onbruikbaar. De telefoon meldt `leadMs` (sentAtMs − zijn klok op het verzendmoment, hier ≈ −enkele
       ms); het horloge meet op zijn EIGEN teller hoe lang het bericht onderweg was (de helft van de snelste rondreis) en hoe lang het daarna
       bleef liggen (nu − ontvangst). Oudere telefoon-app (geen leadMs): de klok-methode. */
    val leadMs = if (json.has("leadMs")) json.optLong("leadMs") else Long.MIN_VALUE
    /* 29 okt 2026: eerst de gedeelde teller (zie ClockSync / WearStateSessionService.start): het moment waarop de telefoon deze fase begon,
       op de teller van de telefoon, omgerekend naar de eigen — de reistijd van het bericht telt dan niet meer mee. */
    val monoUp = if (sentAt > 0L) ClockSync.phoneMonoToUptime(this, json.optLong("anchorMono", 0L), json.optLong("phoneBootWall", 0L)) else null
    val relative = sentAt > 0L && leadMs != Long.MIN_VALUE && recvUp > 0L
    val lag = when {
      monoUp != null -> (SystemClock.uptimeMillis() - monoUp - MARGIN_AFTER_CLOCK_MS).coerceIn(0L, MAX_LAG_MS)
      relative -> (ClockSync.oneWayMs(this) + (SystemClock.uptimeMillis() - recvUp) - leadMs - MARGIN_AFTER_CLOCK_MS).coerceIn(0L, MAX_LAG_MS)
      sentAt > 0L -> (System.currentTimeMillis() - sentAt - MARGIN_AFTER_CLOCK_MS - ClockSync.aheadMs(this)).coerceIn(0L, MAX_LAG_MS)
      else -> 0L
    }
    VzLog.d("breath start ${if (monoUp != null) "mono" else if (relative) "rel" else "clk"} sentAt=$sentAt lead=$leadMs oneWay=${ClockSync.oneWayMs(this)} now=${System.currentTimeMillis()} lag=${lag}ms")
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
      finishSession(completed = false)
      return
    }
    val silentStart = midPhase || skipped
    startVibration(myGeneration, phases, rounds, round, idx, left, resumed = midPhase && !skipped, now)
    runPhase(
      myGeneration, phases, rounds, modeName, round = round, phaseIdx = idx,
      startUptime = now,
      durMs = left,
      silentStart = silentStart,
    )
  }

  /** Het hele resterende ritme in één trilpatroon (zie kop van dit bestand).
   *  Begint NU (`startUptime`): de lopende fase duurt nog `leftMs`. Liep de
   *  telefoon al in die fase (Bluetooth-vertraging), dan speelt enkel het
   *  resterende stuk van zijn patroon — zoals de telefoon het nu voelt —
   *  i.p.v. het hele patroon te laat. Hervatten na pauze: stilte tot de
   *  volgende fase (die fase was al aangekondigd). */
  private fun startVibration(
    gen: Int,
    phases: List<Phase>,
    totalRounds: Int,
    round: Int,
    idx: Int,
    leftMs: Long,
    resumed: Boolean,
    startUptime: Long,
  ) {
    val v = vibrator ?: return
    val ampControl = try {
      v.hasAmplitudeControl()
    } catch (_: Exception) {
      false
    }
    /* 13 okt 2026 (operator: "zacht blijft te hard"): met de gekozen kracht
       i.p.v. altijd de standaardkracht van het horloge. */
    /* 27 okt 2026 (operator: "altijd op max beginnen"): zonder gekozen kracht van de telefoon het MAXIMUM (255), niet de standaardkracht. */
    val onAmp = if (ampControl) (if (amp > 0) amp else 255) else VibrationEffect.DEFAULT_AMPLITUDE
    val pieces = ArrayList<Seg>()
    val curMs = phases[idx].secs * 1000L
    pieces.add(
      if (resumed || leftMs > curMs) silence(leftMs)
      else trimHead(phaseSeg(phases[idx].pattern, curMs, onAmp), curMs - leftMs),
    )
    for (i in idx + 1 until phases.size) pieces.add(phaseSeg(phases[i].pattern, phases[i].secs * 1000L, onAmp))
    val headSteps = pieces.sumOf { it.t.size }
    val fullRoundsLeft = (totalRounds - round).coerceAtLeast(0)
    if (fullRoundsLeft > 0) {
      for (p in phases) pieces.add(phaseSeg(p.pattern, p.secs * 1000L, onAmp))
    }
    val t = LongArray(pieces.sumOf { it.t.size })
    val a = IntArray(t.size)
    var k = 0
    for (p in pieces) {
      p.t.copyInto(t, k)
      p.a.copyInto(a, k)
      k += p.t.size
    }
    val repeat = if (fullRoundsLeft > 0) headSteps else -1
    try {
      vibrateOutsideTouch(VibrationEffect.createWaveform(t, a, repeat))
    } catch (_: Exception) {
      /* een toestel/emulator zonder trilmotor mag de sessie niet stoppen */
    }
    val roundMs = phases.sumOf { it.secs * 1000L }
    var restMs = leftMs
    for (i in idx + 1 until phases.size) restMs += phases[i].secs * 1000L
    val sessionEnd = startUptime + restMs + fullRoundsLeft * roundMs
    VzLog.d(
      "breath vibrate wall=${System.currentTimeMillis()} steps=${t.size} repeat=$repeat round=$round/$totalRounds phase=$idx left=${leftMs}ms resumed=$resumed endIn=${sessionEnd - startUptime}ms",
    )
    if (fullRoundsLeft > 0) {
      /* Het herhalende patroon stopt niet vanzelf: na de laatste trilling
         van de laatste fase afbreken, vóór de "volgende ronde" begint. De
         trilling houdt het toestel wakker, dus dit komt op tijd. */
      val last = phases.last()
      val lastMs = last.secs * 1000L
      val patternMs = min(last.pattern.sum(), lastMs)
      val cancelAt = (sessionEnd - lastMs + patternMs + 30L).coerceAtMost(sessionEnd - 20L)
      handler?.postAtTime({
        if (gen == generation) {
          VzLog.d("breath vibrate end late=${SystemClock.uptimeMillis() - cancelAt}ms")
          try {
            vibrator?.cancel()
          } catch (_: Exception) {
          }
        }
      }, cancelAt)
    }
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
      finishSession(completed = true)
      return
    }
    val phase = phases[phaseIdx]
    curRound = round
    curIdx = phaseIdx
    curTotalRounds = totalRounds
    curPhases = phases
    playing = true
    val label = phaseDisplayLabel(phase.key)

    /* De trilling zelf speelt de trilmotor (startVibration); hier enkel
       beeld en melding. */
    val late = SystemClock.uptimeMillis() - startUptime
    if (late > 40) VzLog.d("breath phase late round=$round phase=$phaseIdx by=${late}ms")
    if (!silentStart) {
      BeatBus.beat(true)
    }

    val endUptime = startUptime + durMs
    curPhaseEndUptime = endUptime
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
    playing = false
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
    localJson?.let { j ->
      activeMs += now - runStartUptime
      pausedLocal = JSONObject(j.toString())
        .put("startRound", curRound)
        .put("startPhase", curIdx)
        .put("phaseRemainingMs", (cur.phaseEndUptime - now).coerceAtLeast(0L))
        .put("activeMs", activeMs)
        .toString()
    }
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
    playing = false
    generation++ // annuleert elke geplande runPhase()
    finishSession(completed = false)
  }

  private fun finishSession(completed: Boolean) {
    playing = false
    handler?.removeCallbacksAndMessages(null)
    localJson?.let { j ->
      activeMs += SystemClock.uptimeMillis() - runStartUptime
      logLocal(this, j, activeMs, if (completed) curTotalRounds else curRound, completed)
      localJson = null
    }
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
  /** Na scherm uit: het resterende ritme opnieuw inzetten vanaf NU. */
  private fun rearmVibration() {
    if (!playing || curPhases.isEmpty()) return
    val now = SystemClock.uptimeMillis()
    val left = curPhaseEndUptime - now
    if (left <= 150L) return
    VzLog.d("breath rearm after screen off round=$curRound phase=$curIdx left=${left}ms")
    startVibration(generation, curPhases, curTotalRounds, curRound, curIdx, left, resumed = false, startUptime = now)
  }

  private fun vibrateOutsideTouch(effect: VibrationEffect) {
    val v = vibrator ?: return
    /* 14 okt 2026 (operator: "scherm uit, trilling weg"): ALTIJD alarm.
       Wear OS stopt een media-trilling die al liep zodra het scherm uitgaat
       (dumpsys vibrator_manager: "cancelled_by_screen_off", gemeten op de
       Watch4); een alarm-trilling loopt door. */
    val asAlarm = true
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
    if (!keepAliveHeld) {
      KeepAlive.acquire(this)
      keepAliveHeld = true
    }
    if (wakeLock?.isHeld == true) return
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "vibezcore:breath-wear")
    wakeLock?.setReferenceCounted(false)
    wakeLock?.acquire(60 * 60 * 1000L) // hard plafond van 60 min (sessies tot 30 min + pauzes) — nooit onbeperkt
  }

  /** Stil geluid tegen het bevriezen door Samsung (zie KeepAlive). */
  private var keepAliveHeld = false

  private fun releaseWakeLock() {
    if (keepAliveHeld) {
      KeepAlive.release()
      keepAliveHeld = false
    }
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
    try {
      unregisterReceiver(screenOffReceiver)
    } catch (_: Exception) {
    }
    if (instance === this) instance = null
    releaseWakeLock()
    thread?.quitSafely()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    /** Loopt er nu een sessie die op het horloge zelf gestart is? */
    val isLocalSession: Boolean get() = instance?.localJson != null
    const val ACTION_START = "com.ubili.vibezcoreapp.wear.action.START"
    const val ACTION_STOP = "com.ubili.vibezcoreapp.wear.action.STOP"
    const val ACTION_PAUSE = "com.ubili.vibezcoreapp.wear.action.PAUSE"

    /** De lopende service, of null — dan is er niets te pauzeren/stoppen. */
    @Volatile
    var instance: WearBreathSessionService? = null
    const val EXTRA_RECV_UP = "recvUptimeMs"
    const val EXTRA_SESSION_JSON = "sessionJson"

    /** Gepauzeerde horloge-sessie (JSON met de plek erin) — hervatten doet
     *  het horloge dan zelf, niet via de telefoon. */
    @Volatile
    var pausedLocal: String? = null

    /** Horloge-sessie in de geschiedenis van de telefoon (CatalogStore). */
    fun logLocal(context: Context, j: JSONObject, activeMs: Long, rounds: Int, completed: Boolean) {
      if (activeMs < 10_000L || j.optBoolean("preview")) return
      CatalogStore.logSession(
        context,
        JSONObject()
          .put("state", j.optString("stateKey"))
          .put("techniqueKey", j.optString("techniqueKey"))
          .put("durSec", activeMs / 1000L)
          .put("rounds", rounds.coerceAtLeast(1))
          .put("completed", completed)
          .put("endedAt", System.currentTimeMillis()),
      )
    }
  }
}
