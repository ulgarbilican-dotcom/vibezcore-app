package com.ubili.vibezcoreapp.wear

/* 13 okt 2026 — het horloge zelfstandig (operator: "de app vanuit de
   smartwatch bedienen zal belangrijk zijn voor users").

   De telefoon is de enige bron van waarheid voor ademtechnieken, fasen,
   trilpatronen, sterkte en toegang. Ze zet een "catalogus" als bewaard
   gegeven klaar (/vibezcore/catalog, zie WearBreathModule.syncCatalog);
   het horloge bewaart hem hier en werkt daarmee ook zonder telefoon. Zo
   bestaat er nooit een tweede, uit de pas lopende versie van de protocollen.

   Ook hier: de laatst gestarte toestand per onderdeel (daarop opent het). */

import android.content.Context
import android.net.Uri
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

  /** Haal de bewaarde catalogus opnieuw op (bv. bij het openen van de app).
   *  Twee wegen, zodat het nooit van één kanaal afhangt: het bewaarde data-item én een rechtstreekse vraag aan de telefoon
   *  (die antwoordt met een bericht, zie BreathListenerService). */
  fun refresh(context: Context) {
    PhoneLink.requestCatalog(context)
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

  /** De laatst gestarte horloge-sessie, Breathwork of State Control.
   *  14 okt 2026 (operator: "recent per onderdeel i.p.v. op de startpagina"):
   *  per onderdeel ook de laatste toestand (`last_state` / `last_breath`) —
   *  het onderdeel opent daarop, zoals Workout op je laatste training. */
  fun setRecent(context: Context, kind: String, key: String, minutes: Int, techKey: String = "") {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("recent", JSONObject().put("kind", kind).put("key", key).put("minutes", minutes).put("tech", techKey).toString())
      .putString("last_$kind", key)
      .apply()
  }

  /** Laatst gestarte toestand van een onderdeel ("state" of "breath"), of null. */
  fun lastKey(context: Context, kind: String): String? {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    prefs.getString("last_$kind", null)?.let { return it }
    /* van vóór 14 okt: enkel één gezamenlijke "recent" */
    return try {
      prefs.getString("recent", null)?.let { JSONObject(it) }
        ?.takeIf { it.optString("kind") == kind }?.optString("key")
    } catch (_: Exception) {
      null
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
      /* id = uniek pad; de telefoon onthoudt ze en importeert nooit dubbel
         (audit 14 okt 2026). */
      val id = "${System.currentTimeMillis()}-${(1000..9999).random()}"
      if (!record.has("id")) record.put("id", id)
      val req = PutDataRequest.create("$PATH_WATCHLOG/$id")
        .setData(record.toString().toByteArray(Charsets.UTF_8))
        .setUrgent()
      Wearable.getDataClient(context.applicationContext).putDataItem(req)
        .addOnSuccessListener {
          VzLog.d("watchlog saved id=${record.optString("id")}")
          /* 15 okt 2026: de telefoon meteen laten ophalen (ook als de app
             al open staat); niet verbonden → bij het volgende openen. */
          PhoneLink.sendWatchAction(context.applicationContext, "logged", "history")
        }
        .addOnFailureListener { e -> VzLog.d("watchlog FAILED ${e.message}") }
    } catch (_: Exception) {
    }
  }

  /** State Control-toestanden uit de catalogus (13 okt 2026; leeg bij een
   *  oudere telefoon-app). */
  fun state(context: Context): List<JSONObject> {
    val cat = load(context) ?: return emptyList()
    val arr = cat.optJSONArray("state") ?: return emptyList()
    /* 27 okt 2026: net als bij Breathwork — de ene gratis volledige State Control-sessie geldt ook op de pols; na die
       sessie weer op slot (voorproef van 30 s), ook zonder telefoon in de buurt. */
    val freeUsedHere = cat.optBoolean("stateFreeOnce", false) &&
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("freeStateUsed", false)
    return (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }.map { e ->
      if (freeUsedHere && !e.optBoolean("locked")) JSONObject(e.toString()).put("locked", true) else e
    }
  }

  /** Een gratis State Control-sessie is op het horloge gestart. */
  fun markFreeStateUsed(context: Context) {
    if (load(context)?.optBoolean("stateFreeOnce", false) != true) return
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("freeStateUsed", true).apply()
  }

  /** Gekozen duur voor deze State Control-toestand, anders de aanbevolen. */
  fun stateMinutes(context: Context, e: JSONObject): Int {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val m = prefs.getInt("stateDur_" + e.optString("key"), -1)
    val min = e.optInt("minMinutes", 5)
    val max = e.optInt("maxMinutes", 30)
    return if (m in min..max) m else e.optInt("defaultMinutes", min).coerceIn(min, max)
  }

  fun setStateMinutes(context: Context, key: String, minutes: Int) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("stateDur_$key", minutes).apply()
  }

  fun breath(context: Context): List<JSONObject> {
    val cat = load(context) ?: return emptyList()
    val arr = cat.optJSONArray("breath") ?: return emptyList()
    /* 14 okt 2026 (audit): de ene gratis Breathwork-sessie geldt ook op de
       pols — na die sessie op slot, ook zonder telefoon in de buurt. */
    val freeUsedHere = cat.optBoolean("breathFreeOnce", false) &&
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("freeBreathUsed", false)
    return (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }.map { e ->
      if (freeUsedHere && !e.optBoolean("locked")) JSONObject(e.toString()).put("locked", true) else e
    }
  }

  /** Een gratis Breathwork-sessie is op het horloge gestart. */
  fun markFreeBreathUsed(context: Context) {
    if (load(context)?.optBoolean("breathFreeOnce", false) != true) return
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("freeBreathUsed", true).apply()
  }

  fun amp(context: Context): Int = load(context)?.optInt("amp", 0) ?: 0

  /** Sessie-JSON in hetzelfde formaat als de telefoon stuurt
   *  (WearBreathSessionService), plus "local" voor pauze/geschiedenis. */
  fun sessionJson(context: Context, entry: JSONObject, durIdx: Int, previewSec: Int = 0): String {
    val durs = entry.optJSONArray("durations")
    val d = durs?.optJSONObject(durIdx.coerceIn(0, (durs.length() - 1).coerceAtLeast(0)))
    /* Voorproef (niet-Premium): zoveel rondes als in ~previewSec passen. */
    var rounds = d?.optInt("rounds", 1) ?: 1
    if (previewSec > 0) {
      val ph = entry.optJSONArray("phases")
      var cycle = 0.0
      for (i in 0 until (ph?.length() ?: 0)) cycle += ph!!.optJSONObject(i)?.optDouble("secs", 0.0) ?: 0.0
      rounds = if (cycle > 0) Math.ceil(previewSec / cycle).toInt().coerceAtLeast(1) else 1
    }
    return JSONObject()
      .put("preview", previewSec > 0)
      .put("local", true)
      .put("stateKey", entry.optString("key"))
      .put("techniqueKey", entry.optString("techniqueKey"))
      .put("modeName", entry.optString("name"))
      .put("colorHex", entry.optString("colorHex"))
      .put("amp", amp(context))
      .put("rounds", rounds)
      .put("phases", entry.optJSONArray("phases"))
      .toString()
  }
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
  /* het oog van Clarity & Relax: veel doorzichtige gloed rondom telt mee
     in het vak, het oog zelf oogt kleiner (operator: "beetje groter") */
  "#FFFFFF" -> 1.18f
  else -> 1f
}

