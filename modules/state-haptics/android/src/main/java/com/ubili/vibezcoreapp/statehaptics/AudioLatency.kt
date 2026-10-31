package com.ubili.vibezcoreapp.statehaptics

/* 20 okt 2026 (operator: "alles moet voor ELKE gebruiker correct zijn"):
   hoeveel later een geluid te horen is dan op de luidspreker van de
   telefoon zelf. Op de luidspreker en bedrade oortjes: 0 (zo zijn hartslag-
   geluid, stem en beeld afgestemd). Via Bluetooth komt daar 150–300 ms bij,
   verschillend per oortje en per telefoon — dat vragen we hier op bij het
   toestel zelf (AudioTrack-latentie, zoals ExoPlayer dat doet), zodat het
   geluid zoveel vroeger kan starten en toch samenvalt met trilling en beeld.
   Lukt de meting niet, dan een gangbare Bluetooth-waarde. */

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.SystemClock

object AudioLatency {
  private const val BLUETOOTH_DEFAULT_MS = 200L
  private const val MAX_MS = 450L
  /** Totaal (gemeten + correctie) nooit buiten deze grenzen. */
  private const val TOTAL_MAX_MS = 600L
  const val CORRECTION_MIN_MS = -200L
  const val CORRECTION_MAX_MS = 400L
  private const val CACHE_MS = 10_000L
  private const val PREFS = "vz_audio_latency"

  @Volatile private var cachedAt = 0L
  @Volatile private var cached = 0L
  @Volatile private var cachedReported = 0L
  @Volatile private var cachedKey: String? = null
  @Volatile private var cachedName = ""

  /* 31 okt 2026 (operator: "het moet voor alle toestellen met bluetooth
     connectie werken"): de vertraging die oortjes zelf doorgeven klopt niet
     altijd (gemeten: het geluid kwam NA de trilling). Per Bluetooth-toestel
     bewaren we daarom een correctie in ms, die de gebruiker één keer instelt
     met Sound timing (meetikken op de slag). Gemeten + correctie = wat stem,
     hartslaggeluid en tikken vooruit starten — overal in de app. */

  /** Extra vertraging (ms) van de huidige media-uitgang t.o.v. de
   *  luidspreker, inclusief de bewaarde correctie van dit toestel. */
  fun extraMs(context: Context): Long {
    refresh(context)
    return cached
  }

  /** Huidige Bluetooth-uitgang, of null (luidspreker/bedraad). */
  fun currentDevice(context: Context): Map<String, Any>? {
    refresh(context)
    val key = cachedKey ?: return null
    val p = prefs(context)
    return mapOf(
      "key" to key,
      "name" to cachedName,
      "reportedMs" to cachedReported.toDouble(),
      "correctionMs" to p.getLong(key, 0L).toDouble(),
      "calibrated" to p.contains(key),
    )
  }

  fun setCorrection(context: Context, key: String, ms: Long) {
    prefs(context).edit().putLong(key, ms.coerceIn(CORRECTION_MIN_MS, CORRECTION_MAX_MS)).apply()
    cachedAt = 0L
  }

  fun clearCorrection(context: Context, key: String) {
    prefs(context).edit().remove(key).apply()
    cachedAt = 0L
  }

  private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun refresh(context: Context) {
    val now = SystemClock.elapsedRealtime()
    if (cachedAt != 0L && now - cachedAt < CACHE_MS) return
    var key: String? = null
    var name = ""
    var reported = 0L
    val value = try {
      val dev = bluetoothDevice(context)
      if (dev != null) {
        name = dev.productName?.toString()?.trim().orEmpty()
        val addr = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) dev.address.orEmpty() else ""
        key = "bt:" + (addr.ifBlank { name.ifBlank { "unknown" } })
        val m = measuredBluetoothMs()
        reported = if (m in 60L..MAX_MS) m else BLUETOOTH_DEFAULT_MS
        val corr = prefs(context).getLong(key, 0L)
        (reported + corr).coerceIn(0L, TOTAL_MAX_MS)
      } else {
        0L
      }
    } catch (_: Exception) {
      0L
    }
    /* Meting 31 okt 2026: volgen of de vertraging tijdens een sessie verandert. */
    if (value != cached || cachedAt == 0L) android.util.Log.d("VZAudio", "extraMs=$value reported=$reported device=$key")
    cachedKey = key
    cachedName = name
    cachedReported = reported
    cached = value
    cachedAt = now
  }

  /** De Bluetooth-media-uitgang (Android routeert media automatisch daarheen). */
  private fun bluetoothDevice(context: Context): AudioDeviceInfo? {
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val bt = mutableSetOf(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      bt.add(AudioDeviceInfo.TYPE_BLE_HEADSET)
      bt.add(AudioDeviceInfo.TYPE_BLE_SPEAKER)
    }
    return am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).firstOrNull { it.type in bt }
  }

  /** Latentie van een media-AudioTrack min zijn eigen buffer = wat de
   *  Bluetooth-keten toevoegt. -1 als het toestel het niet prijsgeeft. */
  private fun measuredBluetoothMs(): Long {
    var track: AudioTrack? = null
    return try {
      val rate = 44_100
      val bufBytes = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT)
      if (bufBytes <= 0) return -1L
      track = AudioTrack.Builder()
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        .setAudioFormat(
          AudioFormat.Builder()
            .setSampleRate(rate)
            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .build(),
        )
        .setBufferSizeInBytes(bufBytes)
        .setTransferMode(AudioTrack.MODE_STREAM)
        .build()
      val latency = (AudioTrack::class.java.getMethod("getLatency").invoke(track) as Int).toLong()
      val bufferMs = bufBytes / 4L * 1000L / rate
      latency - bufferMs
    } catch (_: Throwable) {
      -1L
    } finally {
      try {
        track?.release()
      } catch (_: Exception) {
      }
    }
  }
}
