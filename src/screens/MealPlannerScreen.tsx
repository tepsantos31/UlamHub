import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { PlanDay, Recipe, MealSlot } from '../types/models';
import { getPlan, fillSlot, autoFillWeek, computeWeekBudget } from '../storage/plan';
import { listRecipes } from '../storage/recipes';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SLOTS: { key: MealSlot; label: string }[] = [
  { key: 'breakfast', label: 'BREAKFAST' },
  { key: 'lunch', label: 'LUNCH' },
  { key: 'merienda', label: 'SNACK' },
  { key: 'dinner', label: 'DINNER' },
];

export function MealPlannerScreen() {
  const navigation = useNavigation<Nav>();
  const [plan, setPlan] = useState<PlanDay[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [picker, setPicker] = useState<{ dayIndex: number; slot: MealSlot } | null>(null);

  const reload = useCallback(async () => {
    const [p, r] = await Promise.all([getPlan(), listRecipes()]);
    setPlan(p);
    setRecipes(r);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const byId = new Map(recipes.map((r) => [r.id, r]));
  const labelFor = (val: string | null) => (val ? byId.get(val)?.name ?? val : '+');
  const budget = computeWeekBudget(plan, recipes);

  const onAutoFill = async () => {
    const next = await autoFillWeek();
    setPlan(next);
  };

  const pickRecipe = async (recipeId: string) => {
    if (!picker) return;
    const next = await fillSlot(picker.dayIndex, picker.slot, recipeId);
    setPlan(next);
    setPicker(null);
  };

  const clearSlot = async () => {
    if (!picker) return;
    const next = await fillSlot(picker.dayIndex, picker.slot, null);
    setPlan(next);
    setPicker(null);
  };

  const currentPickerValue = picker ? plan[picker.dayIndex]?.[picker.slot] : null;

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Meal Planner</Text>
      </View>

      <View style={styles.budgetCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.budgetEyebrow}>THIS WEEK'S BUDGET</Text>
          <Text style={styles.budgetVal}>
            ${budget} <Text style={styles.budgetOf}>/ $100</Text>
          </Text>
        </View>
        <Pressable onPress={onAutoFill} style={styles.autoFillBtn}>
          <Text style={styles.autoFillText}>✨ Auto-fill</Text>
        </Pressable>
      </View>

      <View style={{ gap: 12, marginTop: 18 }}>
        {plan.map((day, di) => (
          <View key={day.day} style={[styles.dayCard, shadow.soft]}>
            <View style={styles.dayRow}>
              <View style={styles.dateChip}>
                <Text style={styles.dateChipDay}>{day.day}</Text>
                <Text style={styles.dateChipNum}>{day.date}</Text>
              </View>
              <View style={styles.slotGrid}>
                {SLOTS.map(({ key, label }) => (
                  <Pressable key={key} onPress={() => setPicker({ dayIndex: di, slot: key })} style={styles.slotCell}>
                    <Text style={styles.slotLabel}>{label}</Text>
                    <Text style={styles.slotValue} numberOfLines={1}>
                      {labelFor(day[key])}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ))}
      </View>

      <Modal visible={!!picker} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setPicker(null)} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Choose a recipe</Text>
          {currentPickerValue && (
            <Pressable onPress={clearSlot} style={styles.clearRow}>
              <Text style={styles.clearRowText}>✕ Clear this meal</Text>
            </Pressable>
          )}
          <FlatList
            data={recipes}
            keyExtractor={(r) => r.id}
            style={{ maxHeight: 420 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => pickRecipe(item.id)} style={styles.modalRow}>
                <Text style={[styles.modalRowName, item.id === currentPickerValue && styles.modalRowNameActive]}>{item.name}</Text>
                <Text style={styles.modalRowMeta}>{item.id === currentPickerValue ? '✓ Selected' : item.country}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.ink, letterSpacing: -0.5 },
  budgetCard: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.deepGreen, borderRadius: radii.lg, padding: 17 },
  budgetEyebrow: { fontSize: 11.5, color: colors.tealDark, fontFamily: fonts.bodyBold },
  budgetVal: { fontFamily: fonts.heading, fontSize: 22, color: colors.mint, marginTop: 2 },
  budgetOf: { fontSize: 13, color: colors.tealDark, fontFamily: fonts.bodySemiBold },
  autoFillBtn: { backgroundColor: colors.teal, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13 },
  autoFillText: { color: colors.deepGreenLight, fontFamily: fonts.bodyBold, fontSize: 13 },
  dayCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 13 },
  dayRow: { flexDirection: 'row', gap: 10 },
  dateChip: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  dateChipDay: { fontSize: 9, fontFamily: fonts.bodyExtraBold, color: colors.tealLink },
  dateChipNum: { fontFamily: fonts.heading, fontSize: 15, color: colors.deepGreen },
  slotGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slotCell: { width: '48.5%', borderRadius: 9, padding: 8, backgroundColor: '#F6F4EE', borderWidth: 1, borderColor: colors.divider },
  slotLabel: { fontSize: 8.5, fontFamily: fonts.bodyExtraBold, color: colors.tealDark, letterSpacing: 0.3 },
  slotValue: { fontSize: 11, fontFamily: fonts.bodySemiBold, color: '#2C4642', marginTop: 2 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: colors.screenBg, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: 20, paddingBottom: 34 },
  modalTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink, marginBottom: 12 },
  clearRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  clearRowText: { color: colors.coralSoft, fontFamily: fonts.bodyExtraBold, fontSize: 13.5 },
  modalRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.divider, flexDirection: 'row', justifyContent: 'space-between' },
  modalRowName: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: colors.ink },
  modalRowNameActive: { color: colors.tealLink, fontFamily: fonts.bodyExtraBold },
  modalRowMeta: { fontSize: 12.5, color: colors.secondaryText, fontFamily: fonts.bodySemiBold },
});
