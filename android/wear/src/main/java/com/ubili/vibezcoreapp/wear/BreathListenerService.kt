package com.ubili.vibezcoreapp.wear

/* Ontvangt de berichten die WearBreathModule.kt (telefoon-kant) kan
   sturen, en zet ze meteen door naar de Service die de lus écht draait.
   Logica-loos — zelfde verdeling als BreathListenerService/
   BreathSessionService op de telefoon-kant van deze module. */

import android.content.Intent
import android.os.SystemClock
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

private const val PATH_START = "/vibezcore/breath/start"
private const val PATH_STOP = "/vibezcore/breath/stop"
private const val PATH_PAUSE = "/vibezcore/breath/pause"
/* State Control (docs/WATCH_PROTOCOL.md) — zelfde doorgeefluik, andere
   service: WearStateSessionService speelt het ritme lokaal af. */
private const val PATH_STATE_START = "/vibezcore/state/start"
private const val PATH_STATE_PREPARE = "/vibezcore/state/prepare"
private const val PATH_STATE_GO = "/vibezcore/state/go"
private const val PATH_STATE_PAUSE = "/vibezcore/state/pause"
private const val PATH_STATE_STOP = "/vibezcore/state/stop"
/** Enkel wakker worden: de telefoon stuurt dit als State Control opent,
 *  zodat een echte start meteen aankomt (17 okt 2026). */
private const val PATH_WAKE = "/vibezcore/state/wake"

class BreathListenerService : WearableListenerService() {
  /* 12 okt 2026 (operator: "gebruikers mogen niet sukkelen"): zodra de
     telefoon een sessie start, komt ONS sessiescherm naar voren — anders
     opent Samsung zijn eigen mediabediening (die elke "media" van de
     telefoon overneemt) en ziet de gebruiker de ring niet. */
  private fun bringSessionToFront() {
    try {
      startActivity(
        Intent(this, MainActivity::class.java).addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP,
        ),
      )
    } catch (e: Exception) {
      android.util.Log.w("VZWear", "bringSessionToFront blocked: ${e.message}")
    }
  }

  /* 13 okt 2026: de catalogus van de telefoon (CatalogStore) — bewaard
     gegeven, komt ook binnen als het horloge even weg was. */
  override fun onDataChanged(events: DataEventBuffer) {
    try {
      for (e in events) {
        if (e.type != DataEvent.TYPE_CHANGED) continue
        val item = e.dataItem
        if (item.uri.path == CatalogStore.PATH_CATALOG) {
          item.data?.let { CatalogStore.save(this, String(it, Charsets.UTF_8)) }
          ClockSync.refresh(this)
        }
      }
    } catch (_: Exception) {
      /* de buffer geeft Play Services zelf vrij na deze methode */
    }
  }

  override fun onMessageReceived(event: MessageEvent) {
    /* Meting telefoon → horloge (17 okt 2026): ontvangstmoment. */
    android.util.Log.d("VZSync", "recv ${event.path} at=${System.currentTimeMillis()}")
    /* 28 okt 2026: het ontvangstmoment op de EIGEN teller van het horloge (niet de wandklok, die kan springen) — de sessiediensten rekenen
       hiermee de reistijd en de wachttijd uit, zie ClockSync.oneWayMs en `leadMs` in het bericht. */
    val recvUp = SystemClock.uptimeMillis()
    /* 20 okt 2026: elk bericht van de telefoon = de telefoon-app draait →
       klokverschil (opnieuw) meten, voor deze en volgende sessies. Begrensd
       tot 1× per 20 s; de start zelf wacht er nooit op. */
    ClockSync.refresh(this)
    try {
      when (event.path) {
        /* 27 okt 2026: de telefoon antwoordt op onze vraag met de catalogus zelf — meteen bewaard (vervangt het wachten op een data-item). */
        PhoneLink.PATH_CATALOG_REPLY -> CatalogStore.save(this, String(event.data, Charsets.UTF_8))
        PATH_WAKE -> Unit
        PATH_START -> {
          val json = String(event.data, Charsets.UTF_8)
          val intent = Intent(this, WearBreathSessionService::class.java).apply {
            action = WearBreathSessionService.ACTION_START
            putExtra(WearBreathSessionService.EXTRA_SESSION_JSON, json)
            putExtra(WearBreathSessionService.EXTRA_RECV_UP, recvUp)
          }
          startForegroundService(intent)
          bringSessionToFront()
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
            putExtra(WearStateSessionService.EXTRA_RECV_UP, recvUp)
          }
          startForegroundService(intent)
          bringSessionToFront()
        }
        /* Samen starten (28 okt 2026): PREPARE = klaarzetten en READY melden; GO = het kleine "begin over X ms". */
        PATH_STATE_PREPARE -> {
          val json = String(event.data, Charsets.UTF_8)
          val intent = Intent(this, WearStateSessionService::class.java).apply {
            action = WearStateSessionService.ACTION_ARM
            putExtra(WearStateSessionService.EXTRA_START_JSON, json)
            putExtra(WearStateSessionService.EXTRA_RECV_UP, recvUp)
          }
          /* Het scherm komt pas bij GO naar voren (de sessie loopt dan echt); bij PREPARE staat er nog niets te tonen. */
          startForegroundService(intent)
        }
        PATH_STATE_GO -> {
          if (WearStateSessionService.instance == null) return
          startService(
            Intent(this, WearStateSessionService::class.java).apply {
              action = WearStateSessionService.ACTION_GO
              putExtra(WearStateSessionService.EXTRA_START_JSON, String(event.data, Charsets.UTF_8))
              putExtra(WearStateSessionService.EXTRA_RECV_UP, recvUp)
            },
          )
          bringSessionToFront()
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
