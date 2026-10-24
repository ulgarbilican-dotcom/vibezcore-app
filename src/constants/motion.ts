/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — bewegingstaal (23 okt 2026, operator: "full optimalisatie van de animatie", Apple-stijl).

   Eén plek voor de veer-instellingen, zodat elke knop, kaart en overgang hetzelfde aanvoelt:
   - fysica i.p.v. tijd: veren (massa/stijfheid/demping), geen lineaire of ease-in-out-curves;
   - onderbreekbaar: een veer die al loopt neemt de nieuwe doelwaarde over, zonder te wachten;
   - alles op de UI-thread (Reanimated), vloeiend ook als JS druk is.
   ───────────────────────────────────────────────────────────────────────── */

/** Indrukken: strak en direct (hoge stijfheid, licht gewicht), nauwelijks overshoot. */
export const SPRING_PRESS_IN = { stiffness: 560, damping: 36, mass: 0.6 } as const;

/** Loslaten: een minieme overshoot en dan rust — de typische iOS-veer. */
export const SPRING_PRESS_OUT = { duration: 300, dampingRatio: 0.85 } as const;

/** Een gekozen element "popt": kort groter en dan terug, met een voelbare nasprong. */
export const SPRING_POP = { stiffness: 380, damping: 26, mass: 0.7 } as const; /* dempingsratio ≈ 0,8: hooguit één nauwelijks zichtbare nasprong (Apple-licht) */

/** Elementen die op hun plek veren (kaarten, balken, blaadjes): zacht met een kleine nasprong. */
export const SPRING_SETTLE = { stiffness: 220, damping: 22, mass: 0.9 } as const;

/** Grote verplaatsingen (sheets, overlays): rustiger, geen zichtbare nasprong. */
export const SPRING_SHEET = { stiffness: 260, damping: 30, mass: 1 } as const;

/* ── Beweging beperken (iOS "Verminder beweging" / Android "Animaties verwijderen") ──────────────────
   Reanimated respecteert dit zelf; de RN-`Animated`-animaties (sheets, tabbalk) niet — die vragen het hier. */
import { AccessibilityInfo } from 'react-native';

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduceMotion = v;
  })
  .catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
  reduceMotion = v;
});

export function isReduceMotion(): boolean {
  return reduceMotion;
}

/* Popups en alerts: de kaart komt met een veer in beeld (kort groter en dan op zijn plek), de achtergrond
   dooft zacht in. Overal dezelfde. */
import { ZoomIn } from 'react-native-reanimated';
export const POPUP_IN = ZoomIn.springify().damping(26).stiffness(240).withInitialValues({ transform: [{ scale: 0.9 }], opacity: 0 });
