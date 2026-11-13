package com.ubili.vibezcoreapp.wear

/* 13 nov 2026 (operator-testronde Galaxy Watch4, punten 5 en 8: "knoppen allemaal even groot, enkel bij vastpakken en scrollen wordt de
   middelste groter en worden de andere kleiner", "de onderste knop niet volledig in beeld"): gedrag van alle keuzelijsten op het horloge.

   · IN RUST: alle knoppen even groot en VOLLEDIG binnen de ronding. Wat niet volledig past, wordt verborgen (nooit half afgekapt).
   · TIJDENS VASTPAKKEN EN SCROLLEN: de knop in het midden is het grootst, de andere worden kleiner en vager (lens).
   · NA HET SCROLLEN: (WHEEL) de dichtstbijzijnde knop klikt vast in het midden; (PAGE) de lijst blijft staan.
   Rond scherm; op een vierkant scherm doet dit niets (alles blijft zichtbaar, gewoon scrollen). */

import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.ScrollView
import kotlin.math.abs
import kotlin.math.min

object RoundList {
  enum class Mode { WHEEL, PAGE }

  /** Markering voor een kiesbare knop. "row*" = de knop waarop de lijst opent (bv. je huidige keuze). */
  const val ROW = "row"
  const val ROW_INITIAL = "row*"

  private val refreshers = java.util.WeakHashMap<ScrollView, () -> Unit>()

  /** Na het opnieuw opbouwen van de rijen (bv. de gekozen knop wisselt): de rusttoestand opnieuw toepassen. */
  fun refresh(scroll: ScrollView) {
    refreshers[scroll]?.invoke()
  }

  fun attach(scroll: ScrollView, container: ViewGroup, mode: Mode = Mode.WHEEL) {
    val ctx = scroll.context
    /* 13 nov 2026: ook op een VIERKANT scherm (rust = niets half afgekapt aan de schermrand; lens + vastklikken zijn overal gelijk) */
    val density = ctx.resources.displayMetrics.density
    val handler = Handler(Looper.getMainLooper())
    var touching = false
    var lastY = Int.MIN_VALUE
    var prepared = false
    var snapping = false

    fun children(): List<View> = (0 until container.childCount).map { container.getChildAt(it) }
    fun rows(): List<View> = children().filter { it.tag == ROW || it.tag == ROW_INITIAL }

    fun applyRest() {
      val w = scroll.width.toFloat()
      val h = scroll.height.toFloat()
      if (w <= 0f || h <= 0f) return
      for (v in children()) {
        v.scaleX = 1f
        v.scaleY = 1f
        v.alpha = 1f
        v.visibility = if (RoundFit.fitsAtRest(v, RoundFit.topInScroll(scroll, v), w, h, density)) View.VISIBLE else View.INVISIBLE
      }
    }

    fun applyLens() {
      val h = scroll.height.toFloat()
      if (h <= 0f) return
      for (v in children()) {
        v.visibility = View.VISIBLE
        val cy = RoundFit.topInScroll(scroll, v) + v.height / 2f
        val d = min(1.2f, abs(cy - h / 2f) / (h / 2f))
        val s = (1f - 0.30f * d * d).coerceIn(0.6f, 1f)
        v.scaleX = s
        v.scaleY = s
        v.alpha = (1f - 0.55f * d * d).coerceIn(0.25f, 1f)
      }
    }

    fun snapToNearest(): Boolean {
      if (mode != Mode.WHEEL) return false
      val h = scroll.height.toFloat()
      val rs = rows()
      if (rs.isEmpty() || h <= 0f) return false
      val target = rs.minByOrNull { abs(RoundFit.topInScroll(scroll, it) + it.height / 2f - h / 2f) } ?: return false
      val dy = (RoundFit.topInScroll(scroll, target) + target.height / 2f - h / 2f).toInt()
      if (abs(dy) < 2) return false
      snapping = true
      scroll.smoothScrollBy(0, dy)
      return true
    }

    val restRunnable = Runnable {
      snapping = false
      if (!touching) applyRest()
    }
    val idle = Runnable {
      if (touching) return@Runnable
      if (!snapping && snapToNearest()) {
        handler.removeCallbacks(restRunnable)
        handler.postDelayed(restRunnable, 320)
      } else {
        applyRest()
      }
    }

    fun schedule() {
      handler.removeCallbacks(idle)
      handler.removeCallbacks(restRunnable)
      handler.postDelayed(idle, 140)
    }

    scroll.setOnTouchListener { _, ev ->
      when (ev.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          touching = true
          snapping = false
          handler.removeCallbacks(restRunnable)
          applyLens()
        }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          touching = false
          schedule()
        }
      }
      false
    }

    scroll.viewTreeObserver.addOnScrollChangedListener {
      if (scroll.scrollY != lastY) {
        lastY = scroll.scrollY
        if (prepared) {
          applyLens()
          schedule()
        }
      }
    }

    scroll.viewTreeObserver.addOnGlobalLayoutListener {
      if (!prepared && scroll.height > 0 && container.height > 0 && container.childCount > 0) {
        val h = scroll.height
        if (mode == Mode.WHEEL) {
          /* de eerste en de laatste knop moeten in het midden kunnen komen */
          val need = h / 2
          if (container.paddingBottom < need) {
            container.setPadding(container.paddingLeft, container.paddingTop, container.paddingRight, need)
            return@addOnGlobalLayoutListener // volgende layout-ronde
          }
        }
        prepared = true
        val initial = rows().firstOrNull { it.tag == ROW_INITIAL } ?: rows().firstOrNull()
        if (mode == Mode.WHEEL && initial != null) {
          val dy = (RoundFit.topInScroll(scroll, initial) + initial.height / 2f - h / 2f).toInt()
          lastY = scroll.scrollY + dy
          scroll.scrollBy(0, dy)
        }
        handler.post { applyRest() }
      }
    }

    refreshers[scroll] = {
      handler.post {
        if (prepared) applyRest()
      }
    }
  }
}
