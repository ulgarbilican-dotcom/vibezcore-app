/* KeyboardAwareScrollView met een afgevlakte contentContainerStyle (22 okt 2026).

   Waarom: op Android (enableOnAndroid) leest de bibliotheek `contentContainerStyle.paddingBottom`
   rechtstreeks uit het prop en overschrijft die met 0 + keyboardSpace. Bij een ARRAY-stijl
   (`[s.scroll, { paddingBottom }]`) is die waarde undefined, dus verdween de ondermarge op elk
   scherm dat dit gebruikte (Profile, Subscribe, wachtwoordschermen): de laatste rijen en
   voorwaarden stonden onder de tabbalk of tegen de rand. Een vlak object lost dat op. */
import { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

type Props = React.ComponentProps<typeof KeyboardAwareScrollView>;

const KeyboardAwareScroll = forwardRef<any, Props>(function KeyboardAwareScroll(props, ref) {
  const flat = props.contentContainerStyle ? StyleSheet.flatten(props.contentContainerStyle) : undefined;
  return <KeyboardAwareScrollView {...props} ref={ref} contentContainerStyle={flat} />;
});

export default KeyboardAwareScroll;
