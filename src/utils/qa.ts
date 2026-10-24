/* QA-schakelaar (24 okt 2026, docs/KWALITEITSPROTOCOL.md): in een TESTBUILD (EXPO_PUBLIC_QA=1 bij het bundelen) kan de toestand
   van de gebruiker (Free/gast, Premium) per commando gewisseld worden via vibezcoreapp://qa?tier=free|premium|clear, zodat DEZELFDE
   build in beide toestanden getest wordt. Winkelbuilds (EAS production) zetten deze variabele nooit: dan is dit uit en doet
   de /qa-route niets. */
export const QA_ENABLED = process.env.EXPO_PUBLIC_QA === '1';
