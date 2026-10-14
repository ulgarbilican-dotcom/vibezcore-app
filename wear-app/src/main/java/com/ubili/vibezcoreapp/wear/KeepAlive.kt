package com.ubili.vibezcoreapp.wear

/* 14 okt 2026 (operator: "scherm uit, trilling weg — scherm terug aan ook
   geen trilling"): Samsung's Freecess (MARs) bevriest de app ~5 s nadat het
   scherm uitgaat (logcat "freezePackage com.ubili.vibezcoreapp … LEV"), ook
   met een voorgronddienst van het type health. Bevroren kan de dienst de
   trilmotor niet meer aansturen. Een app die geluid afspeelt, wordt niet
   bevroren — dus speelt het horloge tijdens een lopende sessie een stil
   geluid in een lus (zoals de telefoon-app: assets/silence.wav). Geen
   audiofocus: muziek van de gebruiker speelt gewoon door. */

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer

object KeepAlive {
  private var player: MediaPlayer? = null
  private var holders = 0

  @Synchronized
  fun acquire(context: Context) {
    holders++
    if (player != null) return
    try {
      player = MediaPlayer.create(
        context.applicationContext,
        R.raw.vz_silence,
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
        0,
      )?.apply {
        isLooping = true
        start()
      }
    } catch (_: Exception) {
      player = null
    }
  }

  @Synchronized
  fun release() {
    if (holders > 0) holders--
    if (holders > 0) return
    try {
      player?.stop()
      player?.release()
    } catch (_: Exception) {
    }
    player = null
  }
}
