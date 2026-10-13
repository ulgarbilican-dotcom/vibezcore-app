package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 (operator: "gebruiker moet eerst de techniek kunnen kiezen").
   Na de toestand: de technieken van die toestand, met hun niveau — zoals op
   de telefoon (breath-setup). De techniek die de telefoon voor deze
   gebruiker zou kiezen, staat gemarkeerd ("For you"). Daarna de tijd
   (terug naar de cirkel op het startscherm). Draaiende rand scrolt. */

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class TechniqueActivity : androidx.activity.ComponentActivity() {
  private fun dp(v: Float) = (v * resources.displayMetrics.density).toInt()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val key = intent.getStringExtra("key")
    val e = CatalogStore.breath(this).firstOrNull { it.optString("key") == key }
    val techs = e?.optJSONArray("techniques")
    if (e == null || techs == null || techs.length() == 0) {
      finish()
      return
    }
    val color = try {
      Color.parseColor(e.optString("colorHex"))
    } catch (_: Exception) {
      Color.parseColor("#00A3A3")
    }
    val recommended = e.optInt("recommendedIdx", 0)
    /* 13 okt 2026: je laatste keuze staat klaar ("Last used"); "For you"
       blijft het advies van je niveau. */
    val selected = CatalogStore.selectedIdx(this, e)

    val scroll = ScrollView(this).apply {
      setBackgroundColor(Color.BLACK)
      isVerticalScrollBarEnabled = false
      isFocusable = true
      isFocusableInTouchMode = true
    }
    val list = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(22f), dp(30f), dp(22f), dp(48f))
    }
    scroll.addView(list)

    list.addView(TextView(this).apply {
      text = e.optString("name")
      setTextColor(color)
      textSize = 13f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      bottomMargin = dp(10f)
    })

    for (i in 0 until techs.length()) {
      val t = techs.optJSONObject(i) ?: continue
      val row = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(16f), dp(8f), dp(14f), dp(8f))
        background = GradientDrawable().apply {
          cornerRadius = dp(24f).toFloat()
          setColor(Color.parseColor("#1C1C1E"))
          /* de techniek die klaarstaat: dunne rand in de kleur van de toestand */
          if (i == selected) setStroke(dp(1.5f).coerceAtLeast(1), Color.argb(150, Color.red(color), Color.green(color), Color.blue(color)))
        }
        minimumHeight = dp(52f)
        isClickable = true
        contentDescription = t.optString("name")
        setOnClickListener {
          /* kiezen = onthouden en terug naar de cirkel van deze toestand */
          CatalogStore.setTechFor(this@TechniqueActivity, key ?: "", t.optString("key"))
          finish()
        }
      }
      row.addView(TextView(this).apply {
        text = t.optString("name")
        setTextColor(Color.WHITE)
        textSize = 14f
        typeface = Typeface.DEFAULT_BOLD
        maxLines = 2
      })
      row.addView(TextView(this).apply {
        // één regel: waarom deze klaarstaat, anders het niveau
        text = when {
          i == recommended -> "Recommended"
          i == selected -> "Last used"
          else -> t.optString("level")
        }
        maxLines = 1
        setTextColor(if (i == recommended || i == selected) color else Color.argb(140, 255, 255, 255))
        textSize = 11f
      })
      list.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
        bottomMargin = dp(6f)
      })
    }

    setContentView(scroll)
    scroll.requestFocus()
  }
}
