/* 1 nov 2026 (iOS build 68 #12): Audio Library-bestanden waarvan een genormaliseerde kopie (-16 LUFS, 192 kbps) op Bunny staat onder
   /app-16lufs/<zelfde pad>. Paden ONGECODEERD (zoals decodeURIComponent ze geeft). Enkel bestanden die echt versterkt/verzacht moesten
   worden (> 0,5 dB); de rest speelt het origineel. Gegenereerd uit de normalisatie-run — niet met de hand aanvullen zonder upload. */
export const NORMALIZED_AUDIO_PATHS: ReadonlySet<string> = new Set<string>([]);
