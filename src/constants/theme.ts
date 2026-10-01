/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/* ────────────────────────────────────────────────────────────────────────────
   VIBEZCORE MERK-ANKER — bindend (zie docs/MERK_ANKER.md §2 en §1).
   Bron: webapp sign-in.html / app.vibezcore.com. Niet wijzigen zonder
   operator-goedkeuring. App-schermen gebruiken `Brand` en `BrandFonts`;
   de oudere `Colors` / `Fonts` blijven voor legacy-template-componenten.

   Operator-beslissing 2026-09-05: de app krijgt light + dark mode, light
   als default. De bestaande kleuren hierboven/hieronder blijven ONGEWIJZIGD
   en zijn nu `BrandDark` — niet opnieuw uitvinden. `BrandLight` is het
   nieuwe licht-palet. `Brand` blijft bestaan als statische alias naar
   `BrandDark` voor niet-gemigreerde schermen (module-scope StyleSheet.create
   kan geen hook aanroepen) — nieuwe/gemigreerde schermen gebruiken
   `useAppTheme()` uit `src/hooks/useAppTheme.ts` in plaats van deze
   statische import. Zie docs/MERK_ANKER.md §2 voor het volledige palet.
   ──────────────────────────────────────────────────────────────────────────── */

export const BrandDark = {
  bg: '#0a0a0a',
  accent: '#3a8fff',
  accentHover: '#2a7fee',
  success: '#4ade80',
  error: '#ef4444',
  panel: '#1e1e1e',
  border: '#2a2a2a',
  text: '#f4f4f4',
  textDim: '#8a8a8a',
} as const;

/* Operator, 26 september 2026: Bio-Teal is de ENIGE accentkleur van de
   app, overal — niet langer audio-library-scoped (dat was de vorige,
   inmiddels ingehaalde beslissing van eerder vandaag). Vervangt het
   Royal-Indigo-Light-systeem (`AccentTextOnDark`, `#6E85C4`) volledig als
   accent-tekst/labels/badges/links-rol. `BrandDark.accent` (`#3a8fff`,
   Signal Blue) blijft ernaast bestaan maar met zijn eigen, ongewijzigde
   rol: UITSLUITEND haptic-pulsen en "nu actief" in de player, nooit
   tekst/knoppen/vlakken. */
export const AudioAccent = '#00A3A3';
export const AudioAccentLight = '#4AF0D4';

/* Operator, 14 september 2026: gecorrigeerd naar de echte website-
   huisstijl (VIBEZCORE Huisstijl & Design Handboek v4.0). Het accent was
   hier nog het harde signaalblauw (`#3a8fff`) — dat kanaal is op de
   website strikt gereserveerd voor functionele signalen (haptic-pulsen,
   "nu actief" in de player), nooit voor knoppen/tekst/vlakken. De echte
   primaire accent-/CTA-kleur is Royal Indigo. */
export const BrandLight = {
  bg: '#F5F5F7',
  accent: '#1E2A4A',
  accentHover: '#353F5C',
  success: '#16a34a',
  error: '#dc2626',
  panel: '#ffffff',
  border: '#e5e5ea',
  text: '#1D1D1F',
  textDim: '#8E8E93',
} as const;

export type BrandTheme = { readonly [K in keyof typeof BrandDark]: string };
export type ThemeMode = 'light' | 'dark';

/** @deprecated Statische alias voor niet-gemigreerde schermen, gelijk aan
 *  BrandDark (ongewijzigd). Gebruik `useAppTheme()` in nieuwe/gemigreerde
 *  code. */
export const Brand = BrandDark;

