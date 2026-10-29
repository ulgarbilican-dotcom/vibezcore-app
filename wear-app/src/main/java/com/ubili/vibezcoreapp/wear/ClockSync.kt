package com.ubili.vibezcoreapp.wear

/* 20 okt 2026 (operator: "wij bouwen een commerciële app — het moet voor
   ELKE gebruiker correct lopen"): het klokverschil horloge − telefoon wordt
   gemeten in plaats van één vast getal dat op één Watch4 + A16 afgesteld
   was (≈ +93 ms op 14 okt; op een ander toestel, of na een herinstallatie,
   kan dat honderden ms of meer zijn).

   Werkwijze (zoals NTP): het horloge stuurt een paar pings met zijn eigen
   klok; de telefoon (WearBreathModule.kt) antwoordt meteen met de zijne.
   Per antwoord: verschil = midden(verstuurd, ontvangen) − telefoonklok. De
   meting met de kortste rondreis is de nauwkeurigste. Bewaard, zodat een
   start nooit op een meting moet wachten; ververst bij elke wake/start. */

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable

object ClockSync {
  const val PATH_PING = "/vibezcore/clock/ping"
  const val PATH_PONG = "/vibezcore/clock/pong"

  /** Zonder meting: de waarde die op 14 okt gemeten werd (Watch4 + A16). De
   *  tijdsregels in de sessiediensten zijn zo geschreven dat ze met deze
   *  waarde exact hetzelfde doen als vóór 20 okt. */
  const val LEGACY_AHEAD_MS = 93L

  private const val PREFS = "vz_clock_sync"
  private const val KEY_AHEAD = "aheadMs"
  private const val KEY_RTT = "rttMs"
  private const val KEY_AT = "measuredAt"
  private const val KEY_ONEWAY = "oneWayMs"
  /* 29 okt 2026 — gedeelde klok op de TELLERS van beide toestellen (elapsedRealtime: springt nooit, enkel een herstart zet hem op 0).
     Gemeten (A16 + Watch4, 29 okt): berichten deden er 0,8–0,9 s over terwijl de snelste rondreis 66 ms was; wie de reistijd van één
     bericht schat (de helft van de snelste rondreis) zat daardoor tot 0,85 s naast de telefoon. Met het verschil tussen de twee tellers
     (gemeten met de snelste rondreizen, fout ≤ rtt/2) maakt de reistijd van het startbericht niets meer uit: de telefoon zegt OP ZIJN
     TELLER wanneer slag 0 valt, het horloge rekent dat om naar de zijne. */
  private const val KEY_MONO_OFF = "monoOffMs2"      // horlogeteller − telefoonteller
  private const val KEY_MONO_RTT = "monoRttMs"
  private const val KEY_MONO_AT = "monoAtElapsed2"   // eigen teller op het meetmoment
  private const val KEY_PHONE_BOOT = "phoneBootWall" // telefoon: wandklok − teller (= wanneer hij opstartte)
  private const val KEY_WATCH_BOOT = "watchBootWall"
  /* 29 okt 2026 — gemeten (Galaxy Watch4, pc als referentie): de teller van het horloge verliest bij diepe slaap tot een fractie van een
     seconde per keer (870 ms in 11 min, sprongen van 128 ms; tijdens een sessie stabiel op ±3 ms omdat de trilmotor het horloge wakker
     houdt). Oorzaak in de hardware: de slaaptijd wordt met een grove klok bijgeteld. Een meting geldt daarom enkel zolang het horloge sinds
     die meting NIET geslapen heeft (slaaptijd = elapsedRealtime − uptimeMillis, die groeit enkel tijdens slaap), en bij elke start meet het
     horloge opnieuw (measureNow). */
  private const val KEY_SLEPT = "sleptAtMeasure"
  private const val SLEEP_TOLERANCE_MS = 20L
  /** Zo lang blijft een tellerverschil bruikbaar (kristallen lopen ~20 ppm uiteen: 30 min ≈ 36 ms). */
  private const val MONO_MAX_AGE_MS = 30 * 60_000L
  /** Fout ≤ rtt/2. Ook een trage verbinding (gemeten 29 okt: Bluetooth van de telefoon uit → via wifi/cloud, rondreis 0,6 s) blijft met deze
   *  methode beter dan een reistijd-schatting (die zat er toen 0,8 s naast); pas boven 1 s vallen we terug. */
  private const val MONO_MAX_RTT_MS = 1000L
  /** Herstart van één van beide toestellen = tellers opnieuw op 0 → de meting geldt niet meer. */
  private const val BOOT_TOLERANCE_MS = 5_000L
  /** Zonder meting: een gangbare enkele reis telefoon → horloge (Bluetooth). */
  const val DEFAULT_ONEWAY_MS = 100L
  /* 27 okt 2026: 5 → 12 pings. Gemeten (A16 + Watch4): met 5 pings en de beste van de vijf schommelde de schatting tussen sessies met
     ±300 ms (−1015…−416 ms) terwijl het echte verschil stabiel was; een rondreis van 100–285 ms is nooit nauwkeurig (± rtt/2). Meer
     pings geven meer kans op een echt snelle rondreis, en enkel de snelste tellen mee (zie run()). */
  private const val PINGS = 12
  private const val PING_GAP_MS = 100L
  /** Een meting is betrouwbaar (± ~30 ms) als de snelste rondreis hieronder blijft. */
  private const val TRUSTED_RTT_MS = 90L
  private const val COLLECT_MS = 2500L
  /** Rondreizen langer dan dit zijn te onnauwkeurig (± rtt/2). */
  private const val MAX_RTT_MS = 400L
  private const val MIN_INTERVAL_MS = 20_000L
  /** Een meting ouder dan dit gebruiken we niet meer. */
  private const val MAX_AGE_MS = 6 * 60 * 60_000L

