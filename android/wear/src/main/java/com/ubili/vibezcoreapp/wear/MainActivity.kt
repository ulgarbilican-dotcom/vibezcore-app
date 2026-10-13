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
    /* startscherm: per toestand vastklikken na het scrollen */
    findViewById<View>(R.id.idleContainer).setOnScrollChangeListener { v, _, _, _, _ ->
      v.removeCallbacks(snapRunnable)
      v.postDelayed(snapRunnable, 140)
      updateDots()
    }
    idleContainer = findViewById(R.id.idleContainer)
    sessionContainer = findViewById(R.id.sessionContainer)
    nameDot = findViewById(R.id.nameDot)
    nameLabel = findViewById(R.id.nameLabel)
    ring = findViewById(R.id.ring)
    pauseButton = findViewById(R.id.pauseButton)
    endButton = findViewById(R.id.endButton)

    pauseButton.setOnClickListener { onPauseTap() }
    /* Breathwork: tik op de figuur = pauze / hervatten (geen aparte knop —
       op een horlogescherm is de figuur zelf het grootste doel). */
    ring.setOnClickListener {
      if (!StateSessionState.current.active && BreathSessionState.current.let { it.running || it.paused }) onPauseTap()
    }
    endButton.setOnClickListener { onEndTap() }
    /* END als pil (operator 13 okt 2026): zacht wit vlak, witte tekst. */
    endButton.background = null
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
    setIntent(intent)
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
            """{"modeName":"${intent?.getStringExtra("vz_name") ?: "Calm Control"}","colorHex":"${intent?.getStringExtra("vz_color") ?: "#B478FF"}",""" + """"rounds":12,"phases":[{"key":"inhale","secs":4,"pattern":[0,60],"via":"Nose"},{"key":"hold","secs":4,"pattern":[0,40]},{"key":"exhale","secs":4,"pattern":[0,60],"via":"Mouth"},{"key":"hold-2","secs":4,"pattern":[0,40]}]}""",
          )
        },
      )
      /* testcatalogus (enkel debug) — tot de telefoon hem stuurt */
      "catalog" -> CatalogStore.save(
        this,
        """{"v":1,"amp":120,"breath":[{"key":"calm","name":"Calm Control","colorHex":"#B478FF","technique":"Box Breathing","techniqueKey":"box","locked":false,"phases":[{"key":"inhale","secs":4,"via":"Nose","pattern":[0,60]},{"key":"hold-in","secs":4,"via":"","pattern":[0,40]},{"key":"exhale","secs":4,"via":"Mouth","pattern":[0,60]},{"key":"hold-out","secs":4,"via":"","pattern":[0,40]}],"durations":[{"label":"5 min","minutes":5,"rounds":19},{"label":"10 min","minutes":10,"rounds":38}],"defaultIdx":0},{"key":"rest","name":"Sleep","colorHex":"#4AF0D4","technique":"4-7-8 Breathing","techniqueKey":"478","locked":true,"phases":[{"key":"inhale","secs":4,"via":"Nose","pattern":[0,60]}],"durations":[{"label":"4 cycles","minutes":1,"rounds":4}],"defaultIdx":0}]}""",
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

  private val catalogListener: () -> Unit = { runOnUiThread { render() } }

  override fun onStart() {
    super.onStart()
    CatalogStore.addListener(catalogListener)
    CatalogStore.refresh(this)
    BreathSessionState.addListener(breathListener)
    StateSessionState.addListener(stateListener)
    BeatBus.add(beatListener)
  }

  override fun onResume() {
    super.onResume()
    /* draaiende rand scrolt het startscherm */
    idleContainer.requestFocus()
  }

  override fun onStop() {
    CatalogStore.removeListener(catalogListener)
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
    /* Horloge-sessie: hervatten doet het horloge zelf (13 okt 2026). */
    val local = WearBreathSessionService.pausedLocal
    if (b.paused && local != null) {
      startForegroundService(
        Intent(this, WearBreathSessionService::class.java).apply {
          action = WearBreathSessionService.ACTION_START
          putExtra(WearBreathSessionService.EXTRA_SESSION_JSON, local)
        },
      )
      return
    }
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
    WearBreathSessionService.pausedLocal?.let { raw ->
      /* gepauzeerde horloge-sessie beëindigen: in de geschiedenis, klaar */
      try {
        val j = org.json.JSONObject(raw)
        WearBreathSessionService.logLocal(this, j, j.optLong("activeMs", 0L), j.optInt("startRound", 1), false)
      } catch (_: Exception) {
      }
      WearBreathSessionService.pausedLocal = null
      BreathSessionState.update(BreathSessionState.Snapshot("Waiting for phone…", "", 0, 0, running = false))
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
        findViewById<View>(R.id.homeDots).visibility = View.VISIBLE
        overLockScreen(false)
        renderHome()
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
    ring.art = null
    ring.paused = false
    (nameLabel.parent as View).visibility = View.VISIBLE
    ring.isClickable = false
    pauseButton.visibility = View.VISIBLE
    setNameTop(44)
    nameLabel.textSize = 15f
    val sec = s.remainingSec.coerceAtLeast(0)
    ring.centerText = "%d:%02d".format(sec / 60, sec % 60)
    ring.subText = if (s.paused) "Paused" else ""
    val total = s.totalSec.coerceAtLeast(1)
    val frac = (sec.toFloat() / total).coerceIn(0f, 1f)
    ring.levelAt = { frac }
  }

  private fun renderBreath(b: BreathSessionState.Snapshot) {
    showSession(b.modeName, b.colorHex, b.paused)
    ring.art = artFor(b.colorHex)
    val (scale, focus) = when (b.colorHex.uppercase()) {
      "#F5A524" -> 1f to 0.5f
      /* de bloem heeft veel lege rand: op het kleine scherm groter dan in de app */
      "#3E9BFF" -> 1.0f to 0.5f
      "#B478FF" -> 1.14f to 0.43f
      /* de boom vult zijn beeld bijna helemaal — kleiner, anders raakt hij
         de naam bovenaan */
      "#00A3A3", "#4AF0D4" -> 0.56f to 0.5f
      else -> 0.7f to 0.5f
    }
    ring.artScale = scale
    ring.artFocusY = focus
    ring.paused = b.paused
    ring.isClickable = true
    ring.contentDescription = if (b.paused) "Resume" else "Pause"
    pauseButton.visibility = View.GONE
    setNameTop(30)
    nameLabel.textSize = 12f
    ring.centerText = b.phaseLabel
    /* Kort, zoals het horloge vraagt (operator 13 okt 2026): "Inhale" en
       eronder enkel "Nose" / "Mouth". */
    ring.subText = if (b.paused) "" else b.via
    /* De naam enkel bij pauze — tijdens het ademen krijgt de figuur de
       ruimte (operator 13 okt 2026). */
    (nameLabel.parent as View).visibility = if (b.paused) View.VISIBLE else View.INVISIBLE
    ring.footerAt = { now ->
      val leftMs = if (b.paused) b.pausedSessionLeftMs else b.sessionEndUptime - now
      /* Zoals de telefoon ("10:08 left"): minuten en seconden, zodat je hem
         ziet aftellen — hele minuten bleven een minuut lang gelijk staan. */
      if (b.sessionEndUptime <= 0L) "" else {
        val sec = ((leftMs + 999L) / 1000L).coerceAtLeast(0L)
        "%d:%02d left".format(sec / 60, sec % 60)
      }
    }
    val from = b.levelFrom
    val to = b.levelTo
    val start = b.phaseStartUptime
    val span = (b.phaseEndUptime - b.phaseStartUptime).coerceAtLeast(1L)
    ring.secondsLeftAt = { now ->
      val leftMs = if (b.paused) ((1f - b.pausedProgress) * span).toLong() else b.phaseEndUptime - now
      // nooit "0": bij de overgang staat de volgende fase al klaar
      ((leftMs + 999L) / 1000L).toInt().coerceAtLeast(1)
    }
    ring.phaseProgressAt = { now ->
      if (b.paused) b.pausedProgress else ((now - start).toFloat() / span).coerceIn(0f, 1f)
    }
    ring.levelAt = { now ->
      val k = ((now - start).toFloat() / span).coerceIn(0f, 1f)
      // zacht in en uit, zoals een adem
      val e = k * k * (3f - 2f * k)
      from + (to - from) * e
    }
  }

  private fun showSession(title: String, colorHex: String, paused: Boolean) {
    idleContainer.visibility = View.GONE
    findViewById<View>(R.id.homeDots).visibility = View.GONE
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

  /* Dezelfde figuur als in de app, per toestand (breath-states.ts `art`).
     De telefoon stuurt de kleur van de toestand mee; Sleep komt als het
     lichte teal. */
  private val artCache = HashMap<Int, android.graphics.Bitmap>()
  internal fun artFor(colorHex: String): android.graphics.Bitmap? {
    val res = when (colorHex.uppercase()) {
      "#F5A524" -> R.drawable.vz_art_sun
      "#3E9BFF" -> R.drawable.vz_art_flower
      "#B478FF" -> R.drawable.vz_art_lotus
      "#FFFFFF" -> R.drawable.vz_art_clarity
      "#00A3A3", "#4AF0D4" -> R.drawable.vz_art_tree
      else -> R.drawable.vz_art_lotus
    }
    return artCache.getOrPut(res) { android.graphics.BitmapFactory.decodeResource(resources, res) }
  }

  /* Breathwork heeft geen cirkel: de naam hoger, zodat hij vrij boven de
     figuur staat (operator 12 okt 2026: "die sleep staat zeer laag"). */
  private fun setNameTop(dp: Int) {
    val row = nameLabel.parent as View
    val lp = row.layoutParams as android.widget.FrameLayout.LayoutParams
    val px = (dp * resources.displayMetrics.density).toInt()
    if (lp.topMargin != px) {
      lp.topMargin = px
      row.layoutParams = lp
    }
  }

  /* ── Startscherm (13 okt 2026 — het horloge zelfstandig) ─────────────
     Zoals Apple's Ademhalen/Workout: bovenaan "Again" (laatste sessie, één
     tik), daaronder de vijf Breathe-toestanden met hun figuur. Zonder
     catalogus: uitleg om de telefoon-app één keer te openen. */
  private var homeSignature = ""

  private fun dp(v: Float) = (v * resources.displayMetrics.density).toInt()

  private fun renderHome() {
    val entries = CatalogStore.breath(this)
    val last = CatalogStore.last(this)
    val sig = entries.joinToString { it.optString("key") + it.optBoolean("locked") + it.optString("technique") } + "|" + last
    if (sig == homeSignature) return
    homeSignature = sig
    val list = findViewById<android.widget.LinearLayout>(R.id.homeList)
    list.removeAllViews()
    /* 13 okt 2026: elke pagina vult het hele scherm (geen naam van een andere
       toestand meer in beeld); stipjes rechts tonen waar je bent. De eerste
       pagina = de V + "Again" (als er een laatste sessie is). */
    val pageH = resources.displayMetrics.heightPixels
    val header = android.widget.LinearLayout(this).apply {
      orientation = android.widget.LinearLayout.VERTICAL
      gravity = android.view.Gravity.CENTER
      tag = "page"
      setPadding(dp(22f), 0, dp(22f), 0)
      layoutParams = android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT, pageH)
    }
    header.addView(android.widget.ImageView(this).apply {
      setImageResource(R.drawable.vz_vmark)
      adjustViewBounds = true
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      layoutParams = android.widget.LinearLayout.LayoutParams(dp(26f), android.widget.LinearLayout.LayoutParams.WRAP_CONTENT).apply {
        bottomMargin = dp(16f)
      }
    })

    if (entries.isEmpty()) {
      list.addView(header)
      header.addView(TextView(this).apply {
        text = "Open VIBEZCORE on your phone once to set up your watch"
        setTextColor(Color.parseColor("#F4F4F4"))
        textSize = 15f
        gravity = android.view.Gravity.CENTER
        setPadding(dp(6f), dp(18f), dp(6f), 0)
      })
      return
    }

    /* Again — de laatste sessie, meteen starten */
    if (last != null) {
      val e = entries.firstOrNull { it.optString("key") == last.first }
        ?.let { CatalogStore.withTechnique(it, CatalogStore.lastTech(this)) }
      if (e != null && !e.optBoolean("locked")) {
        val durIdx = durationIndexFor(e, last.second)
        val label = e.optJSONArray("durations")?.optJSONObject(durIdx)?.optString("label") ?: ""
        header.addView(TextView(this).apply {
          /* naam en duur op twee regels — op het ronde scherm paste het
             op één regel niet ("Calm Control · …") */
          val name = e.optString("name")
          text = android.text.SpannableString(name + "\n" + label).apply {
            setSpan(android.text.style.RelativeSizeSpan(0.8f), name.length + 1, length, 0)
            setSpan(android.text.style.ForegroundColorSpan(Color.parseColor("#55555A")), name.length + 1, length, 0)
          }
          setTextColor(Color.parseColor("#0A0A0A"))
          textSize = 14f
          typeface = android.graphics.Typeface.DEFAULT_BOLD
          gravity = android.view.Gravity.CENTER
          setLineSpacing(0f, 0.95f)
          maxLines = 2
          ellipsize = android.text.TextUtils.TruncateAt.END
          setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_vz_play_small, 0, 0, 0)
          compoundDrawablePadding = dp(6f)
          setPadding(dp(14f), 0, dp(14f), 0)
          background = GradientDrawable().apply {
            cornerRadius = dp(26f).toFloat()
            setColor(Color.WHITE)
          }
          contentDescription = "Start ${e.optString("name")}, $label"
          layoutParams = android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT, dp(54f)).apply {
            bottomMargin = dp(14f)
          }
          setOnClickListener { startLocalSession(this@MainActivity, e, durIdx) }
        })
      }
    }
    if (header.childCount > 1) list.addView(header, 0)

    /* 13 okt 2026 (operator: "de state-cirkel horizontaal laten scrollen?"):
       één toestand per scherm, de figuur groot — maar VERTICAAL (een veeg
       naar rechts is op Wear OS "terug"). De volgende figuur piept onderaan
       in beeld, zodat je ziet dat er meer is; het scherm klikt per
       toestand vast (snapHome). Rand/kroon bladert ook. */
    /* 13 okt 2026 (operator: "verticaal, maar de cirkels zelf met de
       minuten erin"): elke toestand is meteen zijn tijdcirkel — fijne ring
       in de kleur van de toestand, binnenin figuur, naam, techniek (⌄),
       minuten groot en de glazen Start. Start = meteen beginnen; tik op de
       minuten = draaiwiel (daar is de rand voor de minuten, hier voor het
       bladeren); tik op de techniek = andere techniek. */
    for (e0 in entries) {
      val color = parse(e0.optString("colorHex"))
      val e = CatalogStore.withTechnique(e0, e0.optJSONArray("techniques")?.optJSONObject(CatalogStore.selectedIdx(this, e0))?.optString("key"))
      val durs = e.optJSONArray("durations")
      var durIdx = e.optInt("defaultIdx", 0)
      if (last != null && last.first == e.optString("key")) durIdx = durationIndexFor(e, last.second)
      val locked = e.optBoolean("locked")

      val page = android.widget.FrameLayout(this).apply {
        tag = "page"
        layoutParams = android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT, pageH)
      }
      // fijne ring in de kleur van de toestand
      page.addView(View(this).apply {
        background = GradientDrawable().apply {
          shape = GradientDrawable.OVAL
          setColor(Color.TRANSPARENT)
          setStroke(dp(2f).coerceAtLeast(1), Color.argb(200, Color.red(color), Color.green(color), Color.blue(color)))
        }
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      }, android.widget.FrameLayout.LayoutParams(android.widget.FrameLayout.LayoutParams.MATCH_PARENT, android.widget.FrameLayout.LayoutParams.MATCH_PARENT).apply {
        setMargins(dp(5f), dp(5f), dp(5f), dp(5f))
      })
      val col = android.widget.LinearLayout(this).apply {
        orientation = android.widget.LinearLayout.VERTICAL
        gravity = android.view.Gravity.CENTER_HORIZONTAL
      }
      page.addView(col, android.widget.FrameLayout.LayoutParams(android.widget.FrameLayout.LayoutParams.MATCH_PARENT, android.widget.FrameLayout.LayoutParams.WRAP_CONTENT, android.view.Gravity.CENTER))

      col.addView(android.widget.ImageView(this).apply {
        setImageBitmap(artFor(e.optString("colorHex")))
        scaleType = android.widget.ImageView.ScaleType.FIT_CENTER
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      }, android.widget.LinearLayout.LayoutParams(dp(42f), dp(42f)))
      col.addView(TextView(this).apply {
        text = e.optString("name")
        setTextColor(Color.WHITE)
        textSize = 14f
        typeface = android.graphics.Typeface.DEFAULT_BOLD
        gravity = android.view.Gravity.CENTER
        if (locked) {
          setCompoundDrawablesWithIntrinsicBounds(0, 0, R.drawable.ic_vz_lock, 0)
          compoundDrawablePadding = dp(6f)
        }
      })
      val manyTechs = (e.optJSONArray("techniques")?.length() ?: 0) > 1
      col.addView(TextView(this).apply {
        text = e.optString("technique")
        setTextColor(Color.argb(200, 255, 255, 255))
        textSize = 10f
        maxLines = 1
        gravity = android.view.Gravity.CENTER
        setPadding(dp(10f), dp(3f), dp(8f), dp(3f))
        if (manyTechs) {
          setCompoundDrawablesWithIntrinsicBounds(0, 0, R.drawable.ic_vz_chevron_down, 0)
          compoundDrawablePadding = dp(3f)
          background = GradientDrawable().apply {
            cornerRadius = dp(12f).toFloat()
            setColor(Color.argb(30, 255, 255, 255))
            setStroke(dp(1f).coerceAtLeast(1), Color.argb(40, 255, 255, 255))
          }
          contentDescription = "Technique ${e.optString("technique")}. Tap to change."
          setOnClickListener {
            startActivity(Intent(this@MainActivity, TechniqueActivity::class.java).putExtra("key", e.optString("key")))
          }
        }
      }, android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(4f)
      })
      col.addView(TextView(this).apply {
        text = durs?.optJSONObject(durIdx)?.optString("label") ?: ""
        setTextColor(Color.WHITE)
        textSize = 30f
        typeface = android.graphics.Typeface.DEFAULT_BOLD
        gravity = android.view.Gravity.CENTER
        contentDescription = "Duration ${text}. Tap to change."
        setOnClickListener {
          startActivity(Intent(this@MainActivity, BreathSetupActivity::class.java).putExtra("key", e.optString("key")).putExtra("tech", e.optString("techniqueKey")))
        }
      }, android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(2f)
        bottomMargin = dp(6f)
      })
      if (locked) {
        col.addView(TextView(this).apply {
          text = "Unlock with Premium\non your phone"
          setTextColor(Color.argb(170, 255, 255, 255))
          textSize = 11f
          gravity = android.view.Gravity.CENTER
        })
      } else {
        col.addView(TextView(this).apply {
          text = "Start"
          setTextColor(Color.WHITE)
          textSize = 13f
          typeface = android.graphics.Typeface.DEFAULT_BOLD
          gravity = android.view.Gravity.CENTER
          background = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(Color.argb(82, 255, 255, 255), Color.argb(34, 255, 255, 255)),
          ).apply {
            cornerRadius = dp(16f).toFloat()
            setStroke(dp(1f).coerceAtLeast(1), Color.argb(50, 255, 255, 255))
          }
          contentDescription = "Start ${e.optString("name")}"
          setOnClickListener { startLocalSession(this@MainActivity, e, durIdx) }
        }, android.widget.LinearLayout.LayoutParams(dp(78f), dp(30f)))
      }
      list.addView(page)
    }
    buildDots()
  }

  /* Stipjes rechts: één per pagina, de huidige helder (Wear OS-patroon). */
  private fun pages(): List<View> {
    val list = findViewById<android.widget.LinearLayout>(R.id.homeList)
    return (0 until list.childCount).map { list.getChildAt(it) }.filter { it.tag == "page" }
  }

  private fun buildDots() {
    val dots = findViewById<android.widget.LinearLayout>(R.id.homeDots)
    dots.removeAllViews()
    val n = pages().size
    if (n < 2) return
    repeat(n) {
      dots.addView(View(this).apply {
        background = GradientDrawable().apply {
          shape = GradientDrawable.OVAL
          setColor(Color.WHITE)
        }
      }, android.widget.LinearLayout.LayoutParams(dp(5f), dp(5f)).apply {
        topMargin = dp(3f)
        bottomMargin = dp(3f)
      })
    }
    updateDots()
  }

  private fun updateDots() {
    val dots = findViewById<android.widget.LinearLayout>(R.id.homeDots)
    val scroll = idleContainer as? android.widget.ScrollView ?: return
    val center = scroll.scrollY + scroll.height / 2
    val ps = pages()
    var cur = 0
    var best = Int.MAX_VALUE
    ps.forEachIndexed { i, c ->
      val d = kotlin.math.abs(c.top + c.height / 2 - center)
      if (d < best) {
        best = d
        cur = i
      }
    }
    for (i in 0 until dots.childCount) dots.getChildAt(i).alpha = if (i == cur) 1f else 0.3f
  }

  /** Na het scrollen: de dichtstbijzijnde toestand mooi in het midden. */
  private val snapRunnable = Runnable { snapHome() }

  private fun snapHome() {
    val scroll = idleContainer as? android.widget.ScrollView ?: return
    val list = findViewById<android.widget.LinearLayout>(R.id.homeList)
    val centerY = scroll.scrollY + scroll.height / 2
    var best: View? = null
    var bestD = Int.MAX_VALUE
    for (i in 0 until list.childCount) {
      val c = list.getChildAt(i)
      if (c.tag != "page") continue
      val d = kotlin.math.abs(c.top + c.height / 2 - centerY)
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    val target = best ?: return
    scroll.smoothScrollTo(0, target.top + target.height / 2 - scroll.height / 2)
  }

  private fun durationIndexFor(e: org.json.JSONObject, minutes: Int): Int {
    val durs = e.optJSONArray("durations") ?: return 0
    for (i in 0 until durs.length()) if (durs.optJSONObject(i)?.optInt("minutes") == minutes) return i
    return e.optInt("defaultIdx", 0)
  }

  private fun parse(hex: String): Int = try {
    Color.parseColor(hex)
  } catch (_: Exception) {
    Color.parseColor("#00A3A3")
  }

}

/** Start een Breathe-sessie op het horloge zelf, uit de catalogus.
 *  CLEAR_TOP (13 okt 2026, operator: "ik kom direct op het techniekenscherm"):
 *  techniek- en tijdscherm worden opgeruimd, anders lagen ze nog achter de
 *  sessie en kwam je daar terug na wegvegen of opnieuw openen. */
internal fun startLocalSession(context: android.content.Context, e: org.json.JSONObject, durIdx: Int) {
  val json = CatalogStore.sessionJson(context, e, durIdx)
  val minutes = e.optJSONArray("durations")?.optJSONObject(durIdx)?.optInt("minutes") ?: 0
  CatalogStore.setLast(context, e.optString("key"), minutes, e.optString("techniqueKey"))
  CatalogStore.setTechFor(context, e.optString("key"), e.optString("techniqueKey"))
  context.startForegroundService(
    Intent(context, WearBreathSessionService::class.java).apply {
      action = WearBreathSessionService.ACTION_START
      putExtra(WearBreathSessionService.EXTRA_SESSION_JSON, json)
    },
  )
  context.startActivity(
    Intent(context, MainActivity::class.java).addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP,
    ),
  )
}
