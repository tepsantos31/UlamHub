import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { PlanDay, Recipe } from '../types/models';
import { getPlan, autoFillWeek, clearWeek } from '../storage/plan';
import { listRecipes } from '../storage/recipes';
import { addRecipesToGrocery } from '../storage/grocery';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MealPlannerScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const [plan, setPlan] = useState<PlanDay[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [addedDay, setAddedDay] = useState<number | null>(null);

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

  const onAutoFill = async () => {
    if (recipes.length === 0) {
      Alert.alert(t('mealPlanner.alerts.noRecipesTitle'), t('mealPlanner.alerts.noRecipesBody'));
      return;
    }
    const next = await autoFillWeek(recipes);
    setPlan(next);
  };

  const onClearWeek = () => {
    Alert.alert(t('mealPlanner.alerts.clearWeekTitle'), t('mealPlanner.alerts.clearWeekBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('mealPlanner.clear'),
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
  const onDishPress = (dayIndex: number, recipeId: string | null) => {
    if (recipeId) {
      navigation.navigate('RecipeDetail', { recipeId });
    } else {
      navigation.navigate('EditDayPlan', { dayIndex });
    }
  };

  // Meal planning no longer syncs to the grocery list on its own — this is
  // the only way a day's ingredients end up there.
  const onAddToGrocery = async (day: PlanDay, dayIndex: number) => {
    const dayRecipes = day.dishes.map((id) => (id ? byId.get(id) : null)).filter((r): r is Recipe => !!r);
    if (dayRecipes.length === 0) {
      Alert.alert(t('mealPlanner.alerts.nothingToAddTitle'), t('mealPlanner.alerts.nothingToAddBody'));
      return;
    }
    await addRecipesToGrocery(dayRecipes);
    setAddedDay(dayIndex);
    setTimeout(() => setAddedDay((d) => (d === dayIndex ? null : d)), 1800);
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('mealPlanner.title')}</Text>
      </View>

      <View style={styles.toolbarRow}>
        <Pressable onPress={onAutoFill} style={styles.autoFillBtn}>
          <Text style={styles.autoFillText}>✨ {t('mealPlanner.autoFill')}</Text>
        </Pressable>
        <Pressable onPress={onClearWeek} style={styles.clearWeekBtn}>
          <Text style={styles.clearWeekText}>{t('mealPlanner.clearWeek')}</Text>
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
                {day.dishes.map((recipeId, slotIdx) => (
                  <Pressable key={slotIdx} onPress={() => onDishPress(di, recipeId)} style={styles.slotCell}>
                    <Text style={[styles.slotValue, !recipeId && styles.slotValueEmpty]} numberOfLines={2}>
                      {recipeId ? byId.get(recipeId)?.name ?? recipeId : `+ ${t('mealPlanner.addADish')}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.dayActions}>
              <Pressable onPress={() => navigation.navigate('EditDayPlan', { dayIndex: di })} style={styles.dayActionBtn}>
                <Text style={styles.editDayText}>✎ {t('mealPlanner.editDay')}</Text>
              </Pressable>
              <View style={styles.dayActionDivider} />
              <Pressable onPress={() => onAddToGrocery(day, di)} style={styles.dayActionBtn}>
                <Text style={styles.addGroceryText}>{addedDay === di ? `✓ ${t('mealPlanner.added')}` : `🧺 ${t('mealPlanner.addToGroceryList')}`}</Text>
              </Pressable>
            </View>
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
  slotCell: { width: '48.5%', borderRadius: 9, padding: 8, backgroundColor: '#F6F4EE', borderWidth: 1, borderColor: colors.divider, justifyContent: 'center', minHeight: 40 },
  slotValue: { fontSize: 12.5, fontFamily: fonts.bodySemiBold, color: '#2C4642' },
  slotValueEmpty: { color: colors.tertiaryText, fontFamily: fonts.bodyBold },
  dayActions: { flexDirection: 'row', alignItems: 'stretch', marginTop: 10, borderTopWidth: 1, borderTopColor: colors.divider },
  dayActionDivider: { width: 1, backgroundColor: colors.divider },
  dayActionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  editDayText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.tealLink },
  addGroceryText: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.tealLink },
});