  private val main = Handler(Looper.getMainLooper())
  @Volatile private var measuring = false
  @Volatile private var lastStartAt = 0L
  /** Uniek over alle metingen heen (start op de teller in ns, dus ook na een herstart van de app nooit hetzelfde nummer). */
  @Volatile private var nextSeq = System.nanoTime()

  /** Klokverschil horloge − telefoon (ms), gemeten of de oude standaard. */
  fun aheadMs(context: Context): Long {
    val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val at = p.getLong(KEY_AT, 0L)
    if (at <= 0L || System.currentTimeMillis() - at > MAX_AGE_MS) return LEGACY_AHEAD_MS
    return p.getLong(KEY_AHEAD, LEGACY_AHEAD_MS)
  }

  /** Enkele reis telefoon → horloge (ms), gemeten met de EIGEN teller van het horloge (geen wandklok, dus onafhankelijk van een klok die
   *  springt): de helft van de snelste rondreis ping → pong. 28 okt 2026. */
  fun oneWayMs(context: Context): Long {
    val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val at = p.getLong(KEY_AT, 0L)
    if (at <= 0L || System.currentTimeMillis() - at > MAX_AGE_MS) return DEFAULT_ONEWAY_MS
    return p.getLong(KEY_ONEWAY, DEFAULT_ONEWAY_MS)
  }

  /** Meet opnieuw (op de achtergrond, faalt stil). */
  fun refresh(context: Context) {
    val app = context.applicationContext
    VzLog.init(app)
    val now = SystemClock.elapsedRealtime()
    if (measuring && now - lastStartAt > PINGS * PING_GAP_MS + COLLECT_MS + 10_000L) measuring = false // nooit voorgoed vastlopen
    if (measuring || (lastStartAt > 0L && now - lastStartAt < MIN_INTERVAL_MS)) return
    measuring = true
    lastStartAt = now
    try {
      Wearable.getNodeClient(app).connectedNodes
        .addOnSuccessListener { nodes ->
          val node = nodes.firstOrNull { it.isNearby } ?: nodes.firstOrNull()
          if (node == null) {
            VzLog.d("clock no phone node")
            measuring = false
            return@addOnSuccessListener
          }
          run(app, node.id)
        }
        .addOnFailureListener {
          VzLog.d("clock nodes failed: ${it.message}")
          measuring = false
        }
    } catch (e: Exception) {
      VzLog.d("clock refresh failed: ${e.message}")
      measuring = false
    }
  }

