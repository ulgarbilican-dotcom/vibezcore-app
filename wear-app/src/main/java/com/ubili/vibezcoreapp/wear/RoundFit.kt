package com.ubili.vibezcoreapp.wear

/* 13 nov 2026 (Google Play: afkeuring "Kwaliteitsrichtlijnen voor Wear-apps: Smartwatchvormen", WO-V16 — tekst en bedieningselementen
   mogen niet door de rand van het scherm afgekapt worden; operator: "pas alles aan zodat we correct kunnen indienen"). Gemeten op de
   Galaxy Watch4 40 mm (396 px, 198 dp, rond): de pil "Haptics" op het startscherm hing half buiten beeld en op Haptics/duurlijsten raakten
   de hoeken van de pillen de ronding.

   Eén formule voor alle schermen i.p.v. losse vaste maten per horloge:
   · edgeDp()  = veilige marge boven/onder voor smalle inhoud (ca. 6,6 % van de hoogte op een rond scherm);
   · attach()  = in lijsten wordt elke rij die tegen de ronding zou liggen verkleind en gedempt (zoals Wear's eigen lijsten), zodat de
                 hoeken altijd binnen de cirkel blijven. Een rij midden in het scherm blijft ongemoeid; op een vierkant scherm doet het niets. */

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.ScrollView
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

object RoundFit {
  fun isRound(ctx: Context): Boolean = ctx.resources.configuration.isScreenRound

  fun heightDp(ctx: Context): Float = ctx.resources.displayMetrics.let { it.heightPixels / it.density }

  /** Veilige marge (dp) bovenaan en onderaan voor smalle inhoud (titel, regel tekst). */
  fun edgeDp(ctx: Context): Float = if (isRound(ctx)) heightDp(ctx) * 0.066f else 6f

  /**
   * Houdt alle rijen van [container] (een directe kind van [scroll]) binnen het zichtbare scherm: een rij die tegen de ronding aan zou
   * komen te liggen wordt verkleind rond zijn midden en dimt een beetje. Draait na elke layout en bij elke scrollbeweging.
   */
  fun attach(scroll: ScrollView, container: ViewGroup) {
    val first = targets.put(scroll, container) == null
    if (!first) {
      // ander doel gekozen (bv. het startscherm is opnieuw opgebouwd): meteen toepassen
      scroll.post { apply(scroll) }
      return
    }
    val update = { apply(scroll) }
    scroll.viewTreeObserver.addOnScrollChangedListener(update)
    scroll.viewTreeObserver.addOnGlobalLayoutListener(update)
  }

  private val targets = java.util.WeakHashMap<ScrollView, ViewGroup>()

  private fun apply(scroll: ScrollView) {
    val container = targets[scroll] ?: return
    val ctx = scroll.context
    val round = isRound(ctx)
    val density = ctx.resources.displayMetrics.density
    val w = scroll.width.toFloat()
    val h = scroll.height.toFloat()
    if (w <= 0f || h <= 0f) return
    for (i in 0 until container.childCount) {
      val v = container.getChildAt(i)
      if (v.visibility == View.GONE) continue
      if (!round) reset(v) else fit(v, topInScroll(scroll, v), w, h, density)
    }
  }

  /** Bovenkant van [v] t.o.v. het zichtbare scherm (houdt rekening met het scrollen en met een geneste container). */
  internal fun topInScroll(scroll: ScrollView, v: View): Float {
    var y = 0f
    var cur: View = v
    while (cur.parent !== scroll && cur.parent is View) {
      y += cur.top
      cur = cur.parent as View
    }
    y += cur.top
    return y - scroll.scrollY
  }

  private fun reset(v: View) {
    if (v.scaleX != 1f || v.scaleY != 1f || v.alpha != 1f) {
      v.scaleX = 1f
      v.scaleY = 1f
      v.alpha = 1f
    }
  }

  private fun fit(v: View, top: Float, screenW: Float, screenH: Float, density: Float) {
    val w = v.width.toFloat()
    val h = v.height.toFloat()
    if (w <= 0f || h <= 0f) return
    // rijen die helemaal buiten beeld staan: met rust laten
    if (top + h < 0f || top > screenH) return
    val radius = min(screenW, screenH) / 2f
    val limit = radius - 3f * density
    val cap = min(h, w) / 2f
    val yFar = max(abs(top - screenH / 2f), abs(top + h - screenH / 2f))
    val yCap = max(0f, yFar - cap)
    val free = (limit - cap) * (limit - cap) - yCap * yCap
    val allowedHalf = if (free <= 0f) cap * 0.5f else cap + sqrt(free)
    val s = (allowedHalf / (w / 2f)).coerceIn(0.5f, 1f)
    // pas dimmen als hij echt klein wordt: een rij die maar licht kleiner is, blijft even helder als de rest
    val a = if (s >= 0.8f) 1f else ((s - 0.5f) / 0.3f).coerceIn(0.3f, 1f)
    if (v.scaleX != s) {
      v.scaleX = s
      v.scaleY = s
    }
    if (v.alpha != a) v.alpha = a
  }

  /** Past [v] met zijn VOLLE grootte binnen de ronding en het scherm? (Voor lijsten in rust: wat niet past, wordt verborgen i.p.v. afgekapt.) */
  fun fitsAtRest(v: View, top: Float, screenW: Float, screenH: Float, density: Float): Boolean {
    val w = v.width.toFloat()
    val h = v.height.toFloat()
    if (w <= 0f || h <= 0f) return true
    if (top < 0f || top + h > screenH) return false
    val radius = min(screenW, screenH) / 2f
    val limit = radius - 6f * density  // in rust: minstens 6 dp van de rand (gemeten: dan raakt niets de rand)
    val cap = min(h, w) / 2f
    val yFar = max(abs(top - screenH / 2f), abs(top + h - screenH / 2f))
    val yCap = max(0f, yFar - cap)
    val free = (limit - cap) * (limit - cap) - yCap * yCap
    val allowedHalf = if (free <= 0f) cap * 0.5f else cap + sqrt(free)
    return allowedHalf >= w / 2f - 3f
  }
}
