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

/** Vaste maten voor de instellingenschermen (State Control en Breathwork even groot — operator: "zelfde grootte als bij State Control").
 *  13 nov 2026 (schermenaudit op 180/192/225 dp): op een kleiner scherm dan de 198 dp van de Watch4 schalen de maten mee (tot 88 %), zodat
 *  Start niet tegen de ronding komt; op een groter scherm blijven ze gelijk. */
object Compact {
  private const val ROW_DP = 38f
  private const val CTA_DP = 36f
  private const val GAP_DP = 4f
  private const val CTA_WIDTH_DP = 126f
  /** Extra ruimte bovenaan voor smalle tekst (label/naam); op een heel klein scherm (< 190 dp) is er geen ruimte over. */
  fun topExtra(ctx: Context, normalDp: Float): Float = if (RoundFit.heightDp(ctx) < 190f) 0f else normalDp
  fun k(ctx: Context): Float = (RoundFit.heightDp(ctx) / 198f).coerceIn(0.80f, 1f)
  fun row(ctx: Context) = ROW_DP * k(ctx)
  fun cta(ctx: Context) = CTA_DP * k(ctx)
  fun gap(ctx: Context) = GAP_DP * k(ctx)
  /** Start/Preview onderaan: iets smaller dan de rijen erboven, zodat de hoeken op een rond scherm ruim binnen de rand blijven (Play WO-V16). */
  fun ctaWidth(ctx: Context) = CTA_WIDTH_DP * k(ctx)
}

/** 13 nov 2026 (Wear-richtlijn WO-V1: "bij grotere lettertypes mag tekst en bediening niet overlappen of afgekapt worden"; audit met lettergrootte 1,3):
 *  de lettergrootte van het systeem wordt gevolgd tot 1,1 — daarboven past de ronde schermruimte niet meer. */
fun capFontScale(base: Context): Context {
  val c = android.content.res.Configuration(base.resources.configuration)
  if (c.fontScale <= 1.1f) return base
  c.fontScale = 1.1f
  return base.createConfigurationContext(c)
}

/** 13 nov 2026 (operator: "het groen van Sleep, tekst enzovoort, moet hetzelfde zijn als de Tree of Life"): op het horloge is Sleep overal het ENE
 *  lichte Bio-Teal (#4AF0D4) — gelijk aan de boom. De telefoon stuurt voor State Control Sleep het donkere #00A3A3; dat wordt hier lichter gemaakt. */
const val SLEEP_TEAL = "#4AF0D4"

fun accentColor(hex: String, fallback: String = SLEEP_TEAL): Int {
  val h = if (hex.equals("#00A3A3", ignoreCase = true)) SLEEP_TEAL else hex
  return try {
    Color.parseColor(h)
  } catch (_: Exception) {
    Color.parseColor(fallback)
  }
}
