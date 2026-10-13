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
import kotlin.math.cos
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
    strokeWidth = 2.5f * density
    strokeCap = Paint.Cap.ROUND
    color = Color.argb(46, 255, 255, 255)
  }
  private val progress = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 3f * density
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

  /* 13 okt 2026 (operator: "kan de cirkel bij het kiezen ook vollopen?"):
     water in de kleur van de toestand, zoals het duurscherm op de telefoon
     (LiquidWave) — hoe langer de duur, hoe hoger; stijgt/zakt vloeiend. */
  private val wavePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val wave = android.graphics.Path()
  private val clip = android.graphics.Path()
  private var levelShown = -1f
  private var levelFrom = 0f
  private var levelStartMs = 0L

  private fun targetLevel() = 0.18f + 0.62f * (index + 1f) / steps

  private fun currentLevel(now: Long): Float {
    val target = targetLevel()
    if (levelShown < 0f) {
      levelShown = target
      levelFrom = target
    }
    val k = ((now - levelStartMs) / 420f).coerceIn(0f, 1f)
    val e = 1f - (1f - k) * (1f - k) * (1f - k)
    levelShown = levelFrom + (target - levelFrom) * e
    return levelShown
  }

  private fun drawWave(canvas: Canvas, left: Float, size: Float, baseY: Float, amp: Float, now: Long, durMs: Long, alpha: Int) {
    val shift = (now % durMs) / durMs.toFloat() * size
    val x0 = left - shift
    wave.reset()
    wave.moveTo(x0, baseY)
    for (i in 0 until 4) {
      val sx = x0 + size * 0.5f * i
      wave.cubicTo(sx + size * 0.25f, baseY - amp, sx + size * 0.25f, baseY + amp, sx + size * 0.5f, baseY)
    }
    wave.lineTo(x0 + size * 2f, baseY + size)
    wave.lineTo(x0, baseY + size)
    wave.close()
    wavePaint.color = color
    wavePaint.alpha = alpha
    canvas.drawPath(wave, wavePaint)
  }

  fun setIndex(i: Int, fromUser: Boolean) {
    val n = i.coerceIn(0, steps - 1)
    if (n == index) return
    levelFrom = if (levelShown >= 0f) levelShown else targetLevel()
    levelStartMs = android.os.SystemClock.uptimeMillis()
    index = n
    if (fromUser) {
      performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
      onChange(n)
    }
    invalidate()
  }

  private fun radius() = min(width, height) / 2f - 7f * density

  /** Hoek (graden, 0 = boven, met de klok mee) van stap i. Eén stap = een
   *  gelijk deel van de ring; de laatste stap vult de ring helemaal. */
  private fun sweepFor(i: Int) = 360f * (i + 1) / steps

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val cx = width / 2f
    val cy = height / 2f
    val r = radius()
    rect.set(cx - r, cy - r, cx + r, cy + r)

    // water binnen de cirkel
    val now = android.os.SystemClock.uptimeMillis()
    val size = 2f * r
    val level = currentLevel(now)
    val waterY = cy + r - size * level
    canvas.save()
    clip.reset()
    clip.addCircle(cx, cy, r - 2f * density, android.graphics.Path.Direction.CW)
    canvas.clipPath(clip)
    val bright = Color.red(color) + Color.green(color) + Color.blue(color) > 600
    drawWave(canvas, cx - r, size, waterY + size * 0.027f, size * 0.040f, now, 5200L, if (bright) 26 else 38)
    drawWave(canvas, cx - r, size, waterY - size * 0.018f, size * 0.031f, now, 3600L, if (bright) 38 else 56)
    canvas.restore()

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
    canvas.drawCircle(cx + (r * cos(a)).toFloat(), cy + (r * sin(a)).toFloat(), 5f * density, knob)
    postInvalidateOnAnimation() // het water golft
  }

  /* 13 okt 2026 (operator: "de ring is heel gevoelig, gaat te ver en te
     snel"): de ring ligt tegen de rand van het scherm, en daar zitten de
     systeemgebaren van Wear OS (vanaf boven = snelmenu, vanaf links =
     terug) — vegen langs de ring botste daarmee. Daarom: draaien aan de
     rand/kroon is de hoofdmanier; met de vinger veeg je in het scherm
     omhoog (langer) of omlaag (korter), één stap per korte veeg. De ring
     toont enkel de keuze. */
  private var lastY = 0f
  private var accY = 0f
  private var dragging = false

  override fun onTouchEvent(event: MotionEvent): Boolean {
    val step = 46f * density
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        /* Watch4: draaien = je vinger langs de rand van het scherm schuiven
           (touch-bezel). Die aanraking kwam hier ook binnen als veeg en
           vocht met de draai (operator: "ik heb geen controle"). Aanrakingen
           bij de rand laten we aan de bezel; vegen enkel in het midden. */
        val dx = event.x - width / 2f
        val dy = event.y - height / 2f
        if (kotlin.math.hypot(dx, dy) > min(width, height) / 2f - 44f * density) return false
        dragging = true
        lastY = event.y
        accY = 0f
        return true
      }
      MotionEvent.ACTION_MOVE -> {
        if (!dragging) return false
        accY += lastY - event.y // omhoog = positief = langer
        lastY = event.y
        if (kotlin.math.abs(accY) > 8f * density) parent?.requestDisallowInterceptTouchEvent(true)
        while (accY >= step) {
          setIndex(index + 1, fromUser = true)
          accY -= step
        }
        while (accY <= -step) {
          setIndex(index - 1, fromUser = true)
          accY += step
        }
        return true
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        dragging = false
        return true
      }
    }
    return true
  }
}
