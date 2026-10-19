# App Store indienen — 19 okt 2026 (deadline 14:00)

## Tijdlijn
| Wanneer | Wat | Wie |
|---|---|---|
| nu – 12:00 | Build 38 testen (testscript hieronder) | operator |
| ± 11:45 | Build 39 op TestFlight (= 38 + "Not Now" in de Breathwork-onboarding + geen horloge-diagnosecodes) | ik |
| 12:00 – 12:15 | Build 39: korte controle (Not Now, Profiel, één sessie) | operator |
| 12:15 – 13:30 | App Store Connect invullen (A3) en build 39 indienen | operator, teksten van mij |

## Testscript build 38 (iPhone, als gratis gebruiker)
Eerst: app verwijderen → build 38 installeren via TestFlight.

1. Welkomstscherm: drie keuzes + "Already a member? Sign in".
2. Profiel: kaart **Free** + **See plans** → dag €1,29 · maand €9,99 · jaar €69,99, juridische tekst eronder.
3. Breathwork: onboarding 5 stappen, demo met stem + tikken, eerste sessie start. Boost/vrouwenstem: "Exhale through your nose" volledig.
4. Breathwork vergrendelen: stem loopt door, kaart op het vergrendelscherm toont "Inhale · Nose" + seconden.
5. State Control: onboarding (Step 1 of 3/4, Skip vraagt eerst), gratis sessie Boost, scherm vergrendelen tot het zwart is → hartslag stabiel.
6. Breathwork starten terwijl State Control loopt → "End current session?".
7. Audio Library: gratis sessies spelen, rest met slotje.
8. Dagpas kopen (zonder account) → Profiel **Premium · Day Pass** + **Keep full access** (Yearly voorgeselecteerd).
9. Account maken → "Account created", Premium blijft. Uitloggen/inloggen → Premium blijft. Restore Purchases.
10. Apple Watch: VIBEZCORE openen → figuren bij Breathwork, sessie starten vanaf het horloge, END vasthouden.
11. Account verwijderen → twee bevestigingen → welkomstscherm.

## App Store Connect (A3)
1. **App Information → Support URL:** `https://www.vibezcore.com/support`
2. **Leeftijdsclassificatie:** 13+ (vragenlijst opnieuw doorlopen).
3. **App Privacy:** gezondheid (hartslag — enkel op het toestel, niet gekoppeld aan identiteit), crashgegevens, aankopen, e-mailadres (account).
4. **Versie → In-App Purchases and Subscriptions:** Monthly, Yearly én Day Pass aanvinken.
5. **Screenshots** iPhone 6,9" en 6,5" uit de huidige app (geen Google Play-elementen).
6. **Beschrijving:** onderaan het blok hieronder toevoegen (bestaande marketingtekst blijft).
7. **App Review Information → Notes:** tekst hieronder + screenshot van de betaalpagina.
8. **Export compliance:** geen eigen versleuteling (enkel standaard HTTPS).
9. **Version Release:** "Automatically release this version".
10. **Build:** build 39 kiezen → Add for Review → Submit.

### Blok voor de beschrijving
```
VIBEZCORE PREMIUM
One membership unlocks Breathwork, State Control and the full Audio Library.
• Day Pass — €1.29 for 24 hours of full access. One-time purchase, does not renew.
• Monthly — €9.99 per month, renews automatically.
• Yearly — €69.99 per year, renews automatically.

Payment is charged to your Apple ID when you confirm the purchase. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period; renewal is charged within 24 hours before the period ends. Manage or cancel anytime in your App Store account settings. Prices may vary by country.

Terms of Use: https://www.vibezcore.com/terms
Privacy Policy: https://www.vibezcore.com/privacy
```

### App Review Notes
```
Thank you for reviewing VIBEZCORE.

No account is required. All content can be explored as a guest, and purchases work without an account (guideline 5.1.1). An account is optional and only used to keep the plan on other devices and to activate a bracelet.

Where to find the purchases: Profile tab → "See plans", or any locked session. Plans: Day Pass (non-renewing, 24 hours), Monthly and Yearly (auto-renewable, one subscription group). Restore Purchases is in the Profile tab.

Sign in with Apple is available on the Profile tab. Deleting the account (Profile → Delete account) also revokes the Sign in with Apple token.

State Control can measure your resting heart rate with the camera (finger on the lens). This is an optional wellness feature to set the starting rhythm; it is not a medical measurement and the value stays on the device. You can also enter it yourself or use an average.

The Apple Watch companion app lets users start Breathwork and State Control sessions from the watch.

Background audio is used to keep session voice guidance and the heartbeat rhythm playing while the screen is locked.
```
