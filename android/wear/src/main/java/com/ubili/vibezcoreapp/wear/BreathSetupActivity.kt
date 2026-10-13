package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 — het horloge zelfstandig: één toestand kiezen en starten.
   Operator: "het mooiste is een cirkel met draaisysteem, + en − weg, alles
   in de cirkel moet kunnen ademen". Daarom: een ring langs de rand
   (DurationDialView) — veeg rond de ring of draai aan de rand/kroon — en in
   het midden enkel de figuur, de naam, de duur groot en de witte Start-pil.
   De duurstappen en de techniek komen van de telefoon (CatalogStore) — hier
   wordt niets zelf bedacht. Zonder toegang: geen Start, wel waar je het
   ontgrendelt. */

import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.SystemClock
import android.view.Gravity
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
  private lateinit var dial: DurationDialView
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

    dial = DurationDialView(this).apply {
      steps = durs?.length() ?: 1
      this.color = color
      setIndex(startIdx, fromUser = false)
      onChange = { showDuration() }
    }
    root.addView(dial, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))

    val col = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
    }
    root.addView(col, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER))

    col.addView(ImageView(this).apply {
      setImageBitmap(BitmapFactory.decodeResource(resources, artResFor(e.optString("colorHex"))))
      scaleType = ImageView.ScaleType.FIT_CENTER
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        gradientType = GradientDrawable.RADIAL_GRADIENT
        gradientRadius = dp(24f).toFloat()
        colors = intArrayOf(Color.argb(70, Color.red(color), Color.green(color), Color.blue(color)), Color.TRANSPARENT)
      }
    }, LinearLayout.LayoutParams(dp(44f), dp(44f)))

    col.addView(TextView(this).apply {
      text = e.optString("name")
      setTextColor(Color.argb(200, 255, 255, 255))
      textSize = 13f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(4f)
    })

    durText = TextView(this).apply {
      setTextColor(Color.WHITE)
      textSize = 28f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }
    col.addView(durText, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      bottomMargin = dp(10f)
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
        text = "Start"
        setTextColor(Color.parseColor("#0A0A0A"))
        textSize = 15f
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        background = GradientDrawable().apply {
          cornerRadius = dp(20f).toFloat()
          setColor(Color.WHITE)
        }
        contentDescription = "Start ${e.optString("name")}"
        setOnClickListener {
          startLocalSession(this@BreathSetupActivity, e, dial.index)
          finish()
        }
      }, LinearLayout.LayoutParams(dp(104f), dp(38f)))
    }

    setContentView(root)
    root.isFocusable = true
    root.isFocusableInTouchMode = true
    root.requestFocus()
    showDuration()
  }

  private fun showDuration() {
    val d = entry?.optJSONArray("durations")?.optJSONObject(dial.index)
    durText.text = d?.optString("label") ?: ""
    durText.contentDescription = "Duration ${d?.optString("label") ?: ""}. Turn the bezel to change."
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
        dial.setIndex(dial.index + if (rotaryAcc > 0) 1 else -1, fromUser = true)
        rotaryAcc = 0f
        lastStepAt = now
      }
      return true
    }
    return super.onGenericMotionEvent(event)
  }
}
