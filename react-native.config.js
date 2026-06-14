/**
 * React Native autolinking config — local dev builds only.
 *
 * react-native-iap v15 gebruikt nitro-modules met een native codegen-pipeline
 * die in EAS-cloud correct draait maar lokaal (npx expo run:android) faalt
 * door een ontbrekende codegen-step. Commit 5fd2994 zegt expliciet:
 * "No local prebuild required" → IAP wordt alleen via EAS production gebouwd.
 *
 * Voor lokale dev op een fysiek toestel sluiten we IAP + nitro-modules uit
 * van autolinking. JS-side gebruikt MockIAPProvider (USE_MOCK_IAP = __DEV__),
 * dus alle bracelet- en audio-flows werken normaal.
 *
 * Voor production builds: gebruik `eas build --platform android --profile production`,
 * die deze file negeert en de native modules wél meeneemt via de Expo config plugin.
 */
module.exports = {
  dependencies: {
    'react-native-iap': {
      platforms: {
        android: null,
        ios: null,
      },
    },
    'react-native-nitro-modules': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
