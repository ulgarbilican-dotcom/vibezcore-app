/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — terug = hetzelfde als de terugpijl (audit 16 okt 2026).

   Sommige schermen hebben een eigen terugpijl die NIET gewoon één scherm
   terug gaat (bv. vanuit de Breathwork-onboarding meteen terug naar stap 5).
   iOS-terugvegen en Android-terug deden toch een gewone stap terug — twee
   verschillende uitkomsten voor hetzelfde gebaar. Deze hook laat vegen en
   terugknop dezelfde weg nemen als de pijl. Andere manieren om het scherm
   te verlaten (de flow afronden, alles sluiten) gaan gewoon door.
   ───────────────────────────────────────────────────────────────────────── */

import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';

type NavAction = { type: string };

export function useBackTo(active: boolean, go: () => void): void {
  const navigation = useNavigation();
  const [release, setRelease] = useState<{ back: boolean; action: NavAction } | null>(null);
  const goRef = useRef(go);
  goRef.current = go;
  usePreventRemove(active && release === null, ({ data }) => {
    const t = data.action.type;
    setRelease({ back: t === 'GO_BACK' || t === 'POP', action: data.action });
  });
  useEffect(() => {
    if (!release) return;
    if (release.back) goRef.current();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else navigation.dispatch(release.action as any);
  }, [release, navigation]);
}
