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
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

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
        v.vibrate(VibrationEffect.createWaveform(t, a, r))
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
  }
}
