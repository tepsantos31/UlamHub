import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PillButton } from '../components/PillButton';
import { Recipe } from '../types/models';
import { listRecipes } from '../storage/recipes';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectPartyDishes'>;

export function SelectPartyDishesScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { limit, initialSelectedIds } = route.params;
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));

  useFocusEffect(
    useCallback(() => {
      listRecipes().then(setRecipes);
    }, []),
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= limit) {
          Alert.alert(t('selectPartyDishes.limitReachedTitle'), t('selectPartyDishes.limitReachedBody', { count: limit }));
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const done = () => {
    navigation.navigate('PartyPlanner', { selectedRecipeIds: Array.from(selected) });
  };

  return (
    <Screen withTabBarSpace={false} scroll={false}>
      <HeaderBar title={t('partyPlanner.selectDishes')} onBack={() => navigation.goBack()} />
      <Text style={styles.subtitle}>{t('selectPartyDishes.subtitle', { limit, selected: selected.size })}</Text>

      <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.card, shadow.soft]}>
          {recipes.map((r, i) => {
            const checked = selected.has(r.id);
            return (
              <Pressable
                key={r.id}
                onPress={() => toggle(r.id)}
                style={[styles.row, i !== recipes.length - 1 && styles.rowBorder]}
              >
                <View style={[styles.checkbox, checked && { backgroundColor: colors.teal, borderColor: colors.teal }]}>
                  {checked && <Text style={styles.checkTick}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{r.name}</Text>
                  <Text style={styles.rowMeta}>
                    {r.country} · {r.type}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PillButton
          label={t('selectPartyDishes.addToPartyPlanner', { count: selected.size })}
          onPress={done}
          disabled={selected.size === 0}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 13.5, color: colors.sageMuted, marginTop: 8, lineHeight: 20 },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.borderMuted, alignItems: 'center', justifyContent: 'center' },
  checkTick: { color: colors.deepGreen, fontSize: 13, fontWeight: '800' },
  rowName: { fontSize: 14.5, fontFamily: fonts.bodySemiBold, color: colors.ink },
  rowMeta: { fontSize: 12, color: colors.secondaryText, fontFamily: fonts.bodyMedium, marginTop: 1 },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
  },
});
