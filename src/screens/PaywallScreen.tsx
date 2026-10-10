import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
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
import { purchasesConfigured, getCurrentOffering, purchase, restore, describeFreeTrial } from '../lib/purchases';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const FEATURE_KEYS = [
  'ownRecipes',
  'importFromLinkPhoto',
  'kitchenAIAndTools',
  'recipeStoryFlavorTips',
  'shareRecipes',
  'browseTrending',
];

export function PaywallScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const FEATURES = FEATURE_KEYS.map((key) => ({
    f: t(`paywall.features.${key}.name`),
    free: t(`paywall.features.${key}.free`),
    prem: t(`paywall.features.${key}.prem`),
  }));

  // Shown only while unconfigured (no RevenueCat keys yet) so the paywall
  // still has something to display in local/demo mode.
  const DEMO_PLANS: { key: 'monthly' | 'annual'; name: string; price: string; per: string; note?: string }[] = [
    { key: 'monthly', name: t('paywall.monthly'), price: '$4.99', per: t('paywall.perMonth') },
    { key: 'annual', name: t('paywall.annual'), price: '$39.99', per: t('paywall.perYear'), note: t('paywall.save33') },
  ];
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
          name: p.packageType === PACKAGE_TYPE.ANNUAL ? t('paywall.annual') : t('paywall.monthly'),
          price: p.product.priceString,
          per: p.packageType === PACKAGE_TYPE.ANNUAL ? '/yr' : '/mo',
          pkg: p,
        }))
    : DEMO_PLANS.map((p) => ({ ...p, pkg: undefined as PurchasesPackage | undefined }));

  // Demo mode has no real trial to offer — subscribeDemo() activates the
  // full period immediately, so the button must not claim a trial exists.
  // In real mode, whether there's a trial (and how long) depends entirely
  // on how the currently-selected package is configured in the store.
  const selectedPackage = plans.find((p) => p.key === pick)?.pkg;
  const trialLength = selectedPackage ? describeFreeTrial(selectedPackage) : null;

  const subscribeDemo = async () => {
    const settings = await getSettings();
    // Resubscribing always starts a fresh full period from today, whether
    // the old one had already lapsed or not — same as a real renewal would.
    await setSettings({ ...settings, plan: pick, planExpiresAt: computeExpiryDate(pick), planCancelled: false });
    Alert.alert(t('paywall.alerts.demoOnlyTitle'), t('paywall.alerts.demoOnlyBody'), [
      { text: t('common.ok'), onPress: () => navigation.goBack() },
    ]);
  };

  const subscribe = async () => {
    if (!purchasesConfigured) return subscribeDemo();
    if (!selectedPackage) {
      Alert.alert(t('paywall.alerts.notAvailableTitle'), t('paywall.alerts.planNotAvailableBody'));
      return;
    }
    setBusy('subscribe');
    try {
      await purchase(selectedPackage);
      navigation.goBack();
    } catch (e: any) {
      if (!e?.userCancelled) Alert.alert(t('paywall.alerts.purchaseFailedTitle'), e?.message ?? t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const restorePurchase = async () => {
    if (!purchasesConfigured) {
      Alert.alert(t('paywall.alerts.notAvailableTitle'), t('paywall.alerts.restoreNotAvailableBody'));
      return;
    }
    setBusy('restore');
    try {
      await restore();
      Alert.alert(t('paywall.alerts.restoredTitle'), t('paywall.alerts.restoredBody'), [{ text: t('common.ok'), onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert(t('paywall.alerts.couldNotRestoreTitle'), e?.message ?? t('common.error'));
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
        <Text style={styles.title}>{t('paywall.ulamhubPremium')}</Text>
        <Text style={styles.subtitle}>{t('paywall.subtitle')}</Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>{t('paywall.feature')}</Text>
          <Text style={[styles.tableHeaderText, { width: 66, textAlign: 'center' }]}>{t('paywall.free')}</Text>
          <Text style={[styles.tableHeaderText, { width: 76, textAlign: 'center', color: colors.tealLink }]}>{t('paywall.premium')}</Text>
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
              <Pressable key={p.key} onPress={() => setPick(p.key)} style={[styles.planCard, { backgroundColor: sel ? colors.white : colors.deepGreenLight, borderColor: sel ? colors.white : 'rgba(255,255,255,0.14)' }]}>
                {'note' in p && p.note && (
                  <View style={[styles.noteBadge, { backgroundColor: sel ? colors.mint : colors.teal }]}>
                    <Text style={[styles.noteBadgeText, { color: sel ? colors.tealLink : colors.deepGreenLight }]}>{p.note}</Text>
                  </View>
                )}
                <Text style={[styles.planName, { color: sel ? colors.ink : colors.mint }]}>{p.name}</Text>
                <Text style={[styles.planPrice, { color: sel ? colors.ink : colors.mint }]}>{p.price}</Text>
                <Text style={[styles.planPer, { color: sel ? colors.secondaryText : colors.tealDark }]}>{p.per}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <PillButton
        label={trialLength ? t('paywall.startFreeTrial', { length: trialLength }) : t('paywall.subscribe')}
        onPress={subscribe}
        loading={busy === 'subscribe'}
        disabled={busy !== null || (purchasesConfigured && plans.length === 0)}
        style={{ marginTop: 22 }}
      />
      <Text style={styles.legal}>
        {t('paywall.cancelAnytime')} ·{' '}
        <Text style={{ color: colors.tealLink, fontFamily: fonts.bodyBold }} onPress={busy ? undefined : restorePurchase}>
          {busy === 'restore' ? t('paywall.restoring') : t('paywall.restorePurchase')}
        </Text>
        {'\n'}
        <Text onPress={() => navigation.navigate('Legal', { doc: 'terms' })}>{t('paywall.terms')}</Text>
        {'  ·  '}
        <Text onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}>{t('paywall.privacy')}</Text>
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