  /** Waar valt een moment van de telefoonteller op de eigen `uptimeMillis` (de klok van Handler.postAtTime)? `null` = geen geldige meting
   *  (te oud, te onnauwkeurig, of één van beide toestellen is intussen herstart) — dan rekent de aanroeper zoals vroeger. */
  fun phoneMonoToUptime(context: Context, phoneMono: Long, phoneBootWall: Long): Long? {
    if (phoneMono <= 0L) return null
    val p = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    if (!p.contains(KEY_MONO_OFF)) return null
    val nowEl = SystemClock.elapsedRealtime()
    val at = p.getLong(KEY_MONO_AT, -1L)
    val watchBoot = System.currentTimeMillis() - nowEl
    val sleptNow = nowEl - SystemClock.uptimeMillis()
    val why = when {
      at < 0L || at > nowEl -> "watch restarted"
      kotlin.math.abs(sleptNow - p.getLong(KEY_SLEPT, Long.MIN_VALUE / 2)) > SLEEP_TOLERANCE_MS -> "watch slept since the measurement"
      nowEl - at > MONO_MAX_AGE_MS -> "too old (${(nowEl - at) / 1000}s)"
      p.getLong(KEY_MONO_RTT, Long.MAX_VALUE) > MONO_MAX_RTT_MS -> "rtt ${p.getLong(KEY_MONO_RTT, -1L)}ms"
      kotlin.math.abs(p.getLong(KEY_WATCH_BOOT, watchBoot) - watchBoot) > BOOT_TOLERANCE_MS -> "watch boot changed"
      phoneBootWall > 0L && kotlin.math.abs(p.getLong(KEY_PHONE_BOOT, phoneBootWall) - phoneBootWall) > BOOT_TOLERANCE_MS -> "phone restarted"
      else -> null
    }
    if (why != null) {
      VzLog.d("clock mono unusable: $why")
      return null
    }
    val watchEl = phoneMono + p.getLong(KEY_MONO_OFF, 0L)
    return watchEl - (nowEl - SystemClock.uptimeMillis())
  }

  /** Bewaar het tellerverschil uit de snelste rondreizen (mediaan). Een slechtere meting vervangt een betere niet zolang die nog geldt (niet
   *  ouder dan 10 min én het horloge sliep sindsdien niet). */
  private fun storeMono(app: Context, monoPicked: List<Triple<Long, Long, Long>>) {
    if (monoPicked.isEmpty()) return
    val best = monoPicked[0].first
    val close = monoPicked.filter { it.first <= best + 20L }.take(5)
    val off = close.map { it.second }.sorted()[close.size / 2]
    VzLog.d("clock mono samples=" + close.joinToString { "${it.first}:${it.second - off}" })
    val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val nowEl = SystemClock.elapsedRealtime()
    val sleptNow = nowEl - SystemClock.uptimeMillis()
    val prevAt = prefs.getLong(KEY_MONO_AT, -1L)
    val prevRtt = prefs.getLong(KEY_MONO_RTT, Long.MAX_VALUE)
    val prevValid = prevAt in 0L..nowEl && nowEl - prevAt <= MONO_MAX_AGE_MS / 3 &&
      kotlin.math.abs(sleptNow - prefs.getLong(KEY_SLEPT, Long.MIN_VALUE / 2)) <= SLEEP_TOLERANCE_MS
    if (!prevValid || best <= prevRtt + 10L || best <= TRUSTED_RTT_MS) {
      prefs.edit()
        .putLong(KEY_MONO_OFF, off)
        .putLong(KEY_MONO_RTT, best)
        .putLong(KEY_MONO_AT, nowEl)
        .putLong(KEY_SLEPT, sleptNow)
        .putLong(KEY_PHONE_BOOT, monoPicked[0].third)
        .putLong(KEY_WATCH_BOOT, System.currentTimeMillis() - nowEl)
        .commit()
      VzLog.d("clock mono off=${off}ms rtt=${best}ms n=${close.size}/${monoPicked.size}")
    } else {
      VzLog.d("clock mono kept (rtt ${best}ms not better than ${prevRtt}ms)")
    }
  }

