import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PillButton } from '../components/PillButton';
import { PremiumGate } from '../components/PremiumGate';
import { Chip } from '../components/Chip';
import { CloseIcon } from '../components/Icon';
import { leftoverAlchemist } from '../api/client';
import { getSettings } from '../storage/settings';
import { isSubscriptionActive } from '../utils/subscription';
import { SettingsState } from '../types/models';
import { COUNTRIES } from '../storage/seed';

type Props = NativeStackScreenProps<RootStackParamList, 'LeftoverAlchemist'>;

interface StagedPhoto {
  uri: string;
  base64: string;
}

export function LeftoverAlchemistScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [text, setText] = useState('');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);

  useFocusEffect(
    useCallback(() => {
      getSettings().then(setSettingsState);
    }, []),
  );

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('recipeDetail.alerts.permissionNeededTitle'), t('leftoverAlchemist.alerts.cameraPermissionBody'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (result.canceled || !result.assets[0]?.base64) return;
    setPhotos((prev) => [...prev, { uri: result.assets[0].uri, base64: result.assets[0].base64! }]);
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('recipeDetail.alerts.permissionNeededTitle'), t('recipeDetail.alerts.permissionNeededBody'));
      return;
    }
    // allowsMultipleSelection so a whole fridge/pantry haul can be added in
    // one go, rather than re-opening the library once per photo.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7, allowsMultipleSelection: true });
    if (result.canceled) return;
    const picked = result.assets.filter((a) => a.base64).map((a) => ({ uri: a.uri, base64: a.base64 as string }));
    setPhotos((prev) => [...prev, ...picked]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const run = async () => {
    if (photos.length === 0 && !text.trim()) return;
    setLoading(true);
    try {
      const extracted = await leftoverAlchemist({
        imageBase64s: photos.map((p) => p.base64),
        text: text.trim() || undefined,
        cuisine: cuisine ?? undefined,
      });
      navigation.replace('AddRecipeReview', { method: 'leftover', extracted });
    } catch (e: any) {
      Alert.alert(t('leftoverAlchemist.alerts.alchemyFailedTitle'), e?.message ?? t('addRecipe.alerts.extractionFailedBody'));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = photos.length > 0 || !!text.trim();

  return (
    <Screen withTabBarSpace={false}>
      <HeaderBar onBack={() => navigation.goBack()} />
      <View style={styles.badge}>
        <Text style={{ fontSize: 22 }}>🧪</Text>
      </View>
      <Text style={styles.title}>{t('leftoverAlchemist.title')}</Text>
      <Text style={styles.subtitle}>{t('leftoverAlchemist.subtitle')}</Text>

      {settings && !isSubscriptionActive(settings) ? (
        <PremiumGate
          icon="🧪"
          title={t('leftoverAlchemist.premiumToolTitle')}
          body={t('leftoverAlchemist.premiumToolBody')}
          onGoPremium={() => navigation.navigate('Paywall')}
        />
      ) : (
        <>
      <Text style={styles.label}>{t('leftoverAlchemist.cuisineOptional')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label={t('leftoverAlchemist.surpriseMe')} active={cuisine === null} onPress={() => setCuisine(null)} small />
        {COUNTRIES.map((c) => (
          <Chip key={c} label={c} active={cuisine === c} onPress={() => setCuisine(c)} small />
        ))}
      </ScrollView>

      <Text style={styles.label}>{t('leftoverAlchemist.photos')}</Text>
      <View style={styles.actionsRow}>
        <Pressable onPress={takePhoto} style={[styles.actionCard, shadow.soft]}>
          <Text style={{ fontSize: 20 }}>📷</Text>
          <Text style={styles.actionLabel}>{t('leftoverAlchemist.takeAPhoto')}</Text>
        </Pressable>
        <Pressable onPress={pickFromLibrary} style={[styles.actionCard, shadow.soft]}>
          <Text style={{ fontSize: 20 }}>🖼️</Text>
          <Text style={styles.actionLabel}>{t('recipeDetail.alerts.chooseFromLibrary')}</Text>
        </Pressable>
      </View>

      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 2 }} style={{ marginTop: 14 }}>
          {photos.map((p, i) => (
            <View key={p.uri + i} style={styles.thumbWrap}>
              <Image source={{ uri: p.uri }} style={styles.thumb} />
              <Pressable onPress={() => removePhoto(i)} style={styles.thumbRemove} hitSlop={6}>
                <CloseIcon size={10} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <Text style={styles.orText}>{photos.length > 0 ? t('leftoverAlchemist.anythingElse') : t('leftoverAlchemist.orTellMe')}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t('leftoverAlchemist.inputPlaceholder')}
        placeholderTextColor={colors.tertiaryText}
        multiline
        style={styles.textInput}
      />
      <PillButton label={t('leftoverAlchemist.workYourMagic')} onPress={run} disabled={!canSubmit} style={{ marginTop: 12 }} />

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.tealDark} />
          <Text style={styles.loadingText}>{t('leftoverAlchemist.inventingSomething')}</Text>
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
  label: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink, marginTop: 22, marginBottom: 10 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionCard: { flex: 1, backgroundColor: colors.white, borderRadius: radii.lg, paddingVertical: 20, alignItems: 'center', gap: 10 },
  actionLabel: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink, textAlign: 'center' },
  thumbWrap: { width: 72, height: 72 },
  thumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: colors.placeholderA },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
