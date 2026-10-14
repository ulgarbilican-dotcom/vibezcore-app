package com.ubili.vibezcoreapp.wear

/* 14 okt 2026 (audit): de synchronisatiemetingen ("VZSync", per slag en per
   fase) enkel in de testversie — niet in de versie voor gebruikers. */

import android.content.Context
import android.content.pm.ApplicationInfo

internal object VzLog {
  @Volatile private var on = false

  fun init(context: Context) {
    on = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
  }

  fun d(msg: String) {
    if (on) android.util.Log.d("VZSync", msg)
  }
}
