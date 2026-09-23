import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PillButton } from '../components/PillButton';
import { PremiumGate } from '../components/PremiumGate';
import { leftoverAlchemist } from '../api/client';
import { getSettings } from '../storage/settings';
import { isSubscriptionActive } from '../utils/subscription';
import { SettingsState } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'LeftoverAlchemist'>;

export function LeftoverAlchemistScreen({ navigation }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);

  useFocusEffect(
    useCallback(() => {
      getSettings().then(setSettingsState);
    }, []),
  );

  const runWithPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to snap your leftovers.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7 });
    if (result.canceled || !result.assets[0]?.base64) return;
    await run({ imageBase64: result.assets[0].base64 });
  };

  const runWithText = async () => {
    if (!text.trim()) return;
    await run({ text: text.trim() });
  };

  const run = async (input: { imageBase64?: string; text?: string }) => {
    setLoading(true);
    try {
      const extracted = await leftoverAlchemist(input);
      navigation.replace('AddRecipeReview', { method: 'leftover', extracted });
    } catch (e: any) {
      Alert.alert('Alchemy failed', e?.message ?? 'Could not reach the AI backend. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen withTabBarSpace={false}>
      <HeaderBar onBack={() => navigation.goBack()} />
      <View style={styles.badge}>
        <Text style={{ fontSize: 22 }}>🧪</Text>
      </View>
      <Text style={styles.title}>Leftover Alchemist</Text>
      <Text style={styles.subtitle}>
        Show me what's left in the fridge — a photo or just a quick list — and I'll invent something new to make with it.
      </Text>

      {settings && !isSubscriptionActive(settings) ? (
        <PremiumGate
          icon="🧪"
          title="Leftover Alchemist is a Premium tool"
          body="Turning your leftovers into a new dish uses Kitchen AI — subscribe to UlamHub Premium to unlock it."
          onGoPremium={() => navigation.navigate('Paywall')}
        />
      ) : (
        <>
      <Pressable onPress={runWithPhoto} style={[styles.photoCard, shadow.soft]}>
        <View style={styles.photoIcon}>
          <Text style={{ fontSize: 22 }}>📷</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.photoTitle}>Snap a photo</Text>
          <Text style={styles.photoDesc}>Of your fridge, pantry, or counter</Text>
        </View>
      </Pressable>

      <Text style={styles.orText}>or tell me what you have</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="e.g. leftover rice, half an onion, some eggs, a bit of tinapa…"
        placeholderTextColor={colors.tertiaryText}
        multiline
        style={styles.textInput}
      />
      <PillButton label="Work your magic ✨" onPress={runWithText} disabled={!text.trim()} style={{ marginTop: 12 }} />

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.tealDark} />
          <Text style={styles.loadingText}>Inventing something delicious…</Text>
        </View>
      )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.coralBg, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginTop: 14 },
  subtitle: { fontSize: 14, color: colors.sageMuted, marginTop: 8, lineHeight: 21 },
  photoCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: radii.lg, padding: 16, marginTop: 22 },
  photoIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  photoTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.ink },
  photoDesc: { fontSize: 12.5, color: colors.secondaryText, marginTop: 2 },
  orText: { textAlign: 'center', fontSize: 12.5, color: colors.tertiaryText, fontFamily: fonts.bodySemiBold, marginTop: 20, marginBottom: 10 },
  textInput: {
    minHeight: 90,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 14,
    fontSize: 14,
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    textAlignVertical: 'top',
  },
  loadingBox: { marginTop: 22, alignItems: 'center', gap: 10, padding: 16 },
  loadingText: { color: colors.sageMuted, fontFamily: fonts.bodySemiBold, fontSize: 13 },
});
