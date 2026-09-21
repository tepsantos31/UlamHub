import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, FlatList, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { Chip } from '../components/Chip';
import { PillButton } from '../components/PillButton';
import { generatePartyPlan, PartyPlan } from '../api/client';
import { getPlan, fillSlot } from '../storage/plan';
import { addMissingIngredientsToGrocery } from '../storage/grocery';
import { Recipe } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'PartyPlanner'>;

const OCCASIONS = ['Party', 'Birthday', 'Holiday Gathering', 'Reunion', 'Just Because'];
const COURSE_TINT: Record<string, string> = { Main: colors.mint, Side: colors.gold, Dessert: colors.coralBg, Drinks: '#E2ECE4' };
const COURSE_FG: Record<string, string> = { Main: colors.tealLink, Side: colors.goldText, Dessert: colors.coralSoft, Drinks: '#5FA37A' };

export function PartyPlannerScreen({ navigation }: Props) {
  const [guestCount, setGuestCount] = useState(10);
  const [occasion, setOccasion] = useState(OCCASIONS[0]);
  const [budget, setBudget] = useState('150');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PartyPlan | null>(null);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [addedGrocery, setAddedGrocery] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const result = await generatePartyPlan({
        guestCount,
        occasion,
        budgetTotal: parseFloat(budget) || undefined,
      });
      setPlan(result);
      setAddedGrocery(false);
    } catch (e: any) {
      Alert.alert('Planning failed', e?.message ?? 'Could not reach the AI backend. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const assignToDay = async (dayIndex: number) => {
    if (!plan) return;
    const summary = plan.courses.map((c) => c.dishName).join(', ');
    await fillSlot(dayIndex, 'dinner', summary);
    setDayPickerOpen(false);
    Alert.alert('Added to plan', `"${plan.theme}" is set as dinner for that day. Check the Meal Planner tab.`);
  };

  const addShoppingList = async () => {
    if (!plan) return;
    const pseudoRecipe: Recipe = {
      id: 'party-temp',
      name: plan.theme,
      country: 'Mixed',
      type: 'Party',
      time: 0,
      kcal: 0,
      rating: 0,
      cooks: 0,
      budget: '$$',
      diff: 'Home cook',
      author: 'You',
      servingsBase: guestCount,
      ingredients: plan.shoppingList,
      steps: [],
      nutrition: { protein: 0, carbs: 0, fat: 0, sodium: 0, fiber: 0 },
      saucePairings: [],
      flavorBalance: [],
    };
    await addMissingIngredientsToGrocery(pseudoRecipe);
    setAddedGrocery(true);
  };

  return (
    <Screen>
      <HeaderBar onBack={() => navigation.goBack()} />
      <View style={styles.badge}>
        <Text style={{ fontSize: 22 }}>🎉</Text>
      </View>
      <Text style={styles.title}>Party Planner</Text>
      <Text style={styles.subtitle}>Tell me the guest count, occasion, and budget — I'll build the whole spread.</Text>

      <Text style={styles.label}>How many guests?</Text>
      <View style={styles.stepperRow}>
        <Pressable onPress={() => setGuestCount((g) => Math.max(2, g - 2))} style={styles.stepperBtn}>
          <Text style={styles.stepperBtnText}>–</Text>
        </Pressable>
        <Text style={styles.stepperVal}>{guestCount}</Text>
        <Pressable onPress={() => setGuestCount((g) => Math.min(200, g + 2))} style={styles.stepperBtn}>
          <Text style={styles.stepperBtnText}>+</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Occasion</Text>
      <View style={styles.chipWrap}>
        {OCCASIONS.map((o) => (
          <Chip key={o} label={o} active={occasion === o} onPress={() => setOccasion(o)} small />
        ))}
      </View>

      <Text style={styles.label}>Budget (USD)</Text>
      <TextInput
        value={budget}
        onChangeText={setBudget}
        keyboardType="numeric"
        placeholder="150"
        placeholderTextColor={colors.tertiaryText}
        style={styles.budgetInput}
      />

      <PillButton label="✨ Generate spread" onPress={generate} loading={loading} style={{ marginTop: 22 }} />

      {plan && (
        <View style={styles.resultWrap}>
          <Text style={styles.themeTitle}>{plan.theme}</Text>
          <Text style={styles.budgetEstimate}>Estimated budget: ${plan.estimatedBudget}</Text>

          <Text style={styles.h2}>The spread</Text>
          <View style={{ gap: 10 }}>
            {plan.courses.map((c, i) => (
              <View key={i} style={styles.courseCard}>
                <View style={[styles.courseTag, { backgroundColor: COURSE_TINT[c.course] ?? colors.mint }]}>
                  <Text style={[styles.courseTagText, { color: COURSE_FG[c.course] ?? colors.tealLink }]}>{c.course}</Text>
                </View>
                <Text style={styles.dishName}>{c.dishName}</Text>
                <Text style={styles.dishDesc}>{c.description}</Text>
                <Text style={styles.servesNote}>{c.servesNote}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.h2}>Prep timeline</Text>
          <View style={{ gap: 10 }}>
            {plan.timeline
              .slice()
              .sort((a, b) => b.hoursBeforeGuests - a.hoursBeforeGuests)
              .map((t, i) => (
                <View key={i} style={styles.timelineRow}>
                  <View style={styles.timelineBadge}>
                    <Text style={styles.timelineBadgeText}>
                      {t.hoursBeforeGuests >= 1 ? `${t.hoursBeforeGuests}h before` : 'Right before'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineLabel}>{t.label}</Text>
                    <Text style={styles.timelineNote}>{t.note}</Text>
                  </View>
                </View>
              ))}
          </View>

          <View style={styles.actionsRow}>
            <PillButton label="Add to Planner" onPress={() => setDayPickerOpen(true)} variant="secondary" style={{ flex: 1 }} />
            <PillButton
              label={addedGrocery ? 'Added ✓' : 'Add to grocery list'}
              onPress={addShoppingList}
              disabled={addedGrocery}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}

      <Modal visible={dayPickerOpen} animationType="slide" transparent onRequestClose={() => setDayPickerOpen(false)}>
        <Pressable style={styles.modalScrim} onPress={() => setDayPickerOpen(false)} />
        <DayPicker onPick={assignToDay} />
      </Modal>
    </Screen>
  );
}

function DayPicker({ onPick }: { onPick: (dayIndex: number) => void }) {
  const [days, setDays] = React.useState<{ day: string; date: string }[]>([]);
  React.useEffect(() => {
    getPlan().then((p) => setDays(p.map((d) => ({ day: d.day, date: d.date }))));
  }, []);
  return (
    <View style={styles.modalSheet}>
      <Text style={styles.modalTitle}>Which day is the party?</Text>
      <FlatList
        data={days}
        keyExtractor={(d, i) => `${d.day}-${i}`}
        renderItem={({ item, index }) => (
          <Pressable onPress={() => onPick(index)} style={styles.modalRow}>
            <Text style={styles.modalRowName}>
              {item.day} {item.date}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginTop: 14 },
  subtitle: { fontSize: 14, color: colors.sageMuted, marginTop: 8, lineHeight: 21 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginTop: 22, marginBottom: 10 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.white, borderRadius: radii.lg, padding: 12, alignSelf: 'flex-start', paddingHorizontal: 20 },
  stepperBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { fontWeight: '800', fontSize: 19, color: colors.tealLink },
  stepperVal: { fontFamily: fonts.bodyExtraBold, fontSize: 19, minWidth: 30, textAlign: 'center', color: colors.ink },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  budgetInput: { height: 48, backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 16, fontSize: 14, color: colors.ink },
  resultWrap: { marginTop: 28 },
  themeTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink },
  budgetEstimate: { fontSize: 13, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, marginTop: 4 },
  h2: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginTop: 22, marginBottom: 10 },
  courseCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 14 },
  courseTag: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
  courseTagText: { fontSize: 10.5, fontFamily: fonts.bodyExtraBold },
  dishName: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.ink },
  dishDesc: { fontSize: 12.5, color: colors.sageText, marginTop: 3, lineHeight: 18 },
  servesNote: { fontSize: 11.5, color: colors.tertiaryText, marginTop: 5, fontFamily: fonts.bodySemiBold },
  timelineRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timelineBadge: { backgroundColor: colors.deepGreen, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 92, alignItems: 'center' },
  timelineBadgeText: { color: colors.mint, fontSize: 10.5, fontFamily: fonts.bodyBold, textAlign: 'center' },
  timelineLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  timelineNote: { fontSize: 12.5, color: colors.sageText, marginTop: 2, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: colors.screenBg, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: 20, paddingBottom: 34 },
  modalTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink, marginBottom: 12 },
  modalRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.divider },
  modalRowName: { fontFamily: fonts.bodySemiBold, fontSize: 14.5, color: colors.ink },
});