  /** Meet METEEN, vlak vóór een start (PREPARE / breath-start): 6 snelle pings, klaar zodra ze terug zijn of na 700 ms. `done` loopt altijd
   *  (ook zonder telefoon of antwoorden) op de hoofdthread. */
  fun measureNow(context: Context, done: () -> Unit) {
    val app = context.applicationContext
    VzLog.init(app)
    val client = Wearable.getMessageClient(app)
    val sent = HashMap<Long, Long>()
    val got = ArrayList<Triple<Long, Long, Long>>()
    var finished = false
    lateinit var listener: MessageClient.OnMessageReceivedListener
    val finish = Runnable {
      if (finished) return@Runnable
      finished = true
      try { client.removeListener(listener) } catch (_: Exception) {}
      val picked = synchronized(got) { got.sortedBy { it.first } }
      VzLog.d("clock start-measure answers=${picked.size} bestRtt=${picked.firstOrNull()?.first}")
      storeMono(app, picked)
      done()
    }
    listener = MessageClient.OnMessageReceivedListener { e: MessageEvent ->
      if (e.path != PATH_PONG) return@OnMessageReceivedListener
      val m1 = SystemClock.elapsedRealtime()
      try {
        val parts = String(e.data, Charsets.UTF_8).split(',')
        val seq = parts[0].toLong()
        val phone = parts[1].toLong()
        val phoneMono = parts.getOrNull(2)?.toLongOrNull() ?: return@OnMessageReceivedListener
        val m0 = synchronized(sent) { sent.remove(seq) } ?: return@OnMessageReceivedListener
        val all = synchronized(got) {
          got.add(Triple(m1 - m0, (m0 + m1) / 2 - phoneMono, phone - phoneMono))
          got.size
        }
        if (all >= START_PINGS) main.post(finish)
      } catch (_: Exception) {
      }
    }
    try {
      client.addListener(listener)
      Wearable.getNodeClient(app).connectedNodes
        .addOnSuccessListener { nodes ->
          val node = nodes.firstOrNull { it.isNearby } ?: nodes.firstOrNull()
          if (node == null) { main.post(finish); return@addOnSuccessListener }
          for (i in 0 until START_PINGS) {
            main.postDelayed({
              if (finished) return@postDelayed
              val seq = nextSeq++
              synchronized(sent) { sent[seq] = SystemClock.elapsedRealtime() }
              try { client.sendMessage(node.id, PATH_PING, seq.toString().toByteArray(Charsets.UTF_8)) } catch (_: Exception) {}
            }, i * START_PING_GAP_MS)
          }
        }
        .addOnFailureListener { main.post(finish) }
    } catch (_: Exception) {
      main.post(finish)
      return
    }
    main.postDelayed(finish, START_MEASURE_MAX_MS)
  }

  private const val START_PINGS = 6
  private const val START_PING_GAP_MS = 30L
  private const val START_MEASURE_MAX_MS = 700L

