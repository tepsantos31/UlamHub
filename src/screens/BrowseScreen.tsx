import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { Chip } from '../components/Chip';
import { SearchIcon } from '../components/Icon';
import { RecipeCard } from '../components/RecipeCard';
import { Recipe, SettingsState } from '../types/models';
import { listRecipes } from '../storage/recipes';
import { getSettings } from '../storage/settings';
import { COUNTRIES, ULAM } from '../storage/seed';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { canAccessRecipe } from '../utils/subscription';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Browse'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const COUNTRY_TINTS = ['#F7ECD9', '#E9EBDD', '#F5E4E4', '#E4EBD6', '#E2ECE4', '#F1E7DA'];

export function BrowseScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainTabParamList, 'Browse'>>();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [settings, setSettingsState] = useState<SettingsState | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.filter) setFilter(route.params.filter);
      listRecipes().then(setRecipes);
      getSettings().then(setSettingsState);
    }, [route.params?.filter]),
  );

  const filtered = useMemo(() => {
    let list = recipes;
    if (filter !== 'All') {
      const f = filter.toLowerCase();
      list = list.filter((r) => `${r.type} ${r.name} ${r.country}`.toLowerCase().includes(f));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => `${r.name} ${r.country} ${r.type}`.toLowerCase().includes(q));
    }
    return list;
  }, [recipes, filter, query]);

  const countryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of recipes) map.set(r.country, (map.get(r.country) ?? 0) + 1);
    return map;
  }, [recipes]);

  return (
    <Screen>
      <Text style={styles.title}>Explore</Text>

      <View style={[styles.searchBar, shadow.soft]}>
        <SearchIcon size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ingredient, dish, or cuisine name"
          placeholderTextColor={colors.tertiaryText}
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {ULAM.map((u) => (
          <Chip key={u} label={u} active={filter === u} onPress={() => setFilter(u)} small />
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Cook by cuisine</Text>
      <View style={styles.countryGrid}>
        {COUNTRIES.map((c, i) => (
          <Pressable key={c} onPress={() => setFilter(c)} style={[styles.countryCard, { backgroundColor: COUNTRY_TINTS[i % COUNTRY_TINTS.length] }]}>
            <Text style={styles.countryName}>{c}</Text>
            <Text style={styles.countryCount}>{countryCounts.get(c) ?? 0} recipes</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.resultsHeader}>
        <Text style={styles.sectionTitle}>Recommended for you</Text>
        <Text style={styles.resultsCount}>{filtered.length} results</Text>
      </View>
      <View style={styles.grid}>
        {filtered.map((r) => (
          <RecipeCard
            key={r.id}
            recipe={r}
            width={165}
            imageHeight={104}
            locked={settings ? !canAccessRecipe(r, settings, recipes) : false}
            onPress={() => navigation.navigate('RecipeDetail', { recipeId: r.id })}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.ink, letterSpacing: -0.5 },
  searchBar: {
    marginTop: 14,
    height: 50,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: colors.ink, fontFamily: fonts.bodyMedium },
  chipRow: { gap: 8, marginTop: 16, paddingVertical: 2 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink, marginTop: 24, marginBottom: 12 },
  countryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  countryCard: { width: '48%', borderRadius: radii.lg, padding: 15, height: 78, justifyContent: 'center' },
  countryName: { fontFamily: fonts.heading, fontSize: 16, color: '#2C4642' },
  countryCount: { fontSize: 12, color: '#8A7A5A', fontFamily: fonts.bodySemiBold, marginTop: 2 },
  resultsHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 26 },
  resultsCount: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.tertiaryText },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' },
});
