package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 (operator, Apple-richting): de instellingen van één toestand
   op één rustig scherm, bereikbaar via ··· onder de figuur. Twee rijen:
   Technique en Duration, elk met de huidige keuze; tik = de korte lijst
   (TechniqueActivity / DurationActivity), daarna terug hier. */

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class OptionsActivity : androidx.activity.ComponentActivity() {
  private fun dp(v: Float) = (v * resources.displayMetrics.density).toInt()

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
    val e = CatalogStore.withTechnique(
      raw,
      raw.optJSONArray("techniques")?.optJSONObject(CatalogStore.selectedIdx(this, raw))?.optString("key"),
    )
    val color = try {
      Color.parseColor(e.optString("colorHex"))
    } catch (_: Exception) {
      Color.parseColor("#00A3A3")
    }
    val dur = e.optJSONArray("durations")?.optJSONObject(CatalogStore.durationIdx(this, e))?.optString("label") ?: ""

    val scroll = ScrollView(this).apply {
      setBackgroundColor(Color.BLACK)
      isFocusable = true
      isFocusableInTouchMode = true
    }
    val list = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(24f), dp(40f), dp(24f), dp(40f))
    }
    scroll.addView(list)
    list.addView(TextView(this).apply {
      text = e.optString("name")
      setTextColor(color)
      textSize = 14f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      bottomMargin = dp(10f)
    })

    fun row(label: String, value: String, target: Class<*>) {
      val r = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(18f), dp(8f), dp(16f), dp(8f))
        background = GradientDrawable().apply {
          cornerRadius = dp(24f).toFloat()
          setColor(Color.parseColor("#1C1C1E"))
        }
        minimumHeight = dp(54f)
        isClickable = true
        contentDescription = "$label: $value"
        setOnClickListener {
          startActivity(Intent(this@OptionsActivity, target).putExtra("key", key))
        }
      }
      r.addView(TextView(this).apply {
        text = label
        setTextColor(Color.argb(140, 255, 255, 255))
        textSize = 11f
      })
      r.addView(TextView(this).apply {
        text = value
        setTextColor(Color.WHITE)
        textSize = 15f
        typeface = Typeface.DEFAULT_BOLD
        maxLines = 2
      })
      list.addView(r, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
        bottomMargin = dp(6f)
      })
    }
    if ((e.optJSONArray("techniques")?.length() ?: 0) > 1) row("Technique", e.optString("technique"), TechniqueActivity::class.java)
    row("Duration", dur, DurationActivity::class.java)

    setContentView(scroll)
    scroll.requestFocus()
  }
}
