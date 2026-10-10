import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { HeaderBar } from '../components/HeaderBar';
import { PillButton } from '../components/PillButton';
import { PremiumGate } from '../components/PremiumGate';
import { Chip } from '../components/Chip';
import { CloseIcon } from '../components/Icon';
import { whatCanIMake, ExtractedRecipe } from '../api/client';
import { getSettings } from '../storage/settings';
import { isSubscriptionActive } from '../utils/subscription';
import { SettingsState } from '../types/models';
import { COUNTRIES } from '../storage/seed';

type Props = NativeStackScreenProps<RootStackParamList, 'WhatCanIMake'>;

interface StagedPhoto {
  uri: string;
  base64: string;
}

// A session gets at most this many suggestions before Regenerate disables —
// keeps a single visit from turning into an unbounded string of AI calls.
const MAX_REGENERATIONS = 5;

export function WhatCanIMakeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [text, setText] = useState('');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);
  // Every suggestion generated this visit, in order — Back/Forward just moves
  // historyIndex (no API call); Regenerate appends a new one (up to the cap).
  const [history, setHistory] = useState<ExtractedRecipe[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getSettings().then(setSettingsState);
    }, []),
  );

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('recipeDetail.alerts.permissionNeededTitle'), t('whatCanIMake.alerts.cameraPermissionBody'));
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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7, allowsMultipleSelection: true });
    if (result.canceled) return;
    const picked = result.assets.filter((a) => a.base64).map((a) => ({ uri: a.uri, base64: a.base64 as string }));
    setPhotos((prev) => [...prev, ...picked]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const generate = async (isRegenerate: boolean) => {
    setLoading(true);
    try {
      const extracted = await whatCanIMake({
        imageBase64s: photos.map((p) => p.base64),
        text: text.trim() || undefined,
        cuisine: cuisine ?? undefined,
        excludeNames: isRegenerate ? history.map((r) => r.name) : undefined,
      });
      const nextHistory = [...history, extracted];
      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
    } catch (e: any) {
      Alert.alert(t('whatCanIMake.alerts.suggestionFailedTitle'), e?.message ?? t('addRecipe.alerts.extractionFailedBody'));
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setHistory([]);
    setHistoryIndex(0);
    setPhotos([]);
    setText('');
    setCuisine(null);
  };

  const useThisRecipe = () => {
    navigation.replace('AddRecipeReview', { method: 'whatcanimake', extracted: history[historyIndex] });
  };

  const canSubmit = photos.length > 0 || !!text.trim();
  const current = history[historyIndex];
  const inResults = history.length > 0 && !!current;
  const canRegenerate = history.length < MAX_REGENERATIONS;
  const haveIngredients = current?.ingredients.filter((i) => i.have) ?? [];
  const needIngredients = current?.ingredients.filter((i) => !i.have) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg, paddingTop: insets.top + 10 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <HeaderBar onBack={inResults ? startOver : () => navigation.goBack()} />
      </View>
      {/* No KeyboardAvoidingView here on purpose — combining one with
          automaticallyAdjustKeyboardInsets below double-compensates for the
          keyboard and scrolls the focused field clean off-screen instead of
          just above it. automaticallyAdjustKeyboardInsets (iOS) alone is
          enough to bring a focused TextInput into view as it's well down
          this form. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
      <View style={styles.badge}>
        <Text style={{ fontSize: 22 }}>💡</Text>
      </View>
      <Text style={styles.title}>{t('whatCanIMake.title')}</Text>
      <Text style={styles.subtitle}>{t('whatCanIMake.subtitle')}</Text>

      {settings && !isSubscriptionActive(settings) ? (
        <PremiumGate
          icon="💡"
          title={t('whatCanIMake.premiumToolTitle')}
          body={t('whatCanIMake.premiumToolBody')}
          onGoPremium={() => navigation.navigate('Paywall')}
        />
      ) : inResults ? (
        <>
          <View style={styles.stepperRow}>
            <Pressable
              onPress={() => setHistoryIndex((i) => Math.max(0, i - 1))}
              disabled={historyIndex === 0 || loading}
              style={[styles.stepperBtn, (historyIndex === 0 || loading) && styles.stepperBtnDisabled]}
            >
              <Text style={styles.stepperBtnText}>‹</Text>
            </Pressable>
            <Text style={styles.stepperVal}>{t('whatCanIMake.optionOf', { current: historyIndex + 1, total: history.length })}</Text>
            <Pressable
              onPress={() => setHistoryIndex((i) => Math.min(history.length - 1, i + 1))}
              disabled={historyIndex === history.length - 1 || loading}
              style={[styles.stepperBtn, (historyIndex === history.length - 1 || loading) && styles.stepperBtnDisabled]}
            >
              <Text style={styles.stepperBtnText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.resultCard}>
            <View style={styles.badgeRow}>
              <Text style={[styles.resultBadge, { backgroundColor: colors.mint, color: colors.tealLink }]}>{current.country}</Text>
              <Text style={[styles.resultBadge, { backgroundColor: colors.gold, color: colors.goldText }]}>{current.type}</Text>
            </View>
            <Text style={styles.resultName}>{current.name}</Text>
            <Text style={styles.resultMeta}>{t('recipeDetail.timeMinutes', { count: current.timeMinutes })} · {current.kcal} kcal</Text>

            {haveIngredients.length > 0 && (
              <>
                <Text style={styles.ingHeader}>{t('whatCanIMake.youAlreadyHave')}</Text>
                {haveIngredients.map((ing, i) => (
                  <Text key={i} style={styles.ingLine}>
                    • {ing.qty} {ing.unit} {ing.name}
                  </Text>
                ))}
              </>
            )}
            {needIngredients.length > 0 && (
              <>
                <Text style={styles.ingHeader}>{t('whatCanIMake.youllNeedToGet')}</Text>
                {needIngredients.map((ing, i) => (
                  <Text key={i} style={styles.ingLine}>
                    • {ing.qty} {ing.unit} {ing.name}
                  </Text>
                ))}
              </>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.tealDark} />
              <Text style={styles.loadingText}>{t('whatCanIMake.thinkingUpADish')}</Text>
            </View>
          ) : (
            <>
              <PillButton
                label={canRegenerate ? t('whatCanIMake.regenerate') : t('whatCanIMake.regenerateLimitReached')}
                onPress={() => generate(true)}
                disabled={!canRegenerate}
                variant="secondary"
                style={{ marginTop: 16 }}
              />
              <PillButton label={t('whatCanIMake.useThisRecipe')} onPress={useThisRecipe} style={{ marginTop: 10 }} />
              <Pressable onPress={startOver} style={{ marginTop: 14 }}>
                <Text style={styles.startOverLink}>{t('whatCanIMake.startOver')}</Text>
              </Pressable>
            </>
          )}
        </>
      ) : (
        <>
          <Text style={styles.label}>{t('whatCanIMake.cuisineOptional')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label={t('whatCanIMake.surpriseMe')} active={cuisine === null} onPress={() => setCuisine(null)} small />
            {COUNTRIES.map((c) => (
              <Chip key={c} label={c} active={cuisine === c} onPress={() => setCuisine(c)} small />
            ))}
          </ScrollView>

          <Text style={styles.label}>{t('whatCanIMake.photos')}</Text>
          <View style={styles.actionsRow}>
            <Pressable onPress={takePhoto} style={[styles.actionCard, shadow.soft]}>
              <Text style={{ fontSize: 20 }}>📷</Text>
              <Text style={styles.actionLabel}>{t('whatCanIMake.takeAPhoto')}</Text>
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

          <Text style={styles.orText}>{photos.length > 0 ? t('whatCanIMake.anythingElse') : t('whatCanIMake.orTellMe')}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('whatCanIMake.inputPlaceholder')}
            placeholderTextColor={colors.tertiaryText}
            multiline
            style={styles.textInput}
          />
          <PillButton label={t('whatCanIMake.suggestADish')} onPress={() => generate(false)} disabled={!canSubmit} loading={loading} style={{ marginTop: 12 }} />
        </>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
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
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 22,
  },
  stepperBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stepperBtnDisabled: { opacity: 0.35 },
  stepperBtnText: { fontWeight: '800', fontSize: 19, color: colors.tealLink },
  stepperVal: { fontFamily: fonts.bodyExtraBold, fontSize: 13.5, color: colors.ink, minWidth: 110, textAlign: 'center' },
  resultCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: 20, marginTop: 16 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  resultBadge: { fontSize: 11, fontFamily: fonts.bodyExtraBold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9, overflow: 'hidden' },
  resultName: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, letterSpacing: -0.3 },
  resultMeta: { fontSize: 13, color: colors.secondaryText, marginTop: 6, fontFamily: fonts.bodySemiBold },
  ingHeader: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink, marginTop: 18, marginBottom: 8 },
  ingLine: { fontSize: 13.5, color: colors.sageText, lineHeight: 20 },
  startOverLink: { textAlign: 'center', color: colors.tealLink, fontFamily: fonts.bodyBold, fontSize: 13.5 },
});
