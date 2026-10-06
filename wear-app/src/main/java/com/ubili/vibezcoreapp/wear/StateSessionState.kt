package com.ubili.vibezcoreapp.wear

/* In-process toestand van een State Control-sessie op het horloge, gedeeld
   tussen WearStateSessionService (schrijft) en MainActivity (leest) —
   zelfde patroon als BreathSessionState. */
object StateSessionState {
  data class Snapshot(
    val active: Boolean,
    val paused: Boolean,
    val title: String,
    val colorHex: String,
    val remainingMinutes: Int,
    /** Voor het scherm (6 okt 2026): aftellen in mm:ss en het waterpeil. */
    val remainingSec: Int = 0,
    val totalSec: Int = 0,
  )

  val IDLE = Snapshot(active = false, paused = false, title = "", colorHex = "#00A3A3", remainingMinutes = 0)

  @Volatile
  var current: Snapshot = IDLE
    private set

  private val listeners = mutableListOf<(Snapshot) -> Unit>()

  @Synchronized
  fun update(snapshot: Snapshot) {
    if (snapshot == current) return
    current = snapshot
    listeners.toList().forEach { it(snapshot) }
  }

  @Synchronized
  fun addListener(listener: (Snapshot) -> Unit) {
    listeners.add(listener)
    listener(current)
  }

  @Synchronized
  fun removeListener(listener: (Snapshot) -> Unit) {
    listeners.remove(listener)
  }
}
