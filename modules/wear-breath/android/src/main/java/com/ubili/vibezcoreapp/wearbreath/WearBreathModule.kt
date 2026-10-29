package com.ubili.vibezcoreapp.wearbreath

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — De brug tussen telefoon en een gekoppelde Wear OS-horloge.

   Twee richtingen:
   1. Telefoon → Horloge: volledige breathwork-sessie (fasen + hun haptic-
      patroon, zoals phaseHapticPattern() in breath-haptics.ts ze al
      berekent) in ÉÉN bericht — horloge draait de lus daarna zelf, los van
      BLE/WiFi-verbinding (zelfde autonomie-filosofie als de bracelet, spec
      §8). ÓF periodieke bracelet-status (kleur/naam/resterende tijd/
      paused) voor Instant State Control — daar draait de ECHTE sessie op
      de bracelet-hardware, het horloge toont enkel.
   2. Horloge → Telefoon (NIEUW, 4 okt 2026): een tik op Pause/Resume/Stop
      op het horloge. Komt hier binnen als `onWatchAction`-event; JS
      (breath-session.tsx/bracelet-control.tsx) beslist wat dat betekent. */

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.wear.remote.interactions.RemoteActivityHelper
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataRequest
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONArray
import org.json.JSONObject

class WearBreathPhase(
  @Field val key: String = "",
  @Field val secs: Int = 0,
  /* Exact dezelfde array als phaseHapticPattern() op de telefoon teruggeeft
     — geen eigen vertaling hier, dat zou een tweede versie zijn die uit de
     pas kan lopen (zie breath-haptics.ts, slotopmerking). */
  @Field val pattern: List<Int> = emptyList(),
  /* Nose / Mouth / Left Nostril / Right Nostril — leeg bij vasthouden. */
  @Field val via: String = "",
) : Record

class WearBreathSession(
  @Field val phases: List<WearBreathPhase> = emptyList(),
  @Field val rounds: Int = 1,
  @Field val modeName: String = "Breathwork",
  /** Kleur van de toestand, voor de cirkel op het horloge (6 okt 2026). */
  @Field val colorHex: String = "#00A3A3",
  /* Hervatten (6 okt 2026): waar in de sessie het horloge verder moet —
     ronde (1-based), fase-index en wat er van die fase nog over is
     (-1 = de fase begint vooraan, met zijn trilpatroon). */
  @Field val startRound: Int = 1,
  @Field val startPhase: Int = 0,
  @Field val phaseRemainingMs: Int = -1,
  /* Date.now() van de telefoon bij versturen (13 okt 2026): het horloge
     trekt de Bluetooth-vertraging van de eerste fase af. */
  @Field val sentAtMs: Double = 0.0,
  /* Trilkracht 0–255 (0 = standaard van het horloge), 13 okt 2026. */
  @Field val amp: Int = 0,
) : Record

/** State Control-sessie voor het horloge — velden exact zoals `state-start`
 *  in docs/WATCH_PROTOCOL.md. Het horloge rekent het ritme zelf uit. */
class WearStateSessionStart(
  @Field val title: String = "",
  @Field val colorHex: String = "#00A3A3",
  /** Rusthartslag van de gebruiker = begintempo ("Match your rhythm"). */
  @Field val startBpm: Double = 75.0,
  @Field val targetBpm: Double = 75.0,
  @Field val holdSec: Double = 10.0,
  @Field val rampSec: Double = 0.0,
  @Field val curveOffsetSec: Double = 0.0,
  @Field val remainingSec: Double = 0.0,
  @Field val lubAmp: Int = 45,
  @Field val dubAmp: Int = 32,
  @Field val lubMsNoAmp: Int = 50,
  @Field val dubMsNoAmp: Int = 40,
  /* 13 okt 2026: deze velden kwamen uit JS maar werden hier nooit
     doorgestuurd — het horloge kreeg dus nooit de tiklengtes. */
  @Field val lubMs: Int = 0,
  @Field val dubMs: Int = 0,
  /** Telefoonklok bij verzenden: het horloge trekt de Bluetooth-vertraging
   *  af (operator: "2 sec achterstand op de watch"). */
  @Field val sentAtMs: Double = 0.0,
) : Record

