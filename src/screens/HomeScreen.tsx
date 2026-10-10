import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { RecipeCard, TrendingCard } from '../components/RecipeCard';
import { SearchIcon, BellIcon } from '../components/Icon';
import { Recipe, SettingsState } from '../types/models';
import { listRecipes } from '../storage/recipes';
import { getProfile, getSettings } from '../storage/settings';
import { canAccessRecipe, isSubscriptionActive } from '../utils/subscription';
import { fetchTrendingRecipes, TrendingRecipe } from '../lib/sync';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const AI_TOOLS: { labelKey: string; descKey: string; icon: string; tint: string; route: 'LeftoverAlchemist' | 'IngredientScanner' | 'PartyPlanner' }[] = [
  { labelKey: 'home.leftoverAlchemist', descKey: 'home.leftoverAlchemistDesc', icon: '🧪', tint: colors.coralBg, route: 'LeftoverAlchemist' },
  { labelKey: 'home.ingredientScanner', descKey: 'home.ingredientScannerDesc', icon: '🔍', tint: colors.mint, route: 'IngredientScanner' },
  { labelKey: 'home.partyPlanner', descKey: 'home.partyPlannerDesc', icon: '🎉', tint: colors.gold, route: 'PartyPlanner' },
];

export function HomeScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [name, setName] = useState('there');
  const [avatarInitial, setAvatarInitial] = useState('U');
  const [settings, setSettingsState] = useState<SettingsState | null>(null);
  const [trending, setTrending] = useState<TrendingRecipe[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const [allRecipes, profile, currentSettings] = await Promise.all([listRecipes(), getProfile(), getSettings()]);
        if (!mounted) return;
        setRecipes(allRecipes);
        setName(profile.name.split(' ')[0]);
        setAvatarInitial(profile.avatarInitial);
        setSettingsState(currentSettings);
      })();
      // Separate from the block above — real community data over the
      // network shouldn't hold up the rest of the screen loading.
      fetchTrendingRecipes(6).then((t) => {
        if (mounted) setTrending(t);
      });
      return () => {
        mounted = false;
      };
    }, []),
  );

  const byId = new Map(recipes.map((r) => [r.id, r]));
  const myRecipes = recipes.filter((r) => r.userAdded);

  const trendingCards = trending.map((tr) => {
    // A trending recipe is very often someone else's — the trending RPC only
    // returns a few display fields (see fetchTrendingRecipes), not the full
    // recipe, so this card is a stand-in until the user actually opens
    // SharedRecipe to pull the whole thing. `local` covers the one case
    // where this account happens to own/have saved that same recipe id too.
    const local = byId.get(tr.id);
    const display: Recipe =
      local ?? {
        id: tr.id,
        name: tr.name,
        country: tr.country,
        type: tr.type,
        time: 0,
        kcal: 0,
        rating: 0,
        cooks: 0,
        budget: '$$',
        diff: 'Home cook',
        author: t('home.aFellowCook'),
        servingsBase: 4,
        ingredients: [],
        steps: [],
        nutrition: { protein: 0, carbs: 0, fat: 0, sodium: 0, fiber: 0 },
        saucePairings: [],
        flavorBalance: [],
      };
    const onPress = local
      ? () => navigation.navigate('RecipeDetail', { recipeId: local.id })
      : () => navigation.navigate('SharedRecipe', { rowId: tr.rowId });
    return { key: tr.rowId, recipe: display, shareCount: tr.shareCount, onPress };
  });

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarInitial}</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{t('home.greeting', { name })}</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Notifications')} style={[styles.bellBtn, shadow.soft]}>
          <BellIcon />
          <View style={styles.bellDot} />
        </Pressable>
      </View>

      <Text style={styles.hero}>{t('home.hero')}</Text>

      <Pressable onPress={() => navigation.navigate('Browse')} style={[styles.searchBar, shadow.soft]}>
        <SearchIcon />
        <Text style={styles.searchPlaceholder}>{t('home.searchPlaceholder')}</Text>
      </Pressable>

      <View style={styles.quickRow}>
        {[
          { label: t('home.addRecipe'), icon: '➕', tint: colors.mint, onPress: () => navigation.navigate('AddRecipe') },
          { label: t('home.planWeek'), icon: '📅', tint: colors.gold, onPress: () => navigation.navigate('Planner') },
          { label: t('home.grocery'), icon: '🧺', tint: '#E9EBDD', onPress: () => navigation.navigate('Grocery') },
          { label: t('home.askAI'), icon: '✨', tint: colors.coralBg, onPress: () => navigation.navigate('KitchenAI') },
        ].map((q) => (
          <Pressable key={q.label} onPress={q.onPress} style={[styles.quickBtn, shadow.card]}>
            <View style={[styles.quickIcon, { backgroundColor: q.tint }]}>
              <Text style={{ fontSize: 16 }}>{q.icon}</Text>
            </View>
            <Text style={styles.quickLabel}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader title={t('home.myRecipes')} right={t('home.seeAll')} onPressRight={() => navigation.navigate('MyRecipes')} />
      {myRecipes.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
          {myRecipes.slice(0, 6).map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              locked={settings ? !canAccessRecipe(r, settings, recipes) : false}
              onPress={() => navigation.navigate('RecipeDetail', { recipeId: r.id })}
            />
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={() => navigation.navigate('AddRecipe')} style={[styles.emptyMyRecipes, shadow.card]}>
          <Text style={styles.emptyMyRecipesText}>{t('home.noRecipesYet')}</Text>
        </Pressable>
      )}

      <SectionHeader title={t('home.aiKitchenTools')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
        {AI_TOOLS.map((tool) => (
          <Pressable key={tool.labelKey} onPress={() => navigation.navigate(tool.route)} style={[styles.toolCard, shadow.card]}>
            <View style={[styles.toolIcon, { backgroundColor: tool.tint }]}>
              <Text style={{ fontSize: 20 }}>{tool.icon}</Text>
            </View>
            {settings && !isSubscriptionActive(settings) && (
              <View style={styles.toolLockBadge}>
                <Text style={{ fontSize: 10 }}>🔒</Text>
              </View>
            )}
            <Text style={styles.toolLabel}>{t(tool.labelKey)}</Text>
            <Text style={styles.toolDesc}>{t(tool.descKey)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable onPress={() => navigation.navigate('Kitchen')} style={[styles.kitchenBanner, shadow.card]}>
        <View style={styles.kitchenIcon}>
          <Text style={{ fontSize: 20 }}>👨‍🍳</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kitchenTitle}>{t('home.kitchen')}</Text>
          <Text style={styles.kitchenBody}>{t('home.kitchenBody')}</Text>
        </View>
        <Text style={styles.kitchenArrow}>→</Text>
      </Pressable>

      <SectionHeader title={t('home.trending')} />
      {settings && !isSubscriptionActive(settings) ? (
        <Pressable onPress={() => navigation.navigate('Paywall')} style={[styles.emptyMyRecipes, shadow.card]}>
          <Text style={{ fontSize: 22 }}>🔒</Text>
          <Text style={[styles.emptyMyRecipesText, { marginTop: 6 }]}>
            {t('home.trendingPremium')}
          </Text>
        </Pressable>
      ) : trendingCards.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
          {trendingCards.map((c) => (
            <TrendingCard
              key={c.key}
              recipe={c.recipe}
              shareCount={c.shareCount}
              locked={settings ? !canAccessRecipe(c.recipe, settings, recipes) : false}
              onPress={c.onPress}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.emptyMyRecipes, shadow.card]}>
          <Text style={styles.emptyMyRecipesText}>{t('home.nothingTrending')}</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.placeholderA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.heading, fontSize: 16, color: '#8A8A7A' },
  greeting: { fontSize: 12.5, color: colors.sage, fontFamily: fonts.bodySemiBold },
  date: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, marginTop: 1 },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.white,
  },
  hero: {
    fontFamily: fonts.heading,
    fontSize: 33,
    lineHeight: 36,
    color: colors.ink,
    letterSpacing: -0.6,
    marginTop: 20,
  },
  searchBar: {
    marginTop: 16,
    height: 52,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 18,
  },
  searchPlaceholder: { color: colors.tertiaryText, fontSize: 15, fontFamily: fonts.bodyMedium },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingVertical: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 7,
  },
  quickIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 10.5, fontFamily: fonts.bodyBold, color: '#2C4642', textAlign: 'center' },
  hScroll: { gap: 14, paddingBottom: 4 },
  kitchenBanner: {
    marginTop: 22,
    backgroundColor: colors.gold,
    borderRadius: radii.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kitchenIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.goldChip, alignItems: 'center', justifyContent: 'center' },
  kitchenTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.goldTextDeep },
  kitchenBody: { fontSize: 11.5, color: colors.goldTextMid, marginTop: 2, fontFamily: fonts.bodySemiBold },
  kitchenArrow: { fontSize: 16, color: colors.tealLink, fontFamily: fonts.bodyBold },
  emptyMyRecipes: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 18,
    alignItems: 'center',
  },
  emptyMyRecipesText: { fontSize: 13, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, textAlign: 'center' },
  toolCard: { width: 150, backgroundColor: colors.white, borderRadius: radii.xl, padding: 14 },
  toolIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  toolLockBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  toolLabel: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink, lineHeight: 17 },
  toolDesc: { fontSize: 11, color: colors.secondaryText, marginTop: 4, lineHeight: 15 },
});
