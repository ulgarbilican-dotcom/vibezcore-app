/* Telefoon-first: op Android-tablets en vouwbare toestellen draait de app in een gecentreerd
   telefoonvenster i.p.v. uitgerekt over het hele scherm (21 okt 2026). */
const { withAndroidManifest } = require('@expo/config-plugins');
module.exports = function withPhoneOnlyWindow(config) {
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application?.[0];
    if (app) {
      const act = (app.activity || []).find((a) => a.$['android:name'] === '.MainActivity');
      if (act) act.$['android:resizeableActivity'] = 'false';
      app['meta-data'] = app['meta-data'] || [];
      if (!app['meta-data'].some((m) => m.$['android:name'] === 'android.max_aspect')) {
        app['meta-data'].push({ $: { 'android:name': 'android.max_aspect', 'android:value': '2.4' } });
      }
    }
    return c;
  });
};
