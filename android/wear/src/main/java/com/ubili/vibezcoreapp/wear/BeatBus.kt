package com.ubili.vibezcoreapp.wear

/* Elke echte tik op de pols, voor het scherm: de services melden hier op
   het moment dat ze trillen, het scherm tekent dan een ring (6 okt 2026,
   "zelfde look als de app"). Puur weergave — de trilling zelf hangt hier
   niet van af. */
object BeatBus {
  private val listeners = mutableListOf<(Boolean) -> Unit>()

  @Synchronized
  fun add(listener: (Boolean) -> Unit) {
    listeners.add(listener)
  }

  @Synchronized
  fun remove(listener: (Boolean) -> Unit) {
    listeners.remove(listener)
  }

  /** `strong` = de eerste tik van een slag (of een fasewissel bij breathwork). */
  fun beat(strong: Boolean) {
    val copy = synchronized(this) { listeners.toList() }
    copy.forEach { it(strong) }
  }
}
