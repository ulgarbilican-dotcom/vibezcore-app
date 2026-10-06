package com.ubili.vibezcoreapp.wear

/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — de sessiecirkel op het horloge, dezelfde look als de app
   (components/LiquidWave.tsx) en de website-mockup (6 okt 2026):
     · donkere schijf (#0A0A0A) met een dunne rand in de kleur van de toestand;
     · een golf in twee lagen (10% / 15%, Sleep 20% / 30%) die horizontaal
       schuift — zelfde tempo's als de app (5,2 s en 3,6 s per breedte);
     · het waterpeil komt van `levelAt` (State Control: resterende tijd,
       breathwork: in- en uitademen);
     · per tik een ring die rustig uitdijt (sterk bij de eerste tik van een
       slag, zacht bij de tweede);
     · in het midden de tijd of de fase, eronder een kleine regel.
   Tekent enkel zolang het zichtbaar is. */

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.os.SystemClock
import android.util.AttributeSet
import android.view.View
import kotlin.math.PI
import kotlin.math.min
import kotlin.math.sin

class SessionRingView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : View(context, attrs) {

  /** Kleur van de toestand (rand, golf, ringen). */
  var color: Int = Color.parseColor("#00A3A3")
    set(value) {
      field = value
      invalidate()
    }

  /** Doorschijnendheid van de twee golflagen. */
  var backAlpha = 0.10f
  var frontAlpha = 0.15f

  /** Grote tekst in het midden (tijd of fase). */
  var centerText: String = ""
    set(value) {
      if (field != value) {
        field = value
        invalidate()
      }
    }

  /** Kleine regel eronder (bv. "Round 3 / 12"), of leeg. */
  var subText: String = ""
    set(value) {
      if (field != value) {
        field = value
        invalidate()
      }
    }

  /** Waterpeil 0..1 voor een gegeven uptime (ms). */
  var levelAt: (Long) -> Float = { 0.5f }

  /** Golf in beweging (uit bij pauze). */
  var flowing = true
    set(value) {
      field = value
      invalidate()
    }

  private data class Pulse(val startMs: Long, val strong: Boolean)

  private val pulses = ArrayList<Pulse>()
  private var frozenShiftMs = 0L
  private val density = resources.displayMetrics.density

  private val discPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = Color.parseColor("#0A0A0A") }
  private val wavePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val rimPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 2f * resources.displayMetrics.density
  }
  private val pulsePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
  private val bigPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    this.color = Color.WHITE
    textAlign = Paint.Align.CENTER
    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    setShadowLayer(6f, 0f, 0f, Color.argb(128, 0, 0, 0))
  }
  private val smallPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    this.color = Color.argb(166, 255, 255, 255)
    textAlign = Paint.Align.CENTER
  }
  private val clip = Path()
  private val wave = Path()

  /** Een echte tik op de pols: een ring laten uitdijen. */
  fun pulse(strong: Boolean) {
    pulses.add(Pulse(SystemClock.uptimeMillis(), strong))
    postInvalidateOnAnimation()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val now = SystemClock.uptimeMillis()
    val cx = width / 2f
    val cy = height / 2f
    // ruimte rondom voor de uitdijende ringen (tot 1,32×)
    val r = min(width, height) / 2f / 1.36f
    val size = 2f * r

    // 1 · schijf
    canvas.drawCircle(cx, cy, r, discPaint)

    // 2 · golf in twee lagen, binnen de cirkel
    canvas.save()
    clip.reset()
    clip.addCircle(cx, cy, r, Path.Direction.CW)
    canvas.clipPath(clip)
    val level = levelAt(now).coerceIn(0.08f, 1f)
    val emptyY = cy - r + size * 0.86f
    val fullY = cy - r + size * 0.04f
    val waterY = emptyY - (emptyY - fullY) * level
    val t = if (flowing) now else frozenShiftMs
    if (flowing) frozenShiftMs = now
    drawWave(canvas, cx - r, size, waterY + size * 0.027f, size * 0.040f, t, 5200L, backAlpha)
    drawWave(canvas, cx - r, size, waterY - size * 0.018f, size * 0.031f, t, 3600L, frontAlpha)
    canvas.restore()

    // 3 · rand
    rimPaint.color = color
    canvas.drawCircle(cx, cy, r, rimPaint)

    // 4 · ringen per tik
    val it = pulses.iterator()
    while (it.hasNext()) {
      val p = it.next()
      val dur = if (p.strong) 1400f else 900f
      val k = (now - p.startMs) / dur
      if (k >= 1f) {
        it.remove()
        continue
      }
      val ease = 1f - (1f - k) * (1f - k)
      val grow = if (p.strong) 0.32f else 0.14f
      val alpha = (if (p.strong) 0.7f else 0.32f) * (1f - k)
      pulsePaint.color = color
      pulsePaint.alpha = (alpha * 255).toInt()
      pulsePaint.strokeWidth = 2.2f * density
      canvas.drawCircle(cx, cy, r * (1f + grow * ease), pulsePaint)
    }

    // 5 · tekst
    bigPaint.textSize = r * (if (centerText.length > 6) 0.34f else 0.46f)
    val bigY = if (subText.isEmpty()) cy + bigPaint.textSize * 0.35f else cy + bigPaint.textSize * 0.15f
    canvas.drawText(centerText, cx, bigY, bigPaint)
    if (subText.isNotEmpty()) {
      smallPaint.textSize = r * 0.15f
      canvas.drawText(subText, cx, bigY + smallPaint.textSize * 1.6f, smallPaint)
    }

    if (flowing || pulses.isNotEmpty()) postInvalidateOnAnimation()
  }

  /** Zelfde vorm als de app: periode = halve breedte, schuift één breedte per `durMs`. */
  private fun drawWave(
    canvas: Canvas,
    left: Float,
    size: Float,
    baseY: Float,
    amp: Float,
    now: Long,
    durMs: Long,
    alpha: Float,
  ) {
    val shift = (now % durMs) / durMs.toFloat() * size
    val period = size / 2f
    wave.reset()
    val bottom = baseY + size
    wave.moveTo(left, bottom)
    var x = 0f
    val step = maxOf(2f, size / 60f)
    while (x <= size + step) {
      val y = baseY + amp * sin(2.0 * PI * ((x + shift) / period)).toFloat()
      wave.lineTo(left + x, y)
      x += step
    }
    wave.lineTo(left + size + step, bottom)
    wave.close()
    wavePaint.color = color
    wavePaint.alpha = (alpha * 255).toInt()
    canvas.drawPath(wave, wavePaint)
  }

  override fun onVisibilityChanged(changedView: View, visibility: Int) {
    super.onVisibilityChanged(changedView, visibility)
    if (visibility == VISIBLE) postInvalidateOnAnimation()
  }
}
