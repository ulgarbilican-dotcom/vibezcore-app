/* VIBEZCORE — app-entry. Eerst de iPhone-tekstschaal (src/utils/ios-text-scale.ts),
   zodat elke StyleSheet.create in de app hem al gebruikt; daarna de gewone
   Expo Router-entry. require() i.p.v. import, zodat de volgorde vastligt. */
require('./src/utils/ios-text-scale').installIosTextScale();
require('expo-router/entry');
