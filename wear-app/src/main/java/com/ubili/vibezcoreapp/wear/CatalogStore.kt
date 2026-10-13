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
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_CATALOG, json).apply()
      listeners.toList().forEach { it() }
    } catch (_: Exception) {
    }
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

  fun setLast(context: Context, key: String, minutes: Int) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString(KEY_LAST, JSONObject().put("key", key).put("minutes", minutes).toString()).apply()
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
