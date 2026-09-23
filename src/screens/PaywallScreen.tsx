import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PACKAGE_TYPE, PurchasesPackage } from 'react-native-purchases';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme/theme';
import { CloseIcon } from '../components/Icon';
import { PillButton } from '../components/PillButton';
import { getSettings, setSettings } from '../storage/settings';
import { computeExpiryDate } from '../utils/subscription';
import { purchasesConfigured, getCurrentOffering, purchase, restore } from '../lib/purchases';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const FEATURES = [
  { f: 'Your own recipes', free: 'Up to 10', prem: 'Unlimited' },
  { f: 'Import from link & photo', free: '✓', prem: '✓' },
  { f: 'Kitchen AI & AI tools', free: '—', prem: '✓' },
  { f: 'Recipe Story & flavor tips', free: '—', prem: '✓' },
  { f: 'Share recipes', free: '—', prem: '✓' },
  { f: 'Browse community trending', free: '—', prem: '✓' },
];

// Shown only while unconfigured (no RevenueCat keys yet) so the paywall still
// has something to display in local/demo mode.
const DEMO_PLANS: { key: 'monthly' | 'annual'; name: string; price: string; per: string; note?: string }[] = [
  { key: 'monthly', name: 'Monthly', price: '$4.99', per: '/mo' },
  { key: 'annual', name: 'Annual', price: '$39.99', per: '/yr', note: 'Save 33%' },
];