private const val PATH_BREATH_START = "/vibezcore/breath/start"
private const val PATH_BREATH_STOP = "/vibezcore/breath/stop"
private const val PATH_BREATH_PAUSE = "/vibezcore/breath/pause"
private const val PATH_WATCH_ACTION = "/vibezcore/watch/action"
private const val PATH_STATE_START = "/vibezcore/state/start"
private const val PATH_STATE_PAUSE = "/vibezcore/state/pause"
private const val PATH_STATE_STOP = "/vibezcore/state/stop"
private const val PATH_STATE_ACK = "/vibezcore/state/ack"
/* 28 okt 2026 — samen starten, voor ELK horloge (operator: "telefoon start en wacht op smartwatch, beiden beginnen samen"): het (grote) sessiebericht
   gaat vooruit als PREPARE; het horloge maakt zich klaar en antwoordt READY; pas dan stuurt de telefoon het kleine GO ("begin over X ms") op een
   warme verbinding, en start zelf op hetzelfde moment. Geen kloktijden tussen de toestellen. */
private const val PATH_STATE_PREPARE = "/vibezcore/state/prepare"
private const val PATH_STATE_READY = "/vibezcore/state/ready"
private const val PATH_STATE_GO = "/vibezcore/state/go"
/* Gemeten: het PREPARE-bericht deed er soms 1,27 s over (trage Bluetooth-verbinding). Het GO-pad is nauwkeuriger dan het oude startbericht (klein
   bericht op een warme verbinding, ~0,03 s), dus liever langer wachten dan te vroeg terugvallen. Enkel een horloge dat helemaal zwijgt valt terug. */
private const val HANDSHAKE_TIMEOUT_MS = 3000L
private const val PREFS_HS = "vz_wear_handshake"
private const val KEY_HS_CAPABLE = "capable"
/** Wekt de horloge-app vooraf (17 okt 2026: een slapende app op de Watch4
 *  kreeg de voorproef pas ~20 s later). Het horloge doet er verder niets mee. */
private const val PATH_WAKE = "/vibezcore/state/wake"
/** 20 okt 2026 — klokmeting (wear-app ClockSync.kt): het horloge stuurt zijn
 *  klok, de telefoon antwoordt METEEN met "<horlogeklok>,<telefoonklok>".
 *  Zo kent elk horloge zijn eigen klokverschil met deze telefoon. */
private const val PATH_CLOCK_PING = "/vibezcore/clock/ping"
private const val PATH_CLOCK_PONG = "/vibezcore/clock/pong"

private const val WATCH_CAPABILITY = "vibezcore_watch_app"
/* 13 okt 2026 — het horloge zelfstandig: de telefoon zet de "catalogus"
   (toestanden, techniek, fasen, trilpatronen, sterkte, toegang) als BEWAARD
   gegeven klaar; het horloge krijgt hem ook als het even weg was. Sessies
   die op het horloge zelf gedaan zijn, laat het horloge achter onder
   /vibezcore/watchlog/… — de telefoon haalt ze op en wist ze. */
private const val PATH_CATALOG = "/vibezcore/catalog"
/** 27 okt 2026: het horloge vraagt de catalogus ACTIEF op; de telefoon antwoordt met een bericht (data-items worden soms niet afgeleverd als de horloge-app niet draait). */
private const val PATH_CATALOG_REQUEST = "/vibezcore/catalog/request"
private const val PATH_CATALOG_REPLY = "/vibezcore/catalog/reply"
/** De laatst door JS gestuurde catalogus, om op een verzoek meteen te kunnen antwoorden. */
@Volatile private var lastCatalogJson: String? = null
private const val PATH_WATCHLOG = "/vibezcore/watchlog"

