package com.ubili.vibezcoreapp.wear

/* Horloge → telefoon: één bericht naar alle verbonden knopen (in de
   praktijk precies de gekoppelde telefoon). Faalt altijd stil — een
   telefoon die even weg is mag het ritme op de pols nooit raken. */

import android.content.Context
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject

object PhoneLink {
  const val PATH_STATE_ACK = "/vibezcore/state/ack"
  const val PATH_WATCH_ACTION = "/vibezcore/watch/action"

  fun send(context: Context, path: String, payload: ByteArray) {
    try {
      val app = context.applicationContext
      val messageClient = Wearable.getMessageClient(app)
      Wearable.getNodeClient(app).connectedNodes
        .addOnSuccessListener { nodes ->
          nodes.forEach { node ->
            try {
              messageClient.sendMessage(node.id, path, payload)
            } catch (_: Exception) {
            }
          }
        }
    } catch (_: Exception) {
      /* stil */
    }
  }

  /** `action` = "pause" | "resume" | "stop", `kind` = "bracelet" | "breath". */
  fun sendWatchAction(context: Context, action: String, kind: String) {
    val json = JSONObject().apply {
      put("action", action)
      put("kind", kind)
    }
    send(context, PATH_WATCH_ACTION, json.toString().toByteArray(Charsets.UTF_8))
  }
}
