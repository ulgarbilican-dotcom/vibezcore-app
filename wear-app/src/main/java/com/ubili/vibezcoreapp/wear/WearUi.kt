package com.ubili.vibezcoreapp.wear

/* 13 nov 2026 (operator-testronde op de Galaxy Watch4, punten 5, 8, 9 + "kunnen wij op de smartwatch glaslook voor knoppen?"):
   één plek voor het uiterlijk van de knoppen op het horloge, zodat elk scherm er hetzelfde uitziet.

   Glaslook op een Wear OS-scherm = nagebootst: echte vervaging van wat achter een knop zit kan een gewone view niet. Het recept is
   hetzelfde als de glazen pil op de telefoon: een doorschijnend wit vlak (iets lichter bovenaan), een dunne lichte rand (≤ 16 %,
   huisregel "pillen zacht omlijnen") en voor de gekozen knop een iets lichter vlak — NOOIT een gekleurde omlijning. */

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import kotlin.math.max

object Glass {
  /** Doorschijnende glazen pil. [selected] = iets lichter vlak, dezelfde dunne lichte rand. */
  fun pill(ctx: Context, radiusDp: Float, selected: Boolean = false): GradientDrawable {
    val d = ctx.resources.displayMetrics.density
    val colors = if (selected) {
      intArrayOf(Color.argb(92, 255, 255, 255), Color.argb(58, 255, 255, 255))
    } else {
      intArrayOf(Color.argb(46, 255, 255, 255), Color.argb(24, 255, 255, 255))
    }
    return GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, colors).apply {
      cornerRadius = radiusDp * d
      setStroke(max(1, d.toInt()), Color.argb(if (selected) 40 else 30, 255, 255, 255))
    }
  }

  /** De ene beslissende knop op een scherm (Start, Done): effen witte pil. */
  fun cta(ctx: Context, radiusDp: Float): GradientDrawable {
    val d = ctx.resources.displayMetrics.density
    return GradientDrawable().apply {
      cornerRadius = radiusDp * d
      setColor(Color.WHITE)
    }
  }
}

/** 13 nov 2026 (operator: "Recommended is niet goed leesbaar"): de kleur van de toestand als tekst op glas is te donker en te zacht → 50 % naar wit. */
fun readable(color: Int): Int = androidx.core.graphics.ColorUtils.blendARGB(color, Color.WHITE, 0.5f)

/** Vaste maten voor de instellingenschermen (State Control en Breathwork even groot — operator: "zelfde grootte als bij State Control"). */
object Compact {
  const val ROW_DP = 40f
  const val CTA_DP = 38f
  const val GAP_DP = 4f
}
