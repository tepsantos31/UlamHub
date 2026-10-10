import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, Share, Linking, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { PillButton } from '../components/PillButton';
import { ShareIcon } from '../components/Icon';
import { GroceryGroup, SettingsState } from '../types/models';
import { getGrocery, toggleGroceryItem, addManualItem, clearGrocery } from '../storage/grocery';
import { getOnboarding, setOnboarding } from '../storage/onboarding';
import { getSettings } from '../storage/settings';
import { ABROAD_SUBSTITUTIONS } from '../storage/seed';
import { RootStackParamList } from '../navigation/types';
import { getIngredientSubstitute, IngredientSubstitute } from '../api/client';
import { isSubscriptionActive } from '../utils/subscription';

// Keyed by `${groupIndex}-${itemIndex}` rather than the ingredient name,
// since two different groups could in theory both have an item called the
// same thing (e.g. a manual "Salt" alongside a plan-derived one).
interface SubstituteState {
  loading: boolean;
  result?: IngredientSubstitute[];
  error?: string;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function GroceryListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const [groups, setGroups] = useState<GroceryGroup[]>([]);
  const [diaspora, setDiaspora] = useState(false);
  const [homeCuisine, setHomeCuisine] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);
  const [substitutes, setSubstitutes] = useState<Record<string, SubstituteState>>({});

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [g, onboarding, s] = await Promise.all([getGrocery(), getOnboarding(), getSettings()]);
        setGroups(g);
        setDiaspora(onboarding.quiz.diaspora);
        setHomeCuisine(onboarding.quiz.countries[0] ?? '');
        setSettingsState(s);
        // The list can change from elsewhere (Recipe Detail's "Add to
        // grocery", Meal Planner's per-day button) while this screen isn't
        // focused — an open substitute panel would otherwise end up labeled
        // for whatever item now sits at that index instead of the one it
        // was opened for.
        setSubstitutes({});
      })();
    }, []),
  );

  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const done = groups.reduce((a, g) => a + g.items.filter((i) => i.checked).length, 0);

  const onToggle = async (gi: number, ii: number) => {
    const next = await toggleGroceryItem(gi, ii);
    setGroups(next);
  };

  const requirePremium = (): boolean => {
    if (settings && isSubscriptionActive(settings)) return true;
    Alert.alert(t('grocery.alerts.premiumFeatureTitle'), t('grocery.alerts.substitutePremiumBody'), [
      { text: t('grocery.alerts.notNow'), style: 'cancel' },
      { text: t('grocery.alerts.goPremium'), onPress: () => navigation.navigate('Paywall') },
    ]);
    return false;
  };

  // Tapping an already-open panel closes it again; otherwise it asks the AI
  // backend for substitutes specific to that one ingredient (and, when
  // cooking-abroad mode is on, nudges it toward substitutes that are easy to
  // find internationally rather than just the most authentic one).
  const toggleSubstitute = async (gi: number, ii: number, name: string) => {
    const key = `${gi}-${ii}`;
    if (substitutes[key]) {
      setSubstitutes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    if (!requirePremium()) return;
    setSubstitutes((prev) => ({ ...prev, [key]: { loading: true } }));
    try {
      const context = diaspora
        ? `This person is cooking ${homeCuisine || 'their home cuisine'} food while living abroad — prefer substitutes that are easy to find internationally.`
        : undefined;
      const res = await getIngredientSubstitute({ name, context });
      setSubstitutes((prev) => ({ ...prev, [key]: { loading: false, result: res.substitutes } }));
    } catch (e: any) {
      setSubstitutes((prev) => ({
        ...prev,
        [key]: { loading: false, error: e?.message ?? t('grocery.alerts.kitchenAIUnreachable') },
      }));
    }
  };

  const onToggleDiaspora = async () => {
    const onboarding = await getOnboarding();
    const nextVal = !diaspora;
    await setOnboarding({ ...onboarding, quiz: { ...onboarding.quiz, diaspora: nextVal } });
    setDiaspora(nextVal);
  };

  const shareList = () => {
    const lines = groups.flatMap((g) => [`${g.name}:`, ...g.items.map((it) => `  ${it.checked ? '✓' : '•'} ${it.n} ${it.q}`.trim())]);
    Share.share({ message: lines.join('\n') || t('grocery.emptyListShareMessage') });
  };

  const findNearestStore = () => {
    const query = homeCuisine ? `${homeCuisine} grocery store` : 'international grocery store';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(t('grocery.alerts.couldNotOpenMapsTitle'), t('grocery.alerts.couldNotOpenMapsBody'));
    });
  };

  const onClear = () => {
    if (total === 0) return;
    Alert.alert(t('grocery.alerts.clearListTitle'), t('grocery.alerts.clearListBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('grocery.clearList'),
        style: 'destructive',
        onPress: async () => {
          const next = await clearGrocery();
          setGroups(next);
        },
      },
    ]);
  };

  const onAddManual = async () => {
    if (!manualName.trim()) return;
    const next = await addManualItem(manualName.trim(), manualQty.trim());
    setGroups(next);
    setManualName('');
    setManualQty('');
    setShowManual(false);
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('grocery.title')}</Text>
        <Pressable onPress={shareList} style={[styles.shareBtn, shadow.soft]}>
          <ShareIcon size={18} color="#2C4642" />
        </Pressable>
      </View>
      <Text style={styles.subline}>{t('grocery.itemsProgress', { done, total })}</Text>

      <View style={styles.diasporaRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.diasporaTitle}>{t('grocery.cookingAbroad')}</Text>
          <Text style={styles.diasporaSub}>{t('grocery.cookingAbroadSub')}</Text>
        </View>
        <ToggleSwitch value={diaspora} onValueChange={onToggleDiaspora} />
      </View>
      {diaspora && (
        <View style={styles.subsBox}>
          <Text style={styles.subsText}>
            🔁 {t('grocery.substituting')}{' '}
            {ABROAD_SUBSTITUTIONS.map(([a, b]) => (
              <Text key={a} style={{ fontFamily: fonts.bodyBold }}>
                {a} → {b}
                {'  '}
              </Text>
            ))}
            <Text style={{ color: colors.tealLink, fontFamily: fonts.bodyBold }} onPress={findNearestStore}>
              {t('grocery.findNearestStore')}
            </Text>
          </Text>
        </View>
      )}

      <Pressable onPress={() => navigation.navigate('IngredientScanner')} style={styles.scanLink}>
        <Text style={styles.scanLinkText}>🔍 {t('grocery.scanIngredient')}</Text>
      </Pressable>

      <View style={{ gap: 16, marginTop: 20 }}>
        {groups.map((g, gi) => (
          <View key={g.name}>
            <Text style={styles.groupName}>{g.name}</Text>
            <View style={styles.card}>
              {g.items.map((it, ii) => {
                const key = `${gi}-${ii}`;
                const sub = substitutes[key];
                return (
                  <View key={key} style={ii !== g.items.length - 1 && styles.rowBorder}>
                    <View style={styles.itemRow}>
                      <Pressable onPress={() => onToggle(gi, ii)} style={styles.itemMain}>
                        <View style={[styles.checkbox, it.checked && { backgroundColor: colors.teal, borderColor: colors.teal }]}>
                          {it.checked && <Text style={styles.checkTick}>✓</Text>}
                        </View>
                        <Text style={[styles.itemName, it.checked && { color: colors.tertiaryText, textDecorationLine: 'line-through' }]}>
                          {it.n}
                        </Text>
                        <Text style={styles.itemQty}>{it.q}</Text>
                      </Pressable>
                      <Pressable onPress={() => toggleSubstitute(gi, ii, it.n)} style={styles.subBtn} hitSlop={6}>
                        <Text style={styles.subBtnText}>{sub ? t('recipeDetail.hide') : t('grocery.substitute')}</Text>
                      </Pressable>
                    </View>
                    {sub && (
                      <View style={styles.subPanel}>
                        {sub.loading ? (
                          <ActivityIndicator color={colors.tealDark} size="small" />
                        ) : sub.error ? (
                          <Text style={styles.subError}>{sub.error}</Text>
                        ) : (
                          sub.result?.map((s, idx) => (
                            <Text key={idx} style={styles.subResultText}>
                              <Text style={{ fontFamily: fonts.bodyExtraBold }}>{s.name}</Text> — {s.note}
                            </Text>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      {showManual ? (
        <View style={styles.manualForm}>
          <TextInput
            value={manualName}
            onChangeText={setManualName}
            placeholder={t('grocery.itemNamePlaceholder')}
            placeholderTextColor={colors.tertiaryText}
            style={styles.manualInput}
          />
          <TextInput
            value={manualQty}
            onChangeText={setManualQty}
            placeholder={t('grocery.qtyOptionalPlaceholder')}
            placeholderTextColor={colors.tertiaryText}
            style={styles.manualInput}
          />
          <Pressable onPress={onAddManual} style={styles.manualAddBtn}>
            <Text style={styles.manualAddBtnText}>{t('grocery.addItem')}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setShowManual(true)} style={{ marginTop: 16 }}>
          <Text style={styles.addManualText}>＋ {t('grocery.addItemManually')}</Text>
        </Pressable>
      )}

      {total > 0 && <PillButton label={t('grocery.clearList')} onPress={onClear} variant="secondary" style={{ marginTop: 24 }} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.ink, letterSpacing: -0.5 },
  shareBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  subline: { fontSize: 13, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, marginTop: 4 },
  diasporaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, padding: 14, borderRadius: radii.lg, backgroundColor: colors.gold },
  diasporaTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.goldTextDeep },
  diasporaSub: { fontSize: 12, color: colors.goldTextMid, marginTop: 2 },
  subsBox: { marginTop: 10, padding: 13, borderRadius: 14, backgroundColor: colors.white },
  subsText: { fontSize: 12.5, color: colors.sageText, lineHeight: 19 },
  scanLink: { marginTop: 14, alignItems: 'center' },
  scanLinkText: { color: colors.tealLink, fontFamily: fonts.bodyBold, fontSize: 13 },
  groupName: { fontFamily: fonts.heading, fontSize: 17, color: colors.ink, marginBottom: 9 },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, paddingHorizontal: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  subBtn: { marginLeft: 10, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(23,137,123,0.35)' },
  subBtnText: { fontSize: 11.5, fontFamily: fonts.bodyBold, color: colors.tealLink },
  subPanel: { paddingBottom: 14, paddingLeft: 34, gap: 6 },
  subResultText: { fontSize: 13, color: colors.sageText, lineHeight: 19 },
  subError: { fontSize: 13, color: colors.coralSoft },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.borderMuted, alignItems: 'center', justifyContent: 'center' },
  checkTick: { color: colors.deepGreen, fontSize: 13, fontWeight: '800' },
  itemName: { flex: 1, fontSize: 14, color: colors.ink, fontFamily: fonts.body },
  itemQty: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.secondaryText },
  addManualText: { textAlign: 'center', color: colors.tealLink, fontFamily: fonts.bodyBold, fontSize: 14 },
  manualForm: { marginTop: 16, gap: 10 },
  manualInput: { height: 48, backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 16, fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.ink },
  manualAddBtn: { height: 48, backgroundColor: colors.deepGreen, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  manualAddBtnText: { color: colors.mint, fontFamily: fonts.bodyBold, fontSize: 14 },
});
