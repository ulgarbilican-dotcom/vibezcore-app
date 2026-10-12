package com.ubili.vibezcoreapp.wear

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE op het horloge — één scherm voor State Control en breathwork,
   in de look van de app (6 okt 2026): naam met kleurstip, de sessiecirkel
   (SessionRingView), een ronde pauzeknop met END eronder.

   Eén sessie, twee bedieningen: de knoppen vragen het de telefoon (bron van
   waarheid). Pauze en stop gebeuren hier meteen ook al, zodat de pols niet
   blijft tikken als de telefoon even weg is; hervatten loopt via de
   telefoon (die kent de plek in de sessie). */

import android.app.Activity
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.TextView

class MainActivity : androidx.activity.ComponentActivity() {
  /* 12 okt 2026: ambient-modus (zoals Apple's Workout) — pols omlaag =
     ons scherm blijft gedimd staan i.p.v. terug naar de wijzerplaat; pols
     omhoog = meteen weer de ring. De golf staat stil in ambient (batterij). */
  private var ambient = false
  private val ambientCallback = object : androidx.wear.ambient.AmbientLifecycleObserver.AmbientLifecycleCallback {
    override fun onEnterAmbient(ambientDetails: androidx.wear.ambient.AmbientLifecycleObserver.AmbientDetails) {
      ambient = true
      ring.flowing = false
      ring.alpha = 0.6f
    }
    override fun onExitAmbient() {
      ambient = false
      ring.alpha = 1f
      render()
    }
    override fun onUpdateAmbient() {
      render()
    }
  }
  private lateinit var idleContainer: View
  private lateinit var sessionContainer: View
  private lateinit var nameDot: View
  private lateinit var nameLabel: TextView
  private lateinit var ring: SessionRingView
  private lateinit var pauseButton: ImageButton
  private lateinit var endButton: TextView

  private val breathListener: (BreathSessionState.Snapshot) -> Unit = { runOnUiThread { render() } }
  private val stateListener: (StateSessionState.Snapshot) -> Unit = { runOnUiThread { render() } }
  private val beatListener: (Boolean) -> Unit = { strong -> runOnUiThread { ring.pulse(strong) } }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
    lifecycle.addObserver(androidx.wear.ambient.AmbientLifecycleObserver(this, ambientCallback))
    idleContainer = findViewById(R.id.idleContainer)
    sessionContainer = findViewById(R.id.sessionContainer)
    nameDot = findViewById(R.id.nameDot)
    nameLabel = findViewById(R.id.nameLabel)
    ring = findViewById(R.id.ring)
    pauseButton = findViewById(R.id.pauseButton)
    endButton = findViewById(R.id.endButton)

