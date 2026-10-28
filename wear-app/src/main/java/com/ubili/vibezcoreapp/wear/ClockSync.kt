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
    val now = System.currentTimeMillis()
    if (measuring || now - lastStartAt < MIN_INTERVAL_MS) return
    measuring = true
    lastStartAt = now
    try {
      Wearable.getNodeClient(app).connectedNodes
        .addOnSuccessListener { nodes ->
          val node = nodes.firstOrNull { it.isNearby } ?: nodes.firstOrNull()
          if (node == null) {
            measuring = false
            return@addOnSuccessListener
          }
          run(app, node.id)
        }
        .addOnFailureListener { measuring = false }
    } catch (_: Exception) {
      measuring = false
    }
  }

  private fun run(app: Context, nodeId: String) {
    val client = Wearable.getMessageClient(app)
    val samples = ArrayList<Pair<Long, Long>>() // (rtt op de eigen teller, ahead)
    val monoAt = HashMap<Long, Long>() // t0 (wandklok) → t0 op de eigen teller
    val listener = MessageClient.OnMessageReceivedListener { e: MessageEvent ->
      if (e.path != PATH_PONG) return@OnMessageReceivedListener
      val t1 = System.currentTimeMillis()
      try {
        val parts = String(e.data, Charsets.UTF_8).split(',')
        val t0 = parts[0].toLong()
        val phone = parts[1].toLong()
        val m1 = SystemClock.elapsedRealtime()
        val m0 = synchronized(monoAt) { monoAt[t0] }
        /* De rondreis op de EIGEN teller: een wandklok die tussen versturen en ontvangen springt, vervalst anders ook de reistijd. */
        val rtt = if (m0 != null) m1 - m0 else t1 - t0
        if (rtt in 0..MAX_RTT_MS) synchronized(samples) { samples.add(rtt to ((t0 + t1) / 2 - phone)) }
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
          val t0 = System.currentTimeMillis()
          synchronized(monoAt) { monoAt[t0] = SystemClock.elapsedRealtime() }
          client.sendMessage(nodeId, PATH_PING, t0.toString().toByteArray(Charsets.UTF_8))
        } catch (_: Exception) {
        }
      }, i * PING_GAP_MS)
    }
    main.postDelayed({
      try {
        client.removeListener(listener)
      } catch (_: Exception) {
      }
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