export const BrandFonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   TYPE SCALE — bindend (operator, 11 september 2026: "het hele systeem
   moet consistent zijn... kakofonie" — elk scherm koos tot nu toe zijn
   eigen willekeurige groottes/gewichten voor dezelfde ROL tekst (een
   scherm-kop was hier 18px, daar 22px, ergens anders 30px; een kaart-
   detail-regel hier 12px, daar 13.5px — geen enkele reden voor het
   verschil, gewoon nooit teruggekoppeld naar één bron).

   Dit is die ene bron. Elke rol hieronder staat voor een BETEKENIS, niet
   voor een scherm — "pageHeader" is de grote kop bovenaan een los scherm
   (bv. "Set your routine" op intensity.tsx, "Choose your direction" op
   goal.tsx), ongeacht welk scherm het is. Nieuwe of aangepaste schermen
   MOETEN deze tokens gebruiken i.p.v. een eigen fontSize/fontFamily te
   verzinnen — dat is precies hoe de kakofonie ontstond.

   Nog NIET met terugwerkende kracht overal ingevoerd (dat is een grotere,
   aparte doorloop over alle ~39 schermen — zie de "page-by-page" prioriteit
   die al liep); voorlopig toegepast op goal.tsx en intensity.tsx als eerste
   twee, en bindend voor elk scherm dat vanaf nu wordt aangeraakt. */
export const TypeScale = {
  /** Grote kop bovenaan een los scherm (protocol-stappen, doel-schermen). */
  pageHeader: {
    fontFamily: BrandFonts.bold,
    fontSize: 30,
    letterSpacing: -0.5,
  },
  /** Vraag/onderschrift direct onder een pageHeader. Operator, 14
   *  september 2026 (Apple-font-framework): "Subheader" hoort Regular te
   *  zijn, niet SemiBold — het gewicht is wat 'm ondergeschikt maakt aan
   *  de kop erboven, niet enkel de kleur. */
  pageSubhead: {
    fontFamily: BrandFonts.regular,
    fontSize: 16,
  },
  /** Korte, gedempte toelichting onder een pageHeader/pageSubhead. */
  pageLead: {
    fontFamily: BrandFonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  /** Klein, gespatieerd label op een kaart/tegel — als eyebrow BOVEN een
   *  cardHeadline (bv. "ESSENTIAL" op intensity.tsx) óf als het enige
   *  tekstlabel op een kleinere tegel (bv. "SLEEP BETTER" op goal.tsx'
   *  2-koloms grid). Operator, 11 september 2026 (9e ronde): "font set
   *  your goal en set your routine cards moeten consistent zijn" — dit
   *  is DE ene bron voor beide rollen; een scherm dat zelf een
   *  letterSpacing/fontSize voor een kaartlabel verzint (zoals goal.tsx
   *  hier eerder deed, losstaand op 0.8 i.p.v. 1.4) is de fout die dit
   *  token juist voorkomt. Geldt ook voor onboarding-kaarten en elke
   *  kaart die nog gebouwd wordt — nooit een eigen label-stijl per
   *  scherm verzinnen, dit hergebruiken. */
  /* Operator, 14 september 2026 (Apple-font-framework): "Positieve
   *  spatiëring bij eyebrows" — Bold i.p.v. SemiBold. `uppercase` bewust
   *  NIET in dit gedeelde token (teruggedraaid, operator: "alles in
   *  hoofdletters") — dit token wordt her­gebruikt voor tekst die niet
   *  overal hoofdletters hoort te zijn; wie effectief caps wil, zet
   *  `textTransform: 'uppercase'` zelf op de call-site, zoals voorheen. */
  cardEyebrow: {
    fontFamily: BrandFonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.4,
  },
  /** De hoofdboodschap van een kaart — wat iemand het eerst moet lezen
   *  (bv. "1 session a day", "Wind down at the end of the day"). */
  cardHeadline: {
    fontFamily: BrandFonts.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  /** Korte, ondersteunende regel onder een cardHeadline. Operator, 14
   *  september 2026 (Apple-font-framework): 14px Medium i.p.v. 12.5px
   *  Regular — functionele kaarttekst, geen fijndruk. */
  cardDetail: {
    fontFamily: BrandFonts.medium,
    fontSize: 14,
  },
  /** Stille sectiekop midden op een scherm (geen los page-kop, wel een
   *  duidelijke breuk tussen twee blokken — bv. "Where your time went"). */
  sectionLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 12.5,
  },
  /** Operator, 11 september 2026: "alle fonts overal gelijk zetten" —
   *  de pagina-titel-rol op een TAB-scherm (Audio Library, Bracelet,
   *  Activity, Account), niet te verwarren met `pageHeader` (die is voor
   *  de protocol-stappen, altijd gecentreerd, 30px). Op de tabs stond
   *  dezelfde rol verspreid over 24/26/28/30px en `regular`/`extrabold`
   *  door elkaar, zonder enige reden voor het verschil — dit is de ene
   *  bron die dat stopt. */
  tabHeader: {
    fontFamily: BrandFonts.bold,
    fontSize: 26,
    letterSpacing: -0.3,
  },
  /* Operator, 11 september 2026 ("alle fonts overal gelijk"): de titel op
   *  een compacte, horizontale entry-kaart (bv. "Activate your bracelet"
   *  op zowel account.tsx als bracelet.tsx) — stond op 17px op de ene
   *  plek en 18px op de andere, zelfde rol, geen reden voor het verschil. */
  compactCardTitle: {
    fontFamily: BrandFonts.extrabold,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  /* Operator, 14 september 2026 (Apple-font-framework): hoofd-CTA-tekst
   *  had nog GEEN gedeeld token — elk scherm verzon 'm los (breath-setup
   *  al toevallig 16px SemiBold, andere schermen wisselend). "Nooit
   *  overdreven dik (geen Extrabold), dat oogt goedkoop." */
  ctaLabel: {
    fontFamily: BrandFonts.semibold,
    fontSize: 16,
  },
  /* Operator, 14 september 2026 (Apple-font-framework): subtiele
   *  secundaire link/actie (bv. "How it works →", "Skip") — ook deze had
   *  nog geen gedeelde bron. */
  microLink: {
    fontFamily: BrandFonts.medium,
    fontSize: 14,
  },
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   AppTypeScale — operator, 11 september 2026: exacte schaal, letterlijk
   aangeleverd, BINDEND vanaf nu. Dit vervangt niet `TypeScale` hierboven
   (die dekt de protocol-stappen/kaart-tegels en blijft in gebruik daar),
   dit is de losse, exacte schaal voor de rest van de app — wordt PAGINA
   PER PAGINA toegepast, te beginnen zodra de operator aangeeft welke.

   Zes rollen, exacte pixelwaarden — niet afronden, niet "in de buurt":
   ──────────────────────────────────────────────────────────────────────────── */
export const AppTypeScale = {
  /** Bovenaan de pagina (bv. "Activity", "Library"). 34px Bold, -0.5px. */
  appHeaderLarge: {
    fontFamily: BrandFonts.bold,
    fontSize: 34,
    letterSpacing: -0.5,
  },
  /** Als de pagina omhoog scrollt en de titel klein wordt. 20px SemiBold. */
  appHeaderInline: {
    fontFamily: BrandFonts.semibold,
    fontSize: 20,
  },
  /** Titel binnen een kaart/bento-box (bv. "Minutes per state"). 18px SemiBold. */
  cardHeader: {
    fontFamily: BrandFonts.semibold,
    fontSize: 18,
  },
  /** Extra info op de kaart (bv. "Last 7 days"). 14px Medium, +0.2px. */
  cardSubheader: {
    fontFamily: BrandFonts.medium,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  /** Langere tekstvlakken, uitleg van een sessie/statistiek. 15px Regular. */
  cardBody: {
    fontFamily: BrandFonts.regular,
    fontSize: 15,
  },
  /** Labels/cijfers in een grafiek (bv. M/T/W, datalabels). 12px Medium, +0.5px. */
  chartLabel: {
    fontFamily: BrandFonts.medium,
    fontSize: 12,
    letterSpacing: 0.5,
  },
} as const;

/* Operator, 11 september 2026: "ook de cta's, cardhoogtes... alles
   consistent" — vervolg op TypeScale hierboven. Twee dingen die tot nu toe
   per scherm apart werden verzonnen, ook al bedoelen ze hetzelfde:

   1) De primaire CTA-knop-chrome (witte pil, dunne rand, donkere tekst,
      pijl-icoon) — bestond al als losse stijl-blob op intensity.tsx, hier
      als bron zodat elk scherm hem letterlijk overneemt i.p.v. namaakt.
   2) Een vaste kaarthoogte voor deze "kies één/twee uit een fotokaart"-
      stap-schermen (protocol: goal.tsx, intensity.tsx) — was 168 op de
      ene, 140 op de andere zonder inhoudelijke reden voor het verschil. */
export const CardHeights = {
  /** Fotokaart met eyebrow + headline (+ evt. detail), protocol-stappen. */
  photoCard: 160,
} as const;

export const CTA = {
  container: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#D2D2D7',
  },
  disabled: { opacity: 0.35 },
  label: {
    fontFamily: BrandFonts.semibold,
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#1D1D1F',
  },
  iconColor: '#1D1D1F',
} as const;