    pauseButton.setOnClickListener { onPauseTap() }
    endButton.setOnClickListener { onEndTap() }
    /* 12 okt 2026: vanaf Wear OS 4 (Android 13) moet een app zelf om
       meldingen vragen — zonder die toestemming loopt de sessie wel, maar
       verbergt het horloge de lopende-sessie-melding (terugkeren naar de
       sessie vanaf de wijzerplaat). Eén keer, bij het eerste openen. */
    if (android.os.Build.VERSION.SDK_INT >= 33 &&
      checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED
    ) {
      requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 41)
    }
    runDemo(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    runDemo(intent)
  }

  /* Testingang, ENKEL in een debug-build (nooit in de winkelversie): een
     sessie starten zonder gekoppelde telefoon, alsof de telefoon die stuurde.
       adb shell am start -n com.ubili.vibezcoreapp/com.ubili.vibezcoreapp.wear.MainActivity --es vz_demo state|breath|pause|stop */
  private fun runDemo(intent: Intent?) {
    if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0) return
    when (intent?.getStringExtra("vz_demo")) {
      "state" -> startForegroundService(
        Intent(this, WearStateSessionService::class.java).apply {
          action = WearStateSessionService.ACTION_START
          putExtra(
            WearStateSessionService.EXTRA_START_JSON,
            """{"title":"Sharp Focus","colorHex":"#3E9BFF","startBpm":70,"targetBpm":63,"holdSec":10,"rampSec":0,"curveOffsetSec":0,"remainingSec":900,"lubAmp":45,"dubAmp":32,"lubMsNoAmp":50,"dubMsNoAmp":40}""",
          )
        },
      )
      "breath" -> startForegroundService(
        Intent(this, WearBreathSessionService::class.java).apply {
          action = WearBreathSessionService.ACTION_START
          putExtra(
            WearBreathSessionService.EXTRA_SESSION_JSON,
            """{"modeName":"Calm Control","colorHex":"#B478FF","rounds":12,"phases":[{"key":"inhale","secs":4,"pattern":[0,60]},{"key":"hold","secs":4,"pattern":[0,40]},{"key":"exhale","secs":4,"pattern":[0,60]},{"key":"hold-2","secs":4,"pattern":[0,40]}]}""",
          )
        },
      )
      "pause" -> {
        if (StateSessionState.current.active) {
          startService(Intent(this, WearStateSessionService::class.java).apply { action = WearStateSessionService.ACTION_PAUSE })
        } else if (WearBreathSessionService.instance != null) {
          startService(Intent(this, WearBreathSessionService::class.java).apply { action = WearBreathSessionService.ACTION_PAUSE })
        }
      }
      "stop" -> {
        startService(Intent(this, WearStateSessionService::class.java).apply { action = WearStateSessionService.ACTION_STOP })
        if (WearBreathSessionService.instance != null) {
          startService(Intent(this, WearBreathSessionService::class.java).apply { action = WearBreathSessionService.ACTION_STOP })
        }
      }
    }
  }

  override fun onStart() {
    super.onStart()
    BreathSessionState.addListener(breathListener)
    StateSessionState.addListener(stateListener)
    BeatBus.add(beatListener)
  }

  override fun onStop() {
    BreathSessionState.removeListener(breathListener)
    StateSessionState.removeListener(stateListener)
    BeatBus.remove(beatListener)
    super.onStop()
  }

  /* ── Knoppen ─────────────────────────────────────────────────────────── */

  private fun onPauseTap() {
    val st = StateSessionState.current
    if (st.active) {
      PhoneLink.sendWatchAction(this, if (st.paused) "resume" else "pause", "bracelet")
      return
    }
    val b = BreathSessionState.current
    PhoneLink.sendWatchAction(this, if (b.paused) "resume" else "pause", "breath")
    if (!b.paused && WearBreathSessionService.instance != null) {
      startService(Intent(this, WearBreathSessionService::class.java).apply { action = WearBreathSessionService.ACTION_PAUSE })
    }
  }

  private fun onEndTap() {
    if (StateSessionState.current.active) {
      PhoneLink.sendWatchAction(this, "stop", "bracelet")
      /* 12 okt 2026 (operator: "bij end session krijg ik 0-scherm en blijf
         ik in session active"): niet meer wachten op de telefoon — het
         horloge stopt meteen zelf (zoals Breathwork) en meldt het. */
      if (WearStateSessionService.instance != null) {
        startService(Intent(this, WearStateSessionService::class.java).apply { action = WearStateSessionService.ACTION_STOP })
      } else {
        StateSessionState.update(StateSessionState.IDLE)
      }
      return
    }
    PhoneLink.sendWatchAction(this, "stop", "breath")
    if (WearBreathSessionService.instance != null) {
      startService(Intent(this, WearBreathSessionService::class.java).apply { action = WearBreathSessionService.ACTION_STOP })
    } else {
      BreathSessionState.update(BreathSessionState.Snapshot("Waiting for phone…", "", 0, 0, running = false))
    }
  }

  /* ── Weergave ────────────────────────────────────────────────────────── */

  private fun render() {
    val st = StateSessionState.current
    val b = BreathSessionState.current
    overLockScreen(st.active || b.running || b.paused)
    when {
      st.active -> renderState(st)
      b.running || b.paused -> renderBreath(b)
      else -> {
        sessionContainer.visibility = View.GONE
        idleContainer.visibility = View.VISIBLE
      }
    }
  }

  /* 12 okt 2026 (operator: "de lockscreen komt onmiddellijk en het is
     moeilijk onze app terug te openen"): tijdens een sessie staat ons scherm
     BOVEN het vergrendelscherm van het horloge — pols omhoog = de sessie,
     geen pincode, geen app zoeken (zoals Apple's Workout). Zonder sessie
     gewoon weer achter het slot. */
  private var shownOverLock: Boolean? = null
  private fun overLockScreen(on: Boolean) {
    if (shownOverLock == on) return
    shownOverLock = on
    setShowWhenLocked(on)
    setTurnScreenOn(on)
  }

  private fun renderState(s: StateSessionState.Snapshot) {
    showSession(s.title, s.colorHex, s.paused)
    val sec = s.remainingSec.coerceAtLeast(0)
    ring.centerText = "%d:%02d".format(sec / 60, sec % 60)
    ring.subText = if (s.paused) "Paused" else ""
    val total = s.totalSec.coerceAtLeast(1)
    val frac = (sec.toFloat() / total).coerceIn(0f, 1f)
    ring.levelAt = { frac }
  }

  private fun renderBreath(b: BreathSessionState.Snapshot) {
    showSession(b.modeName, b.colorHex, b.paused)
    ring.centerText = b.phaseLabel
    val rounds = if (b.totalRounds > 0) "${b.round} / ${b.totalRounds}" else ""
    ring.subText = if (b.paused) rounds else listOf(b.via, rounds).filter { it.isNotBlank() }.joinToString(" · ")
    val from = b.levelFrom
    val to = b.levelTo
    val start = b.phaseStartUptime
    val span = (b.phaseEndUptime - b.phaseStartUptime).coerceAtLeast(1L)
    ring.levelAt = { now ->
      val k = ((now - start).toFloat() / span).coerceIn(0f, 1f)
      // zacht in en uit, zoals een adem
      val e = k * k * (3f - 2f * k)
      from + (to - from) * e
    }
  }

  private fun showSession(title: String, colorHex: String, paused: Boolean) {
    idleContainer.visibility = View.GONE
    sessionContainer.visibility = View.VISIBLE
    val c = parse(colorHex)
    // Sleep: het lichte teal, zoals de ring in de app
    val light = if (colorHex.equals("#00A3A3", ignoreCase = true)) Color.parseColor("#4AF0D4") else c
    val sleepLike = colorHex.equals("#00A3A3", ignoreCase = true) || colorHex.equals("#4AF0D4", ignoreCase = true)
    ring.color = light
    ring.backAlpha = if (sleepLike) 0.20f else 0.10f
    ring.frontAlpha = if (sleepLike) 0.30f else 0.15f
    ring.flowing = !paused && !ambient
    nameLabel.text = title
    nameDot.background = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(c)
    }
    pauseButton.background = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(Color.argb(51, Color.red(c), Color.green(c), Color.blue(c)))
      setStroke((1.5f * resources.displayMetrics.density).toInt(), Color.argb(38, 255, 255, 255))
    }
    pauseButton.setImageResource(if (paused) R.drawable.ic_vz_play else R.drawable.ic_vz_pause)
    pauseButton.contentDescription = if (paused) "Resume" else "Pause"
  }

  private fun parse(hex: String): Int = try {
    Color.parseColor(hex)
  } catch (_: Exception) {
    Color.parseColor("#00A3A3")
  }

}
