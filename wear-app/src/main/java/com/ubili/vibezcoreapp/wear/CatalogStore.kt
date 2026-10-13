package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 — het horloge zelfstandig (operator: "de app vanuit de
   smartwatch bedienen zal belangrijk zijn voor users").

   De telefoon is de enige bron van waarheid voor ademtechnieken, fasen,
   trilpatronen, sterkte en toegang. Ze zet een "catalogus" als bewaard
   gegeven klaar (/vibezcore/catalog, zie WearBreathModule.syncCatalog);
   het horloge bewaart hem hier en werkt daarmee ook zonder telefoon. Zo
   bestaat er nooit een tweede, uit de pas lopende versie van de protocollen.

   Ook hier: de laatst gestarte sessie ("Again" op het startscherm). */

import android.content.Context
import android.net.Uri
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.PutDataRequest
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject

object CatalogStore {
  const val PATH_CATALOG = "/vibezcore/catalog"
  const val PATH_WATCHLOG = "/vibezcore/watchlog"
  private const val PREFS = "vz_watch"
  private const val KEY_CATALOG = "catalog"
  private const val KEY_LAST = "last"

  private val listeners = mutableListOf<() -> Unit>()

  fun addListener(l: () -> Unit) {
    listeners.add(l)
  }

  fun removeListener(l: () -> Unit) {
    listeners.remove(l)
  }

  fun save(context: Context, json: String) {
    try {
      JSONObject(json) // enkel geldige JSON bewaren
      /* Keuze op het horloge blijft staan, tenzij de telefoon voor die
         toestand intussen zelf een ANDERE techniek koos — dan is die leidend.
         (Een nieuwe catalogus wiste eerst alles, ook als de telefoon de
         horloge-keuze nog niet kende: "Last used" verdween.) */
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val local = try {
        JSONObject(prefs.getString("techByState", "{}") ?: "{}")
      } catch (_: Exception) {
        JSONObject()
      }
      val before = selectedKeys(prefs.getString(KEY_CATALOG, null))
      val after = selectedKeys(json)
      for (k in after.keys) if (before[k] != null && before[k] != after[k]) local.remove(k)
      prefs.edit()
        .putString(KEY_CATALOG, json)
        .putString("techByState", local.toString())
        .apply()
      listeners.toList().forEach { it() }
    } catch (_: Exception) {
    }
  }

  /** Per toestand de techniek die de telefoon klaarzet (selectedIdx). */
  private fun selectedKeys(raw: String?): Map<String, String> = try {
    val arr = JSONObject(raw ?: "{}").optJSONArray("breath")
    val out = HashMap<String, String>()
    for (i in 0 until (arr?.length() ?: 0)) {
      val e = arr!!.optJSONObject(i) ?: continue
      val idx = e.optInt("selectedIdx", e.optInt("recommendedIdx", 0))
      out[e.optString("key")] = e.optJSONArray("techniques")?.optJSONObject(idx)?.optString("key") ?: ""
    }
    out
  } catch (_: Exception) {
    emptyMap()
  }

  fun load(context: Context): JSONObject? = try {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_CATALOG, null)?.let { JSONObject(it) }
  } catch (_: Exception) {
    null
  }

  /** Haal de bewaarde catalogus opnieuw op (bv. bij het openen van de app). */
  fun refresh(context: Context) {
    try {
      Wearable.getDataClient(context.applicationContext)
        .getDataItems(Uri.parse("wear://*$PATH_CATALOG"))
        .addOnSuccessListener { buffer ->
          try {
            for (item in buffer) {
              val data = item.data ?: continue
              save(context, String(data, Charsets.UTF_8))
            }
          } finally {
            buffer.release()
          }
        }
    } catch (_: Exception) {
    }
  }

  fun setLast(context: Context, key: String, minutes: Int, techKey: String = "") {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString(KEY_LAST, JSONObject().put("key", key).put("minutes", minutes).put("tech", techKey).toString()).apply()
  }

  /** Laatst gekozen techniek per toestand op het horloge (ook zonder
   *  telefoon); de telefoon neemt hem over via de geschiedenis. */
  fun setTechFor(context: Context, stateKey: String, techKey: String) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val m = try {
      JSONObject(prefs.getString("techByState", "{}") ?: "{}")
    } catch (_: Exception) {
      JSONObject()
    }
    prefs.edit().putString("techByState", m.put(stateKey, techKey).toString()).apply()
  }

  /** Index van de techniek die klaarstaat: eigen keuze op het horloge,
   *  anders die van de telefoon (selectedIdx), anders het advies. */
  fun selectedIdx(context: Context, entry: JSONObject): Int {
    val techs = entry.optJSONArray("techniques") ?: return 0
    val local = try {
      JSONObject(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("techByState", "{}") ?: "{}")
        .optString(entry.optString("key"), "")
    } catch (_: Exception) {
      ""
    }
    if (local.isNotEmpty()) {
      for (i in 0 until techs.length()) if (techs.optJSONObject(i)?.optString("key") == local) return i
    }
    return entry.optInt("selectedIdx", entry.optInt("recommendedIdx", 0))
  }

  /** Gekozen duur per toestand (met de techniek waarvoor ze gekozen werd). */
  fun setDurationFor(context: Context, stateKey: String, techKey: String, minutes: Int) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val m = try {
      JSONObject(prefs.getString("durByState", "{}") ?: "{}")
    } catch (_: Exception) {
      JSONObject()
    }
    m.put(stateKey, JSONObject().put("tech", techKey).put("minutes", minutes))
    prefs.edit().putString("durByState", m.toString()).apply()
  }

  /** Index van de duur die klaarstaat voor deze toestand+techniek: eigen
   *  keuze op het horloge, anders de laatste sessie, anders het advies. */
  fun durationIdx(context: Context, e: JSONObject): Int {
    val durs = e.optJSONArray("durations") ?: return 0
    fun idxOf(minutes: Int): Int {
      for (i in 0 until durs.length()) if (durs.optJSONObject(i)?.optInt("minutes") == minutes) return i
      return -1
    }
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val chosen = try {
      JSONObject(prefs.getString("durByState", "{}") ?: "{}").optJSONObject(e.optString("key"))
    } catch (_: Exception) {
      null
    }
    if (chosen != null && chosen.optString("tech") == e.optString("techniqueKey")) {
      val i = idxOf(chosen.optInt("minutes"))
      if (i >= 0) return i
    }
    last(context)?.let { (k, minutes) ->
      if (k == e.optString("key")) {
        val i = idxOf(minutes)
        if (i >= 0) return i
      }
    }
    return e.optInt("defaultIdx", 0)
  }

  /** Alles wat het startscherm toont, voor de "is er iets veranderd"-check. */
  fun homeSignature(context: Context): String {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return (prefs.getString("durByState", "") ?: "") + (prefs.getString("techByState", "") ?: "") + (prefs.getString(KEY_LAST, "") ?: "")
  }

  fun lastTech(context: Context): String = try {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_LAST, null)
      ?.let { JSONObject(it).optString("tech", "") } ?: ""
  } catch (_: Exception) {
    ""
  }

  /** De toestand met één gekozen techniek erin (fasen, duurstappen, naam) —
   *  zelfde vorm als de toestand zelf, zodat de rest niets anders hoeft te
   *  weten. Lege of onbekende techKey = de aanbevolen techniek. */
  fun withTechnique(entry: JSONObject, techKey: String?): JSONObject {
    val techs = entry.optJSONArray("techniques") ?: return entry
    var t: JSONObject? = null
    for (i in 0 until techs.length()) if (techs.optJSONObject(i)?.optString("key") == techKey) t = techs.optJSONObject(i)
    if (t == null) t = techs.optJSONObject(entry.optInt("selectedIdx", entry.optInt("recommendedIdx", 0))) ?: return entry
    return JSONObject(entry.toString())
      .put("technique", t.optString("name"))
      .put("techniqueKey", t.optString("key"))
      .put("phases", t.optJSONArray("phases"))
      .put("durations", t.optJSONArray("durations"))
      .put("defaultIdx", t.optInt("defaultIdx", 0))
  }

  fun last(context: Context): Pair<String, Int>? = try {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_LAST, null)?.let {
      val o = JSONObject(it)
      o.getString("key") to o.getInt("minutes")
    }
  } catch (_: Exception) {
    null
  }

  /** Een sessie die op het horloge zelf gedaan is: bewaard gegeven dat de
   *  telefoon ophaalt (takeWatchSessions) — ook als ze nu niet verbonden is. */
  fun logSession(context: Context, record: JSONObject) {
    try {
      val req = PutDataRequest.create("$PATH_WATCHLOG/${System.currentTimeMillis()}")
        .setData(record.toString().toByteArray(Charsets.UTF_8))
        .setUrgent()
      Wearable.getDataClient(context.applicationContext).putDataItem(req)
    } catch (_: Exception) {
    }
  }

  fun breath(context: Context): List<JSONObject> {
    val arr = load(context)?.optJSONArray("breath") ?: return emptyList()
    return (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }
  }

  fun amp(context: Context): Int = load(context)?.optInt("amp", 0) ?: 0

  /** Sessie-JSON in hetzelfde formaat als de telefoon stuurt
   *  (WearBreathSessionService), plus "local" voor pauze/geschiedenis. */
  fun sessionJson(context: Context, entry: JSONObject, durIdx: Int): String {
    val durs = entry.optJSONArray("durations")
    val d = durs?.optJSONObject(durIdx.coerceIn(0, (durs.length() - 1).coerceAtLeast(0)))
    return JSONObject()
      .put("local", true)
      .put("stateKey", entry.optString("key"))
      .put("techniqueKey", entry.optString("techniqueKey"))
      .put("modeName", entry.optString("name"))
      .put("colorHex", entry.optString("colorHex"))
      .put("amp", amp(context))
      .put("rounds", d?.optInt("rounds", 1) ?: 1)
      .put("phases", entry.optJSONArray("phases"))
      .toString()
  }

  @Suppress("unused")
  private val unusedFilter = DataClient.FILTER_LITERAL
}

