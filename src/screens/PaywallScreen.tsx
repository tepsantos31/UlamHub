import React, { useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme/theme';
import { CloseIcon } from '../components/Icon';
import { PillButton } from '../components/PillButton';
import { getSettings, setSettings } from '../storage/settings';
import { computeExpiryDate } from '../utils/subscription';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const FEATURES = [
  { f: 'Recipe imports', free: '5 / month', prem: 'Unlimited' },
  { f: 'AI substitution engine', free: '—', prem: '✓' },
  { f: 'Full nutrition calc', free: 'Basic', prem: 'Detailed' },
  { f: 'Family cookbook cloud sync', free: '—', prem: '✓' },
  { f: 'AI chat assistant', free: '10 / mo', prem: 'Unlimited' },
  { f: 'Ad-free experience', free: '—', prem: '✓' },
];

const PLANS: { key: 'monthly' | 'annual' | 'family'; name: string; price: string; per: string; note?: string }[] = [
  { key: 'monthly', name: 'Monthly', price: '$4.99', per: '/mo' },
  { key: 'annual', name: 'Annual', price: '$39.99', per: '/yr', note: 'Save 33%' },
  { key: 'family', name: 'Family', price: '$59.99', per: '/yr', note: 'Up to 6' },
];

export function PaywallScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [pick, setPick] = useState<'monthly' | 'annual' | 'family'>('annual');

  const startTrial = async () => {
    const settings = await getSettings();
    // Resubscribing always starts a fresh full period from today, whether
    // the old one had already lapsed or not — same as a real renewal would.
    await setSettings({ ...settings, plan: pick, planExpiresAt: computeExpiryDate(pick) });
    Alert.alert(
      'Demo only',
      "This is a local mock — no real purchase happened (real StoreKit needs a custom build, not Expo Go). Your plan is saved locally though, including a real expiry date: created/shared/imported recipes lock again once that date passes, unless you resubscribe.",
      [{ text: 'OK', onPress: () => navigation.goBack() }],
    );
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
        <Text style={styles.title}>Ulam Premium</Text>
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

      <View style={styles.plansRow}>
        {PLANS.map((p) => {
          const sel = pick === p.key;
          return (
            <Pressable key={p.key} onPress={() => setPick(p.key)} style={[styles.planCard, { backgroundColor: sel ? colors.deepGreen : colors.white, borderColor: sel ? colors.deepGreen : colors.borderMuted }]}>
              {p.note && (
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

      <PillButton label="Start 7-day free trial" onPress={startTrial} style={{ marginTop: 22 }} />
      <Text style={styles.legal}>Cancel anytime · <Text style={{ color: colors.tealLink, fontFamily: fonts.bodyBold }}>Restore purchase</Text></Text>
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