export function PaywallScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [pick, setPick] = useState<'monthly' | 'annual'>('annual');
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [busy, setBusy] = useState<'subscribe' | 'restore' | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!purchasesConfigured) return;
      getCurrentOffering().then((offering) => setPackages(offering?.availablePackages ?? []));
    }, []),
  );

  const plans = purchasesConfigured
    ? (packages ?? [])
        .filter((p) => p.packageType === PACKAGE_TYPE.MONTHLY || p.packageType === PACKAGE_TYPE.ANNUAL)
        .map((p) => ({
          key: (p.packageType === PACKAGE_TYPE.ANNUAL ? 'annual' : 'monthly') as 'monthly' | 'annual',
          name: p.packageType === PACKAGE_TYPE.ANNUAL ? 'Annual' : 'Monthly',
          price: p.product.priceString,
          per: p.packageType === PACKAGE_TYPE.ANNUAL ? '/yr' : '/mo',
          pkg: p,
        }))
    : DEMO_PLANS.map((p) => ({ ...p, pkg: undefined as PurchasesPackage | undefined }));

  const subscribeDemo = async () => {
    const settings = await getSettings();
    // Resubscribing always starts a fresh full period from today, whether
    // the old one had already lapsed or not — same as a real renewal would.
    await setSettings({ ...settings, plan: pick, planExpiresAt: computeExpiryDate(pick) });
    Alert.alert(
      'Demo only',
      'This is a local mock — no real purchase happened (RevenueCat isn’t configured on this build yet). Your plan is saved locally though, including a real expiry date: created/shared/imported recipes lock again once that date passes, unless you resubscribe.',
      [{ text: 'OK', onPress: () => navigation.goBack() }],
    );
  };

  const subscribe = async () => {
    if (!purchasesConfigured) return subscribeDemo();
    const selected = plans.find((p) => p.key === pick)?.pkg;
    if (!selected) {
      Alert.alert('Not available', 'This plan isn’t available right now — please try again shortly.');
      return;
    }
    setBusy('subscribe');
    try {
      await purchase(selected);
      navigation.goBack();
    } catch (e: any) {
      if (!e?.userCancelled) Alert.alert('Purchase failed', e?.message ?? 'Something went wrong — please try again.');
    } finally {
      setBusy(null);
    }
  };

  const restorePurchase = async () => {
    if (!purchasesConfigured) {
      Alert.alert('Not available', 'Restoring purchases isn’t available in this build yet.');
      return;
    }
    setBusy('restore');
    try {
      await restore();
      Alert.alert('Restored', 'Your purchases have been restored.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Could not restore', e?.message ?? 'Something went wrong — please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 16 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <CloseIcon />
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', marginTop: 6 }}>
        <View style={styles.logo}>
          <Text style={{ fontSize: 28 }}>✨</Text>
        </View>
        <Text style={styles.title}>UlamHub Premium</Text>
        <Text style={styles.subtitle}>Cook without limits — every cuisine, every tool</Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>FEATURE</Text>
          <Text style={[styles.tableHeaderText, { width: 66, textAlign: 'center' }]}>FREE</Text>
          <Text style={[styles.tableHeaderText, { width: 76, textAlign: 'center', color: colors.tealLink }]}>PREMIUM</Text>
        </View>
        {FEATURES.map((row) => (
          <View key={row.f} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1, color: colors.ink }]}>{row.f}</Text>
            <Text style={[styles.tableCell, { width: 66, textAlign: 'center', color: colors.tertiaryText }]}>{row.free}</Text>
            <Text style={[styles.tableCell, { width: 76, textAlign: 'center', color: colors.tealLink, fontFamily: fonts.bodyExtraBold }]}>{row.prem}</Text>
          </View>
        ))}
      </View>

      {purchasesConfigured && packages === null ? (
        <ActivityIndicator color={colors.mint} style={{ marginTop: 30 }} />
      ) : (
        <View style={styles.plansRow}>
          {plans.map((p) => {
            const sel = pick === p.key;
            return (
              <Pressable key={p.key} onPress={() => setPick(p.key)} style={[styles.planCard, { backgroundColor: sel ? colors.deepGreen : colors.white, borderColor: sel ? colors.deepGreen : colors.borderMuted }]}>
                {'note' in p && p.note && (
                  <View style={[styles.noteBadge, { backgroundColor: sel ? colors.teal : colors.mint }]}>
                    <Text style={[styles.noteBadgeText, { color: sel ? colors.deepGreenLight : colors.tealLink }]}>{p.note}</Text>
                  </View>
                )}
                <Text style={[styles.planName, { color: sel ? colors.mint : colors.ink }]}>{p.name}</Text>
                <Text style={[styles.planPrice, { color: sel ? colors.mint : colors.ink }]}>{p.price}</Text>
                <Text style={[styles.planPer, { color: sel ? colors.tealDark : colors.secondaryText }]}>{p.per}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <PillButton
        label={purchasesConfigured ? 'Subscribe' : 'Start 7-day free trial'}
        onPress={subscribe}
        loading={busy === 'subscribe'}
        disabled={busy !== null || (purchasesConfigured && plans.length === 0)}
        style={{ marginTop: 22 }}
      />
      <Text style={styles.legal}>
        Cancel anytime ·{' '}
        <Text style={{ color: colors.tealLink, fontFamily: fonts.bodyBold }} onPress={busy ? undefined : restorePurchase}>
          {busy === 'restore' ? 'Restoring…' : 'Restore purchase'}
        </Text>
        {'\n'}
        <Text onPress={() => navigation.navigate('Legal', { doc: 'terms' })}>Terms</Text>
        {'  ·  '}
        <Text onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}>Privacy</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.deepGreen, paddingHorizontal: 20, paddingBottom: 40 },
  closeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 56, height: 56, borderRadius: 17, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontFamily: fonts.heading, fontSize: 27, color: colors.mint, letterSpacing: -0.4 },
  subtitle: { fontSize: 13.5, color: colors.tealDark, marginTop: 4, fontFamily: fonts.bodySemiBold },
  table: { backgroundColor: colors.white, borderRadius: radii.xl, paddingHorizontal: 18, marginTop: 22 },
  tableHeader: { flexDirection: 'row', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.divider },
  tableHeaderText: { fontSize: 11, fontFamily: fonts.bodyExtraBold, color: colors.tertiaryText, letterSpacing: 0.3 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  tableCell: { fontSize: 13, fontFamily: fonts.bodySemiBold },
  plansRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  planCard: { flex: 1, borderRadius: radii.lg, borderWidth: 1.5, padding: 15, alignItems: 'center' },
  noteBadge: { position: 'absolute', top: -9, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  noteBadgeText: { fontSize: 9.5, fontFamily: fonts.bodyExtraBold },
  planName: { fontFamily: fonts.bodyBold, fontSize: 13 },
  planPrice: { fontFamily: fonts.heading, fontSize: 21, marginTop: 6 },
  planPer: { fontSize: 11, fontFamily: fonts.bodySemiBold },
  legal: { textAlign: 'center', marginTop: 14, fontSize: 12, color: 'rgba(210,236,231,0.7)' },
});
