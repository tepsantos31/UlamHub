import React, { useCallback, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PillButton } from '../components/PillButton';
import { RecipeCard } from '../components/RecipeCard';
import { Recipe } from '../types/models';
import { fetchKitchenMemberRecipes } from '../lib/sync';
import { makeRecipeId, saveRecipe, listRecipes } from '../storage/recipes';
import { getSettings } from '../storage/settings';
import { canAddRecipe, FREE_RECIPE_CAP } from '../utils/subscription';
import { requestRecipe, getMyRequestStatus, getMyApprovedRequests, clearRequest, RecipeRequest } from '../lib/kitchen';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberKitchen'>;

async function copyIntoCookbook(recipe: Recipe): Promise<string> {
  const id = makeRecipeId(recipe.name);
  const copy: Recipe = { ...recipe, id, userAdded: true, savedFromShare: true, favorite: false, photoAsset: undefined };
  await saveRecipe(copy);
  return id;
}

export function MemberKitchenScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { memberId, kitchenName } = route.params;
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [request, setRequest] = useState<RecipeRequest | null | undefined>(undefined); // undefined = loading
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      fetchKitchenMemberRecipes(memberId).then((list) => {
        if (mounted) setRecipes(list);
      });
      // Any request this account sent this crew-mate that got approved while
      // we weren't looking: finish the copy now and clean up the row.
      getMyApprovedRequests().then(async (approved) => {
        const mine = approved.filter((a) => a.toUserId === memberId);
        if (mine.length === 0) return;
        const list = await fetchKitchenMemberRecipes(memberId);
        for (const r of mine) {
          const src = list.find((rec) => rec.id === r.recipeId);
          if (src) await copyIntoCookbook(src);
          await clearRequest(r.id);
        }
      });
      return () => {
        mounted = false;
      };
    }, [memberId]),
  );

  const openRecipe = async (r: Recipe) => {
    setSelected(r);
    setRequest(undefined);
    const status = await getMyRequestStatus(r.id, memberId);
    setRequest(status);
  };

  const sendRequest = async () => {
    if (!selected) return;
    const [existing, settings] = await Promise.all([listRecipes(), getSettings()]);
    if (!canAddRecipe(settings, existing)) {
      Alert.alert(
        t('addRecipeReview.alerts.recipeLimitTitle'),
        t('addRecipeReview.alerts.recipeLimitBody', { cap: FREE_RECIPE_CAP }),
        [
          { text: t('recipeDetail.alerts.notNow'), style: 'cancel' },
          { text: t('recipeDetail.alerts.goPremium'), onPress: () => navigation.navigate('Paywall') },
        ],
      );
      return;
    }
    setBusy(true);
    try {
      await requestRecipe(selected, memberId);
      const status = await getMyRequestStatus(selected.id, memberId);
      setRequest(status);
    } catch (e: any) {
      Alert.alert(t('kitchen.alerts.couldNotSendRequestTitle'), e?.message ?? t('kitchen.alerts.somethingWentWrong'));
    } finally {
      setBusy(false);
    }
  };

  const finishApprovedCopy = async () => {
    if (!selected || !request) return;
    setBusy(true);
    try {
      const id = await copyIntoCookbook(selected);
      await clearRequest(request.id);
      setSelected(null);
      navigation.navigate('RecipeDetail', { recipeId: id });
    } finally {
      setBusy(false);
    }
  };

  if (selected) {
    return (
      <Screen>
        <HeaderBar onBack={() => setSelected(null)} />
        <View style={styles.badgeRow}>
          <Text style={[styles.badge, { backgroundColor: colors.mint, color: colors.tealLink }]}>{selected.country}</Text>
          <Text style={[styles.badge, { backgroundColor: colors.gold, color: colors.goldText }]}>{selected.type}</Text>
        </View>
        <Text style={styles.detailName}>{selected.name}</Text>
        <Text style={styles.detailSub}>
          {t('memberKitchen.detailSub', { time: selected.time, count: selected.ingredients.length, kitchen: kitchenName })}
        </Text>

        <Text style={styles.h2}>{t('recipeDetail.ingredients')}</Text>
        <View style={{ gap: 8 }}>
          {selected.ingredients.map((ing, i) => (
            <Text key={i} style={styles.ingredientLine}>
              • {ing.qty} {ing.unit} {ing.name}
            </Text>
          ))}
        </View>

        <Text style={styles.h2}>{t('recipeDetail.steps')}</Text>
        <View style={{ gap: 14 }}>
          {selected.steps.map((s) => (
            <View key={s.n} style={styles.stepRow}>
              <Text style={styles.stepNum}>{s.n}</Text>
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          ))}
        </View>

        {request === undefined ? (
          <ActivityIndicator color={colors.tealDark} style={{ marginTop: 24 }} />
        ) : request?.status === 'pending' ? (
          <View style={[styles.statusPill, { backgroundColor: colors.gold }]}>
            <Text style={[styles.statusPillText, { color: colors.goldText }]}>{t('memberKitchen.waitingForApproval', { kitchen: kitchenName })}</Text>
          </View>
        ) : request?.status === 'approved' ? (
          <PillButton label={busy ? t('memberKitchen.adding') : t('memberKitchen.addToCookbook')} onPress={finishApprovedCopy} loading={busy} style={{ marginTop: 24 }} />
        ) : request?.status === 'declined' ? (
          <>
            <View style={[styles.statusPill, { backgroundColor: colors.coralBg }]}>
              <Text style={[styles.statusPillText, { color: colors.coralSoft }]}>{t('memberKitchen.declined', { kitchen: kitchenName })}</Text>
            </View>
            <PillButton label={t('memberKitchen.requestAgain')} onPress={sendRequest} loading={busy} variant="secondary" style={{ marginTop: 10 }} />
          </>
        ) : (
          <PillButton label={busy ? t('memberKitchen.sending') : t('memberKitchen.requestToShare')} onPress={sendRequest} loading={busy} style={{ marginTop: 24 }} />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <HeaderBar title={kitchenName} onBack={() => navigation.goBack()} />

      {recipes === null ? (
        <ActivityIndicator color={colors.tealDark} style={{ marginTop: 40 }} />
      ) : recipes.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 30 }}>📖</Text>
          <Text style={styles.emptyTitle}>{t('myRecipes.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('memberKitchen.emptyBody', { kitchen: kitchenName })}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} width={165} imageHeight={104} onPress={() => openRecipe(r)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', marginTop: 20 },
  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30, gap: 8 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginTop: 4 },
  emptyBody: { fontSize: 13.5, color: colors.sageMuted, textAlign: 'center', lineHeight: 20 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  badge: { fontSize: 11, fontFamily: fonts.bodyExtraBold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9, overflow: 'hidden' },
  detailName: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink, letterSpacing: -0.3, marginTop: 12 },
  detailSub: { fontSize: 13, color: colors.secondaryText, marginTop: 8, fontFamily: fonts.bodySemiBold },
  h2: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginTop: 24, marginBottom: 10 },
  ingredientLine: { fontSize: 14, color: colors.ink, lineHeight: 21 },
  stepRow: { flexDirection: 'row', gap: 10 },
  stepNum: { width: 22, fontFamily: fonts.bodyBold, color: colors.tealLink, fontSize: 14 },
  stepText: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 21 },
  statusPill: { marginTop: 24, borderRadius: radii.lg, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  statusPillText: { fontSize: 13, fontFamily: fonts.bodyExtraBold, textAlign: 'center' },
});
