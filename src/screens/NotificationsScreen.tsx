import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { getPantry, lowStockItems } from '../storage/pantry';
import { getPlan } from '../storage/plan';
import { listRecipes } from '../storage/recipes';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOT_LABEL: Record<string, string> = { breakfast: 'breakfast', lunch: 'lunch', merienda: 'snack', dinner: 'dinner' };

interface Group {
  title: string;
  items: { t: string; s: string; dot: string }[];
}

export function NotificationsScreen({ navigation }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    (async () => {
      const [plan, recipes, pantry] = await Promise.all([getPlan(), listRecipes(), getPantry()]);
      const byId = new Map(recipes.map((r) => [r.id, r]));
      const todayName = WEEKDAYS[new Date().getDay()];
      const today = plan.find((d) => d.day === todayName);

      const mealItems: Group['items'] = [];
      if (today) {
        for (const slot of ['breakfast', 'lunch', 'merienda', 'dinner'] as const) {
          const val = today[slot];
          if (!val) continue;
          const name = byId.get(val)?.name ?? val;
          mealItems.push({ t: `Time to prep ${SLOT_LABEL[slot]} — ${name}`, s: 'Today', dot: colors.amber });
        }
      }

      const low = lowStockItems(pantry);
      const pantryItems: Group['items'] = low.length
        ? [{ t: `Running low on ${low.map((i) => i.name).join(', ')}`, s: 'From your pantry', dot: colors.coralSoft }]
        : [{ t: 'Your pantry staples are fully stocked', s: 'Nice!', dot: colors.tealLink }];

      const socialItems: Group['items'] = [
        { t: 'Lola Nena commented on your Adobo', s: 'Yesterday', dot: colors.tealLink },
        { t: 'Bacolod Kusina started following you', s: 'Yesterday', dot: colors.tealLink },
      ];

      setGroups([
        { title: 'Meal reminders', items: mealItems.length ? mealItems : [{ t: 'No meals planned for today yet', s: 'Open Planner to add some', dot: colors.tertiaryText }] },
        { title: 'Pantry alerts', items: pantryItems },
        { title: 'Social', items: socialItems },
      ]);
    })();
  }, []);

  return (
    <Screen withTabBarSpace={false}>
      <HeaderBar title="Notifications" onBack={() => navigation.goBack()} />
      <View style={{ gap: 20, marginTop: 22 }}>
        {groups.map((g) => (
          <View key={g.title}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <View style={styles.card}>
              {g.items.map((it, i) => (
                <View key={i} style={[styles.row, i !== g.items.length - 1 && styles.rowBorder]}>
                  <View style={[styles.dot, { backgroundColor: it.dot }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemText}>{it.t}</Text>
                    <Text style={styles.itemSub}>{it.s}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupTitle: { fontSize: 12, fontFamily: fonts.bodyExtraBold, color: colors.tertiaryText, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 9 },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  dot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 5 },
  itemText: { fontSize: 14, color: colors.ink, lineHeight: 19, fontFamily: fonts.body },
  itemSub: { fontSize: 11.5, color: colors.tertiaryText, marginTop: 3 },
});
