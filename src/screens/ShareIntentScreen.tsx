import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useShareIntentContext } from 'expo-share-intent';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ShareIntent'>;

// The native module resolves what was actually shared asynchronously — on
// the very first render `hasShareIntent` is still false even though a real
// share is on its way in. A safety timeout keeps this from ever hanging if
// the payload never arrives for some reason.
const WAIT_TIMEOUT_MS = 4000;

/** Not a real screen — a redirect target the OS lands on when someone shares
 * a link to UlamHub from another app (Instagram, TikTok, YouTube, a browser).
 * Waits for the native module to hand over what was shared, then hands off
 * into the normal "Import from link" flow so it goes through the same
 * extraction + review step as a manually pasted link. */
export function ShareIntentScreen({ navigation }: Props) {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current || !hasShareIntent) return;
    handledRef.current = true;
    const url = shareIntent.webUrl ?? shareIntent.text?.match(/https?:\/\/\S+/)?.[0];
    resetShareIntent();
    navigation.replace('AddRecipe', url ? { sharedUrl: url } : undefined);
  }, [hasShareIntent, shareIntent]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (handledRef.current) return;
      handledRef.current = true;
      navigation.replace('AddRecipe');
    }, WAIT_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screenBg }}>
      <ActivityIndicator color={colors.tealDark} />
    </View>
  );
}
