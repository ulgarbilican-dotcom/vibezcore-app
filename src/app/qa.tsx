/* QA-route (docs/KWALITEITSPROTOCOL.md): vibezcoreapp://qa?tier=free|premium|clear — alleen in een testbuild (zie utils/qa.ts). */
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { QA_ENABLED } from '@/utils/qa';
import { setDevUserOverride, type DevUserOverride } from '@/utils/dev-user-override';

const MAP: Record<string, DevUserOverride> = { free: 'guest', guest: 'guest', premium: 'pro', pro: 'pro', clear: null };

export default function QaScreen() {
  const { tier } = useLocalSearchParams<{ tier?: string }>();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!QA_ENABLED) return;
    const v = tier && tier in MAP ? MAP[tier] : null;
    void setDevUserOverride(v).then(() => setDone(true));
  }, [tier]);
  if (!QA_ENABLED || done) return <Redirect href="/" />;
  return null;
}