/** Dezelfde figuur als in de app, per toestand (kleur van de toestand). */
internal fun artResFor(colorHex: String): Int = when (colorHex.uppercase()) {
  "#F5A524" -> R.drawable.vz_art_sun
  "#3E9BFF" -> R.drawable.vz_art_flower
  "#B478FF" -> R.drawable.vz_art_lotus
  "#FFFFFF" -> R.drawable.vz_art_clarity
  "#00A3A3", "#4AF0D4" -> R.drawable.vz_art_tree
  else -> R.drawable.vz_art_lotus
}

private val trimmedCache = HashMap<Int, android.graphics.Bitmap>()

/** De figuur zonder lege rand, in een vierkant (operator 13 okt: "alle
 *  figuren moeten hetzelfde formaat hebben"). Elke afbeelding heeft een
 *  andere donkere marge; we meten waar de figuur echt staat (pixels die
 *  duidelijk oplichten), snijden die eruit en centreren ze in een vierkant.
 *  Zo krijgt elke figuur in hetzelfde vak exact dezelfde grootte. */
internal fun trimmedArt(context: android.content.Context, colorHex: String): android.graphics.Bitmap {
  val res = artResFor(colorHex)
  return trimmedCache.getOrPut(res) {
    val src = android.graphics.BitmapFactory.decodeResource(context.resources, res)
    val w = src.width
    val h = src.height
    val px = IntArray(w * h)
    src.getPixels(px, 0, w, 0, 0, w, h)
    var l = w
    var t = h
    var r = -1
    var b = -1
    for (y in 0 until h step 2) for (x in 0 until w step 2) {
      val c = px[y * w + x]
      val a = (c ushr 24) and 0xff
      val m = maxOf((c shr 16) and 0xff, (c shr 8) and 0xff, c and 0xff) * a / 255
      if (m > 70) {
        if (x < l) l = x
        if (x > r) r = x
        if (y < t) t = y
        if (y > b) b = y
      }
    }
    if (r < 0) return@getOrPut src
    val side = maxOf(r - l, b - t) + 4
    val out = android.graphics.Bitmap.createBitmap(side, side, android.graphics.Bitmap.Config.ARGB_8888)
    val cx = (l + r) / 2
    val cy = (t + b) / 2
    android.graphics.Canvas(out).drawBitmap(
      src,
      android.graphics.Rect(cx - side / 2, cy - side / 2, cx - side / 2 + side, cy - side / 2 + side),
      android.graphics.Rect(0, 0, side, side),
      android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG),
    )
    out
  }
}

