import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { PlanDay, Recipe, MealSlot } from '../types/models';
import { getPlan, autoFillWeek, clearWeek } from '../storage/plan';
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

  const onAutoFill = async () => {
    if (recipes.length === 0) {
      Alert.alert('No recipes yet', 'Add some recipes first, then Auto-fill can build out your week.');
      return;
    }
    const next = await autoFillWeek(recipes);
    setPlan(next);
  };

  const onClearWeek = () => {
    Alert.alert('Clear this week', 'This empties every meal slot for the week.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          const next = await clearWeek();
          setPlan(next);
        },
      },
    ]);
  };

  // A filled slot's whole purpose here is to show what's planned, so tapping
  // it goes straight to that recipe; an empty slot has nothing to show, so
  // tapping it goes to the same place "Edit day" does — there's no separate
  // per-slot picker on this screen any more (see EditDayPlanScreen).
  const onSlotPress = (dayIndex: number, recipeId: string | null) => {
    if (recipeId) {
      navigation.navigate('RecipeDetail', { recipeId });
    } else {
      navigation.navigate('EditDayPlan', { dayIndex });
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Meal Planner</Text>
      </View>

      <View style={styles.toolbarRow}>
        <Pressable onPress={onAutoFill} style={styles.autoFillBtn}>
          <Text style={styles.autoFillText}>✨ Auto-fill</Text>
        </Pressable>
        <Pressable onPress={onClearWeek} style={styles.clearWeekBtn}>
          <Text style={styles.clearWeekText}>Clear week</Text>
        </Pressable>
      </View>

      <View style={{ gap: 12, marginTop: 16 }}>
        {plan.map((day, di) => (
          <View key={day.day} style={[styles.dayCard, shadow.soft]}>
            <View style={styles.dayRow}>
              <View style={styles.dateChip}>
                <Text style={styles.dateChipDay}>{day.day}</Text>
                <Text style={styles.dateChipNum}>{day.date}</Text>
              </View>
              <View style={styles.slotGrid}>
                {SLOTS.map(({ key, label }) => (
                  <Pressable key={key} onPress={() => onSlotPress(di, day[key])} style={styles.slotCell}>
                    <Text style={styles.slotLabel}>{label}</Text>
                    <Text style={styles.slotValue} numberOfLines={1}>
                      {labelFor(day[key])}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable onPress={() => navigation.navigate('EditDayPlan', { dayIndex: di })} style={styles.editDayBtn}>
              <Text style={styles.editDayText}>✎ Edit day</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.ink, letterSpacing: -0.5 },
  toolbarRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  autoFillBtn: { backgroundColor: colors.teal, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13 },
  autoFillText: { color: colors.deepGreenLight, fontFamily: fonts.bodyBold, fontSize: 13, textAlign: 'center' },
  clearWeekBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 13, borderWidth: 1, borderColor: colors.borderMuted },
  clearWeekText: { color: colors.tealLink, fontFamily: fonts.bodyBold, fontSize: 12, textAlign: 'center' },
  dayCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 13 },
  dayRow: { flexDirection: 'row', gap: 10 },
  dateChip: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  dateChipDay: { fontSize: 9, fontFamily: fonts.bodyExtraBold, color: colors.tealLink },
  dateChipNum: { fontFamily: fonts.heading, fontSize: 15, color: colors.deepGreen },
  slotGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slotCell: { width: '48.5%', borderRadius: 9, padding: 8, backgroundColor: '#F6F4EE', borderWidth: 1, borderColor: colors.divider },
  slotLabel: { fontSize: 8.5, fontFamily: fonts.bodyExtraBold, color: colors.tealDark, letterSpacing: 0.3 },
  slotValue: { fontSize: 11, fontFamily: fonts.bodySemiBold, color: '#2C4642', marginTop: 2 },
  editDayBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.divider },
  editDayText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.tealLink },
});
