package com.ubili.vibezcoreapp.breathbackground

/* ─────────────────────────────────────────────────────────────────────────
   Kotlin-poort van src/services/breath-haptics.ts.

   Dit is een BEWUSTE kopie, geen herinterpretatie — dezelfde constanten,
   dezelfde volgorde van optellen. Wijzigt iemand de TS-versie (de
   waarheid voor de telefoon-UI en straks de bracelet-firmware), dan hoort
   deze kopie in dezelfde beweging mee te veranderen. Zie de uitleg boven
   in breath-haptics.ts voor de WAAROM achter elk getal — die staat hier
   bewust niet nog een keer, om niet uit de pas te kunnen lopen met de
   bron.
   ───────────────────────────────────────────────────────────────────────── */

import android.content.Context
import android.media.MediaPlayer
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

object BreathHaptics {
  private const val FILL = 0.9
  private const val SMOOTH_ON = 90L
  private const val SMOOTH_OFF = 55L
  private const val RIPPLE_ON = 150L
  private const val RIPPLE_OFF = 120L
  private const val TICK = 85L
  private const val TICK_PERIOD = 1000L

  private fun steady(secs: Int): LongArray {
    val span = maxOf(400L, Math.round(secs * 1000.0 * FILL))
    val out = mutableListOf(0L)
    var used = 0L
    while (used + SMOOTH_ON <= span) {
      out.add(SMOOTH_ON)
      used += SMOOTH_ON
      if (used + SMOOTH_OFF >= span) break
      out.add(SMOOTH_OFF)
      used += SMOOTH_OFF
    }
    return out.toLongArray()
  }

  private fun ripple(secs: Int): LongArray {
    val span = maxOf(400L, Math.round(secs * 1000.0 * FILL))
    val out = mutableListOf(0L)
    var used = 0L
    while (used + RIPPLE_ON <= span) {
      out.add(RIPPLE_ON)
      used += RIPPLE_ON
      if (used + RIPPLE_OFF >= span) break
      out.add(RIPPLE_OFF)
      used += RIPPLE_OFF
    }
    /* Een reeks die met een pauze eindigt is een pauze te veel. */
    if (out.size % 2 == 1) out.add(RIPPLE_ON)
    return out.toLongArray()
  }

  private fun tickPerSecond(secs: Int): LongArray {
    val count = maxOf(1, Math.round(secs.toDouble()).toInt())
    val out = mutableListOf(0L, TICK)
    for (i in 1 until count) {
      out.add(TICK_PERIOD - TICK)
      out.add(TICK)
    }
    return out.toLongArray()
  }

  /** Het patroon voor deze fase, passend bij de lengte ervan — zelfde
   *  vertakking als phaseHapticPattern() in breath-haptics.ts. */
  fun patternFor(phaseKey: String, secs: Int): LongArray = when (phaseKey) {
    "inhale" -> steady(secs)
    "exhale" -> ripple(secs)
    else -> tickPerSecond(secs)
  }
}

/** `VibratorManager` op API 31+ (aanbevolen pad); daaronder de oude,
 *  deprecated `Vibrator`-service. */
fun getVibrator(context: Context): Vibrator? {
  return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
    val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
    vm?.defaultVibrator
  } else {
    @Suppress("DEPRECATION")
    context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
  }
}

/** Speelt het trilpatroon voor deze fase. Faalt stil: een trilmotor die
 *  niet meewerkt (toestel zonder motor, systeemhaptiek uit) mag een
 *  lopende achtergrond-sessie niet onderbreken. Eerst stoppen, dan
 *  starten — zelfde volgorde als playPhaseHaptic() in breath-haptics.ts,
 *  zodat een fase nooit op het ritme van de vorige blijft doortrillen. */
fun playHapticForPhase(context: Context, phaseKey: String, secs: Int) {
  try {
    val vibrator = getVibrator(context) ?: return
    vibrator.cancel()
    val pattern = BreathHaptics.patternFor(phaseKey, secs)
    /* repeat = -1: niet herhalen, zelfde als `Vibration.vibrate(pattern, false)`
       aan de JS-kant. */
    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
  } catch (_: Exception) {
    /* stil */
  }
}

/** Speelt de cue-file voor deze fase-sleutel via een kortstondige,
 *  losstaande MediaPlayer — geen JS nodig, geen gedeelde player-cache
 *  (die leeft op de JS-kant en is hier niet bereikbaar). Faalt stil: een
 *  haperende cue mag de achtergrond-sessie niet breken. */
fun playCueFile(uri: String) {
  if (uri.isEmpty()) return
  try {
    val mp = MediaPlayer()
    mp.setDataSource(uri)
    mp.setOnCompletionListener { it.release() }
    mp.setOnErrorListener { player, _, _ ->
      player.release()
      true
    }
    mp.prepareAsync()
    mp.setOnPreparedListener { it.start() }
  } catch (_: Exception) {
    /* stil */
  }
}
