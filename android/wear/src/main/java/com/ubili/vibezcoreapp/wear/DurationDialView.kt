package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 (operator: "het mooiste is een cirkel met draaisysteem, + en
   − weg, alles in de cirkel moet kunnen ademen"). Een ring langs de rand van
   het scherm, zoals de timer op een Apple Watch: één streepje per duurstap,
   de ring loopt vol in de kleur van de toestand tot de gekozen duur, met een
   bolletje aan het einde. Veeg rond de ring of draai aan de rand/kroon. */

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.sin

class DurationDialView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : View(context, attrs) {

  var steps = 1
    set(value) {
      field = value.coerceAtLeast(1)
      invalidate()
    }

  var index = 0
    private set

  var color: Int = Color.parseColor("#00A3A3")
    set(value) {
      field = value
      invalidate()
    }

  /** Wordt aangeroepen als de gebruiker een andere stap kiest. */
  var onChange: (Int) -> Unit = {}

  private val density = resources.displayMetrics.density
  private val track = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 6f * density
    strokeCap = Paint.Cap.ROUND
    color = Color.argb(46, 255, 255, 255)
  }
  private val progress = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 6f * density
    strokeCap = Paint.Cap.ROUND
  }
  private val tick = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
  }
  private val knob = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = Color.WHITE
  }
  private val rect = RectF()

  fun setIndex(i: Int, fromUser: Boolean) {
    val n = i.coerceIn(0, steps - 1)
    if (n == index) return
    index = n
    if (fromUser) {
      performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
      onChange(n)
    }
    invalidate()
  }

  private fun radius() = min(width, height) / 2f - 9f * density

  /** Hoek (graden, 0 = boven, met de klok mee) van stap i. Eén stap = een
   *  gelijk deel van de ring; de laatste stap vult de ring helemaal. */
  private fun sweepFor(i: Int) = 360f * (i + 1) / steps

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val cx = width / 2f
    val cy = height / 2f
    val r = radius()
    rect.set(cx - r, cy - r, cx + r, cy + r)
    canvas.drawCircle(cx, cy, r, track)

    progress.color = color
    val sweep = sweepFor(index)
    canvas.drawArc(rect, -90f, sweep, false, progress)

    // streepjes per stap (het einde van elke stap)
    for (i in 0 until steps) {
      val a = Math.toRadians((-90f + sweepFor(i)).toDouble())
      tick.color = if (i <= index) Color.argb(220, 255, 255, 255) else Color.argb(90, 255, 255, 255)
      canvas.drawCircle(cx + (r * cos(a)).toFloat(), cy + (r * sin(a)).toFloat(), 1.6f * density, tick)
    }

    // bolletje aan het einde van de gekozen duur
    val a = Math.toRadians((-90f + sweep).toDouble())
    canvas.drawCircle(cx + (r * cos(a)).toFloat(), cy + (r * sin(a)).toFloat(), 7f * density, knob)
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    val cx = width / 2f
    val cy = height / 2f
    val dx = event.x - cx
    val dy = event.y - cy
    val onRing = hypot(dx, dy) > radius() - 34f * density
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        if (!onRing) return false
        parent?.requestDisallowInterceptTouchEvent(true)
        pick(dx, dy)
        return true
      }
      MotionEvent.ACTION_MOVE -> {
        pick(dx, dy)
        return true
      }
    }
    return true
  }

  private fun pick(dx: Float, dy: Float) {
    // hoek met de klok mee vanaf boven, 0..360
    var deg = Math.toDegrees(atan2(dy.toDouble(), dx.toDouble())).toFloat() + 90f
    if (deg < 0) deg += 360f
    val i = ((deg / 360f) * steps).toInt().coerceIn(0, steps - 1)
    setIndex(i, fromUser = true)
  }
}
