import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Image, Share, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { PlaceholderImage } from '../components/PlaceholderImage';
import { BackChevronIcon, HeartIcon, ShareIcon, BookmarkIcon } from '../components/Icon';
import { PillButton } from '../components/PillButton';
import { Recipe, SettingsState } from '../types/models';
import { getRecipe, saveRecipe, listRecipes } from '../storage/recipes';
import { addMissingIngredientsToGrocery } from '../storage/grocery';
import { getSettings } from '../storage/settings';
import { scaleIngredient } from '../utils/units';
import { chatMessage, getRecipeStory, generateRecipePhoto } from '../api/client';
import { shareRecipe as shareRecipeRemote, unshareRecipe as unshareRecipeRemote } from '../lib/sync';
import { canAccessRecipe, isSubscriptionActive } from '../utils/subscription';

type Props = NativeStackScreenProps<RootStackParamList, 'RecipeDetail'>;

const AI_ACTIONS = ['Substitute an ingredient', 'Make this vegan', 'Double the recipe', 'Air fryer version', 'Budget version'];

function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const mins = Math.round(sec / 60);
  return `${mins} min`;
}

export function RecipeDetailScreen({ route, navigation }: Props) {
  const { recipeId } = route.params;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [servings, setServings] = useState(4);
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [haveFlags, setHaveFlags] = useState<Record<string, boolean>>({});
  const [flavorTip, setFlavorTip] = useState<string | null>(null);
  const [flavorLoading, setFlavorLoading] = useState(false);
  const [addedToast, setAddedToast] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyLoading, setStoryLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [generatingPhoto, setGeneratingPhoto] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const [r, settings, all] = await Promise.all([getRecipe(recipeId), getSettings(), listRecipes()]);
        if (!mounted || !r) return;
        setRecipe(r);
        setSettingsState(settings);
        setAllRecipes(all);
        setServings(r.servingsBase);
        setUnit(settings.unit);
        setHaveFlags(Object.fromEntries(r.ingredients.map((i) => [i.name, !!i.have])));
        setFlavorTip(null);
        setStoryOpen(false);
        setStoryError(null);
      })();
      return () => {
        mounted = false;
      };
    }, [recipeId]),
  );

  if (!recipe || !settings) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.tealDark} />
      </View>
    );
  }

  const locked = !canAccessRecipe(recipe, settings, allRecipes);

  const ratio = servings / recipe.servingsBase;

  const toggleFavorite = async () => {
    const next = { ...recipe, favorite: !recipe.favorite };
    setRecipe(next);
    await saveRecipe(next);
  };

  /** Shows the upsell and returns false if this account isn't subscribed. */
  const requirePremium = (message: string): boolean => {
    if (isSubscriptionActive(settings)) return true;
    Alert.alert('Premium feature', message, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Go Premium', onPress: () => navigation.navigate('Paywall') },
    ]);
    return false;
  };

  const shareRecipe = async () => {
    if (!requirePremium('Sharing recipes is available to UlamHub Premium members. Subscribe to share this recipe with anyone.')) return;
    setSharing(true);
    try {
      const rowId = await shareRecipeRemote(recipe);
      if (rowId) {
        const next = { ...recipe, sharedRowId: rowId };
        setRecipe(next);
        await saveRecipe(next);
        const url = Linking.createURL(`recipe/${rowId}`);
        await Share.share({
          message: `${recipe.name} (${recipe.country} · ${recipe.type}) — open it in UlamHub: ${url}`,
          url, // iOS uses this field directly when present
        });
      } else {
        // Not signed in (or Supabase isn't configured) — no cloud copy to link to yet.
        await Share.share({ message: `${recipe.name} (${recipe.country} · ${recipe.type}) — check it out on UlamHub!` });
      }
    } finally {
      setSharing(false);
    }
  };

  const revokeShare = () => {
    if (!recipe.sharedRowId) return;
    Alert.alert('Stop sharing?', 'The link you already sent out will stop working.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop sharing',
        style: 'destructive',
        onPress: async () => {
          await unshareRecipeRemote(recipe.sharedRowId!);
          const next = { ...recipe, sharedRowId: undefined };
          setRecipe(next);
          await saveRecipe(next);
        },
      },
    ]);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to add a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (result.canceled || !result.assets[0]?.uri) return;
    const next = { ...recipe, photoUri: result.assets[0].uri };
    setRecipe(next);
    await saveRecipe(next);
  };

  const generatePhoto = async () => {
    if (!requirePremium('Generating a photo with AI is available to UlamHub Premium members.')) return;
    setGeneratingPhoto(true);
    try {
      const { imageBase64 } = await generateRecipePhoto({
        name: recipe.name,
        country: String(recipe.country),
        type: recipe.type,
        ingredients: recipe.ingredients.map((i) => i.name).filter(Boolean),
      });
      const next = { ...recipe, photoUri: `data:image/png;base64,${imageBase64}` };
      setRecipe(next);
      await saveRecipe(next);
    } catch (e: any) {
      Alert.alert('Could not generate photo', e?.message ?? 'Something went wrong — please try again.');
    } finally {
      setGeneratingPhoto(false);
    }
  };

  const changePhoto = () => {
    Alert.alert('Recipe photo', undefined, [
      { text: 'Choose from library', onPress: pickPhoto },
      { text: 'Generate with AI', onPress: generatePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const addMadeItPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to add a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]?.uri) return;
    const next = { ...recipe, madeItPhotos: [...(recipe.madeItPhotos ?? []), result.assets[0].uri] };
    setRecipe(next);
    await saveRecipe(next);
  };

  const addMissing = async () => {
    const missing = { ...recipe, ingredients: recipe.ingredients.filter((i) => !haveFlags[i.name]) };
    await addMissingIngredientsToGrocery(missing);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 1800);
  };

  const requestFlavorTip = async () => {
    if (flavorTip) {
      setFlavorTip(null);
      return;
    }
    if (!requirePremium('Kitchen AI flavor tips are available to UlamHub Premium members.')) return;
    setFlavorLoading(true);
    try {
      const flavorSummary = recipe.flavorBalance.map((a) => `${a.label}: ${a.val}/100`).join(', ');
      const res = await chatMessage({
        message: `Give a short (2-3 sentence) tip on adjusting the sour-salty-sweet balance for ${recipe.name}. Current balance — ${flavorSummary}. Suggest a concrete ingredient tweak.`,
      });
      setFlavorTip(res.reply);
    } catch (e) {
      setFlavorTip("Couldn't reach Kitchen AI — make sure the backend server is running.");
    } finally {
      setFlavorLoading(false);
    }
  };

  const toggleStory = async () => {
    if (storyOpen) {
      setStoryOpen(false);
      return;
    }
    if (!recipe.story && !requirePremium('Recipe Story is available to UlamHub Premium members.')) return;
    setStoryOpen(true);
    if (recipe.story) return;
    setStoryLoading(true);
    setStoryError(null);
    try {
      const res = await getRecipeStory({
        name: recipe.name,
        country: String(recipe.country),
        region: recipe.region ? String(recipe.region) : undefined,
        type: recipe.type,
      });
      const next = { ...recipe, story: res.story };
      setRecipe(next);
      await saveRecipe(next);
    } catch (e) {
      setStoryError("Couldn't reach Kitchen AI — make sure the backend server is running.");
    } finally {
      setStoryLoading(false);
    }
  };

  const askRemix = (action: string) => {
    navigation.navigate('KitchenAI', { prefill: `${action}: ${recipe.name}` });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <PlaceholderImage uri={recipe.photoUri} source={recipe.photoAsset} style={StyleSheet.absoluteFill} />
          <View style={styles.heroScrim} />
          <View style={styles.heroTopRow}>
            <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn}>
              <BackChevronIcon />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={changePhoto} disabled={generatingPhoto} style={styles.circleBtn}>
                {generatingPhoto ? <ActivityIndicator size="small" color={colors.ink} /> : <Text style={{ fontSize: 16 }}>📷</Text>}
              </Pressable>
              <Pressable onPress={toggleFavorite} style={styles.circleBtn}>
                <HeartIcon color={recipe.favorite ? colors.coral : '#C4CBB8'} />
              </Pressable>
              <Pressable onPress={shareRecipe} disabled={sharing} style={styles.circleBtn}>
                {sharing ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <>
                    <ShareIcon />
                    {!isSubscriptionActive(settings) && (
                      <View style={styles.shareLockBadge}>
                        <Text style={{ fontSize: 9 }}>🔒</Text>
                      </View>
                    )}
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.badgeRow}>
            <Text style={[styles.badge, { backgroundColor: colors.mint, color: colors.tealLink }]}>{recipe.country}</Text>
            <Text style={[styles.badge, { backgroundColor: colors.gold, color: colors.goldText }]}>{recipe.type}</Text>
            {recipe.sharedRowId && (
              <Pressable onPress={revokeShare} style={[styles.badge, { backgroundColor: colors.coralBg }]}>
                <Text style={{ color: colors.coralSoft, fontSize: 11, fontFamily: fonts.bodyExtraBold }}>🔗 Shared · tap to stop</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.name}>{recipe.name}</Text>
          <Text style={styles.subline}>
            ★ {recipe.rating} · {recipe.cooks.toLocaleString()} cooked · by {recipe.author}
          </Text>

          <View style={styles.statRow}>
            <View style={styles.statTile}>
              <Text style={styles.statVal}>{recipe.time}m</Text>
              <Text style={styles.statLabel}>Total time</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statVal}>{recipe.kcal}</Text>
              <Text style={styles.statLabel}>kcal / serving</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statVal}>{recipe.diff}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
          </View>

          {locked ? (
            <View style={styles.lockCard}>
              <Text style={{ fontSize: 30 }}>🔒</Text>
              <Text style={styles.lockTitle}>This recipe is locked</Text>
              <Text style={styles.lockBody}>
                Ingredients, steps, and cook mode for recipes you've created, imported, or saved from a share unlock with an
                active subscription.
              </Text>
              <PillButton label="Unlock recipes" onPress={() => navigation.navigate('Paywall')} style={{ marginTop: 16 }} />
            </View>
          ) : (
            <>
          <View style={styles.servingsRow}>
            <View style={styles.servingsControl}>
              <Text style={styles.servingsLabel}>Servings</Text>
              <View style={styles.stepper}>
                <Pressable onPress={() => setServings((s) => Math.max(1, s - 1))} style={styles.stepperBtn}>
                  <Text style={styles.stepperBtnText}>–</Text>
                </Pressable>
                <Text style={styles.stepperVal}>{servings}</Text>
                <Pressable onPress={() => setServings((s) => Math.min(12, s + 1))} style={styles.stepperBtn}>
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.unitToggle}>
              <Pressable onPress={() => setUnit('metric')} style={[styles.unitBtn, unit === 'metric' && styles.unitBtnActive]}>
                <Text style={[styles.unitBtnText, unit === 'metric' && styles.unitBtnTextActive]}>Metric</Text>
              </Pressable>
              <Pressable onPress={() => setUnit('imperial')} style={[styles.unitBtn, unit === 'imperial' && styles.unitBtnActive]}>
                <Text style={[styles.unitBtnText, unit === 'imperial' && styles.unitBtnTextActive]}>US</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.h2}>Ingredients</Text>
          <View style={styles.card}>
            {recipe.ingredients.map((ing, i) => {
              const have = haveFlags[ing.name];
              const scaled = scaleIngredient(ing.qty, ing.unit, ratio, unit);
              return (
                <Pressable
                  key={ing.name}
                  onPress={() => setHaveFlags((prev) => ({ ...prev, [ing.name]: !prev[ing.name] }))}
                  style={[styles.ingRow, i !== recipe.ingredients.length - 1 && styles.rowBorder]}
                >
                  <View style={[styles.checkbox, have && { backgroundColor: colors.teal, borderColor: colors.teal }]}>
                    {have && <Text style={styles.checkboxTick}>✓</Text>}
                  </View>
                  <Text style={styles.ingName}>{ing.name}</Text>
                  <Text style={styles.ingAmount}>
                    {scaled.qty} {scaled.unit}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable onPress={addMissing} style={styles.addMissingRow}>
              <Text style={styles.addMissingPlus}>＋</Text>
              <Text style={styles.addMissingText}>{addedToast ? 'Added to grocery list ✓' : 'Add missing to grocery list'}</Text>
            </Pressable>
          </View>

          <Text style={[styles.h2, { marginBottom: 4 }]}>Sauce pairing</Text>
          <Text style={styles.h2Sub}>Dips and sauces that bring out the dish</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 11, paddingBottom: 4 }}>
            {recipe.saucePairings.map((d) => (
              <View key={d.name} style={styles.saucePairingCard}>
                <View style={styles.saucePairingIcon}>
                  <Text style={{ fontSize: 16 }}>🥢</Text>
                </View>
                <Text style={styles.saucePairingName}>{d.name}</Text>
                <Text style={styles.saucePairingNote}>{d.note}</Text>
              </View>
            ))}
          </ScrollView>

          <Pressable onPress={toggleStory} style={styles.storyCard}>
            <View style={styles.storyHeaderRow}>
              <View style={styles.storyIcon}>
                <Text style={{ fontSize: 16 }}>📖</Text>
              </View>
              <Text style={styles.storyTitle}>Recipe Story</Text>
              <Text style={styles.storyToggle}>{storyOpen ? 'Hide' : 'Read the story ✨'}</Text>
            </View>
            {storyOpen && (
              <View style={{ marginTop: 12 }}>
                {storyLoading ? (
                  <ActivityIndicator color={colors.tealDark} />
                ) : (
                  <Text style={styles.storyText}>{storyError ?? recipe.story}</Text>
                )}
              </View>
            )}
          </Pressable>

          <View style={styles.flavorCard}>
            <View style={styles.flavorHeaderRow}>
              <Text style={styles.flavorTitle}>Flavor balance</Text>
              <Pressable onPress={requestFlavorTip} disabled={flavorLoading}>
                <Text style={styles.flavorAdjust}>{flavorLoading ? 'Thinking…' : 'Adjust ✨'}</Text>
              </Pressable>
            </View>
            <View style={{ gap: 11, marginTop: 14 }}>
              {recipe.flavorBalance.map((a) => (
                <View key={a.label} style={styles.flavorBarRow}>
                  <Text style={styles.flavorBarLabel}>{a.label}</Text>
                  <View style={styles.flavorBarTrack}>
                    <View style={[styles.flavorBarFill, { width: `${a.val}%`, backgroundColor: a.color }]} />
                  </View>
                </View>
              ))}
            </View>
            {flavorTip && <Text style={styles.flavorTip}>{flavorTip}</Text>}
          </View>

          <Text style={styles.h2}>Steps</Text>
          <View style={{ gap: 12 }}>
            {recipe.steps.map((st) => (
              <View key={st.n} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{st.n}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepText}>{st.text}</Text>
                  {st.sec > 0 && (
                    <View style={styles.stepTimerBadge}>
                      <Text style={styles.stepTimerText}>⏱ {st.tl || formatSeconds(st.sec)}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.h2}>Nutrition · per serving</Text>
          <View style={styles.nutritionRow}>
            {[
              { label: 'Protein', val: `${recipe.nutrition.protein}g` },
              { label: 'Carbs', val: `${recipe.nutrition.carbs}g` },
              { label: 'Fat', val: `${recipe.nutrition.fat}g` },
              { label: 'Sodium', val: `${recipe.nutrition.sodium}mg` },
            ].map((m) => (
              <View key={m.label} style={styles.nutritionTile}>
                <Text style={styles.nutritionVal}>{m.val}</Text>
                <Text style={styles.nutritionLabel}>{m.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.h2}>Ask AI to remix</Text>
          <View style={styles.remixRow}>
            {AI_ACTIONS.map((a) => (
              <Pressable key={a} onPress={() => askRemix(a)} style={styles.remixChip}>
                <Text style={styles.remixChipText}>✨ {a}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.h2}>Made it{recipe.madeItPhotos?.length ? ` (${recipe.madeItPhotos.length})` : ''}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {(recipe.madeItPhotos ?? []).map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.madeItPlaceholder} />
            ))}
            <Pressable onPress={addMadeItPhoto} style={styles.madeItAdd}>
              <Text style={styles.madeItAddText}>＋{'\n'}Add yours</Text>
            </Pressable>
          </ScrollView>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.stickyBar}>
        {locked ? (
          <PillButton label="🔒 Unlock to cook this recipe" onPress={() => navigation.navigate('Paywall')} style={{ flex: 1 }} />
        ) : (
          <>
            <Pressable onPress={toggleFavorite} style={[styles.saveBtn, shadow.soft]}>
              <BookmarkIcon color={recipe.favorite ? colors.tealLink : colors.ink} />
            </Pressable>
            <PillButton label="🍳 Start cooking" onPress={() => navigation.navigate('CookMode', { recipeId })} style={{ flex: 1 }} />
            {recipe.sourceUrl && (
              <Pressable onPress={() => Linking.openURL(recipe.sourceUrl!)} style={[styles.sourceBtn, shadow.soft]}>
                <Text style={{ fontSize: 16 }}>🔗</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screenBg },
  hero: { height: 320, overflow: 'hidden' },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,25,12,0.15)' },
  heroTopRow: {
    position: 'absolute',
    top: 58,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareLockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  sheet: { backgroundColor: colors.screenBg, borderRadius: radii.xxl, marginTop: -24, padding: 20, paddingTop: 22 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  badge: { fontSize: 11, fontFamily: fonts.bodyExtraBold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9, overflow: 'hidden' },
  name: { fontFamily: fonts.heading, fontSize: 27, color: colors.ink, letterSpacing: -0.4, lineHeight: 30 },
  subline: { fontSize: 13, color: colors.secondaryText, marginTop: 6, fontFamily: fonts.bodySemiBold },
  statRow: { flexDirection: 'row', gap: 9, marginTop: 16 },
  statTile: { flex: 1, backgroundColor: colors.white, borderRadius: 14, padding: 11, alignItems: 'center' },
  statVal: { fontFamily: fonts.heading, fontSize: 17, color: colors.ink },
  statLabel: { fontSize: 10.5, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, marginTop: 1 },
  servingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  servingsControl: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  servingsLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  stepperBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { fontWeight: '800', fontSize: 17, color: colors.tealLink },
  stepperVal: { fontFamily: fonts.bodyExtraBold, fontSize: 15, minWidth: 16, textAlign: 'center', color: colors.ink },
  unitToggle: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 12, padding: 4 },
  unitBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9 },
  unitBtnActive: { backgroundColor: colors.deepGreen },
  unitBtnText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.sage },
  unitBtnTextActive: { color: colors.mint },
  h2: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink, marginTop: 26, marginBottom: 12 },
  h2Sub: { fontSize: 12.5, color: colors.secondaryText, marginBottom: 12, marginTop: -8 },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, paddingHorizontal: 16 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: colors.borderMuted, alignItems: 'center', justifyContent: 'center' },
  checkboxTick: { color: colors.deepGreen, fontSize: 13, fontWeight: '800' },
  ingName: { flex: 1, fontSize: 14, color: colors.ink, fontFamily: fonts.body },
  ingAmount: { fontSize: 13.5, fontFamily: fonts.bodyBold, color: colors.sageText },
  addMissingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 13 },
  addMissingPlus: { fontSize: 16, color: colors.tealLink },
  addMissingText: { color: colors.tealLink, fontFamily: fonts.bodyBold, fontSize: 13.5 },
  saucePairingCard: { width: 150, backgroundColor: colors.white, borderRadius: radii.lg, padding: 14 },
  saucePairingIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.coralBg, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  saucePairingName: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  saucePairingNote: { fontSize: 11.5, color: colors.secondaryText, marginTop: 3, lineHeight: 15 },
  storyCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 16, marginTop: 22 },
  storyHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  storyIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  storyTitle: { flex: 1, fontFamily: fonts.heading, fontSize: 16, color: colors.ink },
  storyToggle: { fontSize: 11.5, fontFamily: fonts.bodyBold, color: colors.tealLink },
  storyText: { fontSize: 13.5, color: colors.inkSoft, lineHeight: 21 },
  flavorCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 16, marginTop: 22 },
  flavorHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flavorTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink },
  flavorAdjust: { fontSize: 11.5, fontFamily: fonts.bodyBold, color: colors.tealLink },
  flavorBarRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  flavorBarLabel: { width: 96, fontSize: 12, fontFamily: fonts.bodyBold, color: colors.sageText },
  flavorBarTrack: { flex: 1, height: 9, borderRadius: 6, backgroundColor: '#EEECE3', overflow: 'hidden' },
  flavorBarFill: { height: '100%', borderRadius: 6 },
  flavorTip: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.mint, fontSize: 12.5, color: '#2C534C', lineHeight: 18 },
  stepRow: { flexDirection: 'row', gap: 13 },
  stepNum: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.deepGreen, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: fonts.heading, fontSize: 14, color: colors.mint },
  stepText: { fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
  stepTimerBadge: { marginTop: 7, alignSelf: 'flex-start', backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  stepTimerText: { fontSize: 11, fontFamily: fonts.bodyBold, color: colors.goldText },
  nutritionRow: { flexDirection: 'row', gap: 9 },
  nutritionTile: { flex: 1, backgroundColor: colors.white, borderRadius: 14, padding: 13, alignItems: 'center' },
  nutritionVal: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink },
  nutritionLabel: { fontSize: 10, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, marginTop: 2 },
  remixRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  remixChip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(23,137,123,0.35)', backgroundColor: colors.white },
  remixChipText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.mintText },
  madeItPlaceholder: { width: 120, height: 120, borderRadius: 16, backgroundColor: colors.placeholderA },
  madeItAdd: { width: 120, height: 120, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  madeItAddText: { color: colors.tealLink, fontFamily: fonts.bodyBold, fontSize: 13, textAlign: 'center' },
  lockCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: 28, alignItems: 'center', marginTop: 8 },
  lockTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink, marginTop: 12 },
  lockBody: { fontSize: 13, color: colors.sageMuted, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingTop: 14,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.screenBg,
  },
  saveBtn: { width: 64, height: 56, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderMuted, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  sourceBtn: { width: 48, height: 48, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.borderMuted, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
