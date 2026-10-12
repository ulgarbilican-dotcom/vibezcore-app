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
import android.graphics.Bitmap
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
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

  /* 12 okt 2026 (operator: "breathwork ook animatie zoals besproken"):
     Breathwork toont de ademfiguur van de app (SessionArt.tsx — zon, bloem,
     lotus, kristal, boom) in plaats van de golf. Zelfde beweging als op de
     telefoon: schaal 0,70 → 1,00 en helderheid 0,74 → 1,00 met de adem,
     een gloed in de kleur van de toestand erachter die harder meezwelt.
     null = State Control (golf). */
  var art: Bitmap? = null
    set(value) {
      if (field !== value) {
        field = value
        invalidate()
      }
    }

  /** Breathwork gepauzeerd: play-teken over de figuur (tik = hervatten). */
  var paused = false
    set(value) {
      if (field != value) {
        field = value
        invalidate()
      }
    }

  private val artPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
  private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val playPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val artRect = RectF()
  private val playPath = Path()

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
    /* 12 okt 2026: één ring per hartslag (enkel lub) — de schijf klopt zelf
       al mee; twee ringen per slag oogde druk. */
    if (strong) pulses.add(Pulse(SystemClock.uptimeMillis(), strong))
    lastBeat = Pulse(SystemClock.uptimeMillis(), strong)
    postInvalidateOnAnimation()
  }

  /* 12 okt 2026 (operator: "de ring zelf laten meekloppen"): de schijf
     zwelt bij elke slag heel licht op — sterk bij lub, zacht bij dub — en
     zakt zacht terug. Zelfde slag als de trilling (BeatBus), dus beeld,
     gevoel en geluid uit één bron. */
  private var lastBeat: Pulse? = null
  private fun beatScale(now: Long): Float {
    val b = lastBeat ?: return 1f
    val dur = if (b.strong) 420f else 300f
    val k = (now - b.startMs) / dur
    if (k >= 1f || k < 0f) return 1f
    val up = if (k < 0.18f) k / 0.18f else 1f - (k - 0.18f) / 0.82f
    val e = up * up * (3f - 2f * up)
    return 1f + (if (b.strong) 0.06f else 0.03f) * e
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val now = SystemClock.uptimeMillis()
    val cx = width / 2f
    val cy = height / 2f
    // 12 okt 2026: de ring vult het scherm; de tik-ringen dijen nog net tot
    // aan de rand uit (tot 1,08×) i.p.v. ver erbuiten.
    val r = min(width, height) / 2f / 1.10f * beatScale(now)
    val size = 2f * r

    // 1 · schijf
    canvas.drawCircle(cx, cy, r, discPaint)

    if (art != null) {
      drawBreathFigure(canvas, cx, cy, r, now)
      if (flowing || pulses.isNotEmpty()) postInvalidateOnAnimation()
      return
    }

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
      /* 12 okt 2026 (operator: "buitenringen niet duidelijk"): dikker en
         helderder, tot net aan de rand van het scherm. */
      val grow = if (p.strong) 0.09f else 0.05f
      val alpha = (if (p.strong) 0.95f else 0.55f) * (1f - k)
      pulsePaint.color = color
      pulsePaint.alpha = (alpha * 255).toInt()
      pulsePaint.strokeWidth = (if (p.strong) 4.5f else 3f) * density
      canvas.drawCircle(cx, cy, r * (1f + grow * ease), pulsePaint)
    }

    // 5 · tekst
    bigPaint.textSize = r * (if (centerText.length > 6) 0.26f else 0.36f)
    // 12 okt 2026: tijd iets boven het midden — pauze + END staan eronder,
    // binnen de cirkel.
    val lift = r * 0.10f
    val bigY = (if (subText.isEmpty()) cy + bigPaint.textSize * 0.35f else cy + bigPaint.textSize * 0.15f) - lift
    canvas.drawText(centerText, cx, bigY, bigPaint)
    if (subText.isNotEmpty()) {
      smallPaint.textSize = r * 0.12f
      canvas.drawText(subText, cx, bigY + smallPaint.textSize * 1.6f, smallPaint)
    }

    if (flowing || pulses.isNotEmpty()) postInvalidateOnAnimation()
  }

  /** Breathwork: rand, gloed, figuur en "Inhale · Nose" eronder. */
  private fun drawBreathFigure(canvas: Canvas, cx: Float, cy: Float, r: Float, now: Long) {
    val bmp = art ?: return
    // waterpeil van de service: 0,18 (uitgeademd) … 0,85 (ingeademd)
    val b = ((levelAt(now) - 0.18f) / 0.67f).coerceIn(0f, 1f)
    val acy = cy - r * 0.10f

    // gloed — zoals SessionArt (glowBoost): 0,18 + 0,5·adem, 0,70 → 1,14×
    val gR = r * 0.66f * (0.7f + 0.44f * b)
    val ga = ((0.18f + 0.5f * b) * 255).toInt().coerceIn(0, 255)
    val c = Color.argb(ga, Color.red(color), Color.green(color), Color.blue(color))
    glowPaint.shader = RadialGradient(
      cx, acy, gR,
      intArrayOf(c, c, Color.argb(0, Color.red(color), Color.green(color), Color.blue(color))),
      floatArrayOf(0f, 0.14f, 1f),
      Shader.TileMode.CLAMP,
    )
    canvas.drawCircle(cx, acy, gR, glowPaint)

    // de figuur
    val s = r * 0.96f * (0.7f + 0.3f * b)
    val aspect = bmp.width.toFloat() / bmp.height
    val w = if (aspect >= 1f) s else s * aspect
    val h = if (aspect >= 1f) s / aspect else s
    artRect.set(cx - w / 2f, acy - h / 2f, cx + w / 2f, acy + h / 2f)
    artPaint.alpha = ((0.74f + 0.26f * b) * (if (paused) 0.4f else 1f) * 255).toInt()
    canvas.drawBitmap(bmp, null, artRect, artPaint)

    // rand
    rimPaint.color = color
    canvas.drawCircle(cx, cy, r, rimPaint)

    // gepauzeerd: wit rondje met donker play-teken (CTA-stijl)
    if (paused) {
      val pr = r * 0.17f
      playPaint.color = Color.WHITE
      canvas.drawCircle(cx, acy, pr, playPaint)
      playPath.reset()
      val t = pr * 0.42f
      playPath.moveTo(cx - t * 0.7f, acy - t)
      playPath.lineTo(cx + t, acy)
      playPath.lineTo(cx - t * 0.7f, acy + t)
      playPath.close()
      playPaint.color = Color.parseColor("#0A0A0A")
      canvas.drawPath(playPath, playPaint)
    }

    // "Inhale · Nose" onder de figuur, de neus/mond-regel gedimd
    bigPaint.textSize = r * 0.19f
    smallPaint.textSize = r * 0.19f
    val y = cy + r * 0.60f
    val head = centerText
    val tail = if (subText.isNotEmpty()) "  ·  $subText" else ""
    val wHead = bigPaint.measureText(head)
    val wTail = smallPaint.measureText(tail)
    val x0 = cx - (wHead + wTail) / 2f
    canvas.drawText(head, x0 + wHead / 2f, y, bigPaint)
    if (tail.isNotEmpty()) canvas.drawText(tail, x0 + wHead + wTail / 2f, y, smallPaint)
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
    /* 12 okt 2026 (operator: "het water lijkt harder te golven"): exact
       hetzelfde pad als de telefoon (components/LiquidWave.tsx wavePath) —
       vier S-bochten (kubisch) over twee breedtes. De vroegere sinus op
       volle amplitude golfde ~3,5× hoger dan de app. */
    val shift = (now % durMs) / durMs.toFloat() * size
    val p = size
    val bottom = maxOf(size, baseY + amp) + 2f
    val x0 = left - shift
    wave.reset()
    wave.moveTo(x0, baseY)
    for (i in 0 until 4) {
      val sx = x0 + p * 0.5f * i
      wave.cubicTo(sx + p * 0.25f, baseY - amp, sx + p * 0.25f, baseY + amp, sx + p * 0.5f, baseY)
    }
    wave.lineTo(x0 + p * 2f, baseY + bottom)
    wave.lineTo(x0, baseY + bottom)
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
