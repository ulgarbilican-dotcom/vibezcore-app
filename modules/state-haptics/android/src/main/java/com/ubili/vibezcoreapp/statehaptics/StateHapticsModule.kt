package com.ubili.vibezcoreapp.statehaptics

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — native speler voor de State Control-hartslagcurve.

   Bewust logica-loos: de curve (basislijn → glijden → eindtempo, lub-dub,
   amplitudes) wordt in src/services/bracelet-haptics.ts berekend — dat
   blijft de enige bron van waarheid. Deze module geeft die volledige
   curve in ÉÉN aanroep aan de systeem-trilmotor, zodat:
     1. elke tik een echte, lage amplitude krijgt (expo-haptics' zachtste
        stand is 30/255 — te sterk voor de kalme modi);
     2. het ritme doorloopt zonder JS-timers, die Android bevriest zodra
        het scherm op slot staat (zie modules/breath-background/index.ts,
        gemeten augustus 2026).
   ───────────────────────────────────────────────────────────────────────── */

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues

class StateHapticsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun vibrator(): Vibrator? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

  override fun definition() = ModuleDefinition {
    Name("StateHaptics")

    /* Knop op het vergrendelscherm ("pause"/"resume") → JS, zodat de
       sessie-monitor (bron van waarheid) en de bracelet meegaan. */
    Events("onRemoteControl")

    OnCreate {
      StateHapticsService.remoteListener = { action ->
        sendEvent("onRemoteControl", mapOf("action" to action))
      }
    }

    OnDestroy {
      StateHapticsService.remoteListener = null
    }

    /* Zonder amplitude-sturing rondt Android elke niet-nul amplitude af
       naar 100% — dan hoort de JS-kant terug te vallen op expo-haptics. */
    Function("hasAmplitudeControl") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && (vibrator()?.hasAmplitudeControl() ?: false)
    }

    /** timings in ms, amplitudes 0–255 (zelfde lengte), repeat = index om
     *  vanaf te herhalen of -1 voor eenmalig. */
    Function("play") { timings: List<Double>, amplitudes: List<Int>, repeat: Int ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function
      if (timings.isEmpty() || timings.size != amplitudes.size) return@Function
      try {
        val v = vibrator() ?: return@Function
        v.cancel()
        val t = LongArray(timings.size) { timings[it].toLong() }
        val a = IntArray(amplitudes.size) { amplitudes[it].coerceIn(0, 255) }
        val r = if (repeat in t.indices) repeat else -1
        StateHapticsService.vibrateForSession(context, v, VibrationEffect.createWaveform(t, a, r))
      } catch (_: Exception) {
        /* stil — een trilmotor die niet meewerkt mag de sessie niet breken */
      }
    }

    Function("stop") {
      try {
        vibrator()?.cancel()
      } catch (_: Exception) {
      }
    }

    /** Echte sessie: de curve gaat naar StateHapticsService, die ze laat
     *  doorlopen met het scherm op slot (zie die klasse). De eerste start
     *  gebeurt terwijl de app in de voorgrond is (de gebruiker drukt op
     *  Play); daarna stuurt de module de DRAAIENDE service bij, want met het
     *  scherm op slot mag een app een voorgrondservice niet opnieuw starten.
     *  Start/pauze/stop draaien allemaal op de hoofdthread: zo komen ze in
     *  volgorde aan en nooit tegelijk met een stop van de service zelf. */
    AsyncFunction("startSession") { timings: List<Double>, amplitudes: List<Int>, title: String, sessionTotalSec: Double, sessionElapsedSec: Double ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@AsyncFunction
      if (timings.isEmpty() || timings.size != amplitudes.size) return@AsyncFunction
      try {
        val intent = Intent(context, StateHapticsService::class.java).apply {
          action = StateHapticsService.ACTION_START
          putExtra(StateHapticsService.EXTRA_TIMINGS, LongArray(timings.size) { timings[it].toLong() })
          putExtra(StateHapticsService.EXTRA_AMPLITUDES, IntArray(amplitudes.size) { amplitudes[it].coerceIn(0, 255) })
          putExtra(StateHapticsService.EXTRA_TITLE, title)
          putExtra(StateHapticsService.EXTRA_SESSION_TOTAL_MS, (sessionTotalSec * 1000).toLong())
          putExtra(StateHapticsService.EXTRA_SESSION_ELAPSED_MS, (sessionElapsedSec * 1000).toLong())
        }
        StateHapticsService.pendingPause = false
        StateHapticsService.pendingStop = false
        val running = StateHapticsService.instance
        if (running != null) {
          running.applyFromApp(intent)
        } else {
          StateHapticsService.startPending = true
          ContextCompat.startForegroundService(context, intent)
        }
      } catch (_: Exception) {
        StateHapticsService.startPending = false
        /* stil — zonder service trilt het enkel niet door op slot */
      }
    }.runOnQueue(Queues.MAIN)

    /** Pauze vanuit de app: de service blijft (melding met hervat-knop op
     *  het vergrendelscherm), enkel ritme en klok staan stil. Komt de pauze
     *  terwijl de service nog opstart, dan voert hij ze uit zodra hij er is. */
    AsyncFunction("pauseSession") {
      val running = StateHapticsService.instance
      if (running != null) running.pauseFromApp()
      else if (StateHapticsService.startPending) StateHapticsService.pendingPause = true
    }.runOnQueue(Queues.MAIN)

    /* Een service die nog opstart NIET met stopService stoppen: Android
       crasht de app als een via startForegroundService gestarte service
       stopt vóór hij startForeground aanriep. Dan stopt hij zelf, meteen na
       het opstarten. */
    AsyncFunction("stopSession") {
      StateHapticsService.pendingPause = false
      val running = StateHapticsService.instance
      if (running != null) {
        running.stopFromApp()
      } else if (StateHapticsService.startPending) {
        StateHapticsService.pendingStop = true
      }
    }.runOnQueue(Queues.MAIN)

    Function("dismissCompletionNotice") {
      StateHapticsService.dismissCompletionNotice(context)
    }

    Function("sessionStatus") {
      StateHapticsService.status()
    }

    /** false op toestellen zonder trilmotor (tablets): dan voelt de
     *  gebruiker niets en hoort de app dat te zeggen. */
    Function("hasVibrator") {
      try {
        vibrator()?.hasVibrator() ?: false
      } catch (_: Exception) {
        true
      }
    }
  }
}
