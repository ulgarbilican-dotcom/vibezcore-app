/* TESTBUILD-ONLY: /test-tier?tier=free|day|monthly|yearly|off forceert een toegangsniveau.
   In een store-build (zonder EXPO_PUBLIC_VZ_TEST=1) stuurt dit scherm meteen terug. */
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { setTestTier } from '@/hooks/useSubscription';

export default function TestTierScreen() {
  const { tier } = useLocalSearchParams<{ tier?: string }>();
  const enabled = process.env.EXPO_PUBLIC_VZ_TEST === '1';
  useEffect(() => {
    if (enabled && (tier === 'free' || tier === 'day' || tier === 'monthly' || tier === 'yearly' || tier === 'off')) setTestTier(tier);
  }, [enabled, tier]);
  return <Redirect href="/" />;
}
