import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PlanDay, Recipe, MealSlot } from '../types/models';
import { getPlan, fillSlot } from '../storage/plan';
import { listRecipes } from '../storage/recipes';

type Props = NativeStackScreenProps<RootStackParamList, 'EditDayPlan'>;

const SLOTS: { key: MealSlot; label: string }[] = [
  { key: 'breakfast', label: 'BREAKFAST' },
  { key: 'lunch', label: 'LUNCH' },
  { key: 'merienda', label: 'SNACK' },
  { key: 'dinner', label: 'DINNER' },
];

export function EditDayPlanScreen({ route, navigation }: Props) {
  const { dayIndex } = route.params;
  const [day, setDay] = useState<PlanDay | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeSlot, setActiveSlot] = useState<MealSlot | null>(null);

  const reload = useCallback(async () => {
    const [plan, r] = await Promise.all([getPlan(), listRecipes()]);
    setDay(plan[dayIndex] ?? null);
    setRecipes(r);
  }, [dayIndex]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const byId = new Map(recipes.map((r) => [r.id, r]));
  const labelFor = (val: string | null) => (val ? byId.get(val)?.name ?? val : 'Not set');

  const pickRecipe = async (recipeId: string) => {
    if (!activeSlot) return;
    const next = await fillSlot(dayIndex, activeSlot, recipeId);
    setDay(next[dayIndex] ?? null);
    setActiveSlot(null);
  };

  const clearSlot = async () => {
    if (!activeSlot) return;
    const next = await fillSlot(dayIndex, activeSlot, null);
    setDay(next[dayIndex] ?? null);
    setActiveSlot(null);
  };

  const currentSlotValue = activeSlot && day ? day[activeSlot] : null;

  if (!day) return null;

  return (
    <Screen withTabBarSpace={false} scroll={false}>
      <HeaderBar title={`Edit ${day.day}`} onBack={() => navigation.goBack()} />
      <Text style={styles.subtitle}>Select or replace the dish for each meal.</Text>

      <View style={{ gap: 10, marginTop: 16 }}>
        {SLOTS.map(({ key, label }) => (
          <Pressable key={key} onPress={() => setActiveSlot(key)} style={[styles.slotRow, shadow.soft]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.slotLabel}>{label}</Text>
              <Text style={styles.slotValue}>{labelFor(day[key])}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>

      <Modal visible={!!activeSlot} animationType="slide" transparent onRequestClose={() => setActiveSlot(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setActiveSlot(null)} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Choose a recipe</Text>
          {currentSlotValue && (
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
                <Text style={[styles.modalRowName, item.id === currentSlotValue && styles.modalRowNameActive]}>{item.name}</Text>
                <Text style={styles.modalRowMeta}>{item.id === currentSlotValue ? '✓ Selected' : item.country}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 13.5, color: colors.sageMuted, marginTop: 8, lineHeight: 20 },
  slotRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radii.lg, padding: 16 },
  slotLabel: { fontSize: 10.5, fontFamily: fonts.bodyExtraBold, color: colors.tealDark, letterSpacing: 0.3 },
  slotValue: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.ink, marginTop: 4 },
  chevron: { fontSize: 22, color: colors.tertiaryText, fontFamily: fonts.bodyBold },
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
