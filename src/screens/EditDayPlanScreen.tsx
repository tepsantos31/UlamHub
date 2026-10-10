import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PlanDay, Recipe } from '../types/models';
import { getPlan, fillDish, addDish } from '../storage/plan';
import { listRecipes } from '../storage/recipes';

type Props = NativeStackScreenProps<RootStackParamList, 'EditDayPlan'>;

export function EditDayPlanScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { dayIndex } = route.params;
  const [day, setDay] = useState<PlanDay | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  // The picker modal is shared between replacing an existing dish
  // (editingIndex points at it) and appending a new one (addingNew) — only
  // one of the two is ever active at a time.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);

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
  const labelFor = (val: string | null) => (val ? byId.get(val)?.name ?? val : t('editDayPlan.notSet'));

  const pickerOpen = editingIndex !== null || addingNew;

  const closePicker = () => {
    setEditingIndex(null);
    setAddingNew(false);
  };

  const pickRecipe = async (recipeId: string) => {
    const next = addingNew ? await addDish(dayIndex, recipeId) : editingIndex !== null ? await fillDish(dayIndex, editingIndex, recipeId) : null;
    if (next) setDay(next[dayIndex] ?? null);
    closePicker();
  };

  const clearDish = async () => {
    if (editingIndex === null) return;
    const next = await fillDish(dayIndex, editingIndex, null);
    setDay(next[dayIndex] ?? null);
    closePicker();
  };

  const currentValue = editingIndex !== null && day ? day.dishes[editingIndex] : null;

  if (!day) return null;

  return (
    <Screen withTabBarSpace={false} scroll={false}>
      <HeaderBar title={t('editDayPlan.editDay', { day: day.day })} onBack={() => navigation.goBack()} />
      <Text style={styles.subtitle}>{t('editDayPlan.subtitle')}</Text>

      <View style={{ gap: 10, marginTop: 16 }}>
        {day.dishes.map((val, idx) => (
          <Pressable key={idx} onPress={() => setEditingIndex(idx)} style={[styles.slotRow, shadow.soft]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.slotValue}>{labelFor(val)}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setAddingNew(true)} style={styles.addDishBtn}>
          <Text style={styles.addDishText}>＋ {t('editDayPlan.addADish')}</Text>
        </Pressable>
      </View>

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={closePicker}>
        <Pressable style={styles.modalScrim} onPress={closePicker} />
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{t('editDayPlan.chooseARecipe')}</Text>
          {editingIndex !== null && currentValue && (
            <Pressable onPress={clearDish} style={styles.clearRow}>
              <Text style={styles.clearRowText}>✕ {t('editDayPlan.clearThisDish')}</Text>
            </Pressable>
          )}
          <FlatList
            data={recipes}
            keyExtractor={(r) => r.id}
            style={{ maxHeight: 420 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => pickRecipe(item.id)} style={styles.modalRow}>
                <Text style={[styles.modalRowName, item.id === currentValue && styles.modalRowNameActive]}>{item.name}</Text>
                <Text style={styles.modalRowMeta}>{item.id === currentValue ? `✓ ${t('editDayPlan.selected')}` : item.country}</Text>
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
  slotValue: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.ink },
  chevron: { fontSize: 22, color: colors.tertiaryText, fontFamily: fonts.bodyBold },
  addDishBtn: {
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderMuted,
  },
  addDishText: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.tealLink },
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
