import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { ChevronRightIcon } from '../components/Icon';
import { PillButton } from '../components/PillButton';
import { extractRecipe } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'AddRecipe'>;

type MethodKey = 'manual' | 'url' | 'photo';

const METHODS: { key: MethodKey; titleKey: string; descKey: string; icon: string; tint: string }[] = [
  { key: 'manual', titleKey: 'addRecipe.manualEntry', descKey: 'addRecipe.manualEntryDesc', icon: '✏️', tint: colors.mint },
  { key: 'url', titleKey: 'addRecipe.importFromLink', descKey: 'addRecipe.importFromLinkDesc', icon: '🔗', tint: colors.gold },
  { key: 'photo', titleKey: 'addRecipe.scanAPhoto', descKey: 'addRecipe.scanAPhotoDesc', icon: '📷', tint: '#E9EBDD' },
];

export function AddRecipeScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const sharedUrl = route.params?.sharedUrl;
  const [method, setMethod] = useState<MethodKey | null>(sharedUrl ? 'url' : null);
  const [url, setUrl] = useState(sharedUrl ?? '');
  const [loading, setLoading] = useState(false);

  // Arrived here via the OS share sheet (see ShareIntentScreen) — go
  // straight into the same import flow a pasted link would trigger.
  useEffect(() => {
    if (sharedUrl) runUrlImport(sharedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedUrl]);

  const pick = async (key: MethodKey) => {
    setMethod(key);
    // replace, not navigate — so backing out of the review screen returns to
    // wherever the user was before AddRecipe, skipping this method-picker
    // screen rather than stacking it underneath.
    if (key === 'manual') {
      navigation.replace('AddRecipeReview', { method: 'manual' });
    }
    if (key === 'photo') {
      await runPhotoImport();
    }
  };

  const runPhotoImport = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('addRecipe.alerts.permissionNeededTitle'), t('addRecipe.alerts.permissionNeededPhotoBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7 });
    if (result.canceled || !result.assets[0]?.base64) return;
    setLoading(true);
    try {
      const extracted = await extractRecipe({ imageBase64: result.assets[0].base64 });
      navigation.replace('AddRecipeReview', { method: 'photo', extracted });
    } catch (e: any) {
      Alert.alert(t('addRecipe.alerts.extractionFailedTitle'), e?.message ?? t('addRecipe.alerts.extractionFailedBody'));
    } finally {
      setLoading(false);
    }
  };

  const runUrlImport = async (overrideUrl?: string) => {
    const target = (overrideUrl ?? url).trim();
    if (!target) return;
    setLoading(true);
    try {
      const extracted = await extractRecipe({ url: target });
      navigation.replace('AddRecipeReview', { method: 'url', extracted, sourceUrl: target });
    } catch (e: any) {
      Alert.alert(t('addRecipe.alerts.extractionFailedTitle'), e?.message ?? t('addRecipe.alerts.extractionFailedBody'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen withTabBarSpace={false}>
      <HeaderBar onBack={() => navigation.goBack()} />
      <Text style={styles.title}>{t('addRecipe.title')}</Text>
      <Text style={styles.subtitle}>{t('addRecipe.subtitle')}</Text>

      <View style={{ gap: 12, marginTop: 22 }}>
        {METHODS.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => pick(m.key)}
            style={[styles.methodCard, shadow.soft, method === m.key && styles.methodCardActive]}
          >
            <View style={[styles.methodIcon, { backgroundColor: m.tint }]}>
              <Text style={{ fontSize: 22 }}>{m.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>{t(m.titleKey)}</Text>
              <Text style={styles.methodDesc}>{t(m.descKey)}</Text>
            </View>
            <ChevronRightIcon />
          </Pressable>
        ))}
      </View>

      {method === 'url' && (
        <View style={styles.urlBox}>
          <Text style={styles.urlBoxLabel}>{t('addRecipe.pasteRecipeLink')}</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://..."
            placeholderTextColor={colors.tertiaryText}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.urlInput}
          />
          <PillButton label={t('auth.continue')} onPress={() => runUrlImport()} loading={loading} style={{ marginTop: 12 }} />
        </View>
      )}

      {loading && method === 'photo' && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.tealDark} />
          <Text style={styles.loadingText}>{t('addRecipe.readingPhotoWithAI')}</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, marginTop: 6 },
  subtitle: { fontSize: 14, color: colors.sageMuted, marginTop: 10, lineHeight: 21 },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: radii.lg, padding: 16, borderWidth: 1.5, borderColor: colors.borderMuted },
  methodCardActive: { borderColor: colors.tealDark },
  methodIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  methodTitle: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.ink },
  methodDesc: { fontSize: 12.5, color: colors.secondaryText, marginTop: 2 },
  urlBox: { marginTop: 22, padding: 16, borderRadius: radii.lg, backgroundColor: colors.mint },
  urlBoxLabel: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.mintText },
  urlInput: { height: 48, backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 14, marginTop: 10, fontSize: 14, color: colors.ink },
  loadingBox: { marginTop: 22, alignItems: 'center', gap: 10, padding: 16 },
  loadingText: { color: colors.sageMuted, fontFamily: fonts.bodySemiBold, fontSize: 13 },
});
