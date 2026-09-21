import React, { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
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

// Handles both `ulam://recipe/<id>` (a real standalone build) and Expo Go's
// own dev-time scheme (Linking.createURL abstracts the difference away) —
// only screens reachable via a shared link need an entry here.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'ulam://'],
  config: {
    screens: {
      SharedRecipe: 'recipe/:rowId',
    },
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
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <AuthProvider>
        <NavigationContainer linking={linking}>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
