/* Ontwikkel-/prototype-schermen horen niet in een winkelbuild (24 okt 2026, docs/KWALITEITSPROTOCOL.md): buiten __DEV__ stuurt
   dit ze door naar het beginscherm, ook als iemand de route via een link opent. */
import { Redirect } from 'expo-router';
import type { ComponentType } from 'react';

export function devOnly<P extends object>(Screen: ComponentType<P>): ComponentType<P> {
  return function DevOnly(props: P) {
    if (!__DEV__) return <Redirect href="/" />;
    return <Screen {...props} />;
  };
}
