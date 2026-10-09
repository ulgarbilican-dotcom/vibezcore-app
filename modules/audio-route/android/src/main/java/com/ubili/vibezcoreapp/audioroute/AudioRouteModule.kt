package com.ubili.vibezcoreapp.audioroute

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/* VIBEZCORE (operator, 9 okt 2026): het hartslaggeluid klinkt op de speaker
   en in een koptelefoon anders — de app kiest per uitgang de juiste versie. */
class AudioRouteModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AudioRoute")

    Function("isHeadphones") {
      val am = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        ?: return@Function false
      val headphoneTypes = mutableSetOf(
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
        AudioDeviceInfo.TYPE_USB_HEADSET,
      )
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        headphoneTypes.add(AudioDeviceInfo.TYPE_BLE_HEADSET)
      }
      am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any { it.type in headphoneTypes }
    }
  }
}
