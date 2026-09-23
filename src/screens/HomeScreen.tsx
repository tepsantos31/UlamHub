import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { RecipeCard, TrendingCard } from '../components/RecipeCard';
import { SearchIcon, BellIcon } from '../components/Icon';
import { Recipe, PlanDay, SettingsState } from '../types/models';
import { listRecipes } from '../storage/recipes';
import { getProfile, getSettings } from '../storage/settings';
import { getPlan } from '../storage/plan';
import { canAccessRecipe, isSubscriptionActive } from '../utils/subscription';
import { fetchTrendingRecipes, TrendingRecipe } from '../lib/sync';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const AI_TOOLS: { label: string; desc: string; icon: string; tint: string; route: 'LeftoverAlchemist' | 'IngredientScanner' | 'PartyPlanner' }[] = [
  { label: 'Leftover Alchemist', desc: 'Turn what you have into something new', icon: '🧪', tint: colors.coralBg, route: 'LeftoverAlchemist' },
  { label: 'Ingredient Scanner', desc: "Snap it, I'll tell you what it is", icon: '🔍', tint: colors.mint, route: 'IngredientScanner' },
  { label: 'Party Planner', desc: 'A full spread, built for you', icon: '🎉', tint: colors.gold, route: 'PartyPlanner' },
];

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<PlanDay[]>([]);
  const [name, setName] = useState('there');
  const [avatarInitial, setAvatarInitial] = useState('U');
  const [settings, setSettingsState] = useState<SettingsState | null>(null);
  const [trending, setTrending] = useState<TrendingRecipe[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const [allRecipes, profile, weekPlan, currentSettings] = await Promise.all([
          listRecipes(),
          getProfile(),
          getPlan(),
          getSettings(),
        ]);
        if (!mounted) return;
        setRecipes(allRecipes);
        setPlan(weekPlan);
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
  const todayName = WEEKDAYS[new Date().getDay()];
  const todayPlan = plan.find((d) => d.day === todayName) ?? plan[0];
  const myRecipes = recipes.filter((r) => r.userAdded);

  const trendingCards = trending.map((t) => {
    const local = byId.get(t.id);
    const display: Recipe =
      local ?? {
        id: t.id,
        name: t.name,
        country: t.country,
        type: t.type,
        time: 0,
        kcal: 0,
        rating: 0,
        cooks: 0,
        budget: '$$',
        diff: 'Home cook',
        author: 'a fellow cook',
        servingsBase: 4,
        ingredients: [],
        steps: [],
        nutrition: { protein: 0, carbs: 0, fat: 0, sodium: 0, fiber: 0 },
        saucePairings: [],
        flavorBalance: [],
      };
    const onPress = local
      ? () => navigation.navigate('RecipeDetail', { recipeId: local.id })
      : () => navigation.navigate('SharedRecipe', { rowId: t.rowId });
    return { key: t.rowId, recipe: display, shareCount: t.shareCount, onPress };
  });

  const todayLabel = (val: string | null) => {
    if (!val) return '—';
    return byId.get(val)?.name ?? val;
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarInitial}</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hi, {name} 👋</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Notifications')} style={[styles.bellBtn, shadow.soft]}>
          <BellIcon />
          <View style={styles.bellDot} />
        </Pressable>
      </View>

      <Text style={styles.hero}>What's cooking today?</Text>

      <Pressable onPress={() => navigation.navigate('Browse')} style={[styles.searchBar, shadow.soft]}>
        <SearchIcon />
        <Text style={styles.searchPlaceholder}>Search dishes, cuisines, or ingredients…</Text>
      </Pressable>

      <View style={styles.quickRow}>
        {[
          { label: 'Add Recipe', icon: '➕', tint: colors.mint, onPress: () => navigation.navigate('AddRecipe') },
          { label: 'Plan Week', icon: '📅', tint: colors.gold, onPress: () => navigation.navigate('Planner') },
          { label: 'Grocery', icon: '🧺', tint: '#E9EBDD', onPress: () => navigation.navigate('Grocery') },
          { label: 'Ask AI', icon: '✨', tint: colors.coralBg, onPress: () => navigation.navigate('KitchenAI') },
        ].map((q) => (
          <Pressable key={q.label} onPress={q.onPress} style={[styles.quickBtn, shadow.card]}>
            <View style={[styles.quickIcon, { backgroundColor: q.tint }]}>
              <Text style={{ fontSize: 16 }}>{q.icon}</Text>
            </View>
            <Text style={styles.quickLabel}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => navigation.navigate('MyKitchen')} style={[styles.kitchenBanner, shadow.card]}>
        <View style={styles.kitchenIcon}>
          <Text style={{ fontSize: 20 }}>👨‍🍳</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kitchenTitle}>My Kitchen</Text>
          <Text style={styles.kitchenBody}>Invite your crew, browse each other's recipes</Text>
        </View>
        <Text style={styles.kitchenArrow}>→</Text>
      </Pressable>

      <SectionHeader title="My Recipes" right="See all →" onPressRight={() => navigation.navigate('MyRecipes')} />
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
          <Text style={styles.emptyMyRecipesText}>You haven't added any recipes yet — tap to add your first one</Text>
        </Pressable>
      )}

      <SectionHeader title="AI Kitchen Tools" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
        {AI_TOOLS.map((t) => (
          <Pressable key={t.label} onPress={() => navigation.navigate(t.route)} style={[styles.toolCard, shadow.card]}>
            <View style={[styles.toolIcon, { backgroundColor: t.tint }]}>
              <Text style={{ fontSize: 20 }}>{t.icon}</Text>
            </View>
            {settings && !isSubscriptionActive(settings) && (
              <View style={styles.toolLockBadge}>
                <Text style={{ fontSize: 10 }}>🔒</Text>
              </View>
            )}
            <Text style={styles.toolLabel}>{t.label}</Text>
            <Text style={styles.toolDesc}>{t.desc}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable onPress={() => navigation.navigate('Planner')} style={styles.planCard}>
        <View style={styles.planGlow} />
        <View style={styles.planTopRow}>
          <Text style={styles.planTitle}>Today's Plan</Text>
          <Text style={styles.planSeeWeek}>See week →</Text>
        </View>
        <View style={styles.planSlots}>
          {(['breakfast', 'lunch', 'merienda', 'dinner'] as const).map((slot) => (
            <View key={slot} style={styles.planSlot}>
              <Text style={styles.planSlotLabel}>{slot === 'merienda' ? 'Snack' : slot}</Text>
              <Text style={styles.planSlotValue} numberOfLines={2}>
                {todayPlan ? todayLabel(todayPlan[slot]) : '—'}
              </Text>
            </View>
          ))}
        </View>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('PartyPlanner')} style={styles.occasionBanner}>
        <View style={styles.occasionIcon}>
          <Text style={{ fontSize: 22 }}>🕯️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.occasionEyebrow}>IN SEASON</Text>
          <Text style={styles.occasionTitle}>Party season is here</Text>
          <Text style={styles.occasionBody}>Build a full party spread in one tap</Text>
        </View>
      </Pressable>

      <SectionHeader title="Trending in the community" />
      {settings && !isSubscriptionActive(settings) ? (
        <Pressable onPress={() => navigation.navigate('Paywall')} style={[styles.emptyMyRecipes, shadow.card]}>
          <Text style={{ fontSize: 22 }}>🔒</Text>
          <Text style={[styles.emptyMyRecipesText, { marginTop: 6 }]}>
            Browsing what the community is sharing is a Premium feature — tap to subscribe.
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
          <Text style={styles.emptyMyRecipesText}>Nothing trending yet — be the first to share a recipe and it'll show up here.</Text>
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
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kitchenIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  kitchenTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },
  kitchenBody: { fontSize: 11.5, color: colors.secondaryText, marginTop: 2, fontFamily: fonts.bodySemiBold },
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
  planCard: {
    marginTop: 22,
    backgroundColor: colors.deepGreen,
    borderRadius: radii.xl,
    padding: 18,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  planGlow: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(67,193,180,0.14)',
  },
  planTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planTitle: { fontFamily: fonts.heading, fontSize: 17, color: colors.mint },
  planSeeWeek: { fontSize: 12, color: colors.teal, fontFamily: fonts.bodyBold },
  planSlots: { flexDirection: 'row', gap: 8, marginTop: 14 },
  planSlot: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 13, padding: 9 },
  planSlotLabel: { fontSize: 10, fontFamily: fonts.bodyBold, color: colors.tealDark, textTransform: 'uppercase' },
  planSlotValue: { fontSize: 12, color: '#DCEEEA', fontFamily: fonts.bodySemiBold, marginTop: 5, lineHeight: 15 },
  occasionBanner: {
    marginTop: 22,
    borderRadius: radii.xl,
    padding: 16,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  occasionIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.goldChip, alignItems: 'center', justifyContent: 'center' },
  occasionEyebrow: { fontSize: 11, fontFamily: fonts.bodyExtraBold, color: colors.goldText, letterSpacing: 0.4 },
  occasionTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.goldTextDeep, marginTop: 2 },
  occasionBody: { fontSize: 12, color: colors.goldTextMid, marginTop: 1 },
});
