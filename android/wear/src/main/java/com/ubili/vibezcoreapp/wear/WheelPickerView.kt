package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 (operator: "met de vinger werkt het niet — kunnen we naar een
   draaiwiel?"). Een draaiwiel zoals de wekker op iPhone/Apple Watch: de
   gekozen waarde groot en wit in het midden, de buren kleiner en gedimd.
   Veeg omhoog/omlaag — het wiel loopt mee en klikt vast op een waarde (ook
   na een snelle veeg). De rand/kroon draait het wiel per klikje
   (BreathSetupActivity). Elke nieuwe waarde geeft een tikje. */

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.View
import android.view.animation.DecelerateInterpolator
import kotlin.math.abs
import kotlin.math.roundToInt

class WheelPickerView(context: Context) : View(context) {
  var labels: List<String> = emptyList()
    set(value) {
      field = value
      invalidate()
    }

  /** Gekozen index (afgerond op het dichtstbijzijnde item). */
  val index: Int
    get() = pos.roundToInt().coerceIn(0, (labels.size - 1).coerceAtLeast(0))

  var onChange: (Int) -> Unit = {}

  private val density = resources.displayMetrics.density
  private val itemH = 34f * density
  private var pos = 0f // fractionele index (0 = eerste)
  private var lastIdx = 0
  private var lastY = 0f
  private var velocity: VelocityTracker? = null
  private var anim: ValueAnimator? = null

  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.WHITE
    textAlign = Paint.Align.CENTER
    typeface = Typeface.DEFAULT_BOLD
  }

  fun setIndex(i: Int, animate: Boolean) {
    val target = i.coerceIn(0, (labels.size - 1).coerceAtLeast(0)).toFloat()
    if (animate) animateTo(target) else {
      anim?.cancel()
      pos = target
      lastIdx = index
      invalidate()
    }
  }

  private fun maxPos() = (labels.size - 1).coerceAtLeast(0).toFloat()

  private fun announce() {
    val i = index
    if (i != lastIdx) {
      lastIdx = i
      performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
      onChange(i)
    }
  }

  private fun animateTo(target: Float) {
    anim?.cancel()
    anim = ValueAnimator.ofFloat(pos, target).apply {
      duration = 220
      interpolator = DecelerateInterpolator()
      addUpdateListener {
        pos = it.animatedValue as Float
        announce()
        invalidate()
      }
      start()
    }
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val cy = height / 2f
    val cx = width / 2f
    val first = (pos - 2).toInt().coerceAtLeast(0)
    val last = (pos + 2).toInt().coerceAtMost(labels.size - 1)
    for (i in first..last) {
      val d = i - pos // afstand tot het midden, in items
      val ad = abs(d)
      if (ad > 1.6f) continue
      val y = cy + d * itemH
      // midden groot en wit; buren kleiner en gedimd
      paint.textSize = (32f - 13f * ad.coerceAtMost(1f)) * density
      paint.alpha = (255 * (1f - 0.62f * ad.coerceAtMost(1.4f))).toInt().coerceIn(0, 255)
      canvas.drawText(labels[i], cx, y + paint.textSize * 0.36f, paint)
    }
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        anim?.cancel()
        parent?.requestDisallowInterceptTouchEvent(true)
        velocity = VelocityTracker.obtain()
        velocity?.addMovement(event)
        lastY = event.y
        return true
      }
      MotionEvent.ACTION_MOVE -> {
        velocity?.addMovement(event)
        // vinger omhoog = wiel omhoog = volgende (langere) waarde
        pos = (pos + (lastY - event.y) / itemH).coerceIn(-0.4f, maxPos() + 0.4f)
        lastY = event.y
        announce()
        invalidate()
        return true
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        velocity?.addMovement(event)
        velocity?.computeCurrentVelocity(1000)
        val vy = velocity?.yVelocity ?: 0f
        velocity?.recycle()
        velocity = null
        // een snelle veeg loopt een paar items door, daarna vastklikken
        val fling = (-vy / itemH) * 0.12f
        animateTo((pos + fling).roundToInt().toFloat().coerceIn(0f, maxPos()))
        return true
      }
    }
    return true
  }
}
