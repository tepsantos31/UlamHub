import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, Share, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { ShareIcon } from '../components/Icon';
import { GroceryGroup } from '../types/models';
import { getGrocery, toggleGroceryItem, addManualItem, regenerateFromPlan } from '../storage/grocery';
import { getPlan } from '../storage/plan';
import { listRecipes } from '../storage/recipes';
import { getOnboarding, setOnboarding } from '../storage/onboarding';
import { ABROAD_SUBSTITUTIONS } from '../storage/seed';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function GroceryListScreen() {
  const navigation = useNavigation<Nav>();
  const [groups, setGroups] = useState<GroceryGroup[]>([]);
  const [diaspora, setDiaspora] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('');
  const [showManual, setShowManual] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [plan, recipes, onboarding] = await Promise.all([getPlan(), listRecipes(), getOnboarding()]);
        const g = await regenerateFromPlan(plan, recipes);
        setGroups(g);
        setDiaspora(onboarding.quiz.diaspora);
      })();
    }, []),
  );

  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const done = groups.reduce((a, g) => a + g.items.filter((i) => i.checked).length, 0);

  const onToggle = async (gi: number, ii: number) => {
    const next = await toggleGroceryItem(gi, ii);
    setGroups(next);
  };

  const onToggleDiaspora = async () => {
    const onboarding = await getOnboarding();
    const nextVal = !diaspora;
    await setOnboarding({ ...onboarding, quiz: { ...onboarding.quiz, diaspora: nextVal } });
    setDiaspora(nextVal);
  };

  const shareList = () => {
    const lines = groups.flatMap((g) => [`${g.name}:`, ...g.items.map((it) => `  ${it.checked ? '✓' : '•'} ${it.n} ${it.q}`.trim())]);
    Share.share({ message: lines.join('\n') || 'My Ulam grocery list is empty right now.' });
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
        <Text style={styles.title}>Grocery List</Text>
        <Pressable onPress={shareList} style={[styles.shareBtn, shadow.soft]}>
          <ShareIcon size={18} color="#2C4642" />
        </Pressable>
      </View>
      <Text style={styles.subline}>
        {done} of {total} items · from this week's plan
      </Text>

      <View style={styles.diasporaRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.diasporaTitle}>Cooking abroad?</Text>
          <Text style={styles.diasporaSub}>Get substitutes & find the nearest specialty grocery store</Text>
        </View>
        <ToggleSwitch value={diaspora} onValueChange={onToggleDiaspora} />
      </View>
      {diaspora && (
        <View style={styles.subsBox}>
          <Text style={styles.subsText}>
            🔁 Substituting:{' '}
            {ABROAD_SUBSTITUTIONS.map(([a, b]) => (
              <Text key={a} style={{ fontFamily: fonts.bodyBold }}>
                {a} → {b}
                {'  '}
              </Text>
            ))}
            <Text
              style={{ color: colors.tealLink, fontFamily: fonts.bodyBold }}
              onPress={() => Alert.alert('Store locator', 'This would open a map of nearby specialty grocery stores.')}
            >
              Find nearest specialty store →
            </Text>
          </Text>
        </View>
      )}

      <Pressable onPress={() => navigation.navigate('IngredientScanner')} style={styles.scanLink}>
        <Text style={styles.scanLinkText}>🔍 Don't recognize an ingredient? Scan it</Text>
      </Pressable>

      <View style={{ gap: 16, marginTop: 20 }}>
        {groups.map((g, gi) => (
          <View key={g.name}>
            <Text style={styles.groupName}>{g.name}</Text>
            <View style={styles.card}>
              {g.items.map((it, ii) => (
                <Pressable
                  key={it.n}
                  onPress={() => onToggle(gi, ii)}
                  style={[styles.itemRow, ii !== g.items.length - 1 && styles.rowBorder]}
                >
                  <View style={[styles.checkbox, it.checked && { backgroundColor: colors.teal, borderColor: colors.teal }]}>
                    {it.checked && <Text style={styles.checkTick}>✓</Text>}
                  </View>
                  <Text style={[styles.itemName, it.checked && { color: colors.tertiaryText, textDecorationLine: 'line-through' }]}>
                    {it.n}
                  </Text>
                  <Text style={styles.itemQty}>{it.q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </View>

      {showManual ? (
        <View style={styles.manualForm}>
          <TextInput
            value={manualName}
            onChangeText={setManualName}
            placeholder="Item name"
            placeholderTextColor={colors.tertiaryText}
            style={styles.manualInput}
          />
          <TextInput
            value={manualQty}
            onChangeText={setManualQty}
            placeholder="Qty (optional)"
            placeholderTextColor={colors.tertiaryText}
            style={styles.manualInput}
          />
          <Pressable onPress={onAddManual} style={styles.manualAddBtn}>
            <Text style={styles.manualAddBtnText}>Add item</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setShowManual(true)} style={{ marginTop: 16 }}>
          <Text style={styles.addManualText}>＋ Add item manually</Text>
        </Pressable>
      )}
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
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
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
