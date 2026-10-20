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
  private const val PINGS = 5
  private const val PING_GAP_MS = 120L
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
    var best: Pair<Long, Long>? = null // (rtt, ahead)
    val listener = MessageClient.OnMessageReceivedListener { e: MessageEvent ->
      if (e.path != PATH_PONG) return@OnMessageReceivedListener
      val t1 = System.currentTimeMillis()
      try {
        val parts = String(e.data, Charsets.UTF_8).split(',')
        val t0 = parts[0].toLong()
        val phone = parts[1].toLong()
        val rtt = t1 - t0
        if (rtt in 0..MAX_RTT_MS) {
          val ahead = (t0 + t1) / 2 - phone
          val b = best
          if (b == null || rtt < b.first) best = rtt to ahead
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
          val t0 = System.currentTimeMillis()
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
      best?.let { (rtt, ahead) ->
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
          .putLong(KEY_AHEAD, ahead)
          .putLong(KEY_RTT, rtt)
          .putLong(KEY_AT, System.currentTimeMillis())
          .apply()
        VzLog.d("clock ahead=${ahead}ms rtt=${rtt}ms")
      }
      measuring = false
    }, PINGS * PING_GAP_MS + COLLECT_MS)
  }
}
