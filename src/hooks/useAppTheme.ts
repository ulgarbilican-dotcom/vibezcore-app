/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — App-brede theme-hook (light/dark)

   Operator-beslissing 2026-09-05: de app krijgt light + dark mode.
   Operator-omkering 26 september 2026: dark is de default, niet light.
   Volgt hetzelfde patroon als de rest van `utils/settings.ts`
   (module-state + listener-set, synchrone getter) — themeMode is gewoon
   een setting, gepersisteerd via dezelfde AsyncStorage-key (vzs_v1).

   Gebruik in een component:
     const { theme, mode, preference, setMode } = useAppTheme();
     <View style={{ backgroundColor: theme.bg }}>
   `mode` is altijd 'light'/'dark' (effectief, na 'system' opgelost) —
   gebruik dat om kleuren te kiezen. `preference` is de opgeslagen
   voorkeur inclusief 'system', voor de 3-weg toggle in Settings.

   `theme` is een `BrandLight`/`BrandDark`-object — zelfde vorm/keys als de
   oude statische `Brand`, dus een gemigreerd scherm vervangt simpelweg
   `Brand.xxx` door `theme.xxx`. Kan NIET gebruikt worden op module-scope
   (bv. binnen `StyleSheet.create` buiten de component) — daar blijft de
   statische `Brand`-alias (= BrandDark, ongewijzigd) nodig; zie
   `src/constants/theme.ts`.
   ─────────────────────────────────────────────────────────────────────── */

import { BrandDark, BrandLight, type BrandTheme } from '@/constants/theme';
import { useSetting } from '@/utils/settings';
import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';

/** 'system' erbij (6 september 2026) — volgt de telefoon se eigen
 *  instelling, naast de twee expliciete standen. Dit type is de
 *  OPGESLAGEN voorkeur; `resolveMode()`/`theme` hieronder lossen 'system'
 *  op naar het effectieve licht/donker op basis van de OS-instelling. */
export type ThemeModePref = 'light' | 'dark' | 'system';

function resolveMode(pref: ThemeModePref): 'light' | 'dark' {
  if (pref === 'system') return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  return pref;
}

export function resolveTheme(pref: ThemeModePref): BrandTheme {
  return resolveMode(pref) === 'dark' ? BrandDark : BrandLight;
}

export function useAppTheme(): {
  /** De OPGESLAGEN voorkeur ('light' | 'dark' | 'system') — gebruik dit
   *  voor de Settings-toggle (welke van de 3 opties is aangevinkt). */
  preference: ThemeModePref;
  /** De EFFECTIEVE stand ('light' | 'dark', nooit 'system') — gebruik dit
   *  om daadwerkelijk kleuren te kiezen. */
  mode: 'light' | 'dark';
  theme: BrandTheme;
  setMode: (pref: ThemeModePref) => void;
  toggleMode: () => void;
} {
  const [preference, setPreference] = useSetting('themeMode');
  /* Alleen relevant wanneer preference === 'system': luistert naar OS-
     wijzigingen (iemand die tijdens gebruik van licht naar donker schakelt
     in de telefoon-instellingen) zodat het thema live meeschakelt zonder
     dat de gebruiker de app hoeft te herstarten. */
  const [systemScheme, setSystemScheme] = useState(() => Appearance.getColorScheme());
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);
  const mode: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const theme = mode === 'dark' ? BrandDark : BrandLight;
  const toggleMode = () => setPreference(mode === 'dark' ? 'light' : 'dark');
  return { preference, mode, theme, setMode: setPreference, toggleMode };
}