class WearBreathModule : Module() {
  companion object {
    /** Een horloge-app die PREPARE/READY/GO kent (meldt zich met "hs1" in het catalogus-verzoek). */
    @Volatile var handshakeCapable = false
  }

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private class Pending(val id: Long, val anchorWallMs: Long)
  @Volatile private var pending: Pending? = null
  private val handler = android.os.Handler(android.os.Looper.getMainLooper())
  @Volatile private var warmOn = false
  private val warmTick = object : Runnable {
    override fun run() {
      if (!warmOn) return
      broadcast(PATH_WAKE, ByteArray(0), quiet = true)
      handler.postDelayed(this, 1000L)
    }
  }

  private val messageListener = MessageClient.OnMessageReceivedListener { event: MessageEvent ->
    try {
      when (event.path) {
        PATH_CATALOG_REQUEST -> {
          /* Een horloge-app die de handdruk kent meldt dat in dit verzoek ("hs1"). */
          if (String(event.data, Charsets.UTF_8) == "hs1") {
            handshakeCapable = true
            try { context.getSharedPreferences(PREFS_HS, Context.MODE_PRIVATE).edit().putBoolean(KEY_HS_CAPABLE, true).apply() } catch (_: Exception) {}
          }
          lastCatalogJson?.let { json ->
            Wearable.getMessageClient(context).sendMessage(event.sourceNodeId, PATH_CATALOG_REPLY, json.toByteArray(Charsets.UTF_8))
          }
        }
        PATH_CLOCK_PING -> {
          val phoneNow = System.currentTimeMillis()
          /* 29 okt 2026: ook de teller van de telefoon (springt nooit) — het horloge meet daarmee de verhouding tussen beide tellers.
             Een oudere horloge-app leest enkel de eerste twee getallen. */
          val reply = "${String(event.data, Charsets.UTF_8)},$phoneNow,${android.os.SystemClock.elapsedRealtime()}".toByteArray(Charsets.UTF_8)
          Wearable.getMessageClient(context).sendMessage(event.sourceNodeId, PATH_CLOCK_PONG, reply)
        }
        PATH_WATCH_ACTION -> {
          val json = JSONObject(String(event.data, Charsets.UTF_8))
          val action = json.optString("action", "")
          val kind = json.optString("kind", "")
          if (action.isEmpty() || kind.isEmpty()) return@OnMessageReceivedListener
          sendEvent("onWatchAction", mapOf("action" to action, "kind" to kind))
        }
        /* Het horloge speelt State Control echt af → JS legt de eigen
           trilling op de telefoon stil (WATCH_PROTOCOL §3). */
        PATH_STATE_ACK -> sendEvent("onStateAck", emptyMap<String, Any>())
        /* Het horloge staat klaar: nu het kleine GO, met hoeveel ms er nog te wachten is tot het startmoment van de telefoon. */
        PATH_STATE_READY -> {
          val id = String(event.data, Charsets.UTF_8).trim().toLongOrNull()
          val p = pending
          if (id != null && p != null && p.id == id) {
            pending = null
            val wall = System.currentTimeMillis()
            val mono = android.os.SystemClock.elapsedRealtime()
            val startInMs = p.anchorWallMs - wall
            /* 29 okt 2026: het startmoment ook op de teller van de telefoon (zie stampLead). */
            val go = JSONObject().put("id", id).put("startInMs", startInMs)
              .put("anchorMono", p.anchorWallMs - wall + mono).put("phoneBootWall", wall - mono)
              .toString().toByteArray(Charsets.UTF_8)
            Wearable.getMessageClient(context).sendMessage(event.sourceNodeId, PATH_STATE_GO, go)
            android.util.Log.d("VZSend", "$PATH_STATE_GO sent=${System.currentTimeMillis()} startInMs=$startInMs")
          }
        }
      }
    } catch (_: Exception) {
      /* een kapot bericht van het horloge mag de telefoon-app niet raken */
    }
  }

