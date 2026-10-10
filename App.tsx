import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, LinkingOptions, useNavigationContainerRef } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
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
import { getSettings } from './src/storage/settings';
// Side-effect import — initializes i18next before anything tries to render
// translated text. getSettings() (called from AuthProvider's first render
// path, among others) switches the active language once the saved/detected
// one is known; until then this sets English as the starting point.
import './src/lib/i18n';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Handles `ulamhub://recipe/<id>` (a real standalone build) and Expo Go's
// own dev-time scheme (Linking.createURL abstracts the difference away).
// Someone sharing a link to UlamHub from another app is handled separately —
// see ShareIntentWatcher below — since expo-share-intent's native "is a share
// pending" signal (ShareIntentModule.hasShareIntent/onStateChange) is Android
// only; its own useShareIntentContext() hook is what actually works on both
// platforms, decoding the share via expo-linking's URL regardless of this
// `linking` config, so ShareIntent doesn't need an entry in `screens` here.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'ulamhub://'],
  config: {
    screens: {
      SharedRecipe: 'recipe/:rowId',
      KitchenJoin: 'kitchen/join',
    },
  },
};

// Navigates to the ShareIntent bridge screen the moment expo-share-intent's
// own hook reports a share is ready — this is what makes sharing work at all
// on iOS (see comment above), and doubles as Android's trigger too now,
// replacing the old onStateChange-based linking hack.
function ShareIntentWatcher({
  navigationRef,
  navReady,
}: {
  navigationRef: ReturnType<typeof useNavigationContainerRef<RootStackParamList>>;
  // The ref is non-null as soon as NavigationContainer mounts, but it isn't
  // actually ready to navigate until a moment after that — calling
  // navigate() before then throws "The 'navigation' object hasn't been
  // initialized yet". On a cold launch opened directly via a share,
  // hasShareIntent can flip true before that happens, so this effect must
  // wait on both conditions, not just the ref being non-null.
  navReady: boolean;
}) {
  const { hasShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (hasShareIntent && navReady) navigationRef.current?.navigate('ShareIntent');
  }, [hasShareIntent, navReady, navigationRef]);
  return null;
}

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

  // Applies the saved (or device-detected, on first launch) language before
  // the user reaches any real screen — getSettings() itself is what calls
  // i18n.changeLanguage(). Individual screens also call getSettings() for
  // their own data, which keeps this in sync if it's ever changed mid-session
  // (e.g. from Profile), not just once at startup.
  useEffect(() => {
    getSettings().catch(() => {});
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const onLayoutRootView = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [navReady, setNavReady] = useState(false);

  if (!ready) return null;

  return (
    <ShareIntentProvider>
      <ShareIntentWatcher navigationRef={navigationRef} navReady={navReady} />
      <SafeAreaProvider onLayout={onLayoutRootView}>
        <AuthProvider>
          <NavigationContainer ref={navigationRef} linking={linking} onReady={() => setNavReady(true)}>
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}
