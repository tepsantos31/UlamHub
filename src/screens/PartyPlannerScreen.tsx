import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { Chip } from '../components/Chip';
import { PillButton } from '../components/PillButton';
import { PremiumGate } from '../components/PremiumGate';
import { listRecipes } from '../storage/recipes';
import { getSettings } from '../storage/settings';
import { getPartyPlan, setPartyPlan, clearPartyPlan, DEFAULT_PARTY_PLAN } from '../storage/partyPlan';
import { schedulePartyReminder, cancelPartyReminder } from '../lib/notifications';
import { isSubscriptionActive } from '../utils/subscription';
import { Recipe, SettingsState } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'PartyPlanner'>;

const OCCASIONS = ['Party', 'Birthday', 'Holiday Gathering', 'Reunion', 'Just Because'];
const DATE_OPTIONS_COUNT = 60;

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function nextDays(count: number): { iso: string; weekday: string; day: string; month: string }[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      iso,
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
      day: String(d.getDate()),
      month: d.toLocaleDateString(undefined, { month: 'short' }),
    };
  });
}

function formatIsoDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function dateMinusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** 9am on the reminder day — scheduled notifications need an actual Date,
 * not just the display string dateMinusDays produces. */
function reminderFireDate(iso: string, daysBefore: number): Date {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - daysBefore);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function PartyPlannerScreen({ route, navigation }: Props) {
  const [occasion, setOccasion] = useState(DEFAULT_PARTY_PLAN.occasion);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [selectedDishes, setSelectedDishes] = useState<Recipe[]>([]);
  const [partyDate, setPartyDate] = useState<string | null>(null);
  const [remindDaysBefore, setRemindDaysBefore] = useState(3);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);
  const [dateOptions] = useState(() => nextDays(DATE_OPTIONS_COUNT));
  const hydratedRef = useRef(false);
  const notificationIdRef = useRef<string | null>(null);

  // The dish count is never independent state — it's always exactly how
  // many dishes are currently in the spread, so it can't drift out of sync
  // with the actual list.
  const dishCount = selectedDishes.length;

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [s, recipes] = await Promise.all([getSettings(), listRecipes()]);
        setSettingsState(s);
        setAllRecipes(recipes);
        // This whole screen's useFocusEffect reruns every time you come back
        // to it (e.g. after picking dishes). Without hydratedRef, each
        // refocus would re-load the last *saved* plan and stomp over
        // whatever the user has changed but not saved yet.
        if (!hydratedRef.current) {
          hydratedRef.current = true;
          const saved = await getPartyPlan();
          const byId = new Map(recipes.map((r) => [r.id, r]));
          setSelectedDishes(saved.dishIds.map((id) => byId.get(id)).filter((r): r is Recipe => !!r));
          setOccasion(saved.occasion);
          setPartyDate(saved.partyDate);
          notificationIdRef.current = saved.notificationId;
          setRemindDaysBefore(saved.remindDaysBefore ?? 3);
        }
      })();
    }, []),
  );

  // Picked up after returning from SelectPartyDishesScreen — see its done().
  useFocusEffect(
    useCallback(() => {
      const ids = route.params?.selectedRecipeIds;
      if (!ids) return;
      listRecipes().then((recipes) => {
        const byId = new Map(recipes.map((r) => [r.id, r]));
        setSelectedDishes(ids.map((id) => byId.get(id)).filter((r): r is Recipe => !!r));
        navigation.setParams({ selectedRecipeIds: undefined });
      });
    }, [route.params?.selectedRecipeIds]),
  );

  const openPicker = () => {
    navigation.navigate('SelectPartyDishes', { limit: Math.max(allRecipes.length, 1), initialSelectedIds: selectedDishes.map((d) => d.id) });
  };

  const generate = () => {
    if (allRecipes.length === 0) {
      Alert.alert('No recipes yet', 'Add some recipes first, then I can put together a spread.');
      return;
    }
    const count = Math.min(dishCount || 6, allRecipes.length);
    setSelectedDishes(shuffled(allRecipes).slice(0, count));
  };

  const removeDish = (id: string) => {
    setSelectedDishes((prev) => prev.filter((d) => d.id !== id));
  };

  // "+"/"-" on "How many dishes" directly add/remove a dish, always from
  // your own recipe list — Select Dishes is still there for choosing
  // exactly which ones, this is just the quick one-at-a-time adjustment.
  const addOneDish = () => {
    const next = allRecipes.find((r) => !selectedDishes.some((d) => d.id === r.id));
    if (!next) {
      Alert.alert('No more recipes', "You've already added every recipe you have.");
      return;
    }
    setSelectedDishes((prev) => [...prev, next]);
  };

  const removeOneDish = () => {
    setSelectedDishes((prev) => prev.slice(0, -1));
  };

  const goHome = () => {
    navigation.navigate('Main', { screen: 'Home' });
  };

  const onSave = async () => {
    // Re-saving replaces any reminder already scheduled from a previous
    // save, rather than piling up duplicates for the same party.
    if (notificationIdRef.current) {
      await cancelPartyReminder(notificationIdRef.current);
      notificationIdRef.current = null;
    }
    let permissionDenied = false;
    // The "Party reminders" toggle in Profile > Notifications gates whether
    // this ever actually schedules something — the date/days-before choice
    // below is still saved either way, it just won't fire a reminder.
    if (settings?.notif.party && partyDate && remindDaysBefore != null) {
      const fireAt = reminderFireDate(partyDate, remindDaysBefore);
      const id = await schedulePartyReminder(fireAt, `${occasion} reminder`, `Your party is coming up — time to get ready!`);
      if (id) {
        notificationIdRef.current = id;
      } else if (fireAt.getTime() > Date.now()) {
        // A real denial, not just "the reminder date already passed".
        permissionDenied = true;
      }
    }
    await setPartyPlan({
      dishIds: selectedDishes.map((d) => d.id),
      dishCount,
      occasion,
      partyDate,
      remindDaysBefore,
      notificationId: notificationIdRef.current,
    });
    if (permissionDenied) {
      Alert.alert(
        'Saved — reminder not scheduled',
        "Your party plan is saved, but notification permission isn't granted, so the reminder won't fire. Enable notifications for Lutopia in your device Settings to turn that on.",
      );
    } else {
      Alert.alert('Saved', "Your party plan is saved — it'll be here next time you open Party Planner.");
    }
  };

  const onClear = () => {
    Alert.alert('Clear party plan', 'This resets your selected dishes, date, and reminder.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          if (notificationIdRef.current) {
            await cancelPartyReminder(notificationIdRef.current);
            notificationIdRef.current = null;
          }
          await clearPartyPlan();
          setSelectedDishes([]);
          setOccasion(DEFAULT_PARTY_PLAN.occasion);
          setPartyDate(null);
          setRemindDaysBefore(3);
        },
      },
    ]);
  };

  return (
    <Screen>
      <HeaderBar onBack={() => navigation.goBack()} />
      <View style={styles.badge}>
        <Text style={{ fontSize: 22 }}>🎉</Text>
      </View>
      <Text style={styles.title}>Party Planner</Text>
      <Text style={styles.subtitle}>Pick how many dishes you want, then choose them yourself or let me surprise you.</Text>

      {settings && !isSubscriptionActive(settings) ? (
        <PremiumGate
          icon="🎉"
          title="Party Planner is a Premium tool"
          body="Building a full spread is a Premium feature — subscribe to Lutopia Premium to unlock it."
          onGoPremium={() => navigation.navigate('Paywall')}
        />
      ) : (
        <>
          <Text style={styles.label}>How many dishes?</Text>
          <View style={styles.stepperRow}>
            <Pressable onPress={removeOneDish} disabled={dishCount === 0} style={[styles.stepperBtn, dishCount === 0 && styles.stepperBtnDisabled]}>
              <Text style={styles.stepperBtnText}>–</Text>
            </Pressable>
            <Text style={styles.stepperVal}>{dishCount}</Text>
            <Pressable onPress={addOneDish} style={styles.stepperBtn}>
              <Text style={styles.stepperBtnText}>+</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Occasion</Text>
          <View style={styles.chipWrap}>
            {OCCASIONS.map((o) => (
              <Chip key={o} label={o} active={occasion === o} onPress={() => setOccasion(o)} small />
            ))}
          </View>

          <Text style={styles.label}>When is the party?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {dateOptions.map((d) => {
              const active = partyDate === d.iso;
              return (
                <Pressable
                  key={d.iso}
                  onPress={() => setPartyDate(active ? null : d.iso)}
                  style={[styles.dateChip, active && styles.dateChipActive]}
                >
                  <Text style={[styles.dateChipWeekday, active && styles.dateChipTextActive]}>{d.weekday}</Text>
                  <Text style={[styles.dateChipDay, active && styles.dateChipTextActive]}>{d.day}</Text>
                  <Text style={[styles.dateChipMonth, active && styles.dateChipTextActive]}>{d.month}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {partyDate && <Text style={styles.dateChosenText}>🎉 {formatIsoDate(partyDate)}</Text>}

          {partyDate && (
            <>
              <Text style={styles.label}>Remind me how many days before?</Text>
              <View style={styles.stepperRow}>
                <Pressable onPress={() => setRemindDaysBefore((g) => Math.max(0, g - 1))} style={styles.stepperBtn}>
                  <Text style={styles.stepperBtnText}>–</Text>
                </Pressable>
                <Text style={styles.stepperVal}>{remindDaysBefore}</Text>
                <Pressable onPress={() => setRemindDaysBefore((g) => Math.min(30, g + 1))} style={styles.stepperBtn}>
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.reminderNote}>
                {remindDaysBefore === 0
                  ? "We'll remind you on the day of the party."
                  : `We'll remind you on ${dateMinusDays(partyDate, remindDaysBefore)}.`}
              </Text>
            </>
          )}

          <View style={styles.actionsRow}>
            <PillButton label="Select Dishes" onPress={openPicker} variant="secondary" style={{ flex: 1 }} />
            <PillButton label="✨ Generate spread" onPress={generate} style={{ flex: 1 }} />
          </View>

          {selectedDishes.length > 0 && (
            <View style={styles.resultWrap}>
              <Text style={styles.themeTitle}>{occasion} Spread</Text>
              <Text style={styles.budgetEstimate}>
                {selectedDishes.length} dish{selectedDishes.length === 1 ? '' : 'es'} selected
              </Text>

              <View style={{ gap: 10, marginTop: 16 }}>
                {selectedDishes.map((d) => (
                  <View key={d.id} style={styles.courseCard}>
                    <Pressable onPress={() => navigation.navigate('RecipeDetail', { recipeId: d.id })} style={{ flex: 1 }}>
                      <Text style={styles.dishName}>{d.name}</Text>
                      <Text style={styles.dishDesc}>
                        {d.country} · {d.type}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => removeDish(d.id)} style={styles.removeDishBtn}>
                      <Text style={styles.removeDishBtnText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.actionsRow}>
            <PillButton label="Clear" onPress={onClear} variant="secondary" style={{ flex: 1 }} />
            <PillButton label="Save" onPress={onSave} style={{ flex: 1 }} />
          </View>

          <PillButton label="Return to Homescreen" onPress={goHome} variant="secondary" style={{ marginTop: 12 }} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginTop: 14 },
  subtitle: { fontSize: 14, color: colors.sageMuted, marginTop: 8, lineHeight: 21 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, marginTop: 22, marginBottom: 10 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.white, borderRadius: radii.lg, padding: 12, alignSelf: 'flex-start', paddingHorizontal: 20 },
  stepperBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  stepperBtnDisabled: { opacity: 0.4 },
  stepperBtnText: { fontWeight: '800', fontSize: 19, color: colors.tealLink },
  stepperVal: { fontFamily: fonts.bodyExtraBold, fontSize: 19, minWidth: 30, textAlign: 'center', color: colors.ink },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  dateChip: { width: 56, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center' },
  dateChipActive: { backgroundColor: colors.deepGreen },
  dateChipWeekday: { fontSize: 10, fontFamily: fonts.bodyExtraBold, color: colors.secondaryText, textTransform: 'uppercase' },
  dateChipDay: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginTop: 2 },
  dateChipMonth: { fontSize: 10.5, fontFamily: fonts.bodySemiBold, color: colors.secondaryText },
  dateChipTextActive: { color: colors.mint },
  dateChosenText: { marginTop: 12, fontSize: 13.5, fontFamily: fonts.bodyBold, color: colors.ink },
  reminderNote: { fontSize: 12.5, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, marginTop: -2 },
  resultWrap: { marginTop: 28 },
  themeTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink },
  budgetEstimate: { fontSize: 13, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, marginTop: 4 },
  courseCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: radii.lg, padding: 14 },
  dishName: { fontFamily: fonts.bodyBold, fontSize: 15.5, color: colors.ink },
  dishDesc: { fontSize: 12.5, color: colors.sageText, marginTop: 3, lineHeight: 18 },
  removeDishBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.coralBg, alignItems: 'center', justifyContent: 'center' },
  removeDishBtnText: { color: colors.coral, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
});
