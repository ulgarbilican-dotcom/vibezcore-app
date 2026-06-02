// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/* Iter 9dq v3 (2026-06-02): voeg `mjs` toe aan sourceExts zodat Metro
   ESM-modules kan resolven. Nodig voor `lucide-react-native` dat z'n
   icons als `.mjs` ships (en mogelijk toekomstige ESM-only packages).
   Zonder deze fix faalt de bundle met:
     "None of these files exist: ...icons/a-arrow-down.mjs(...)"
   Bekend Metro-issue: https://github.com/facebook/metro/issues/535 */
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;
