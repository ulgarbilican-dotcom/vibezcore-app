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
  private const val CACHE_MS = 10_000L

  @Volatile private var cachedAt = 0L
  @Volatile private var cached = 0L

  /** Extra vertraging (ms) van de huidige media-uitgang t.o.v. de luidspreker. */
  fun extraMs(context: Context): Long {
    val now = SystemClock.elapsedRealtime()
    if (now - cachedAt < CACHE_MS) return cached
    val value = try {
      if (bluetoothOutput(context)) {
        val m = measuredBluetoothMs()
        if (m in 60L..MAX_MS) m else BLUETOOTH_DEFAULT_MS
      } else {
        0L
      }
    } catch (_: Exception) {
      0L
    }
    /* Meting 31 okt 2026: volgen of de vertraging van de oortjes tijdens
       een sessie verandert (operator: eerste ~20 s via oortjes niet gelijk). */
    if (value != cached || cachedAt == 0L) android.util.Log.d("VZAudio", "extraMs=$value")
    cached = value
    cachedAt = now
    return value
  }

  /** Media gaat naar Bluetooth zodra er een Bluetooth-media-uitgang is
   *  (Android routeert media automatisch daarheen). */
  private fun bluetoothOutput(context: Context): Boolean {
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val bt = mutableSetOf(AudioDeviceInfo.TYPE_BLUETOOTH_A2DP)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      bt.add(AudioDeviceInfo.TYPE_BLE_HEADSET)
      bt.add(AudioDeviceInfo.TYPE_BLE_SPEAKER)
    }
    return am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any { it.type in bt }
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
