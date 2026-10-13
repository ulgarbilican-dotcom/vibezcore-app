package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 (operator: "het wiel werkt niet — heb jij een betere,
   professionele suggestie?"). Zoals Apple's Ademhalen/Timer: een korte lijst
   met de duurstappen van de gekozen techniek (2–4 stappen — een wiel is
   daarvoor overbodig). Tik = kiezen en terug naar de cirkel. De rand/kroon
   scrollt de lijst zoals in elke app. De duurstappen komen van de telefoon. */

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class DurationActivity : androidx.activity.ComponentActivity() {
  private fun dp(v: Float) = (v * resources.displayMetrics.density).toInt()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
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
    val durs = e.optJSONArray("durations")
    if (durs == null || durs.length() == 0) {
      finish()
      return
    }
    val color = try {
      Color.parseColor(e.optString("colorHex"))
    } catch (_: Exception) {
      Color.parseColor("#00A3A3")
    }
    val current = CatalogStore.durationIdx(this, e)
    val recommended = e.optInt("defaultIdx", 0)

    val scroll = ScrollView(this).apply {
      setBackgroundColor(Color.BLACK)
      isVerticalScrollBarEnabled = true
      isFocusable = true
      isFocusableInTouchMode = true
    }
    val list = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(26f), dp(34f), dp(26f), dp(48f))
    }
    scroll.addView(list)

    list.addView(TextView(this).apply {
      text = e.optString("technique")
      setTextColor(color)
      textSize = 12f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      bottomMargin = dp(10f)
    })

    for (i in 0 until durs.length()) {
      val d = durs.optJSONObject(i) ?: continue
      val row = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        background = GradientDrawable().apply {
          cornerRadius = dp(24f).toFloat()
          setColor(Color.parseColor("#1C1C1E"))
          if (i == current) setStroke(dp(1.5f).coerceAtLeast(1), Color.argb(170, Color.red(color), Color.green(color), Color.blue(color)))
        }
        minimumHeight = dp(50f)
        isClickable = true
        contentDescription = d.optString("label")
        setOnClickListener {
          CatalogStore.setDurationFor(this@DurationActivity, e.optString("key"), e.optString("techniqueKey"), d.optInt("minutes"))
          finish()
        }
      }
      row.addView(TextView(this).apply {
        text = d.optString("label")
        setTextColor(Color.WHITE)
        textSize = 17f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
      })
      if (i == recommended) {
        row.addView(TextView(this).apply {
          text = "Recommended"
          setTextColor(color)
          textSize = 10f
          gravity = Gravity.CENTER
        })
      }
      list.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
        bottomMargin = dp(6f)
      })
    }

    setContentView(scroll)
    scroll.requestFocus()
  }
}
