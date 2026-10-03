package com.ubili.vibezcoreapp.wear

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView

class MainActivity : Activity() {
  private lateinit var phaseLabel: TextView
  private lateinit var roundLabel: TextView
  private lateinit var modeLabel: TextView
  private lateinit var stopButton: Button

  private val listener: (BreathSessionState.Snapshot) -> Unit = { s -> runOnUiThread { render(s) } }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
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
  }

  override fun onStart() {
    super.onStart()
    BreathSessionState.addListener(listener)
  }

  override fun onStop() {
    BreathSessionState.removeListener(listener)
    super.onStop()
  }

  private fun render(s: BreathSessionState.Snapshot) {
    phaseLabel.text = s.phaseLabel
    modeLabel.text = if (s.modeName.isNotBlank()) s.modeName.uppercase() else "VIBEZCORE"
    roundLabel.text = if (s.running) "Round ${s.round} / ${s.totalRounds}" else ""
    stopButton.visibility = if (s.running) Button.VISIBLE else Button.GONE
  }
}
