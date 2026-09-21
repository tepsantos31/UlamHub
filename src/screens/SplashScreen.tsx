import React, { useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/theme';
import { getOnboarding } from '../storage/onboarding';
import { useAuth } from '../lib/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  // Wait for any persisted session to be restored, and for the initial cloud
  // sync it triggers to finish, before deciding where to route — otherwise
  // we'd read local onboarding state before a freshly-pulled remote copy lands.
  const { loading, syncing } = useAuth();

  useEffect(() => {
    if (loading || syncing) return;
    const t = setTimeout(async () => {
      const onboarding = await getOnboarding();
      if (onboarding.complete) {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'OnboardingCarousel' }] });
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [navigation, loading, syncing]);

  return (
    <LinearGradient colors={[colors.mint, colors.screenBg]} style={styles.wrap}>
      <View style={styles.logo}>
        <Image source={require('../../assets/logo-mark.png')} style={styles.logoImage} resizeMode="contain" />
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.title}>Ulam</Text>
        <Text style={styles.subtitle}>What's for dinner tonight?</Text>
      </View>
      <ActivityIndicator color={colors.tealDark} style={{ marginTop: 8 }} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26 },
  logo: {
    width: 108,
    height: 108,
    borderRadius: 30,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28968C',
    shadowOpacity: 0.3,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  logoImage: {
    width: 78,
    height: 78,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 38,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.sage,
    marginTop: 4,
    fontFamily: fonts.bodySemiBold,
  },
});
