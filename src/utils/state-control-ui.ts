/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — gedeelde UI-staat van de State Control-tab.

   Operator, 5 okt 2026 ("na minimaliseren en teruggaan naar de actieve
   sessie zie ik soms het tabblad onderaan, dat mag niet"): de actieve
   sessie is een volledig scherm, zoals Now Playing bij Apple — geen
   tabbalk. Het sessiescherm meldt hier dat het zichtbaar is; de tab-
   indeling ((tabs)/_layout.tsx) verbergt dan de balk voor deze tab.
   ───────────────────────────────────────────────────────────────────────── */

import { router } from 'expo-router';

/** De ENIGE manier om State Control van elders te openen (pill, melding,
 *  plan, bracelet-pagina, audio-bibliotheek): de tab zelf, zonder intro,
 *  met eventuele parameters (mode/duration/plan/breathwork/from). Vervangt
 *  het oude losse /bracelet-control-scherm met zijn afwijkende opmaak. */
export function openStateControl(params: Record<string, string | number> = {}): void {
  const p: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) p[k] = String(v);
  /* dismissTo i.p.v. navigate (audit 5 okt 2026): vanuit een scherm BOVEN
     de tabbladen (plan, protocol, bracelet-pagina) zette navigate een
     TWEEDE set tabbladen op de stapel — terugknop-lussen en "verdwaalde"
     schermen. dismissTo keert terug naar de bestaande tabbladen en kiest
     daar State Control. */
  goToTab({ pathname: '/bracelet', params: { ...p, open: String(Date.now()) } });
}

/** Naar een tabblad, van waar ook. Operator, 6 okt 2026 ("tikken op de
 *  geminimaliseerde pill werkt niet meer — gisteren nog wel"): dismissTo
 *  deed NIETS wanneer de tabbladen zelf bovenaan liggen (pill, Activity,
 *  sessie-laag) — er valt dan niets te sluiten. Daar gewoon van tab
 *  wisselen; dismissTo enkel vanaf een scherm BOVEN de tabbladen (anders
 *  komt er een tweede set tabbladen op de stapel). */
export function goToTab(href: string | { pathname: string; params?: Record<string, string> }): void {
  if (tabsOnTop) router.navigate(href as never);
  else router.dismissTo(href as never);
}

/* Liggen de tabbladen bovenaan (geen plan/protocol/… erboven)? Gezet door
   (tabs)/_layout.tsx via de focus van de tab-groep. */
let tabsOnTop = false;

export function setTabsOnTop(onTop: boolean): void {
  tabsOnTop = onTop;
}

type Listener = (visible: boolean) => void;

let activeSessionVisible = false;
const listeners = new Set<Listener>();

export function setActiveSessionVisible(visible: boolean): void {
  if (activeSessionVisible === visible) return;
  activeSessionVisible = visible;
  listeners.forEach((l) => l(visible));
}

export function isActiveSessionVisible(): boolean {
  return activeSessionVisible;
}

export function subscribeActiveSessionVisible(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* Het keuzescherm (Session Control) staat in beeld (operator, 6 okt 2026:
   "bij breathwork zijn de tabs onderaan weg, bij session control niet —
   meer ademruimte"): ook dan geen tabbalk, zoals de breathwork-setup. */
let chooseVisible = false;
const chooseListeners = new Set<Listener>();

export function setChooseScreenVisible(visible: boolean): void {
  if (chooseVisible === visible) return;
  chooseVisible = visible;
  chooseListeners.forEach((l) => l(visible));
}

export function isChooseScreenVisible(): boolean {
  return chooseVisible;
}

export function subscribeChooseScreenVisible(listener: Listener): () => void {
  chooseListeners.add(listener);
  return () => {
    chooseListeners.delete(listener);
  };
}

/* Het State Control-intro staat in beeld (5 okt 2026, audit): dan moet de
   sessie-pill zichtbaar zijn als er een sessie loopt — het intro zelf toont
   die sessie nergens. */
let introVisible = false;
const introListeners = new Set<Listener>();

export function setStateControlIntroVisible(visible: boolean): void {
  if (introVisible === visible) return;
  introVisible = visible;
  introListeners.forEach((l) => l(visible));
}

export function isStateControlIntroVisible(): boolean {
  return introVisible;
}

export function subscribeStateControlIntroVisible(listener: Listener): () => void {
  introListeners.add(listener);
  return () => {
    introListeners.delete(listener);
  };
}
