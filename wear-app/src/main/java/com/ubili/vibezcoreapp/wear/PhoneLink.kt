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
  /** 27 okt 2026: het horloge vraagt de catalogus ACTIEF op (een bewaard data-item wordt soms niet afgeleverd als de app niet draait). */
  const val PATH_CATALOG_REQUEST = "/vibezcore/catalog/request"
  const val PATH_CATALOG_REPLY = "/vibezcore/catalog/reply"

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

  fun requestCatalog(context: Context) {
    send(context, PATH_CATALOG_REQUEST, ByteArray(0))
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
