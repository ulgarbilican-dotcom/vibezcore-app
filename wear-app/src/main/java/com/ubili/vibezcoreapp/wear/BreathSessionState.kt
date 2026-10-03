package com.ubili.vibezcoreapp.wear

/* In-process toestand, gedeeld tussen de Service (schrijft) en MainActivity
   (leest) — allebei in dezelfde app/hetzelfde proces, dus geen Binder/
   broadcast nodig, een gewoon singleton-object volstaat. */
object BreathSessionState {
  data class Snapshot(
    val phaseLabel: String,
    val modeName: String,
    val round: Int,
    val totalRounds: Int,
    val running: Boolean,
  )

  @Volatile
  var current: Snapshot = Snapshot("Waiting for phone…", "", 0, 0, running = false)
    private set

  private val listeners = mutableListOf<(Snapshot) -> Unit>()

  fun update(snapshot: Snapshot) {
    current = snapshot
    listeners.toList().forEach { it(snapshot) }
  }

  fun addListener(listener: (Snapshot) -> Unit) {
    listeners.add(listener)
    listener(current)
  }

  fun removeListener(listener: (Snapshot) -> Unit) {
    listeners.remove(listener)
  }
}
