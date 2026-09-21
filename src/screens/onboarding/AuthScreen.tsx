import React, { useState } from 'react';
import { View, Text, Image, TextInput, Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme/theme';
import { PillButton } from '../../components/PillButton';
import { Screen } from '../../components/Screen';
import { supabaseConfigured } from '../../lib/supabase';
import { signInWithPassword, signUpWithPassword, signInWithMagicLink } from '../../lib/auth';
import { runInitialSync } from '../../lib/initialSync';
import { getOnboarding } from '../../storage/onboarding';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingAuth'>;

type Mode = 'signin' | 'signup';

export function AuthScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'password' | 'magic' | null>(null);

  // If Supabase isn't configured yet, fall back to the old "just move on"
  // behavior rather than blocking onboarding on a setup step the user hasn't
  // done yet — see mobile/.env.example.
  const proceedLocally = () => navigation.navigate('OnboardingQuiz');

  const afterSignedIn = async () => {
    await runInitialSync().catch(() => {});
    const onboarding = await getOnboarding();
    if (onboarding.complete) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } else {
      navigation.navigate('OnboardingQuiz');
    }
  };

  const submitPassword = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Enter both an email and a password.');
      return;
    }
    setLoading('password');
    try {
      if (mode === 'signup') {
        const { needsEmailConfirmation } = await signUpWithPassword(email.trim(), password);
        if (needsEmailConfirmation) {
          Alert.alert(
            'Check your email',
            `We sent a confirmation link to ${email.trim()}. Confirm it, then come back and sign in.`,
            [{ text: 'OK', onPress: () => setMode('signin') }],
          );
        } else {
          // Confirmation is off on this project — already signed in.
          navigation.navigate('OnboardingQuiz');
        }
      } else {
        await signInWithPassword(email.trim(), password);
        await afterSignedIn();
      }
    } catch (e: any) {
      Alert.alert(mode === 'signup' ? 'Sign up failed' : 'Sign in failed', e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(null);
    }
  };

  const submitMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert('Missing info', 'Enter your email first.');
      return;
    }
    setLoading('magic');
    try {
      await signInWithMagicLink(email.trim());
      Alert.alert('Check your email', `We sent a sign-in link to ${email.trim()}. Open it on this device to continue.`);
    } catch (e: any) {
      Alert.alert('Could not send link', e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Screen scroll={false} withTabBarSpace={false} contentContainerStyle={{ paddingTop: 96 }}>
      <View style={styles.logo}>
        <Image source={require('../../../assets/logo-mark.png')} style={styles.logoImage} resizeMode="contain" />
      </View>
      <Text style={styles.title}>Welcome to your kitchen</Text>
      <Text style={styles.body}>Save recipes, plan your week, and cook every dish with confidence.</Text>

      {!supabaseConfigured ? (
        <>
          <View style={{ flex: 1 }} />
          <Text style={styles.notConfigured}>
            Cloud accounts aren't set up yet on this build — continuing without one for now.
          </Text>
          <PillButton label="Continue" onPress={proceedLocally} style={{ marginTop: 12 }} />
        </>
      ) : (
        <>
          <View style={styles.modeSwitch}>
            <Text
              onPress={() => setMode('signin')}
              style={[styles.modeTab, mode === 'signin' && styles.modeTabActive]}
            >
              Sign in
            </Text>
            <Text
              onPress={() => setMode('signup')}
              style={[styles.modeTab, mode === 'signup' && styles.modeTabActive]}
            >
              Create account
            </Text>
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.tertiaryText}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.tertiaryText}
            secureTextEntry
            style={[styles.input, { marginTop: 10 }]}
          />

          <View style={{ flex: 1 }} />
          <View style={{ gap: 12 }}>
            <PillButton
              label={mode === 'signup' ? 'Create account' : 'Sign in'}
              onPress={submitPassword}
              loading={loading === 'password'}
              disabled={loading !== null}
            />
            <PillButton
              label="Email me a sign-in link instead"
              onPress={submitMagicLink}
              variant="ghost"
              loading={loading === 'magic'}
              disabled={loading !== null}
            />
          </View>
        </>
      )}

      <Text style={styles.legal}>By continuing you agree to our Terms & Privacy Policy.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
    shadowColor: '#28968C',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  logoImage: { width: 50, height: 50 },
  title: { fontFamily: fonts.heading, fontSize: 31, color: colors.ink, letterSpacing: -0.4 },
  body: { fontSize: 15, color: colors.sageMuted, marginTop: 8, lineHeight: 22 },
  notConfigured: { fontSize: 13.5, color: colors.sageMuted, textAlign: 'center', lineHeight: 20 },
  modeSwitch: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 14, padding: 4, marginTop: 28 },
  modeTab: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.sage,
    overflow: 'hidden',
  },
  modeTabActive: { backgroundColor: colors.deepGreen, color: colors.mint },
  input: {
    height: 52,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    marginTop: 16,
  },
  legal: { textAlign: 'center', fontSize: 12, color: colors.tertiaryText, marginTop: 20, lineHeight: 18 },
});
