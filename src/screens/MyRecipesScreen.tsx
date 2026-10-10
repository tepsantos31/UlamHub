import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { RecipeCard } from '../components/RecipeCard';
import { Recipe, SettingsState } from '../types/models';
import { listRecipes } from '../storage/recipes';
import { getSettings } from '../storage/settings';
import { canAccessRecipe } from '../utils/subscription';

type Props = NativeStackScreenProps<RootStackParamList, 'MyRecipes'>;

export function MyRecipesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [all, s] = await Promise.all([listRecipes(), getSettings()]);
        setRecipes(all.filter((r) => r.userAdded));
        setSettingsState(s);
      })();
    }, []),
  );

  const created = recipes.filter((r) => !r.savedFromShare);
  const shared = recipes.filter((r) => r.savedFromShare);

  return (
    <Screen>
      <HeaderBar title={t('myRecipes.title')} onBack={() => navigation.goBack()} />
      <Text style={styles.subline}>{t('myRecipes.subline')}</Text>

      {recipes.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 30 }}>📖</Text>
          <Text style={styles.emptyTitle}>{t('myRecipes.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('myRecipes.emptyBody')}</Text>
        </View>
      ) : (
        <>
          {created.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('myRecipes.createdByYou')}</Text>
              <View style={styles.grid}>
                {created.map((r) => (
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
            </>
          )}

          {shared.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('myRecipes.savedFromShare')}</Text>
              <View style={styles.grid}>
                {shared.map((r) => (
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
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subline: { fontSize: 13, color: colors.secondaryText, marginTop: 10, lineHeight: 19 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginTop: 22, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' },
  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30, gap: 8 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginTop: 4 },
  emptyBody: { fontSize: 13.5, color: colors.sageMuted, textAlign: 'center', lineHeight: 20 },
});
