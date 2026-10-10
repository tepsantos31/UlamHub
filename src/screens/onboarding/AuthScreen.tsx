import React, { useEffect, useState } from 'react';
import { View, Text, Image, TextInput, Pressable, Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as AppleAuthentication from 'expo-apple-authentication';
import { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme/theme';
import { PillButton } from '../../components/PillButton';
import { Screen } from '../../components/Screen';
import { EyeIcon, EyeOffIcon, GoogleIcon } from '../../components/Icon';
import { supabaseConfigured } from '../../lib/supabase';
import { signInWithPassword, signUpWithPassword, signInWithMagicLink, signInWithGoogle, signInWithApple } from '../../lib/auth';
import { runInitialSync } from '../../lib/initialSync';
import { getOnboarding } from '../../storage/onboarding';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingAuth'>;

type Mode = 'signin' | 'signup';

export function AuthScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<'password' | 'magic' | 'google' | 'apple' | null>(null);
  // expo-apple-authentication resolves this false on Android and on iOS
  // devices without an Apple ID signed in — never assume it's available.
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

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
      Alert.alert(t('auth.missingInfoTitle'), t('auth.missingInfoBoth'));
      return;
    }
    setLoading('password');
    try {
      if (mode === 'signup') {
        const { needsEmailConfirmation } = await signUpWithPassword(email.trim(), password);
        if (needsEmailConfirmation) {
          Alert.alert(
            t('auth.checkEmailTitle'),
            t('auth.checkEmailConfirmBody', { email: email.trim() }),
            [{ text: t('common.ok'), onPress: () => setMode('signin') }],
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
      Alert.alert(mode === 'signup' ? t('auth.signUpFailed') : t('auth.signInFailed'), e?.message ?? t('common.error'));
    } finally {
      setLoading(null);
    }
  };

  const submitMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert(t('auth.missingInfoTitle'), t('auth.missingInfoEmail'));
      return;
    }
    setLoading('magic');
    try {
      await signInWithMagicLink(email.trim());
      Alert.alert(t('auth.checkEmailTitle'), t('auth.checkEmailLinkBody', { email: email.trim() }));
    } catch (e: any) {
      Alert.alert(t('auth.linkFailedTitle'), e?.message ?? t('common.error'));
    } finally {
      setLoading(null);
    }
  };

  const submitGoogle = async () => {
    setLoading('google');
    try {
      await signInWithGoogle(mode === 'signup');
      await afterSignedIn();
    } catch (e: any) {
      Alert.alert(t('auth.googleFailedTitle'), e?.message ?? t('common.error'));
    } finally {
      setLoading(null);
    }
  };

  const submitApple = async () => {
    setLoading('apple');
    try {
      await signInWithApple(mode === 'signup');
      await afterSignedIn();
    } catch (e: any) {
      Alert.alert(t('auth.appleFailedTitle'), e?.message ?? t('common.error'));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Screen scroll={false} withTabBarSpace={false} contentContainerStyle={{ paddingTop: 96 }}>
      <View style={styles.logo}>
        <Image source={require('../../../assets/logo-mark.png')} style={styles.logoImage} resizeMode="contain" />
      </View>
      <Text style={styles.title}>{t('auth.welcomeTitle')}</Text>
      <Text style={styles.body}>{t('auth.welcomeBody')}</Text>

      {!supabaseConfigured ? (
        <>
          <View style={{ flex: 1 }} />
          <Text style={styles.notConfigured}>
            {t('auth.notConfigured')}
          </Text>
          <PillButton label={t('auth.continue')} onPress={proceedLocally} style={{ marginTop: 12 }} />
        </>
      ) : (
        <>
          <View style={styles.modeSwitch}>
            <Text
              onPress={() => setMode('signin')}
              style={[styles.modeTab, mode === 'signin' && styles.modeTabActive]}
            >
              {t('auth.signIn')}
            </Text>
            <Text
              onPress={() => setMode('signup')}
              style={[styles.modeTab, mode === 'signup' && styles.modeTabActive]}
            >
              {t('auth.createAccount')}
            </Text>
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email')}
            placeholderTextColor={colors.tertiaryText}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
          <View style={[styles.passwordRow, { marginTop: 10 }]}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.password')}
              placeholderTextColor={colors.tertiaryText}
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10} style={styles.eyeBtn}>
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </Pressable>
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ gap: 12 }}>
            <PillButton
              label={mode === 'signup' ? t('auth.createAccount') : t('auth.signIn')}
              onPress={submitPassword}
              loading={loading === 'password'}
              disabled={loading !== null}
            />
            <PillButton
              label={t('auth.magicLinkInstead')}
              onPress={submitMagicLink}
              variant="ghost"
              loading={loading === 'magic'}
              disabled={loading !== null}
            />
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.or')}</Text>
              <View style={styles.dividerLine} />
            </View>
            {appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={mode === 'signup' ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={14}
                style={[styles.appleBtn, loading !== null && { opacity: 0.6 }]}
                onPress={loading !== null ? () => {} : submitApple}
              />
            )}
            <Pressable
              onPress={submitGoogle}
              disabled={loading !== null}
              style={[styles.googleBtn, loading !== null && { opacity: 0.6 }]}
            >
              <GoogleIcon />
              <Text style={styles.googleBtnText}>
                {loading === 'google' ? t('auth.connecting') : mode === 'signup' ? t('auth.signUpWithGoogle') : t('auth.continueWithGoogle')}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <Text style={styles.legal}>{t('auth.legal')}</Text>
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
  passwordRow: {
    height: 52,
    backgroundColor: colors.white,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
  },
  eyeBtn: { paddingHorizontal: 14, height: '100%', alignItems: 'center', justifyContent: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: { fontSize: 12.5, color: colors.tertiaryText, fontFamily: fonts.bodySemiBold },
  appleBtn: { height: 52, width: '100%' },
  googleBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleBtnText: { fontSize: 14.5, fontFamily: fonts.bodyBold, color: colors.ink },
  legal: { textAlign: 'center', fontSize: 12, color: colors.tertiaryText, marginTop: 20, lineHeight: 18 },
});
