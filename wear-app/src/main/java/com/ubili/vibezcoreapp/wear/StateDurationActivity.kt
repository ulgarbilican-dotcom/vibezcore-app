package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 — duur voor State Control op het horloge: elke hele minuut
   van het bereik van de toestand (zoals de telefoon), "Recommended" bij de
   aanbevolen duur, je keuze omrand. Opent op je huidige keuze. */

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class StateDurationActivity : androidx.activity.ComponentActivity() {
  private fun dp(v: Float) = (v * resources.displayMetrics.density).toInt()

  override fun onResume() {
    super.onResume()
    render()
  }

  private fun render() {
    val key = intent.getStringExtra("key")
    val e = CatalogStore.state(this).firstOrNull { it.optString("key") == key }
    if (e == null) {
      finish()
      return
    }
    val c = try {
      Color.parseColor(e.optString("colorHex"))
    } catch (_: Exception) {
      Color.parseColor("#00A3A3")
    }
    val current = CatalogStore.stateMinutes(this, e)
    val rec = e.optInt("defaultMinutes")
    val scroll = ScrollView(this).apply {
      setBackgroundColor(Color.BLACK)
      isFocusable = true
      isFocusableInTouchMode = true
      isVerticalScrollBarEnabled = true
    }
    val list = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(30f), dp(34f), dp(30f), dp(40f))
    }
    scroll.addView(list)
    RoundList.attach(scroll, list) // 13 nov 2026: even groot in rust, lens tijdens scrollen
    list.addView(TextView(this).apply {
      text = e.optString("name")
      setTextColor(c)
      textSize = 13f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      bottomMargin = dp(10f)
    })
    for (m in e.optInt("minMinutes", 5)..e.optInt("maxMinutes", 30)) {
      val row = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        background = Glass.pill(this@StateDurationActivity, 24f, selected = m == current)
        tag = if (m == current) RoundList.ROW_INITIAL else RoundList.ROW
        minimumHeight = dp(44f)
        isClickable = true
        contentDescription = "$m minutes" + if (m == rec) ", recommended" else ""
        setOnClickListener {
          CatalogStore.setStateMinutes(this@StateDurationActivity, key ?: "", m)
          finish()
        }
      }
      row.addView(TextView(this).apply {
        text = "$m min"
        setTextColor(Color.WHITE)
        textSize = 17f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
      })
      if (m == rec) {
        row.addView(TextView(this).apply {
          text = "Recommended"
          setTextColor(readable(c))
          textSize = 11f
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