private val figureColorCache = HashMap<Int, Int>()

/** De kleur van de figuur zelf (gemiddelde van haar oplichtende pixels).
 *  Operator 13 okt: "kleur groen is anders dan groen van figuur" — de gloed
 *  en accenten op het horloge volgen de figuur, zodat alles één geheel is. */
internal fun figureColor(context: android.content.Context, colorHex: String): Int {
  val res = artResFor(colorHex)
  return figureColorCache.getOrPut(res) {
    val bm = trimmedArt(context, colorHex)
    val w = bm.width
    val h = bm.height
    val px = IntArray(w * h)
    bm.getPixels(px, 0, w, 0, 0, w, h)
    /* de overheersende tint (histogram over 36 tinten, gewogen naar
       helderheid × verzadiging) — een gemiddelde mengt bv. lichtgroen en
       teal tot een vale olijfkleur */
    val bins = FloatArray(36)
    val hsv = FloatArray(3)
    var grey = 0f
    for (i in px.indices step 3) {
      val c = px[i]
      android.graphics.Color.colorToHSV(c, hsv)
      if (hsv[2] < 0.35f) continue
      if (hsv[1] < 0.18f) {
        grey += hsv[2]
        continue
      }
      bins[(hsv[0] / 10f).toInt().coerceIn(0, 35)] += hsv[1] * hsv[2]
    }
    var best = 0
    for (i in bins.indices) if (bins[i] > bins[best]) best = i
    // vooral wit/grijs (het kristal van Clarity): een zacht wit
    if (bins[best] < grey * 0.25f) return@getOrPut android.graphics.Color.WHITE
    android.graphics.Color.HSVToColor(floatArrayOf(best * 10f + 5f, 0.8f, 1f))
  }
}

