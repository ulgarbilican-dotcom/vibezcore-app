package com.ubili.vibezcoreapp.wear

/* Ontvangt de berichten die WearBreathModule.kt (telefoon-kant) kan
   sturen, en zet ze meteen door naar de Service die de lus écht draait.
   Logica-loos — zelfde verdeling als BreathListenerService/
   BreathSessionService op de telefoon-kant van deze module. */

import android.content.Intent
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

private const val PATH_START = "/vibezcore/breath/start"
private const val PATH_STOP = "/vibezcore/breath/stop"
private const val PATH_PAUSE = "/vibezcore/breath/pause"
/* State Control (docs/WATCH_PROTOCOL.md) — zelfde doorgeefluik, andere
   service: WearStateSessionService speelt het ritme lokaal af. */
private const val PATH_STATE_START = "/vibezcore/state/start"
private const val PATH_STATE_PAUSE = "/vibezcore/state/pause"
private const val PATH_STATE_STOP = "/vibezcore/state/stop"

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
        PATH_PAUSE -> {
          /* Loopt er niets (al gepauzeerd), dan is er niets te doen. */
          if (WearBreathSessionService.instance == null) return
          startService(
            Intent(this, WearBreathSessionService::class.java).apply {
              action = WearBreathSessionService.ACTION_PAUSE
            },
          )
        }
        PATH_STOP -> {
          /* Gepauzeerd = geen lopende service: enkel het scherm terugzetten. */
          if (WearBreathSessionService.instance == null) {
            BreathSessionState.update(
              BreathSessionState.Snapshot("Waiting for phone…", "", 0, 0, running = false),
            )
            return
          }
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
        PATH_STATE_START -> {
          val json = String(event.data, Charsets.UTF_8)
          val intent = Intent(this, WearStateSessionService::class.java).apply {
            action = WearStateSessionService.ACTION_START
            putExtra(WearStateSessionService.EXTRA_START_JSON, json)
          }
          startForegroundService(intent)
        }
        PATH_STATE_PAUSE, PATH_STATE_STOP -> {
          /* Zonder lopende service is er niets te pauzeren/stoppen — dan
             ook geen service opstarten (dat zou een achtergrond-start zijn). */
          if (WearStateSessionService.instance == null) return
          val intent = Intent(this, WearStateSessionService::class.java).apply {
            action = if (event.path == PATH_STATE_PAUSE) {
              WearStateSessionService.ACTION_PAUSE
            } else {
              WearStateSessionService.ACTION_STOP
            }
          }
          startService(intent)
        }
      }
    } catch (_: Exception) {
      /* een stray/late bericht mag de listener-service nooit laten crashen */
    }
  }
}
