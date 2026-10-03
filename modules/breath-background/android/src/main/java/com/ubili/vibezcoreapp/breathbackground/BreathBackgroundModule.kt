package com.ubili.vibezcoreapp.breathbackground

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — De Expo-modulebrug naar JS.

   Ontvangt exact de vorm van StartBreathBackgroundOptions uit
   modules/breath-background/index.ts, en start/stopt daarmee
   BreathSessionService. Verder logica-loos — alle cyclus-logica woont in
   de service en de receiver, precies zoals runPhase() in
   breath-session.tsx niet ergens anders dan in dat scherm zelf leeft. */

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class BgPhaseOption(
  @Field val key: String = "",
  @Field val secs: Int = 0,
) : Record

class StartBreathBackgroundOptions(
  @Field val phases: List<BgPhaseOption> = emptyList(),
  @Field val rounds: Int = 0,
  @Field val inhaleCueUri: String = "",
  @Field val holdCueUri: String = "",
  @Field val exhaleCueUri: String = "",
  @Field val cueLeadMs: Int = 400,
  @Field val startPhaseIdx: Int = 0,
  @Field val startRound: Int = 1,
  @Field val startRemainingMs: Int = -1,
  @Field val modeName: String = "Breathwork",
  @Field val totalDurationMs: Double = 0.0,
  @Field val sessionRemainingMs: Double = 0.0,
) : Record

class BreathBackgroundModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("BreathBackground")

    Function("startBackgroundBreathSession") { options: StartBreathBackgroundOptions ->
      val intent = Intent(context, BreathSessionService::class.java).apply {
        action = BreathSessionService.ACTION_START
        putStringArrayListExtra(
          BreathSessionService.EXTRA_PHASE_KEYS,
          ArrayList(options.phases.map { it.key }),
        )
        putIntegerArrayListExtra(
          BreathSessionService.EXTRA_PHASE_SECS,
          ArrayList(options.phases.map { it.secs }),
        )
        putExtra(BreathSessionService.EXTRA_ROUNDS, options.rounds)
        putExtra(BreathSessionService.EXTRA_INHALE_URI, options.inhaleCueUri)
        putExtra(BreathSessionService.EXTRA_HOLD_URI, options.holdCueUri)
        putExtra(BreathSessionService.EXTRA_EXHALE_URI, options.exhaleCueUri)
        putExtra(BreathSessionService.EXTRA_CUE_LEAD_MS, options.cueLeadMs)
        putExtra(BreathSessionService.EXTRA_START_PHASE_IDX, options.startPhaseIdx)
        putExtra(BreathSessionService.EXTRA_START_ROUND, options.startRound)
        putExtra(BreathSessionService.EXTRA_START_REMAINING_MS, options.startRemainingMs)
        putExtra(BreathSessionService.EXTRA_MODE_NAME, options.modeName)
        putExtra(BreathSessionService.EXTRA_TOTAL_DURATION_MS, options.totalDurationMs.toLong())
        putExtra(
          BreathSessionService.EXTRA_SESSION_REMAINING_MS,
          options.sessionRemainingMs.toLong(),
        )
      }
      ContextCompat.startForegroundService(context, intent)
    }

    Function("stopBackgroundBreathSession") {
      val intent = Intent(context, BreathSessionService::class.java).apply {
        action = BreathSessionService.ACTION_STOP
      }
      ContextCompat.startForegroundService(context, intent)
    }

    /* Operator, 14 augustus 2026: "met batterij onbeperkt lukt het wel,
       hoe pakken we dat aan?" — Samsung's (en andere OEM's) eigen
       batterijbeheer kan de AlarmManager-wekkers en dus stem/haptiek
       gewoon blokkeren, los van hoe correct de rest van deze module is.
       Android heeft hier een STANDAARD systeemdialoog voor
       (ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS) — dezelfde die
       WhatsApp/Spotify gebruiken — die de gebruiker in twee tikken
       toestemming laat geven, zonder zelf naar Instellingen te hoeven
       navigeren. */
    Function("isIgnoringBatteryOptimizations") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function true
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("requestIgnoreBatteryOptimizations") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function Unit
      try {
        val intent = Intent(
          Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
          Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      } catch (_: Exception) {
        /* Sommige OEM's (met name budget-toestellen) implementeren deze
           actie niet — dan blijft de bestaande wall-clock inhaalslag in
           breath-session.tsx het vangnet, geen crash. */
      }
    }
  }
}
