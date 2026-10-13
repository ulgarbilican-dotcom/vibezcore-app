package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 — het beeld van State Control op het horloge, zoals op de
   telefoon: een fijne ring in de kleur van de toestand met water dat
   zachtjes golft, en de duur in het midden. Water = State Control,
   figuur = Breathe — zo zie je meteen waar je bent. */

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.view.View
import kotlin.math.PI
import kotlin.math.min
import kotlin.math.sin

class WaterCircleView(context: Context) : View(context) {
  var color: Int = Color.parseColor("#00A3A3")
    set(v) {
      field = v
      invalidate()
    }
  var centerText: String = ""
    set(v) {
      field = v
      invalidate()
    }
  /** Waterpeil 0–1. */
  var level: Float = 0.55f

  private val density = resources.displayMetrics.density
  private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
  private val water = Paint(Paint.ANTI_ALIAS_FLAG)
  private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.WHITE
    textAlign = Paint.Align.CENTER
    typeface = Typeface.DEFAULT_BOLD
  }
  private val clip = Path()
  private val wave = Path()
  private var phase = 0f
  private val anim = ValueAnimator.ofFloat(0f, 1f).apply {
    duration = 6000
    repeatCount = ValueAnimator.INFINITE
    interpolator = android.view.animation.LinearInterpolator()
    addUpdateListener {
      phase = it.animatedValue as Float
      invalidate()
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    anim.start()
  }

  override fun onDetachedFromWindow() {
    anim.cancel()
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    val cx = width / 2f
    val cy = height / 2f
    val r = min(cx, cy) - 2f * density
    ring.color = color
    ring.strokeWidth = 1.6f * density
    canvas.drawCircle(cx, cy, r, ring)

    clip.reset()
    clip.addCircle(cx, cy, r - 3f * density, Path.Direction.CW)
    canvas.save()
    canvas.clipPath(clip)
    val top = cy + r - 2f * r * level
    val amp = r * 0.05f
    wave.reset()
    wave.moveTo(cx - r, top)
    var x = cx - r
    while (x <= cx + r) {
      val t = (x - (cx - r)) / (2f * r)
      wave.lineTo(x, top + amp * sin((t * 2f + phase * 2f) * PI).toFloat())
      x += 3f * density
    }
    wave.lineTo(cx + r, cy + r)
    wave.lineTo(cx - r, cy + r)
    wave.close()
    water.color = Color.argb(110, Color.red(color), Color.green(color), Color.blue(color))
    canvas.drawPath(wave, water)
    canvas.restore()

    if (centerText.isNotEmpty()) {
      text.textSize = r * 0.42f
      canvas.drawText(centerText, cx, cy - (text.descent() + text.ascent()) / 2f, text)
    }
  }
}
