package com.ubili.vibezcoreapp.wear

/* 12 okt 2026 (operator: "de lopende sessie verdwijnt snel van het scherm,
   terughalen = ontgrendelen en de app zoeken"): de melding is nu een Wear OS
   "Ongoing Activity" — een VIBEZCORE-icoon op de wijzerplaat en bovenaan de
   recente apps; één tik brengt je terug in de sessie. */
internal fun buildOngoingNotification(
  context: android.content.Context,
  channelId: String,
  notificationId: Int,
  title: String,
  text: String,
): android.app.Notification {
  val open = android.app.PendingIntent.getActivity(
    context,
    notificationId,
    android.content.Intent(context, MainActivity::class.java)
      .addFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP or android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
    android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT,
  )
  val builder = androidx.core.app.NotificationCompat.Builder(context, channelId)
    .setContentTitle(title.ifBlank { "VIBEZCORE" })
    .setContentText(text)
    .setSmallIcon(R.drawable.vz_vmark)
    .setOngoing(true)
    .setCategory(androidx.core.app.NotificationCompat.CATEGORY_WORKOUT)
    .setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC)
    .setContentIntent(open)
  try {
    androidx.wear.ongoing.OngoingActivity.Builder(context, notificationId, builder)
      .setStaticIcon(R.drawable.vz_vmark)
      .setTouchIntent(open)
      .setStatus(
        androidx.wear.ongoing.Status.Builder()
          .addTemplate(if (text.isBlank()) title else "$title · $text")
          .build(),
      )
      .build()
      .apply(context)
  } catch (_: Exception) {
    /* zonder Ongoing Activity blijft het een gewone lopende melding */
  }
  return builder.build()
}