  override fun definition() = ModuleDefinition {
    Name("WearBreath")

    Events("onWatchAction", "onStateAck")

    OnCreate {
      /* Een horloge-app die de handdruk ooit meldde blijft die kennen, ook na een herstart van de telefoon-app. */
      try { if (context.getSharedPreferences(PREFS_HS, Context.MODE_PRIVATE).getBoolean(KEY_HS_CAPABLE, false)) handshakeCapable = true } catch (_: Exception) {}
      Wearable.getMessageClient(context).addListener(messageListener)
    }

    OnDestroy {
      Wearable.getMessageClient(context).removeListener(messageListener)
    }

    /* 12 okt 2026 (operator: "gebruikers mogen niet sukkelen"): wat het
       horloge doet, in één woord voor de statusregel op de telefoon.
         "none"       → geen horloge verbonden;
         "noApp"      → wel een horloge, maar zonder VIBEZCORE;
         "ready"      → horloge mét VIBEZCORE, alles werkt.
       De horloge-app meldt zich via de capability "vibezcore_watch_app"
       (wear-app/src/main/res/values/wear.xml). */
    AsyncFunction("watchStatus") { promise: Promise ->
      Wearable.getNodeClient(context).connectedNodes
        .addOnSuccessListener { nodes ->
          if (nodes.isEmpty()) {
            promise.resolve(mapOf("status" to "none", "name" to ""))
            return@addOnSuccessListener
          }
          val watch = nodes.first()
          Wearable.getCapabilityClient(context)
            .getCapability(WATCH_CAPABILITY, CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener { info ->
              val hasApp = info.nodes.isNotEmpty()
              val name = (info.nodes.firstOrNull() ?: watch).displayName ?: ""
              promise.resolve(mapOf("status" to (if (hasApp) "ready" else "noApp"), "name" to name))
            }
            .addOnFailureListener { promise.resolve(mapOf("status" to "noApp", "name" to (watch.displayName ?: ""))) }
        }
        .addOnFailureListener { promise.resolve(mapOf("status" to "none", "name" to "")) }
    }

    /* Opent de Play Store OP HET HORLOGE bij VIBEZCORE — één tik op de
       telefoon, de gebruiker bevestigt op zijn pols. */
    AsyncFunction("openStoreOnWatch") { promise: Promise ->
      Wearable.getNodeClient(context).connectedNodes
        .addOnSuccessListener { nodes ->
          val node = nodes.firstOrNull()
          if (node == null) {
            promise.resolve(false)
            return@addOnSuccessListener
          }
          try {
            val intent = Intent(Intent.ACTION_VIEW)
              .addCategory(Intent.CATEGORY_BROWSABLE)
              .setData(Uri.parse("market://details?id=" + context.packageName))
            RemoteActivityHelper(context).startRemoteActivity(intent, node.id)
            promise.resolve(true)
          } catch (_: Exception) {
            promise.resolve(false)
          }
        }
        .addOnFailureListener { promise.resolve(false) }
    }

    AsyncFunction("isWatchReachable") { promise: Promise ->
      Wearable.getNodeClient(context).connectedNodes
        .addOnSuccessListener { nodes -> promise.resolve(nodes.isNotEmpty()) }
        .addOnFailureListener { promise.resolve(false) }
    }

    Function("syncCatalog") { json: String ->
      lastCatalogJson = json
      try {
        val req = PutDataRequest.create(PATH_CATALOG)
          .setData(json.toByteArray(Charsets.UTF_8))
          .setUrgent()
        Wearable.getDataClient(context).putDataItem(req)
      } catch (_: Exception) {
        /* geen horloge / geen Play Services: niets te doen */
      }
    }

    /** Sessies die op het horloge gedaan zijn (JSON-strings), en meteen
     *  gewist zodat ze nooit dubbel in de geschiedenis komen. */
    AsyncFunction("takeWatchSessions") { promise: Promise ->
      try {
        val client = Wearable.getDataClient(context)
        client.getDataItems(Uri.parse("wear://*$PATH_WATCHLOG"), com.google.android.gms.wearable.DataClient.FILTER_PREFIX)
          .addOnSuccessListener { buffer ->
            val out = ArrayList<String>()
            try {
              for (item in buffer) {
                val data = item.data ?: continue
                out.add(String(data, Charsets.UTF_8))
                client.deleteDataItems(item.uri)
              }
            } finally {
              buffer.release()
            }
            promise.resolve(out)
          }
          .addOnFailureListener { promise.resolve(emptyList<String>()) }
      } catch (_: Exception) {
        promise.resolve(emptyList<String>())
      }
    }

    Function("sendBreathSession") { session: WearBreathSession ->
      broadcast(PATH_BREATH_START, toJson(session).toString().toByteArray(Charsets.UTF_8))
    }

    Function("pauseBreathSession") {
      broadcast(PATH_BREATH_PAUSE, ByteArray(0))
    }

    Function("stopBreathSession") {
      broadcast(PATH_BREATH_STOP, ByteArray(0))
    }

    /* ── State Control op de pols (docs/WATCH_PROTOCOL.md) ─────────────── */

    Function("sendStateSession") { start: WearStateSessionStart ->
      val payload = JSONObject().apply {
        put("title", start.title)
        put("colorHex", start.colorHex)
        put("startBpm", start.startBpm)
        put("targetBpm", start.targetBpm)
        put("holdSec", start.holdSec)
        put("rampSec", start.rampSec)
        put("curveOffsetSec", start.curveOffsetSec)
        put("remainingSec", start.remainingSec)
        put("lubAmp", start.lubAmp)
        put("dubAmp", start.dubAmp)
        put("lubMsNoAmp", start.lubMsNoAmp)
        put("dubMsNoAmp", start.dubMsNoAmp)
        if (start.lubMs > 0) put("lubMs", start.lubMs)
        if (start.dubMs > 0) put("dubMs", start.dubMs)
        put("sentAtMs", if (start.sentAtMs > 0) start.sentAtMs.toLong() else System.currentTimeMillis())
      }
      val anchor = payload.optLong("sentAtMs", 0L)
      if (handshakeCapable && anchor > 0L) {
        val id = System.nanoTime()
        pending = Pending(id, anchor)
        broadcast(PATH_STATE_PREPARE, JSONObject(payload.toString()).put("hsId", id).toString().toByteArray(Charsets.UTF_8))
        /* Antwoordt het horloge niet (uit het bereik, de app door het systeem gestopt), dan toch het gewone startbericht — het horloge sluit
           dan aan op de plek waar de telefoon is, zoals vroeger. */
        handler.postDelayed({
          if (pending?.id == id) {
            pending = null
            broadcast(PATH_STATE_START, payload.toString().toByteArray(Charsets.UTF_8))
          }
        }, HANDSHAKE_TIMEOUT_MS)
      } else {
        broadcast(PATH_STATE_START, payload.toString().toByteArray(Charsets.UTF_8))
      }
    }

    Function("pauseStateSession") {
      pending = null
      broadcast(PATH_STATE_PAUSE, ByteArray(0))
    }

    Function("stopStateSession") {
      pending = null
      broadcast(PATH_STATE_STOP, ByteArray(0))
    }

    /* 28 okt 2026: een eerste bericht over een slapende Bluetooth-verbinding doet er 0,4–0,6 s over (gemeten: PREPARE → READY ruim 1 s),
       een bericht op een wakkere verbinding ~50 ms. Zolang het State Control-scherm open is sturen we daarom elke seconde een leeg tikje,
       zodat de handdruk bij de start snel is. Gestopt zodra het scherm sluit. */
    Function("keepLinkWarm") { on: Boolean ->
      warmOn = on
      handler.removeCallbacks(warmTick)
      if (on) handler.post(warmTick)
    }

    Function("wakeWatch") {
      broadcast(PATH_WAKE, ByteArray(0))
    }
  }

  private fun toJson(session: WearBreathSession): JSONObject {
    val phasesArr = JSONArray()
    session.phases.forEach { p ->
      phasesArr.put(
        JSONObject().apply {
          put("key", p.key)
          put("secs", p.secs)
          put("pattern", JSONArray(p.pattern))
          put("via", p.via)
        },
      )
    }
    return JSONObject().apply {
      put("phases", phasesArr)
      put("rounds", session.rounds)
      put("modeName", session.modeName)
      put("colorHex", session.colorHex)
      put("startRound", session.startRound)
      put("startPhase", session.startPhase)
      put("phaseRemainingMs", session.phaseRemainingMs)
      put("sentAtMs", session.sentAtMs.toLong())
      put("amp", session.amp)
    }
  }

  /* Naar ALLE verbonden knopen — in de praktijk precies het ene gekoppelde
     horloge. Geen enkele node mag de telefoon-sessie zelf kunnen breken,
     dus dit faalt altijd stil (`sendMessage` zelf gooit niet, en een lege
     nodes-lijst is gewoon "geen horloge gekoppeld", geen fout). */
  /* 28 okt 2026 (operator: het moet voor ELK horloge van elke abonnee kloppen): de wandklok van sommige horloges springt (gemeten op een
     Galaxy Watch4: seconden heen en weer), dus een kloktijd van de telefoon is voor het horloge onbruikbaar. Bij een startbericht zet de
     telefoon daarom op het ECHTE verzendmoment erbij hoeveel ms vóór (+) of na (−) het verzonden startmoment `sentAtMs` dat is: `leadMs`.
     Het horloge rekent daarmee op zijn eigen teller, zonder de klok van de telefoon. */
  private fun stampLead(path: String, payload: ByteArray): ByteArray {
    if (path != PATH_STATE_START && path != PATH_BREATH_START && path != PATH_STATE_PREPARE) return payload
    return try {
      val j = JSONObject(String(payload, Charsets.UTF_8))
      val sentAt = j.optLong("sentAtMs", 0L)
      if (sentAt <= 0L) return payload
      val wall = System.currentTimeMillis()
      val mono = android.os.SystemClock.elapsedRealtime()
      j.put("leadMs", sentAt - wall)
      /* 29 okt 2026 (operator: "een vaste formule, het moet consistent werken"): gemeten deden berichten er 0,8–0,9 s over — wie de reistijd
         schat zat tot 0,85 s naast de telefoon. Daarom ook het startmoment op de TELLER van de telefoon (elapsedRealtime, springt nooit) en
         wanneer de telefoon opstartte; het horloge rekent dat met de gemeten verhouding tussen beide tellers om (wear-app ClockSync). */
      j.put("anchorMono", sentAt - wall + mono)
      j.put("phoneBootWall", wall - mono)
      j.toString().toByteArray(Charsets.UTF_8)
    } catch (_: Exception) {
      payload
    }
  }

  private fun broadcast(path: String, payload: ByteArray, quiet: Boolean = false) {
    try {
      val messageClient = Wearable.getMessageClient(context)
      Wearable.getNodeClient(context).connectedNodes
        .addOnSuccessListener { nodes ->
          nodes.forEach { node ->
            messageClient.sendMessage(node.id, path, stampLead(path, payload))
            /* Meting telefoon → horloge (17 okt 2026): verzendmoment. */
            if (!quiet) android.util.Log.d("VZSend", "$path sent=${System.currentTimeMillis()} node=${node.displayName}")
          }
        }
    } catch (_: Exception) {
      /* geen Play Services / geen context: stil, zoals beloofd */
    }
  }
}
