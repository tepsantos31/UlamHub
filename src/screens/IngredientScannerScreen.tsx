import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PillButton } from '../components/PillButton';
import { PremiumGate } from '../components/PremiumGate';
import { scanIngredient, ScannedIngredient } from '../api/client';
import { getSettings } from '../storage/settings';
import { isSubscriptionActive } from '../utils/subscription';
import { SettingsState } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'IngredientScanner'>;

export function IngredientScannerScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScannedIngredient | null>(null);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);

  useFocusEffect(
    useCallback(() => {
      getSettings().then(setSettingsState);
    }, []),
  );

  const runScan = async (base64: string) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await scanIngredient({ imageBase64: base64 });
      setResult(res);
    } catch (e: any) {
      Alert.alert('Scan failed', e?.message ?? 'Could not reach the AI backend. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const fromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera access is required to scan an ingredient live.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (res.canceled || !res.assets[0]?.base64) return;
    await runScan(res.assets[0].base64);
  };

  const fromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7 });
    if (res.canceled || !res.assets[0]?.base64) return;
    await runScan(res.assets[0].base64);
  };

  return (
    <Screen withTabBarSpace={false}>
      <HeaderBar onBack={() => navigation.goBack()} />
      <View style={styles.badge}>
        <Text style={{ fontSize: 22 }}>🔍</Text>
      </View>
      <Text style={styles.title}>Ingredient Scanner</Text>
      <Text style={styles.subtitle}>At the market or an unfamiliar grocery aisle? Snap it and I'll tell you what it is.</Text>

      {settings && !isSubscriptionActive(settings) ? (
        <PremiumGate
          icon="🔍"
          title="Ingredient Scanner is a Premium tool"
          body="Identifying ingredients from a photo uses Kitchen AI — subscribe to UlamHub Premium to unlock it."
          onGoPremium={() => navigation.navigate('Paywall')}
        />
      ) : (
        <>
      <View style={styles.actionsRow}>
        <Pressable onPress={fromCamera} style={[styles.actionCard, shadow.soft]}>
          <Text style={{ fontSize: 22 }}>📸</Text>
          <Text style={styles.actionLabel}>Take a photo</Text>
        </Pressable>
        <Pressable onPress={fromLibrary} style={[styles.actionCard, shadow.soft]}>
          <Text style={{ fontSize: 22 }}>🖼️</Text>
          <Text style={styles.actionLabel}>Choose from library</Text>
        </Pressable>
      </View>

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.tealDark} />
          <Text style={styles.loadingText}>Identifying…</Text>
        </View>
      )}

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultName}>{result.name}</Text>
          <Text style={styles.resultSub}>{result.englishOrScientificName}</Text>

          {result.alternateNames.length > 0 && (
            <View style={styles.chipRow}>
              {result.alternateNames.map((n) => (
                <View key={n} style={styles.chip}>
                  <Text style={styles.chipText}>{n}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.resultDesc}>{result.description}</Text>

          {result.commonUses.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Common uses</Text>
              {result.commonUses.map((u) => (
                <Text key={u} style={styles.listItem}>
                  • {u}
                </Text>
              ))}
            </>
          )}

          {result.substitutes.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Substitutes</Text>
              {result.substitutes.map((s) => (
                <Text key={s} style={styles.listItem}>
                  • {s}
                </Text>
              ))}
            </>
          )}

          <PillButton label="Scan another" onPress={() => setResult(null)} variant="secondary" style={{ marginTop: 18 }} />
        </View>
      )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginTop: 14 },
  subtitle: { fontSize: 14, color: colors.sageMuted, marginTop: 8, lineHeight: 21 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 22 },
  actionCard: { flex: 1, backgroundColor: colors.white, borderRadius: radii.lg, paddingVertical: 20, alignItems: 'center', gap: 10 },
  actionLabel: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink, textAlign: 'center' },
  loadingBox: { marginTop: 22, alignItems: 'center', gap: 10, padding: 16 },
  loadingText: { color: colors.sageMuted, fontFamily: fonts.bodySemiBold, fontSize: 13 },
  resultCard: { marginTop: 22, backgroundColor: colors.white, borderRadius: radii.xl, padding: 20 },
  resultName: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  resultSub: { fontSize: 13, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, marginTop: 2, fontStyle: 'italic' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  chip: { backgroundColor: colors.mint, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  chipText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.tealLink },
  resultDesc: { fontSize: 14, color: colors.inkSoft, marginTop: 14, lineHeight: 21 },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink, marginTop: 16, marginBottom: 6 },
  listItem: { fontSize: 13.5, color: colors.sageText, lineHeight: 20 },
});
