package com.ubili.vibezcoreapp.wear

/* 2 nov 2026 (operator: "kunnen we voor android ook strong en medium haptics keuze? standaard strong" → "ja"): dezelfde Haptics-pagina
   als op de Apple Watch. Strong = de standaard en het maximum van de motor; Medium = hetzelfde ritme, lichter. De keuze is ÉÉN instelling
   met de telefoon: een tik hier gaat naar de telefoon (die hem onthoudt en de nieuwe sterkte terugstuurt in de catalogus). */

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class HapticsActivity : androidx.activity.ComponentActivity() {
  private fun dp(v: Float) = (v * resources.displayMetrics.density).toInt()
  private lateinit var list: LinearLayout

  companion object {
    private const val PREFS = "vz_haptics"
    private const val KEY_CHOICE = "choice"
    private const val KEY_AT = "choiceAt"

    /** Wat er nu geldt: een keuze van de laatste 20 s op het horloge zelf (de telefoon bevestigt nog), anders wat de telefoon stuurde. */
    fun current(context: Context): String {
      val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val at = p.getLong(KEY_AT, 0L)
      if (System.currentTimeMillis() - at < 20_000L) p.getString(KEY_CHOICE, null)?.let { return it }
      return if (CatalogStore.load(context)?.optString("strength") == "medium") "medium" else "strong"
    }
  }

  private lateinit var scrollView: ScrollView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val scroll = ScrollView(this).apply {
      setBackgroundColor(Color.BLACK)
      isVerticalScrollBarEnabled = true
      isFocusable = true
      isFocusableInTouchMode = true
    }
    scrollView = scroll
    list = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(25f), dp(RoundFit.edgeDp(this@HapticsActivity) + 2f), dp(25f), dp(44f))
    }
    scroll.addView(list)
    /* 13 nov 2026 (operator-testronde): rijen even groot in rust, lens tijdens scrollen; titel, twee keuzes en Done in één beeld */
    RoundList.attach(scroll, list, RoundList.Mode.PAGE)
    setContentView(scroll)
    render()
  }

  private fun render() {
    list.removeAllViews()
    val cur = current(this)
    list.addView(TextView(this).apply {
      text = "Strength"
      setTextColor(Color.WHITE)
      textSize = 14f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(6f) })
    option("strong", "Strong", "Firmest taps", cur == "strong")
    option("medium", "Medium", "Same rhythm, lighter", cur == "medium")
    /* 13 nov 2026 (operator: "als ik Strong aanduid en verder wil, geen knop of manier om verder te gaan"): Done sluit het scherm */
    list.addView(TextView(this).apply {
      text = "Done"
      setTextColor(Color.parseColor("#0A0A0A"))
      textSize = 14f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      background = Glass.cta(this@HapticsActivity, 20f)
      contentDescription = "Done"
      isClickable = true
      tag = RoundList.ROW
      setOnClickListener { finish() }
    }, LinearLayout.LayoutParams(dp(120f), dp(Compact.CTA_DP)).apply { topMargin = dp(2f) })
    // de uitleg onder de knoppen: scrol om te lezen
    list.addView(TextView(this).apply {
      text = "For State Control and Breathwork. Strong is the default."
      setTextColor(Color.argb(140, 255, 255, 255))
      textSize = 10f
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10f) })
    list.addView(TextView(this).apply {
      text = "Your phone uses the same strength."
      setTextColor(Color.argb(120, 255, 255, 255))
      textSize = 10f
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(6f) })
    RoundList.refresh(scrollView)
  }

  private fun option(value: String, title: String, sub: String, selected: Boolean) {
    /* glazen pil; de gekozen optie = lichter glas met dezelfde dunne lichte rand (nooit een gekleurde omlijning) */
    val row = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(14f), dp(4f), dp(14f), dp(4f))
      background = Glass.pill(this@HapticsActivity, 26f, selected)
      isClickable = true
      tag = RoundList.ROW
      contentDescription = if (selected) "$title, selected" else title
      setOnClickListener { choose(value) }
    }
    row.addView(TextView(this).apply {
      text = title
      setTextColor(if (selected) Color.WHITE else Color.argb(200, 255, 255, 255))
      textSize = 13f
      typeface = Typeface.DEFAULT_BOLD
    })
    row.addView(TextView(this).apply {
      text = sub
      setTextColor(Color.argb(140, 255, 255, 255))
      textSize = 10f
    })
    list.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(Compact.ROW_DP + 2f)).apply {
      bottomMargin = dp(Compact.GAP_DP)
    })
  }

  private fun choose(value: String) {
    getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString(KEY_CHOICE, value)
      .putLong(KEY_AT, System.currentTimeMillis())
      .apply()
    /* Naar de telefoon: die onthoudt het (zoals "Remember") en stuurt de catalogus met de nieuwe sterkte terug. */
    PhoneLink.sendWatchAction(this, "strength:$value", "settings")
    feel(value)
    render()
    list.postDelayed({ PhoneLink.requestCatalog(this) }, 1500)
  }

  /** Meteen voelen wat je kiest: Strong = maximum van de motor, Medium = lichter. */
  private fun feel(value: String) {
    val vib: Vibrator = if (Build.VERSION.SDK_INT >= 31) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    val amp = if (value == "medium") 205 else 255
    val effect = if (vib.hasAmplitudeControl()) {
      VibrationEffect.createWaveform(longArrayOf(0, 70, 140, 50), intArrayOf(0, amp, 0, (amp * 0.7f).toInt()), -1)
    } else {
      val ms = if (value == "medium") 50L else 80L
      VibrationEffect.createWaveform(longArrayOf(0, ms, 140, ms - 15), -1)
    }
    vib.vibrate(effect)
  }
}
