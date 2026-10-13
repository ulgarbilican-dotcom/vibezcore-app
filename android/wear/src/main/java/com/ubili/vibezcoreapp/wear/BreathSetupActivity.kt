package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 — het horloge zelfstandig: één toestand kiezen en starten.
   Zoals Apple's Ademhalen: de figuur, de naam, de duur groot in het midden
   (draai aan de rand of tik − / +), en één witte Start-pil. De duurstappen
   en de techniek komen van de telefoon (CatalogStore) — hier wordt niets
   zelf bedacht. Zonder toegang: geen Start, wel waar je het ontgrendelt. */

import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.SystemClock
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.InputDevice
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject

class BreathSetupActivity : androidx.activity.ComponentActivity() {
  private var entry: JSONObject? = null
  private var durIdx = 0
  private lateinit var durText: TextView
  private var rotaryAcc = 0f
  private var lastStepAt = 0L

  private fun dp(v: Float) = (v * resources.displayMetrics.density).toInt()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val key = intent.getStringExtra("key")
    val e = CatalogStore.breath(this).firstOrNull { it.optString("key") == key }
    if (e == null) {
      finish()
      return
    }
    entry = e
    durIdx = e.optInt("defaultIdx", 0)
    CatalogStore.last(this)?.let { (k, minutes) ->
      if (k == key) {
        val durs = e.optJSONArray("durations")
        for (i in 0 until (durs?.length() ?: 0)) if (durs?.optJSONObject(i)?.optInt("minutes") == minutes) durIdx = i
      }
    }
    val color = try {
      Color.parseColor(e.optString("colorHex"))
    } catch (_: Exception) {
      Color.parseColor("#00A3A3")
    }

    val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
    val col = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(20f), dp(18f), dp(20f), dp(12f))
    }
    root.addView(col, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))

    col.addView(ImageView(this).apply {
      setImageBitmap(BitmapFactory.decodeResource(resources, artResFor(e.optString("colorHex"))))
      scaleType = ImageView.ScaleType.FIT_CENTER
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }, LinearLayout.LayoutParams(dp(78f), dp(78f)))

    col.addView(TextView(this).apply {
      text = e.optString("name")
      setTextColor(Color.WHITE)
      textSize = 15f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    })
    col.addView(TextView(this).apply {
      text = e.optString("technique")
      setTextColor(Color.argb(140, 255, 255, 255))
      textSize = 11f
      gravity = Gravity.CENTER
    })

    val locked = e.optBoolean("locked")
    val durRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    durRow.addView(stepButton("−") { step(-1) })
    durText = TextView(this).apply {
      setTextColor(Color.WHITE)
      textSize = 24f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }
    durRow.addView(durText, LinearLayout.LayoutParams(dp(110f), LinearLayout.LayoutParams.WRAP_CONTENT))
    durRow.addView(stepButton("+") { step(1) })
    col.addView(durRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(8f)
      bottomMargin = dp(10f)
    })

    if (locked) {
      col.addView(TextView(this).apply {
        text = "Unlock with Premium on your phone"
        setTextColor(Color.argb(170, 255, 255, 255))
        textSize = 12f
        gravity = Gravity.CENTER
      })
    } else {
      col.addView(TextView(this).apply {
        text = "Start"
        setTextColor(Color.parseColor("#0A0A0A"))
        textSize = 15f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        background = GradientDrawable().apply {
          cornerRadius = dp(24f).toFloat()
          setColor(Color.WHITE)
        }
        contentDescription = "Start ${e.optString("name")}"
        setOnClickListener {
          startLocalSession(this@BreathSetupActivity, e, durIdx)
          finish()
        }
      }, LinearLayout.LayoutParams(dp(124f), dp(44f)))
    }

    /* een dun accent in de kleur van de toestand onder de figuur */
    col.getChildAt(0).background = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      gradientType = GradientDrawable.RADIAL_GRADIENT
      gradientRadius = dp(40f).toFloat()
      colors = intArrayOf(Color.argb(70, Color.red(color), Color.green(color), Color.blue(color)), Color.TRANSPARENT)
    }

    setContentView(root)
    root.isFocusable = true
    root.isFocusableInTouchMode = true
    root.requestFocus()
    showDuration()
  }

  private fun stepButton(label: String, onTap: () -> Unit) = TextView(this).apply {
    text = label
    setTextColor(Color.WHITE)
    textSize = 20f
    gravity = Gravity.CENTER
    background = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(Color.parseColor("#1C1C1E"))
    }
    contentDescription = if (label == "+") "Longer" else "Shorter"
    setOnClickListener { onTap() }
    layoutParams = LinearLayout.LayoutParams(dp(34f), dp(34f))
  }

  private fun durations() = entry?.optJSONArray("durations")

  private fun step(dir: Int) {
    val n = durations()?.length() ?: return
    val next = (durIdx + dir).coerceIn(0, n - 1)
    if (next == durIdx) return
    durIdx = next
    durText.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
    showDuration()
  }

  private fun showDuration() {
    durText.text = durations()?.optJSONObject(durIdx)?.optString("label") ?: ""
  }

  /* Draaiende rand / kroon: één stap per tik, kort na elkaar geremd zodat
     een snelle draai niet in één keer naar het einde schiet. */
  override fun onGenericMotionEvent(event: MotionEvent): Boolean {
    if (event.action == MotionEvent.ACTION_SCROLL && event.isFromSource(InputDevice.SOURCE_ROTARY_ENCODER)) {
      val delta = -event.getAxisValue(MotionEvent.AXIS_SCROLL) *
        ViewConfiguration.get(this).getScaledVerticalScrollFactor()
      rotaryAcc += delta
      val now = SystemClock.uptimeMillis()
      if (kotlin.math.abs(rotaryAcc) >= dp(24f) && now - lastStepAt > 90) {
        step(if (rotaryAcc > 0) 1 else -1)
        rotaryAcc = 0f
        lastStepAt = now
      }
      return true
    }
    return super.onGenericMotionEvent(event)
  }
}
