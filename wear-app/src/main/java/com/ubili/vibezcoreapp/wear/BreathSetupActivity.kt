package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 — het horloge zelfstandig: de tijd kiezen en starten.
   Operator (laatste ronde): "kunnen we naar een draaiwiel gaan; de cirkel
   rondom mag gewoon een fijne lijn in de kleur van de state zijn; de
   animatie mag hier weg; de techniek bovenaan". Dus:
     · bovenaan de techniek als keuzeknopje (⌄) — tik = andere techniek;
     · in het midden een draaiwiel met de vaste duurstappen (WheelPickerView):
       veeg omhoog/omlaag, of draai aan de rand/kroon (één stap per klikje);
     · rondom een fijne lijn in de kleur van de toestand;
     · onderaan de glazen Start-pil.
   De duurstappen en de techniek komen van de telefoon (CatalogStore). */

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.SystemClock
import android.view.Gravity
import android.view.InputDevice
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject

class BreathSetupActivity : androidx.activity.ComponentActivity() {
  private var entry: JSONObject? = null
  private lateinit var wheel: WheelPickerView
  private var lastStepAt = 0L

  private fun dp(v: Float) = (v * resources.displayMetrics.density).toInt()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val key = intent.getStringExtra("key")
    val e = CatalogStore.breath(this).firstOrNull { it.optString("key") == key }
      ?.let { raw ->
        /* gekozen techniek: uit de lijst, anders wat klaarstaat (eigen keuze
           op het horloge of die van de telefoon) */
        val tech = intent.getStringExtra("tech")
          ?: raw.optJSONArray("techniques")?.optJSONObject(CatalogStore.selectedIdx(this, raw))?.optString("key")
        CatalogStore.withTechnique(raw, tech)
      }
    if (e == null) {
      finish()
      return
    }
    entry = e
    val durs = e.optJSONArray("durations")
    var startIdx = e.optInt("defaultIdx", 0)
    CatalogStore.last(this)?.let { (k, minutes) ->
      if (k == key) {
        for (i in 0 until (durs?.length() ?: 0)) if (durs?.optJSONObject(i)?.optInt("minutes") == minutes) startIdx = i
      }
    }
    val color = try {
      Color.parseColor(e.optString("colorHex"))
    } catch (_: Exception) {
      Color.parseColor("#00A3A3")
    }
    val locked = e.optBoolean("locked")

    val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }

    // fijne lijn rondom, in de kleur van de toestand
    root.addView(View(this).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.TRANSPARENT)
        setStroke(dp(2f).coerceAtLeast(1), Color.argb(200, Color.red(color), Color.green(color), Color.blue(color)))
      }
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT).apply {
      setMargins(dp(5f), dp(5f), dp(5f), dp(5f))
    })

    val col = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
    }
    root.addView(col, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER))

    // techniek bovenaan, als keuzeknopje
    val manyTechs = (e.optJSONArray("techniques")?.length() ?: 0) > 1
    col.addView(TextView(this).apply {
      text = e.optString("technique")
      setTextColor(Color.argb(220, 255, 255, 255))
      textSize = 11f
      maxLines = 1
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setPadding(dp(12f), dp(5f), dp(10f), dp(5f))
      if (manyTechs) {
        setCompoundDrawablesWithIntrinsicBounds(0, 0, R.drawable.ic_vz_chevron_down, 0)
        compoundDrawablePadding = dp(4f)
        /* geen pil, enkel het pijltje (operator 13 okt 2026) */
        contentDescription = "Technique ${e.optString("technique")}. Tap to change."
        setOnClickListener {
          startActivity(Intent(this@BreathSetupActivity, TechniqueActivity::class.java).putExtra("key", e.optString("key")))
          finish()
        }
      }
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))

    // het draaiwiel met de duur
    wheel = WheelPickerView(this).apply {
      labels = (0 until (durs?.length() ?: 0)).map { durs?.optJSONObject(it)?.optString("label") ?: "" }
      setIndex(startIdx, animate = false)
      contentDescription = "Duration. Swipe up or down, or turn the bezel."
    }
    col.addView(wheel, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(112f)).apply {
      topMargin = dp(4f)
      bottomMargin = dp(6f)
    })

    if (locked) {
      col.addView(TextView(this).apply {
        text = "Unlock with Premium\non your phone"
        setTextColor(Color.argb(170, 255, 255, 255))
        textSize = 11f
        gravity = Gravity.CENTER
      })
    } else {
      col.addView(TextView(this).apply {
        /* subtiel, als glas: licht van boven, dunne lichte rand */
        text = "Start"
        setTextColor(Color.WHITE)
        textSize = 13f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        background = GradientDrawable(
          GradientDrawable.Orientation.TOP_BOTTOM,
          intArrayOf(Color.argb(82, 255, 255, 255), Color.argb(34, 255, 255, 255)),
        ).apply {
          cornerRadius = dp(16f).toFloat()
          setStroke(dp(1f).coerceAtLeast(1), Color.argb(50, 255, 255, 255))
        }
        contentDescription = "Start ${e.optString("name")}"
        setOnClickListener {
          startLocalSession(this@BreathSetupActivity, e, wheel.index)
          finish()
        }
      }, LinearLayout.LayoutParams(dp(78f), dp(30f)))
    }

    setContentView(root)
    root.isFocusable = true
    root.isFocusableInTouchMode = true
    root.requestFocus()
  }

  /* Draaiende rand / kroon — gemeten op de Galaxy Watch4: één klikje = één
     signaal van ±1, soms dubbel binnen enkele ms. Eén klikje = één stap
     (met de klok mee = langer); een tweede signaal binnen 60 ms telt niet. */
  override fun onGenericMotionEvent(event: MotionEvent): Boolean {
    if (event.action == MotionEvent.ACTION_SCROLL && event.isFromSource(InputDevice.SOURCE_ROTARY_ENCODER)) {
      val axis = event.getAxisValue(MotionEvent.AXIS_SCROLL)
      val now = SystemClock.uptimeMillis()
      if (axis != 0f && now - lastStepAt > 60) {
        wheel.setIndex(wheel.index + if (axis < 0) 1 else -1, animate = true)
        lastStepAt = now
      }
      return true
    }
    return super.onGenericMotionEvent(event)
  }
}
