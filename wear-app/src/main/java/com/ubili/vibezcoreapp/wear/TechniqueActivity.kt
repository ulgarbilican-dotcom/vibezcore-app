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
    val color = figureColor(this, e.optString("colorHex"))
    val recommended = e.optInt("recommendedIdx", 0)
    /* 13 okt 2026: je laatste keuze staat klaar ("Last used"); "For you"
       blijft het advies van je niveau. */
    val selected = CatalogStore.selectedIdx(this, e)

    val scroll = ScrollView(this).apply {
      background = stateGlow(this@TechniqueActivity, e.optString("colorHex"), 0.3f)
      isVerticalScrollBarEnabled = false
      isFocusable = true
      isFocusableInTouchMode = true
    }
    val list = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(30f), dp(34f), dp(30f), dp(48f))
    }
    scroll.addView(list)
    RoundList.attach(scroll, list) // 13 nov 2026: even groot in rust, lens tijdens scrollen

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
        setPadding(dp(14f), dp(4f), dp(12f), dp(4f))
        /* 13 nov 2026 (operator: "omlijning moet niet in kleur"): de gekozen techniek = lichter glas, geen gekleurde rand */
        background = Glass.pill(this@TechniqueActivity, 24f, selected = i == selected)
        tag = if (i == selected) RoundList.ROW_INITIAL else RoundList.ROW
        minimumHeight = dp(46f)
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
        typeface = Typeface.DEFAULT_BOLD
        maxLines = 1
        androidx.core.widget.TextViewCompat.setAutoSizeTextTypeUniformWithConfiguration(this, 10, 14, 1, android.util.TypedValue.COMPLEX_UNIT_SP)
      }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(20f)))
      row.addView(TextView(this).apply {
        // één regel: waarom deze klaarstaat, anders het niveau
        text = when {
          i == recommended -> "Recommended"
          i == selected -> "Last used"
          else -> t.optString("level")
        }
        maxLines = 1
        setTextColor(if (i == recommended || i == selected) readable(color) else Color.argb(190, 255, 255, 255))
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
