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
    /** Gepauzeerd (op telefoon of horloge): toon Resume, het ritme staat stil. */
    val paused: Boolean = false,
    /** Kleur van de toestand (6 okt 2026, zelfde look als de app). */
    val colorHex: String = "#00A3A3",
    /** Waterpeil van..tot over de lopende fase (inademen stijgt, uitademen
     *  zakt, vasthouden blijft) en wanneer die fase eindigt (uptime ms). */
    val levelFrom: Float = 0.3f,
    val levelTo: Float = 0.3f,
    val phaseStartUptime: Long = 0L,
    val phaseEndUptime: Long = 0L,
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
