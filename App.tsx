import React, { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { ShareIntentProvider, ShareIntentModule, getScheme, getShareExtensionKey } from 'expo-share-intent';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts as useFredokaFonts,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
} from '@expo-google-fonts/fredoka';
import {
  useFonts as usePlusJakartaFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/lib/auth';
import { RootStackParamList } from './src/navigation/types';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Handles `ulamhub://recipe/<id>` (a real standalone build), Expo Go's own
// dev-time scheme (Linking.createURL abstracts the difference away), and —
// on Android — someone sharing a link to UlamHub from another app (the OS
// routes that through expo-share-intent's own fake "shareintent" URL, which
// getInitialURL/subscribe below redirect to the ShareIntent bridge screen).
// Only screens reachable via a shared link/URL need an entry here.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'ulamhub://'],
  config: {
    screens: {
      SharedRecipe: 'recipe/:rowId',
      KitchenJoin: 'kitchen/join',
      ShareIntent: 'shareintent',
    },
  },
  subscribe(listener) {
    const onReceiveURL = ({ url }: { url: string }) => listener(url);
    const stateSub = ShareIntentModule?.addListener('onStateChange', (event) => {
      if (event.value === 'pending') listener(`${getScheme()}://shareintent`);
    });
    const urlSub = Linking.addEventListener('url', onReceiveURL);
    return () => {
      stateSub?.remove();
      urlSub.remove();
    };
  },
  async getInitialURL() {
    if (ShareIntentModule?.hasShareIntent(getShareExtensionKey())) {
      return `${Constants.expoConfig?.scheme}://shareintent`;
    }
    return (await Linking.getLinkingURL()) ?? null;
  },
};

export default function App() {
  const [fredokaLoaded, fredokaError] = useFredokaFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
  });
  const [jakartaLoaded, jakartaError] = usePlusJakartaFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const ready = (fredokaLoaded || !!fredokaError) && (jakartaLoaded || !!jakartaError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const onLayoutRootView = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ShareIntentProvider>
      <SafeAreaProvider onLayout={onLayoutRootView}>
        <AuthProvider>
          <NavigationContainer linking={linking}>
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}
