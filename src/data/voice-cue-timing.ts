/* VIBEZCORE — waar de stem begint en eindigt in elke ademcue (seconden).

   Gemeten op de bestanden in Bunny-map "Breathwork audio v4" (19 okt 2026,
   ffmpeg silencedetect −45 dB, min. 0,12 s). Sleutel = de bestandsnaam zoals
   in de CDN-URL (breath-voice.ts). Gebruikt om een zin die niet in een korte
   fase past vooraan in te korten (stilte overslaan), zodat hij volledig
   uitgesproken wordt (operator, 19 okt 2026: "bij Boost wordt exhale through
   your nose niet volledig uitgesproken"). Nieuwe opname = opnieuw meten. */

export const VOICE_CUE_SPEECH: Record<string, [number, number]> = {
  'Boost%20exhale%20through%20mouth.mp3': [0.00, 1.31],
  'Boost_%20inhale%20through%20nose.mp3': [0.00, 1.36],
  'Exhale%20through%20your%20mouth..mp3': [0.57, 1.94],
  'Exhale%20through%20your%20nose..mp3': [0.63, 2.14],
  'Hold.mp3': [0.61, 1.10],
  'Inhale%20through%20your%20nose..mp3': [0.65, 2.19],
  'Kylie%20Dart%20Vader%20(1).mp3': [0.60, 10.18],
  'Kylie%20Enjoy%20your%20session%20fem.mp3': [0.54, 1.75],
  'Kylie%20Exhale%20left%20nostril.mp3': [0.54, 2.19],
  'Kylie%20Exhale%20right%20nostril.mp3': [0.54, 2.33],
  'Kylie%20Extra%20inhale.mp3': [0.00, 1.17],
  'Kylie%20Inhale%20left%20nostril.mp3': [0.55, 2.31],
  'Kylie%20Inhale%20right%20nostril.mp3': [0.51, 2.08],
  'Marius%20Boost%20%20inhale%20through%20nose.mp3': [0.00, 1.48],
  'Marius%20Boost%20exhale%20through%20mouth.mp3': [0.00, 1.23],
  'Marius%20Dart%20Vader%203.mp3': [0.00, 9.82],
  'Marius%20Enjoy%20your%20session%20male.mp3': [0.00, 1.16],
  'Marius%20Exhale%20left%20nostril%20male.mp3': [0.00, 1.56],
  'Marius%20Exhale%20right%20nostril%20male.mp3': [0.00, 1.56],
  'Marius%20Exhale%20through%20your%20mouth%20male.mp3': [0.00, 1.35],
  'Marius%20Exhale%20through%20your%20nose%20male.mp3': [0.00, 1.31],
  'Marius%20Extra%20inhale%20male.mp3': [0.00, 1.05],
  'Marius%20Hold%20male.mp3': [0.00, 0.44],
  'Marius%20Inhale%20left%20nostril%20male.mp3': [0.00, 1.56],
  'Marius%20Inhale%20right%20nostril%20male.mp3': [0.00, 1.39],
  'Marius%20Inhale%20through%20your%20nose.mp3': [0.00, 1.32],
  'boost%20finished%20.mp3': [0.00, 9.49],
  'calm%20finished.mp3': [0.00, 14.51],
  'clarity%20finished.mp3': [0.14, 14.60],
  'focus%20finished%20.mp3': [0.00, 13.11],
  'rest%20finished.mp3': [0.17, 19.62],
};
