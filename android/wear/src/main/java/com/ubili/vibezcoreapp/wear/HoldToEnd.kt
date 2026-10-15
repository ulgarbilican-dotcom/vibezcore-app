package com.ubili.vibezcoreapp.wear

/* ─────────────────────────────────────────────────────────────────────────
   END vasthouden in plaats van tikken (15 okt 2026).

   Operator: een State Control-sessie stopte na 8,7 min zonder dat er iets
   aangeraakt werd — het horloge registreerde één aanraking (logcat:
   "userActivityFromNative: touch") 2 s nadat het scherm door polsbeweging
   aanging, en dat landde op END. Eén losse tik mag een sessie dus niet meer
   beëindigen: END moet 0,8 s vastgehouden worden, met een vlak dat van
   links naar rechts volloopt; loslaten vóór het vol is = niets. Een korte
   tik toont enkel "HOLD TO END". Pauze blijft één tik (onschuldig). */

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.drawable.Drawable
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.animation.LinearInterpolator
import android.widget.TextView

object HoldToEnd {
  private const val HOLD_MS = 800L
  private const val HINT_MS = 1600L
  private const val LABEL = "END"
  private const val HINT = "HOLD TO END"

  @SuppressLint("ClickableViewAccessibility")
  fun attach(button: TextView, onEnd: () -> Unit) {
    val fill = FillDrawable()
    button.background = fill
    var animator: ValueAnimator? = null
    var fired = false
    val restoreLabel = Runnable { button.text = LABEL }

    fun animateTo(target: Float, duration: Long, onDone: (() -> Unit)? = null) {
      animator?.cancel()
      animator = ValueAnimator.ofFloat(fill.progress, target).apply {
        this.duration = duration
        interpolator = LinearInterpolator()
        addUpdateListener { fill.progress = it.animatedValue as Float }
        if (onDone != null) {
          addListener(object : android.animation.AnimatorListenerAdapter() {
            var cancelled = false
            override fun onAnimationCancel(animation: android.animation.Animator) {
              cancelled = true
            }
            override fun onAnimationEnd(animation: android.animation.Animator) {
              if (!cancelled) onDone()
            }
          })
        }
        start()
      }
    }

    button.setOnTouchListener { v, ev ->
      when (ev.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          fired = false
          v.removeCallbacks(restoreLabel)
          button.text = LABEL
          v.isPressed = true
          animateTo(1f, ((1f - fill.progress) * HOLD_MS).toLong()) {
            fired = true
            v.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
            fill.progress = 0f
            onEnd()
          }
          true
        }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          v.isPressed = false
          if (!fired) {
            val wasShortTap = fill.progress < 0.35f && ev.actionMasked == MotionEvent.ACTION_UP
            animateTo(0f, 180L)
            if (wasShortTap) {
              button.text = HINT
              v.postDelayed(restoreLabel, HINT_MS)
            }
          }
          true
        }
        else -> true
      }
    }
    /* TalkBack: dubbeltik = bewuste keuze, dat mag meteen beëindigen. */
    button.setOnClickListener { onEnd() }
  }

  /** Pil die van links naar rechts volloopt (zacht wit, zoals de pauzeknop). */
  private class FillDrawable : Drawable() {
    var progress = 0f
      set(value) {
        field = value.coerceIn(0f, 1f)
        invalidateSelf()
      }
    private val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x1FFFFFFF }
    private val bar = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x59FFFFFF }
    private val rect = RectF()

    override fun draw(canvas: Canvas) {
      if (progress <= 0f) return
      val b = bounds
      val r = b.height() / 2f
      rect.set(b.left.toFloat(), b.top.toFloat(), b.right.toFloat(), b.bottom.toFloat())
      canvas.drawRoundRect(rect, r, r, track)
      canvas.save()
      canvas.clipRect(b.left.toFloat(), b.top.toFloat(), b.left + b.width() * progress, b.bottom.toFloat())
      canvas.drawRoundRect(rect, r, r, bar)
      canvas.restore()
    }

    override fun setAlpha(alpha: Int) {}
    override fun setColorFilter(colorFilter: ColorFilter?) {}
    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
  }
}
