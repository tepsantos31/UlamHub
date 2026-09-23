import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PillButton } from '../components/PillButton';
import { Recipe } from '../types/models';
import { fetchSharedRecipe } from '../lib/sync';
import { makeRecipeId, saveRecipe, listRecipes } from '../storage/recipes';
import { getSettings } from '../storage/settings';
import { canAddRecipe, FREE_RECIPE_CAP } from '../utils/subscription';

type Props = NativeStackScreenProps<RootStackParamList, 'SharedRecipe'>;

export function SharedRecipeScreen({ route, navigation }: Props) {
  const { rowId } = route.params;
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchSharedRecipe(rowId).then((r) => {
      if (!mounted) return;
      if (r) setRecipe(r);
      else setNotFound(true);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [rowId]);

  const saveToCookbook = async () => {
    if (!recipe) return;
    const [existing, settings] = await Promise.all([listRecipes(), getSettings()]);
    if (!canAddRecipe(settings, existing)) {
      Alert.alert(
        'Recipe limit reached',
        `Free accounts can save up to ${FREE_RECIPE_CAP} recipes. Subscribe to UlamHub Premium for unlimited recipes.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Go Premium', onPress: () => navigation.navigate('Paywall') },
        ],
      );
      return;
    }
    setSaving(true);
    const id = makeRecipeId(recipe.name);
    const copy: Recipe = { ...recipe, id, userAdded: true, savedFromShare: true, favorite: false, photoAsset: undefined };
    await saveRecipe(copy);
    navigation.replace('RecipeDetail', { recipeId: id });
  };

  return (
    <Screen withTabBarSpace={false}>
      <HeaderBar title="Shared recipe" onBack={() => navigation.goBack()} />

      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.tealDark} />
        </View>
      )}

      {!loading && notFound && (
        <View style={styles.centerBox}>
          <Text style={styles.notFoundTitle}>This link isn't available</Text>
          <Text style={styles.notFoundBody}>The recipe may have been unshared, or the link is incorrect.</Text>
        </View>
      )}

      {!loading && recipe && (
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <Text style={[styles.badge, { backgroundColor: colors.mint, color: colors.tealLink }]}>{recipe.country}</Text>
            <Text style={[styles.badge, { backgroundColor: colors.gold, color: colors.goldText }]}>{recipe.type}</Text>
          </View>
          <Text style={styles.name}>{recipe.name}</Text>
          <Text style={styles.subline}>
            {recipe.ingredients.length} ingredients · {recipe.steps.length} steps · {recipe.time}m
          </Text>
          <Text style={styles.author}>Shared by {recipe.author || 'a fellow cook'}</Text>

          <PillButton label={saving ? 'Saving…' : 'Save to my cookbook'} onPress={saveToCookbook} loading={saving} style={{ marginTop: 22 }} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  notFoundTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink },
  notFoundBody: { fontSize: 13.5, color: colors.sageMuted, textAlign: 'center', paddingHorizontal: 30, lineHeight: 20 },
  card: { marginTop: 20, backgroundColor: colors.white, borderRadius: radii.xl, padding: 20 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  badge: { fontSize: 11, fontFamily: fonts.bodyExtraBold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9, overflow: 'hidden' },
  name: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, letterSpacing: -0.3 },
  subline: { fontSize: 13, color: colors.secondaryText, marginTop: 8, fontFamily: fonts.bodySemiBold },
  author: { fontSize: 12.5, color: colors.tertiaryText, marginTop: 4 },
});
