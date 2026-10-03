package com.ubili.vibezcoreapp.wear

/* Ontvangt de twee berichten die WearBreathModule.kt (telefoon-kant) kan
   sturen, en zet ze meteen door naar de Service die de lus écht draait.
   Logica-loos — zelfde verdeling als BreathListenerService/
   BreathSessionService op de telefoon-kant van deze module. */

import android.content.Intent
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

private const val PATH_START = "/vibezcore/breath/start"
private const val PATH_STOP = "/vibezcore/breath/stop"

class BreathListenerService : WearableListenerService() {
  override fun onMessageReceived(event: MessageEvent) {
    try {
      when (event.path) {
        PATH_START -> {
          val json = String(event.data, Charsets.UTF_8)
          val intent = Intent(this, WearBreathSessionService::class.java).apply {
            action = WearBreathSessionService.ACTION_START
            putExtra(WearBreathSessionService.EXTRA_SESSION_JSON, json)
          }
          startForegroundService(intent)
        }
        PATH_STOP -> {
          val intent = Intent(this, WearBreathSessionService::class.java).apply {
            action = WearBreathSessionService.ACTION_STOP
          }
          /* Gewone startService: de sessie-service draait op dit moment
             bijna altijd al als foreground-service (dit is het stop-
             signaal ervoor), dus er is al een geldige foreground-context.
             Komt dit bericht toch zonder actieve sessie binnen, dan vangt
             de catch hieronder een eventuele achtergrond-restrictie op —
             er is dan toch niets te stoppen. */
          startService(intent)
        }
      }
    } catch (_: Exception) {
      /* een stray/late bericht mag de listener-service nooit laten crashen */
    }
  }
}
