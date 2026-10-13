package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 — het horloge zelfstandig: één toestand kiezen en starten.
   Operator: "het mooiste is een cirkel met draaisysteem, + en − weg, alles
   in de cirkel moet kunnen ademen". Daarom: een ring langs de rand
   (DurationDialView) — veeg rond de ring of draai aan de rand/kroon — en in
   het midden enkel de figuur, de naam, de duur groot en de witte Start-pil.
   De duurstappen en de techniek komen van de telefoon (CatalogStore) — hier
   wordt niets zelf bedacht. Zonder toegang: geen Start, wel waar je het
   ontgrendelt. */

import android.content.Intent
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
    }, LinearLayout.LayoutParams(dp(34f), dp(34f)))

    val manyTechs = (e.optJSONArray("techniques")?.length() ?: 0) > 1
    col.addView(TextView(this).apply {
      text = e.optString("technique")
      setTextColor(Color.argb(210, 255, 255, 255))
      textSize = 11f
      maxLines = 1
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      if (manyTechs) {
        /* tik = andere techniek kiezen — als keuzeknopje (operator 13 okt
           2026: "enkel de laatst gekozen techniek tonen, met een dropdown") */
        setPadding(dp(12f), dp(5f), dp(10f), dp(5f))
        setCompoundDrawablesWithIntrinsicBounds(0, 0, R.drawable.ic_vz_chevron_down, 0)
        compoundDrawablePadding = dp(4f)
        background = GradientDrawable().apply {
          cornerRadius = dp(14f).toFloat()
          setColor(Color.argb(30, 255, 255, 255))
          setStroke(dp(1f).coerceAtLeast(1), Color.argb(40, 255, 255, 255))
        }
        contentDescription = "Technique ${e.optString("technique")}. Tap to change."
        setOnClickListener {
          startActivity(Intent(this@BreathSetupActivity, TechniqueActivity::class.java).putExtra("key", e.optString("key")))
          finish()
        }
      }
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(4f)
    })

    durText = TextView(this).apply {
      setTextColor(Color.WHITE)
      textSize = 32f
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
        /* subtiel, als glas (operator 13 okt 2026: "startknop subtieler,
           kan dat glas?"): licht van boven, dunne lichte rand */
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
          startLocalSession(this@BreathSetupActivity, e, dial.index)
          finish()
        }
      }, LinearLayout.LayoutParams(dp(78f), dp(30f)))
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
