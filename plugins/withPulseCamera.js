/* VIBEZCORE — camera voor "Match your rhythm" (operator, 7 okt 2026).

   De camera + zaklamp lezen de pols uit de vingertop, enkel om het
   State Control-ritme in te stellen. Er wordt niets opgenomen of bewaard.

   - iOS: uitlegtekst in het systeemvenster (NSCameraUsageDescription).
   - Android: CAMERA-toestemming, maar camera en flits NIET verplicht —
     anders verbergt Google Play de app voor toestellen zonder camera of
     flits; daar valt de app terug op zelf invullen. */

const { withInfoPlist, withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const CAMERA_USAGE =
  'VIBEZCORE uses the camera and flash to read your pulse from your fingertip, to set your rhythm. Nothing is recorded or saved.';

function withPulseCamera(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.NSCameraUsageDescription = CAMERA_USAGE;
    return c;
  });

  config = withAndroidManifest(config, (c) => {
    AndroidConfig.Permissions.ensurePermission(c.modResults, 'android.permission.CAMERA');
    const manifest = c.modResults.manifest;
    manifest['uses-feature'] = manifest['uses-feature'] ?? [];
    for (const name of ['android.hardware.camera', 'android.hardware.camera.flash']) {
      const existing = manifest['uses-feature'].find((f) => f.$['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return c;
  });

  return config;
}

module.exports = withPulseCamera;
