# Bevindingen doorloop (21-22 okt 2026)

Methode: doorloop als nieuwe bezoeker op emulator (411×914, 3-knops navigatie) + matrix-runs op 5 formaten × 3 navigatiemodi × 2 lettergroottes. Fix op het moment van vinden.

## Gevonden en gerepareerd
| Scherm | Fout | Fix |
|---|---|---|
| Breath-intro | gezichten half buiten beeld, foto te hoog/laag per scherm | foto op verhouding, bovenaan uitgelijnd, zachte zwarte overgang |
| Breath-onboarding stap 1 | foto te ver ingezoomd, 1 gezicht ontbrak | zelfde behandeling als intro |
| Breath-onboarding stap 2 | bracelet-kaart leeg tot de foto laadde | foto zit in de app; gebundelde foto wint altijd van het cachebestand |
| Breath-toestanden | Boost/Calm foto's lieten zwarte band/afsnijding zien | nieuwe Boost-foto, Calm groter, offsets als verhouding |
| Breath-instelscherm | tekst achter de knop op korte schermen | scrollt onder 760 dp |
| Breath-sessie | cijfer/pil/knop overlapten op korte schermen | beeld schaalt met schermhoogte |
| Sessie-boog | gloed van het bolletje als vierkant afgesneden | canvas met marge |
| State Control (preview) | grote witte End Preview-knop | ronde play/pauze + END SESSION |
| State Control stap 1 | pillen niet zoals website; grafiek onder knop | glazen iconenbalk; grafiek krimpt, voetnoot valt weg bij krap |
| Quick Chill/Boost | pillen met tekst | alleen icoon in glazen cirkel |
| Alle CTA's | hoekig, fel wit overal | ovaal; flow = glazen pil; beslissende actie = wit; 50 dp |
| Uitgeschakelde knop | tekst scheen door | ondoorzichtig |
| Library-intro | te groot | uitgezoomd (zelfde als andere intro's) |
| Library-bracelet-kaart | schermhoge foto | vaste hoogte |
| Mini-speler | helder wit in een donkere app | donker |
| Plan-review | iconen uitgerekt, vinkje onzichtbaar op wit, tekst afgekapt | contain, donker vinkje, schaalt |
| Protocol-bouwer | dubbel vinkje, badges onder tekst, knop | één vinkje, badges schalen, vaste knop |
| feel-now | 1 kolom op 320 dp, afgekapte techniek | flexibele tegels, wrap |
| Titels | "plan-summary" als kop; dubbele titel Settings; dubbele bovenrand | headerShown/edges |
| Tabnaam | "State Contr…" | schaalt |
| Profile, Subscribe, wachtwoord-/activatieschermen | ondermarge verdween op Android: `KeyboardAwareScrollView` overschrijft `paddingBottom` met 0 bij een array-stijl; laatste rijen/voorwaarden onder tabbalk of tegen de rand | wrapper `components/KeyboardAwareScroll.tsx` met afgevlakte stijl (te verifiëren) |
| Systeemnavigatie | inhoud liep onder de knoppen door | effen strook onder systeemnavigatie (te verifiëren) |
| Tablets/vouwbaar | uitgerekt over het scherm | telefoonvenster (Android-config) |
| Bevestigingsgeluid | schel | warm tweetonig geluid |

| Boost/Calm (alleen lokale build) | zwart vlak: nieuwe foto's ontbraken in de lokale incrementele build | herbouw met afgedwongen asset-stappen; store-builds niet getroffen |

## Niet op de emulator te beoordelen (jouw A16/iPhone)
Animaties, glas/blur, haptiek, geluid, golfvulling van de ervaringskaarten, de meting met de camera, iOS.

| Keuzebladen (Times/Routine/…) | laatste kaart halverwege afgesneden (ScrollView te vroeg gemeten) | `components/SheetScroll.tsx`: hoogte volgt gemeten inhoud (nog te verifiëren op toestel) |
| Tegels in breath-setup/intensity | waarde afgekapt ("Diaphragma…", "Less stress +…") | krimpt (geverifieerd: "Recover & relax" past) |

## Emulator-beperking (belangrijk)
De Windows-emulator (qemu) crasht herhaaldelijk (access violation) zodra de app zware schermen met glas/blur tekent (Level/Routine/Times in de protocolbouwer). Dat is een fout in de host-emulatie, geen app-crash. Deze schermen en alle animaties moeten op de A16 getest worden.

## Open / nog te doen
- Profile- en systeemstrook-fix verifiëren in de nieuwe build.
- Resterende schermen en niveaus in de flow-ronde (agenda, bracelet-schermen, speler-overgangen, dagpas-verloop).

- Op de A16 testen (zie docs/CONTROLELIJST_OPERATOR.md): protocolbouwer Level/Routine/Times/Plan length en het bevestigingsmoment, pulsen/animaties, geluid, haptiek, glas.
- Nog niet gezien (emulator viel uit): agenda met een echt protocol, bracelet-schermen, speler-overgangen, dagpas-verloop.
- Ontwerp-aandachtspunt: uitgeschakelde glazen CTA toont witte tekst op donker vlak; op sommige schermen leest dat bijna als actief.