/** Dezelfde gloed op elke pagina van een toestand (startpagina, instellingen,
 *  lijsten): licht in het midden, naar zwart aan de rand. */
internal fun stateGlow(context: android.content.Context, colorHex: String, centerY: Float = 0.42f, radius: Float = 0.5f): android.graphics.drawable.GradientDrawable {
  val c = figureColor(context, colorHex)
  val r = android.graphics.Color.red(c)
  val g = android.graphics.Color.green(c)
  val b = android.graphics.Color.blue(c)
  return android.graphics.drawable.GradientDrawable().apply {
    gradientType = android.graphics.drawable.GradientDrawable.RADIAL_GRADIENT
    gradientRadius = context.resources.displayMetrics.heightPixels * radius
    setGradientCenter(0.5f, centerY)
    // ingetogen, zoals de halo op het startscherm (operator: "achtergrond
    // te veel, terug zwart, professioneel")
    colors = intArrayOf(
      android.graphics.Color.argb(70, r, g, b),
      android.graphics.Color.argb(22, r, g, b),
      android.graphics.Color.BLACK,
    )
  }
}

/** Optische correctie: een volle bol (de bloem van Sharp Focus) oogt groter
 *  dan een open figuur in hetzelfde vak. */
internal fun artOpticalScale(colorHex: String): Float = when (colorHex.uppercase()) {
  "#3E9BFF" -> 0.86f
  /* de zon: de dunne stralen tellen mee in het vak, maar het oog ziet de
     ring — iets groter (operator: "is boost kleiner dan de rest?") */
  "#F5A524" -> 1.12f
  else -> 1f
}

