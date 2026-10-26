/* QA-route (docs/KWALITEITSPROTOCOL.md): vibezcoreapp://qa?tier=free|premium|clear — alleen in een testbuild (zie utils/qa.ts). */
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { qaResetGate } from '@/utils/onboarding-gate';
import { useEffect, useState } from 'react';
import { QA_ENABLED } from '@/utils/qa';
import { setDevUserOverride, type DevUserOverride } from '@/utils/dev-user-override';
import { ensureSettingsLoaded, setSetting } from '@/utils/settings';
import { resetRestingPulse } from '@/services/resting-pulse';

/* premium = gewone abonnee (audio-override, geen armband); bundle = armband + audio (pro-override). */
const MAP: Record<string, DevUserOverride> = { free: 'guest', guest: 'guest', premium: 'audio', audio: 'audio', bundle: 'pro', pro: 'pro', clear: null };

export default function QaScreen() {
  const { tier, fresh, stay, intro, did } = useLocalSearchParams<{ tier?: string; fresh?: string; stay?: string; intro?: string; did?: string }>();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!QA_ENABLED) return;
    const v = tier && tier in MAP ? MAP[tier] : null;
    void (async () => {
      /* fresh=1: alleen de eerste-gebruik-vlaggen terug (onboarding State Control + Breath, rusthartslag) zodat een flow écht bij het
         begin kan starten; favorieten, geschiedenis en plan blijven onaangeroerd. */
      if (fresh === '1') {
        await ensureSettingsLoaded();      // eerst laden, anders overschrijft het laden onze reset
        await setSetting('stateOnboardingCompletedAt', null);
        await setSetting('breathOnboardingCompletedAt', null);
        await setSetting('stateFreeSessionUsedAt', null);   // nieuwe gebruiker = ook de gratis sessies nog niet gebruikt
        await setSetting('breathFreeSessionUsedAt', null);
        await setSetting('stateOnboardingDeferredCount', 0);
        await setSetting('breathOnboardingDeferredCount', 0);
        resetRestingPulse();
        /* De algemene uitleg blijft 'gezien' (zodat flows op het welkomstscherm starten); intro=1 zet hem terug. */
        await setSetting('appIntroSeenAt', intro === '1' ? null : Date.now());
      }
      /* did=1: doet alsof er al een gratis sessie is afgerond (voor de zachte accountuitnodiging op Activity). */
      if (did === '1') await setSetting('stateFreeSessionUsedAt', Date.now());
      await setDevUserOverride(v);
      if (fresh === '1') qaResetGate();
      if (stay === '1') {
        /* stay=1: terug naar waar de gebruiker was (geen redirect naar het hoofdtabblad); de poort nog eens terugzetten voor het geval de navigatie een uitstel telde. */
        if (router.canGoBack()) router.back();
        setTimeout(qaResetGate, 900);
        return;
      }
      setDone(true);
    })();
  }, [tier, fresh]);
  if (!QA_ENABLED || done) return <Redirect href="/" />;
  return null;
}
