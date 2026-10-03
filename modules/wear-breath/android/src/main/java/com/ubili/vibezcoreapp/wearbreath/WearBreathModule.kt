package com.ubili.vibezcoreapp.wearbreath

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — De brug van de telefoon naar een gekoppelde Wear OS-horloge.

   Stuurt de VOLLEDIGE sessie (alle fasen + hun haptic-patroon, zoals
   phaseHapticPattern() in breath-haptics.ts ze al berekent) in ÉÉN bericht.
   Geen per-fase-tik over Bluetooth — dat gaf precies de latency/jitter die
   deze app overal elders als bug behandelt (zie breath-haptics.ts: "de
   haptiek moet het beeld en de stem exact volgen"). Het horloge draait de
   lus daarna volledig lokaal, los van de BLE-verbinding — dezelfde
   autonomie-filosofie als de bracelet (spec §8: verbindingsverlies stopt
   de sessie niet). */

import android.content.Context
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
) : Record

private const val PATH_START = "/vibezcore/breath/start"
private const val PATH_STOP = "/vibezcore/breath/stop"

class WearBreathModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("WearBreath")

    AsyncFunction("isWatchReachable") { promise: Promise ->
      Wearable.getNodeClient(context).connectedNodes
        .addOnSuccessListener { nodes -> promise.resolve(nodes.isNotEmpty()) }
        .addOnFailureListener { promise.resolve(false) }
    }

    Function("sendBreathSession") { session: WearBreathSession ->
      broadcast(PATH_START, toJson(session).toString().toByteArray(Charsets.UTF_8))
    }

    Function("stopBreathSession") {
      broadcast(PATH_STOP, ByteArray(0))
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
    }
  }

  /* Naar ALLE verbonden knopen — in de praktijk precies het ene gekoppelde
     horloge. Geen enkele node mag de telefoon-sessie zelf kunnen breken,
     dus dit faalt altijd stil (`sendMessage` zelf gooit niet, en een lege
     nodes-lijst is gewoon "geen horloge gekoppeld", geen fout). */
  private fun broadcast(path: String, payload: ByteArray) {
    val messageClient = Wearable.getMessageClient(context)
    Wearable.getNodeClient(context).connectedNodes
      .addOnSuccessListener { nodes ->
        nodes.forEach { node -> messageClient.sendMessage(node.id, path, payload) }
      }
  }
}
