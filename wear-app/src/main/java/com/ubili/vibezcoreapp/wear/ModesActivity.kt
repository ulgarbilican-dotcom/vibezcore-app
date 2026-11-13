package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 (operator: "het was mij niet duidelijk dat ik in breathwork
   zat"): na de keuze op het startscherm de toestanden van ÉÉN onderdeel,
   één per scherm, met bovenaan een klein label in de kleur van de toestand:
     · STATE CONTROL — de cirkel met water, zoals op de telefoon;
     · BREATHE       — de ademende figuur.
   Verticaal bladeren klikt per toestand vast. Een tik opent de instellingen
   (duur / techniek) — hier start nooit iets. */

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class ModesActivity : androidx.activity.ComponentActivity() {
  /* 13 nov 2026: lettergrootte van het systeem tot 1,15 volgen (schermenaudit) */
  override fun attachBaseContext(newBase: android.content.Context) {
    super.attachBaseContext(capFontScale(newBase))
  }

  private fun dp(v: Float) = (v * resources.displayMetrics.density).toInt()

  private lateinit var scroll: ScrollView
  private lateinit var list: LinearLayout
  private var page = 0
  private var signature = ""
  private val catalogListener: () -> Unit = { runOnUiThread { render() } }

  private val kind get() = intent.getStringExtra(EXTRA_KIND) ?: KIND_BREATH

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    scroll = ScrollView(this).apply {
      setBackgroundColor(Color.BLACK)
      isFocusable = true
      isFocusableInTouchMode = true
      isVerticalScrollBarEnabled = true
    }
    list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    scroll.addView(list)
    scroll.setOnScrollChangeListener { v, _, _, _, _ ->
      v.removeCallbacks(snap)
      v.postDelayed(snap, 140)
    }
    setContentView(scroll)
  }

  override fun onResume() {
    super.onResume()
    CatalogStore.addListener(catalogListener)
    render()
    scroll.requestFocus()
  }

  override fun onPause() {
    CatalogStore.removeListener(catalogListener)
    super.onPause()
  }

  private fun render() {
    val entries = if (kind == KIND_STATE) CatalogStore.state(this) else CatalogStore.breath(this)
    /* ook naam en "wanneer"-regel: anders bleef een gewijzigde tekst staan
       zolang de lijst open was (15 okt 2026) */
    val sig = entries.joinToString {
      it.optString("key") + it.optBoolean("locked") + it.optString("colorHex") + it.optString("name") + it.optString("use")
    }
    if (sig == signature) return
    signature = sig
    list.removeAllViews()
    val pageH = resources.displayMetrics.heightPixels
    if (entries.isEmpty()) {
      list.addView(TextView(this).apply {
        text = "Open VIBEZCORE on your phone once to set up your watch"
        setTextColor(Color.parseColor("#F4F4F4"))
        textSize = 15f
        gravity = Gravity.CENTER
        setPadding(dp(28f), 0, dp(28f), 0)
      }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, pageH))
      return
    }
    for (e in entries) list.addView(pageFor(e, pageH), LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, pageH))
    /* 14 okt 2026: openen op de laatst gebruikte toestand van dit onderdeel
       (i.p.v. een "Recent"-rij op het startscherm) — zoals Workout. */
    val last = CatalogStore.lastKey(this, if (kind == KIND_STATE) "state" else "breath")
    val idx = entries.indexOfFirst { it.optString("key") == last }
    if (idx > 0) scroll.post { scroll.scrollTo(0, idx * pageH) }
  }

  private fun pageFor(e: org.json.JSONObject, pageH: Int): View {
    val hex = e.optString("colorHex")
    val c = accentColor(hex)
    val locked = e.optBoolean("locked")
    /* 13 nov 2026 (Play WO-V16, gemeten op Galaxy Watch4 40 mm): label + figuur + naam + 2 regels "wanneer" waren 190 dp op een scherm
       van 198 dp — "To unwind" stond 3 dp van de rand. Nu past alles binnen de veilige marge boven/onder; de figuur krijgt wat overblijft
       (max. 112 dp zoals voorheen, op elk scherm even groot). */
    /* 13 nov 2026 (audit 180–225 dp en lettergrootte 1,15): bovenaan het label en onderaan de gebruiksregel zijn smal-breed tekst dicht bij de rand;
       daar is 1,35 x de gewone marge nodig, en de vaste tekstdelen groeien mee met de lettergrootte. */
    val fs = resources.configuration.fontScale.coerceAtLeast(1f)
    val figDp = (RoundFit.heightDp(this) - 2f * 1.35f * RoundFit.edgeDp(this) - 78f * fs).coerceIn(52f, 112f)
    val page = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      tag = "page"
      isClickable = true
      contentDescription = e.optString("name") + (if (locked) ", locked" else "")
      setOnClickListener {
        val target = if (kind == KIND_STATE) StateControlActivity::class.java else StateActivity::class.java
        startActivity(Intent(this@ModesActivity, target).putExtra("key", e.optString("key")))
      }
    }
    // het label: waar je bent
    page.addView(TextView(this).apply {
      text = if (kind == KIND_STATE) "STATE CONTROL" else "BREATHWORK"
      // het label is enkel "waar ben je" — rustig grijs (operator 14 okt)
      setTextColor(Color.argb(140, 255, 255, 255))
      textSize = 10f
      letterSpacing = 0.14f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      bottomMargin = dp(6f)
    })
    if (kind == KIND_STATE) {
      val minutes = CatalogStore.stateMinutes(this, e)
      page.addView(WaterCircleView(this).apply {
        color = c
        centerText = "%d:00".format(minutes)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      }, LinearLayout.LayoutParams(dp(figDp), dp(figDp)))
    } else {
      if (artResFor(hex) != R.drawable.vz_art_tree) page.background = halo(hex, pageH)
      val figure = ImageView(this).apply {
        setImageBitmap(trimmedArt(this@ModesActivity, hex))
        scaleType = ImageView.ScaleType.FIT_CENTER
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      }
      val sz = dp(figDp * (108f / 112f) * artOpticalScale(hex))
      page.addView(figure, LinearLayout.LayoutParams(sz, sz))
      breathe(figure)
    }
    page.addView(TextView(this).apply {
      text = e.optString("name")
      // de naam van de toestand in zijn kleur (Breathwork: de kleur van de figuur)
      setTextColor(if (kind == KIND_STATE) c else figureColor(this@ModesActivity, hex))
      textSize = 17f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      if (locked) {
        setCompoundDrawablesWithIntrinsicBounds(0, 0, R.drawable.ic_vz_lock, 0)
        compoundDrawablePadding = dp(6f)
      }
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(8f)
    })
    /* 15 okt 2026 (operator: per toestand kort wanneer te gebruiken, "maar
       moet overzichtelijk blijven"): één rustige grijze regel onder de naam,
       geen i-knop. Leeg bij een oudere telefoon-app → niets. */
    e.optString("use").takeIf { it.isNotBlank() }?.let { use ->
      page.addView(TextView(this).apply {
        text = use
        setTextColor(Color.argb(150, 255, 255, 255))
        textSize = 12f
        gravity = Gravity.CENTER
        /* rond scherm: onderaan smaller — nooit afknippen, desnoods 2 regels */
        maxLines = 2
        setPadding(dp(30f), 0, dp(30f), 0)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(2f)
      })
      page.contentDescription = "${page.contentDescription}. $use"
    }
    return page
  }

  /** Ingetogen halo in de kleur van de figuur, die binnen de pagina uitdooft. */
  private fun halo(colorHex: String, pageH: Int): GradientDrawable {
    val c = figureColor(this, colorHex)
    fun a(alpha: Int) = Color.argb(alpha, Color.red(c), Color.green(c), Color.blue(c))
    return GradientDrawable().apply {
      gradientType = GradientDrawable.RADIAL_GRADIENT
      setGradientCenter(0.5f, 0.46f)
      gradientRadius = pageH * 0.38f
      colors = intArrayOf(a(92), a(36), a(10), Color.TRANSPARENT)
    }
  }

  /** Na het scrollen vastklikken; een korte veeg is genoeg voor de volgende. */
  private val snap = Runnable {
    val h = scroll.height
    val pages = (0 until list.childCount).count { list.getChildAt(it).tag == "page" }
    if (h <= 0 || pages == 0) return@Runnable
    val delta = scroll.scrollY - page * h
    page = when {
      delta > h * 0.12f -> kotlin.math.ceil(scroll.scrollY / h.toFloat()).toInt()
      delta < -h * 0.12f -> kotlin.math.floor(scroll.scrollY / h.toFloat()).toInt()
      else -> page
    }.coerceIn(0, pages - 1)
    val y = page * h
    if (y != scroll.scrollY) scroll.smoothScrollTo(0, y)
  }

  /** Traag ademen, zoals de figuur tijdens de sessie (6 s per adem). */
  private fun breathe(v: View) {
    val sx = android.animation.ObjectAnimator.ofFloat(v, View.SCALE_X, 0.9f, 1f)
    val sy = android.animation.ObjectAnimator.ofFloat(v, View.SCALE_Y, 0.9f, 1f)
    val al = android.animation.ObjectAnimator.ofFloat(v, View.ALPHA, 0.8f, 1f)
    listOf(sx, sy, al).forEach {
      it.duration = 3000
      it.repeatCount = android.animation.ValueAnimator.INFINITE
      it.repeatMode = android.animation.ValueAnimator.REVERSE
      it.interpolator = android.view.animation.AccelerateDecelerateInterpolator()
    }
    android.animation.AnimatorSet().apply {
      playTogether(sx, sy, al)
      start()
    }
  }

  companion object {
    const val EXTRA_KIND = "kind"
    const val KIND_STATE = "state"
    const val KIND_BREATH = "breath"
  }
}
