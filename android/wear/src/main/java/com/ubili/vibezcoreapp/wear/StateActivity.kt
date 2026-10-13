package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 — stap 2 van de flow (vastgelegd met de operator): één
   toestand, alles voor die ene sessie op één scherm.
     · bovenaan de figuur die traag ademt, met de naam;
     · twee regels om na te kijken of te wijzigen:
         Technique — de techniek, met "Recommended" (advies van je niveau)
                     of "Last used";
         Duration  — de duur;
       tik = de korte lijst (TechniqueActivity / DurationActivity), daarna
       terug hier;
     · onderaan Start — de ENIGE knop die een sessie start.
   Zonder toegang: in plaats van Start waar je het ontgrendelt. */

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

class StateActivity : androidx.activity.ComponentActivity() {
  private fun dp(v: Float) = (v * resources.displayMetrics.density).toInt()
  private var scrollView: ScrollView? = null

  override fun onResume() {
    super.onResume()
    render()
  }

  private fun render() {
    val key = intent.getStringExtra("key")
    val raw = CatalogStore.breath(this).firstOrNull { it.optString("key") == key }
    if (raw == null) {
      finish()
      return
    }
    val selected = CatalogStore.selectedIdx(this, raw)
    val recommended = raw.optInt("recommendedIdx", 0)
    val e = CatalogStore.withTechnique(raw, raw.optJSONArray("techniques")?.optJSONObject(selected)?.optString("key"))
    val durIdx = CatalogStore.durationIdx(this, e)
    val dur = e.optJSONArray("durations")?.optJSONObject(durIdx)?.optString("label") ?: ""
    val color = try {
      Color.parseColor(e.optString("colorHex"))
    } catch (_: Exception) {
      Color.parseColor("#00A3A3")
    }
    val locked = e.optBoolean("locked")
    val manyTechs = (e.optJSONArray("techniques")?.length() ?: 0) > 1

    // terug uit een keuzelijst: blijf waar je was (Start in beeld)
    val keepY = scrollView?.scrollY ?: 0
    val scroll = ScrollView(this).apply {
      setBackgroundColor(Color.BLACK)
      isFocusable = true
      isFocusableInTouchMode = true
    }
    val col = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(24f), dp(10f), dp(24f), dp(34f))
    }
    scroll.addView(col)

    // de ademende figuur met zijn gloed
    val figure = ImageView(this).apply {
      setImageBitmap(android.graphics.BitmapFactory.decodeResource(resources, artResFor(e.optString("colorHex"))))
      scaleType = ImageView.ScaleType.FIT_CENTER
      val pad = dp(4f)
      setPadding(pad, pad, pad, pad)
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        gradientType = GradientDrawable.RADIAL_GRADIENT
        gradientRadius = dp(54f).toFloat()
        colors = intArrayOf(Color.argb(100, Color.red(color), Color.green(color), Color.blue(color)), Color.TRANSPARENT)
      }
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    col.addView(figure, LinearLayout.LayoutParams(dp(104f), dp(104f)))
    breatheView(figure)

    col.addView(TextView(this).apply {
      text = e.optString("name")
      setTextColor(Color.WHITE)
      textSize = 16f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      bottomMargin = dp(8f)
    })

    fun row(label: String, value: String, tag: String?, onTap: (() -> Unit)?) {
      val r = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(16f), dp(6f), dp(14f), dp(6f))
        background = GradientDrawable().apply {
          cornerRadius = dp(20f).toFloat()
          setColor(Color.parseColor("#1C1C1E"))
        }
        minimumHeight = dp(44f)
        if (onTap != null) {
          isClickable = true
          setOnClickListener { onTap() }
        }
        contentDescription = "$label: $value" + (if (tag != null) ", $tag" else "") + (if (onTap != null) ". Tap to change." else "")
      }
      r.addView(TextView(this).apply {
        // één regel: het label, of — als er gekozen kan worden — waarom
        // deze techniek klaarstaat ("Recommended" / "Last used")
        text = tag ?: label
        maxLines = 1
        setTextColor(if (tag != null) color else Color.argb(140, 255, 255, 255))
        textSize = 10f
      })
      r.addView(TextView(this).apply {
        text = if (onTap != null) "$value  ›" else value
        setTextColor(Color.WHITE)
        textSize = 13f
        typeface = Typeface.DEFAULT_BOLD
        maxLines = 2
      })
      col.addView(r, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
        bottomMargin = dp(5f)
      })
    }

    val techTag = when {
      selected == recommended -> "Recommended"
      else -> "Last used"
    }
    row(
      "Technique",
      e.optString("technique"),
      if (manyTechs) techTag else null,
      if (manyTechs) ({ startActivity(Intent(this, TechniqueActivity::class.java).putExtra("key", key)) }) else null,
    )
    row("Duration", dur, null) { startActivity(Intent(this, DurationActivity::class.java).putExtra("key", key)) }

    if (locked) {
      col.addView(TextView(this).apply {
        text = "Unlock with Premium on your phone"
        setTextColor(Color.argb(170, 255, 255, 255))
        textSize = 11f
        gravity = Gravity.CENTER
        setPadding(0, dp(8f), 0, 0)
      })
    } else {
      col.addView(TextView(this).apply {
        text = "Start"
        setTextColor(Color.parseColor("#0A0A0A"))
        textSize = 15f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        background = GradientDrawable().apply {
          cornerRadius = dp(22f).toFloat()
          setColor(Color.WHITE)
        }
        contentDescription = "Start ${e.optString("name")}, ${e.optString("technique")}, $dur"
        setOnClickListener {
          startLocalSession(this@StateActivity, e, durIdx)
          finish()
        }
      }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(44f)).apply {
        topMargin = dp(6f)
      })
    }

    setContentView(scroll)
    scrollView = scroll
    scroll.requestFocus()
    if (keepY > 0) {
      // pas na de opbouw terugscrollen, anders is er nog niets om te scrollen
      scroll.viewTreeObserver.addOnGlobalLayoutListener(object : android.view.ViewTreeObserver.OnGlobalLayoutListener {
        override fun onGlobalLayout() {
          scroll.viewTreeObserver.removeOnGlobalLayoutListener(this)
          scroll.scrollTo(0, keepY)
        }
      })
    }
  }

  /** Traag ademen, zoals de figuur tijdens de sessie (6 s per adem). */
  private fun breatheView(v: View) {
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
}
