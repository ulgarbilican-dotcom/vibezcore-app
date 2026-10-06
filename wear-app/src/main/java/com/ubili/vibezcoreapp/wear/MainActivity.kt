package com.ubili.vibezcoreapp.wear

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView

class MainActivity : Activity() {
  private lateinit var breathContainer: View
  private lateinit var phaseLabel: TextView
  private lateinit var roundLabel: TextView
  private lateinit var modeLabel: TextView
  private lateinit var stopButton: Button

  private lateinit var stateContainer: View
  private lateinit var stateAccent: View
  private lateinit var stateTitle: TextView
  private lateinit var stateRemaining: TextView
  private lateinit var statePauseButton: Button
  private lateinit var stateStopButton: Button

  private val breathListener: (BreathSessionState.Snapshot) -> Unit = { s -> runOnUiThread { renderBreath(s) } }
  private val stateListener: (StateSessionState.Snapshot) -> Unit = { s -> runOnUiThread { renderState(s) } }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
    breathContainer = findViewById(R.id.breathContainer)
    phaseLabel = findViewById(R.id.phaseLabel)
    roundLabel = findViewById(R.id.roundLabel)
    modeLabel = findViewById(R.id.modeLabel)
    stopButton = findViewById(R.id.stopButton)
    stopButton.setOnClickListener {
      startService(
        Intent(this, WearBreathSessionService::class.java).apply {
          action = WearBreathSessionService.ACTION_STOP
        },
      )
    }

    stateContainer = findViewById(R.id.stateContainer)
    stateAccent = findViewById(R.id.stateAccent)
    stateTitle = findViewById(R.id.stateTitle)
    stateRemaining = findViewById(R.id.stateRemaining)
    statePauseButton = findViewById(R.id.statePauseButton)
    stateStopButton = findViewById(R.id.stateStopButton)
    /* De telefoon is de bron van waarheid (docs/WATCH_PROTOCOL.md §4): de
       knoppen vragen het enkel; de telefoon stuurt daarna zelf state-pause/
       state-start/state-stop terug. */
    statePauseButton.setOnClickListener {
      val action = if (StateSessionState.current.paused) "resume" else "pause"
      PhoneLink.sendWatchAction(this, action, "bracelet")
    }
    stateStopButton.setOnClickListener {
      PhoneLink.sendWatchAction(this, "stop", "bracelet")
    }
  }

  override fun onStart() {
    super.onStart()
    BreathSessionState.addListener(breathListener)
    StateSessionState.addListener(stateListener)
  }

  override fun onStop() {
    BreathSessionState.removeListener(breathListener)
    StateSessionState.removeListener(stateListener)
    super.onStop()
  }

  private fun renderBreath(s: BreathSessionState.Snapshot) {
    phaseLabel.text = s.phaseLabel
    modeLabel.text = if (s.modeName.isNotBlank()) s.modeName.uppercase() else "VIBEZCORE"
    roundLabel.text = if (s.running) "Round ${s.round} / ${s.totalRounds}" else ""
    stopButton.visibility = if (s.running) Button.VISIBLE else Button.GONE
  }

  private fun renderState(s: StateSessionState.Snapshot) {
    stateContainer.visibility = if (s.active) View.VISIBLE else View.GONE
    breathContainer.visibility = if (s.active) View.GONE else View.VISIBLE
    if (!s.active) return
    val accent = try {
      Color.parseColor(s.colorHex)
    } catch (_: Exception) {
      Color.parseColor("#00A3A3")
    }
    stateAccent.setBackgroundColor(accent)
    stateTitle.text = s.title
    val minutes = if (s.remainingMinutes == 1) "1 min left" else "${s.remainingMinutes} min left"
    stateRemaining.text = if (s.paused) "Paused · $minutes" else minutes
    statePauseButton.text = if (s.paused) "Resume" else "Pause"
  }
}
