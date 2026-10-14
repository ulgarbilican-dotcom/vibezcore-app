package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 — State Control op het horloge zelf starten (operator: "de
   bedoeling is in de horloge-app ook State Control te bedienen"). Na de tik
   op een toestand: de naam, de duur (tik = lijst per minuut) en een witte
   Start, de enige knop die een sessie start. Het ritme (rusthartslag,
   sterkte) komt van de telefoon via de catalogus; het horloge speelt het
   zelf, ook als de telefoon er niet is. */

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject

class StateControlActivity : androidx.activity.ComponentActivity() {
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
    val minutes = CatalogStore.stateMinutes(this, e)
    val scroll = ScrollView(this).apply {
      background = GradientDrawable().apply {
        gradientType = GradientDrawable.RADIAL_GRADIENT
        gradientRadius = resources.displayMetrics.heightPixels * 0.5f
        setGradientCenter(0.5f, 0.3f)
        colors = intArrayOf(
          Color.argb(70, Color.red(c), Color.green(c), Color.blue(c)),
          Color.argb(22, Color.red(c), Color.green(c), Color.blue(c)),
          Color.BLACK,
        )
      }
      isFocusable = true
      isFocusableInTouchMode = true
    }
    val col = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(24f), dp(30f), dp(24f), dp(34f))
    }
    scroll.addView(col)
    col.addView(TextView(this).apply {
      text = "STATE CONTROL"
      setTextColor(Color.argb(140, 255, 255, 255))
      textSize = 10f
      letterSpacing = 0.14f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    })
    col.addView(TextView(this).apply {
      text = e.optString("name")
      setTextColor(c)
      textSize = 18f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(2f)
      bottomMargin = dp(10f)
    })

    // Duur — zelfde knop als bij Breathe
    val row = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(16f), dp(6f), dp(14f), dp(6f))
      background = GradientDrawable().apply {
        cornerRadius = dp(20f).toFloat()
        setColor(Color.argb(36, 255, 255, 255))
      }
      isClickable = true
      contentDescription = "Duration: $minutes minutes. Tap to change."
      setOnClickListener {
        startActivity(Intent(this@StateControlActivity, StateDurationActivity::class.java).putExtra("key", key))
      }
    }
    row.addView(TextView(this).apply {
      text = if (minutes == e.optInt("defaultMinutes")) "Recommended" else "Duration"
      setTextColor(if (minutes == e.optInt("defaultMinutes")) c else Color.argb(140, 255, 255, 255))
      textSize = 10f
      maxLines = 1
    })
    row.addView(TextView(this).apply {
      text = "$minutes min  ›"
      setTextColor(Color.WHITE)
      textSize = 14f
      typeface = Typeface.DEFAULT_BOLD
      maxLines = 1
    })
    col.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52f)).apply {
      bottomMargin = dp(6f)
    })

    if (e.optBoolean("locked")) {
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
        contentDescription = "Start ${e.optString("name")}, $minutes minutes"
        setOnClickListener {
          startLocalStateSession(this@StateControlActivity, e, minutes)
          finish()
        }
      }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(44f)).apply {
        topMargin = dp(6f)
      })
    }
    setContentView(scroll)
    scroll.requestFocus()
  }
}

/** Start State Control op het horloge zelf, met het ritme uit de catalogus. */
internal fun startLocalStateSession(context: Context, e: JSONObject, minutes: Int) {
  val p = e.optJSONObject("params") ?: return
  CatalogStore.setStateMinutes(context, e.optString("key"), minutes)
  CatalogStore.setRecent(context, "state", e.optString("key"), minutes)
  val json = JSONObject(p.toString()).apply {
    put("title", e.optString("name"))
    put("colorHex", e.optString("colorHex"))
    put("curveOffsetSec", 0.0)
    put("remainingSec", minutes * 60.0)
    put("sound", false)
    put("local", true)
    put("mode", e.optInt("key"))
    put("plannedSec", minutes * 60)
    put("startedAt", System.currentTimeMillis())
  }
  context.startForegroundService(
    Intent(context, WearStateSessionService::class.java).apply {
      action = WearStateSessionService.ACTION_START
      putExtra(WearStateSessionService.EXTRA_START_JSON, json.toString())
    },
  )
  context.startActivity(
    Intent(context, MainActivity::class.java).addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP,
    ),
  )
}
