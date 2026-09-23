import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
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
  const { memberId, memberName } = route.params;
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
        'Recipe limit reached',
        `Free accounts can save up to ${FREE_RECIPE_CAP} recipes. Subscribe to UlamHub Premium for unlimited recipes.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Go Premium', onPress: () => navigation.navigate('Paywall') },
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
      Alert.alert('Could not send request', e?.message ?? 'Something went wrong.');
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

  return (
    <Screen>
      <HeaderBar title={`${memberName}'s Kitchen`} onBack={() => navigation.goBack()} />

      {recipes === null ? (
        <ActivityIndicator color={colors.tealDark} style={{ marginTop: 40 }} />
      ) : recipes.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 30 }}>📖</Text>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyBody}>{memberName} hasn't added any recipes yet.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} width={165} imageHeight={104} onPress={() => openRecipe(r)} />
          ))}
        </View>
      )}

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setSelected(null)} />
        {selected && (
          <View style={styles.modalSheet}>
            <View style={styles.badgeRow}>
              <Text style={[styles.badge, { backgroundColor: colors.mint, color: colors.tealLink }]}>{selected.country}</Text>
              <Text style={[styles.badge, { backgroundColor: colors.gold, color: colors.goldText }]}>{selected.type}</Text>
            </View>
            <Text style={styles.modalName}>{selected.name}</Text>
            <Text style={styles.modalSub}>
              {selected.ingredients.length} ingredients · {selected.steps.length} steps · {selected.time}m
            </Text>

            {request === undefined ? (
              <ActivityIndicator color={colors.tealDark} style={{ marginTop: 20 }} />
            ) : request?.status === 'pending' ? (
              <View style={[styles.statusPill, { backgroundColor: colors.gold }]}>
                <Text style={[styles.statusPillText, { color: colors.goldText }]}>Requested — waiting for {memberName} to approve</Text>
              </View>
            ) : request?.status === 'approved' ? (
              <PillButton label={busy ? 'Adding…' : 'Add to my cookbook'} onPress={finishApprovedCopy} loading={busy} style={{ marginTop: 20 }} />
            ) : request?.status === 'declined' ? (
              <>
                <View style={[styles.statusPill, { backgroundColor: colors.coralBg }]}>
                  <Text style={[styles.statusPillText, { color: colors.coralSoft }]}>{memberName} declined this request</Text>
                </View>
                <PillButton label="Request again" onPress={sendRequest} loading={busy} variant="secondary" style={{ marginTop: 10 }} />
              </>
            ) : (
              <PillButton label={busy ? 'Sending…' : 'Request to add'} onPress={sendRequest} loading={busy} style={{ marginTop: 20 }} />
            )}
          </View>
        )}
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', marginTop: 20 },
  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30, gap: 8 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginTop: 4 },
  emptyBody: { fontSize: 13.5, color: colors.sageMuted, textAlign: 'center', lineHeight: 20 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: colors.screenBg, borderTopLeftRadius: radii.xxl, borderTopRightRadius: radii.xxl, padding: 22, paddingBottom: 34 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  badge: { fontSize: 11, fontFamily: fonts.bodyExtraBold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9, overflow: 'hidden' },
  modalName: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, letterSpacing: -0.3 },
  modalSub: { fontSize: 13, color: colors.secondaryText, marginTop: 8, fontFamily: fonts.bodySemiBold },
  statusPill: { marginTop: 20, borderRadius: radii.lg, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  statusPillText: { fontSize: 13, fontFamily: fonts.bodyExtraBold, textAlign: 'center' },
});
