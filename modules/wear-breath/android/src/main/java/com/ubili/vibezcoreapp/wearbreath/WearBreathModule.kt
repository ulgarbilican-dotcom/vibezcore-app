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
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
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
) : Record

/** Lichtgewicht, periodiek te hersturen status voor Instant State Control
 *  (bracelet) — zie WatchBraceletStatus in wear-breath/index.ts. */
class WearBraceletStatus(
  @Field val title: String = "",
  @Field val colorHex: String = "#B478FF",
  @Field val remainingMinutes: Int = 0,
  @Field val paused: Boolean = false,
  @Field val active: Boolean = false,
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
) : Record

private const val PATH_BREATH_START = "/vibezcore/breath/start"
private const val PATH_BREATH_STOP = "/vibezcore/breath/stop"
private const val PATH_BREATH_PAUSE = "/vibezcore/breath/pause"
private const val PATH_BRACELET_STATUS = "/vibezcore/bracelet/status"
private const val PATH_BRACELET_STOP = "/vibezcore/bracelet/stop"
private const val PATH_WATCH_ACTION = "/vibezcore/watch/action"
private const val PATH_STATE_START = "/vibezcore/state/start"
private const val PATH_STATE_PAUSE = "/vibezcore/state/pause"
private const val PATH_STATE_STOP = "/vibezcore/state/stop"
private const val PATH_STATE_ACK = "/vibezcore/state/ack"

class WearBreathModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val messageListener = MessageClient.OnMessageReceivedListener { event: MessageEvent ->
    try {
      when (event.path) {
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
      }
    } catch (_: Exception) {
      /* een kapot bericht van het horloge mag de telefoon-app niet raken */
    }
  }

  override fun definition() = ModuleDefinition {
    Name("WearBreath")

    Events("onWatchAction", "onStateAck")

    OnCreate {
      Wearable.getMessageClient(context).addListener(messageListener)
    }

    OnDestroy {
      Wearable.getMessageClient(context).removeListener(messageListener)
    }

    AsyncFunction("isWatchReachable") { promise: Promise ->
      Wearable.getNodeClient(context).connectedNodes
        .addOnSuccessListener { nodes -> promise.resolve(nodes.isNotEmpty()) }
        .addOnFailureListener { promise.resolve(false) }
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

    Function("sendBraceletStatus") { status: WearBraceletStatus ->
      val payload = JSONObject().apply {
        put("title", status.title)
        put("colorHex", status.colorHex)
        put("remainingMinutes", status.remainingMinutes)
        put("paused", status.paused)
        put("active", status.active)
      }
      broadcast(PATH_BRACELET_STATUS, payload.toString().toByteArray(Charsets.UTF_8))
    }

    Function("stopBraceletRelay") {
      broadcast(PATH_BRACELET_STOP, ByteArray(0))
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
      }
      broadcast(PATH_STATE_START, payload.toString().toByteArray(Charsets.UTF_8))
    }

    Function("pauseStateSession") {
      broadcast(PATH_STATE_PAUSE, ByteArray(0))
    }

    Function("stopStateSession") {
      broadcast(PATH_STATE_STOP, ByteArray(0))
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
    }
  }

  /* Naar ALLE verbonden knopen — in de praktijk precies het ene gekoppelde
     horloge. Geen enkele node mag de telefoon-sessie zelf kunnen breken,
     dus dit faalt altijd stil (`sendMessage` zelf gooit niet, en een lege
     nodes-lijst is gewoon "geen horloge gekoppeld", geen fout). */
  private fun broadcast(path: String, payload: ByteArray) {
    try {
      val messageClient = Wearable.getMessageClient(context)
      Wearable.getNodeClient(context).connectedNodes
        .addOnSuccessListener { nodes ->
          nodes.forEach { node -> messageClient.sendMessage(node.id, path, payload) }
        }
    } catch (_: Exception) {
      /* geen Play Services / geen context: stil, zoals beloofd */
    }
  }
}