  private fun run(app: Context, nodeId: String) {
    val client = Wearable.getMessageClient(app)
    val samples = ArrayList<Pair<Long, Long>>() // (rtt op de eigen teller, ahead)
    val monoSamples = ArrayList<Triple<Long, Long, Long>>() // (rtt, horlogeteller − telefoonteller, telefoon-opstartmoment)
    var pongs = 0
    /* 29 okt 2026: elk ping krijgt een UNIEK volgnummer (de telefoon stuurt het ongewijzigd terug). Vroeger was de sleutel de wandklok van het
       horloge; die verspringt op een Galaxy Watch4 (gemeten 155 ms in 2,5 min), waardoor een antwoord aan het verkeerde ping kon hangen: een
       "snelle" rondreis met een verschil dat 443 ms naast de werkelijkheid lag (gemeten met de tellers van beide toestellen via adb). */
    val sent = HashMap<Long, Pair<Long, Long>>() // volgnummer → (eigen teller, wandklok) bij versturen
    val listener = MessageClient.OnMessageReceivedListener { e: MessageEvent ->
      if (e.path != PATH_PONG) return@OnMessageReceivedListener
      val t1 = System.currentTimeMillis()
      try {
        val parts = String(e.data, Charsets.UTF_8).split(',')
        val seq = parts[0].toLong()
        val phone = parts[1].toLong()
        val m1 = SystemClock.elapsedRealtime()
        val s0 = synchronized(sent) { sent.remove(seq) } ?: return@OnMessageReceivedListener // niet van deze meting, of een dubbel antwoord
        val (m0, t0) = s0
        /* De rondreis op de EIGEN teller: een wandklok die tussen versturen en ontvangen springt, vervalst anders ook de reistijd. */
        val rtt = m1 - m0
        VzLog.d("clock pong seq=$seq rtt=$rtt t0=$t0 t1=$t1 m0=$m0 m1=$m1 phone=$phone phoneMono=${parts.getOrNull(2)}")
        synchronized(samples) { pongs++ }
        if (rtt in 0..MAX_RTT_MS) synchronized(samples) { samples.add(rtt to ((t0 + t1) / 2 - phone)) }
        /* Nieuwe telefoon-app: ook zijn teller (derde getal). */
        val phoneMono = parts.getOrNull(2)?.toLongOrNull()
        if (phoneMono != null && rtt >= 0L) {
          synchronized(samples) { monoSamples.add(Triple(rtt, (m0 + m1) / 2 - phoneMono, phone - phoneMono)) }
        }
      } catch (_: Exception) {
      }
    }
    try {
      client.addListener(listener)
    } catch (_: Exception) {
      measuring = false
      return
    }
    for (i in 0 until PINGS) {
      main.postDelayed({
        try {
          val seq = nextSeq++
          synchronized(sent) { sent[seq] = SystemClock.elapsedRealtime() to System.currentTimeMillis() }
          client.sendMessage(nodeId, PATH_PING, seq.toString().toByteArray(Charsets.UTF_8))
        } catch (_: Exception) {
        }
      }, i * PING_GAP_MS)
    }
    main.postDelayed({
      try {
        client.removeListener(listener)
      } catch (_: Exception) {
      }
      val monoPicked = synchronized(samples) { monoSamples.sortedBy { it.first } }
      VzLog.d("clock pongs=${synchronized(samples) { pongs }} usable=${synchronized(samples) { samples.size }} mono=${monoPicked.size} bestRtt=${monoPicked.firstOrNull()?.first}")
      storeMono(app, monoPicked)
      val picked = synchronized(samples) { samples.sortedBy { it.first } }
      if (picked.isNotEmpty()) {
        /* Enkel de snelste rondreizen (binnen 20 ms van de beste), de MEDIAAN daarvan: één uitschieter telt niet. */
        val bestRtt = picked[0].first
        val close = picked.filter { it.first <= bestRtt + 20L }.take(5)
        val ahead = close.map { it.second }.sorted()[close.size / 2]
        val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val hadFresh = prefs.getLong(KEY_AT, 0L) > 0L && System.currentTimeMillis() - prefs.getLong(KEY_AT, 0L) <= MAX_AGE_MS
        val prevRtt = prefs.getLong(KEY_RTT, Long.MAX_VALUE)
        /* Een trage meting (alle rondreizen langzaam) vervangt een eerdere, betere niet: het klokverschil verandert maar traag. */
        if (bestRtt <= TRUSTED_RTT_MS || !hadFresh || bestRtt <= prevRtt) {
          prefs.edit()
            .putLong(KEY_AHEAD, ahead)
            .putLong(KEY_RTT, bestRtt)
            .putLong(KEY_ONEWAY, (bestRtt / 2).coerceIn(10L, 400L))
            .putLong(KEY_AT, System.currentTimeMillis())
            .apply()
          VzLog.d("clock ahead=${ahead}ms rtt=${bestRtt}ms n=${close.size}/${picked.size}")
        } else {
          VzLog.d("clock kept (new ahead=${ahead}ms rtt=${bestRtt}ms not better than ${prevRtt}ms)")
        }
      }
      measuring = false
    }, PINGS * PING_GAP_MS + COLLECT_MS)
  }
}
