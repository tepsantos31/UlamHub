import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, Share, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PillButton } from '../components/PillButton';
import { PremiumGate } from '../components/PremiumGate';
import { GroupedList, ListRow, SectionLabel } from '../components/GroupedList';
import {
  getMyKitchens,
  requestJoinKitchenByCode,
  getIncomingKitchenJoinRequests,
  getMySentKitchenJoinRequests,
  respondToKitchenJoinRequest,
  leaveKitchen,
  renameKitchen,
  getKitchenLeaveNotices,
  dismissKitchenLeaveNotice,
  getIncomingRequests,
  respondToRequest,
  KitchenInfo,
  KitchenJoinRequest,
  KitchenLeaveNotice,
  RecipeRequest,
} from '../lib/kitchen';
import { listRecipes } from '../storage/recipes';
import { getSettings } from '../storage/settings';
import { isSubscriptionActive } from '../utils/subscription';
import { SettingsState } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'Kitchen'>;

export function KitchenScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [kitchens, setKitchens] = useState<KitchenInfo[]>([]);
  const [recipeCount, setRecipeCount] = useState(0);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [recipeRequests, setRecipeRequests] = useState<RecipeRequest[]>([]);
  const [joinRequests, setJoinRequests] = useState<KitchenJoinRequest[]>([]);
  const [sentJoinRequests, setSentJoinRequests] = useState<KitchenJoinRequest[]>([]);
  const [leaveNotices, setLeaveNotices] = useState<KitchenLeaveNotice[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, k, recipes] = await Promise.all([getSettings(), getMyKitchens(), listRecipes()]);
      setSettingsState(s);
      setKitchens(k);
      setRecipeCount(recipes.filter((r) => r.userAdded).length);
      if (k.length) {
        const [recipeReqs, incomingJoin, sentJoin, notices] = await Promise.all([
          getIncomingRequests(),
          getIncomingKitchenJoinRequests(),
          getMySentKitchenJoinRequests(),
          getKitchenLeaveNotices(),
        ]);
        setRecipeRequests(recipeReqs);
        setJoinRequests(incomingJoin);
        setSentJoinRequests(sentJoin);
        setLeaveNotices(notices);
      }
    } catch (e: any) {
      Alert.alert(t('kitchen.alerts.couldNotLoadTitle'), e?.message ?? t('kitchen.alerts.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onJoin = async () => {
    if (!code.trim()) return;
    setJoining(true);
    try {
      const name = await requestJoinKitchenByCode(code);
      setCode('');
      Alert.alert(t('kitchen.alerts.requestSentTitle'), t('kitchen.alerts.requestSentBody', { name }));
      await load();
    } catch (e: any) {
      Alert.alert(t('kitchen.alerts.couldNotSendRequestTitle'), e?.message ?? t('kitchen.alerts.somethingWentWrong'));
    } finally {
      setJoining(false);
    }
  };

  const respondRecipe = async (r: RecipeRequest, approve: boolean) => {
    setRespondingId(r.id);
    try {
      await respondToRequest(r.id, approve);
      setRecipeRequests((cur) => cur.filter((x) => x.id !== r.id));
    } catch (e: any) {
      Alert.alert(t('kitchen.alerts.couldNotRespondTitle'), e?.message ?? t('kitchen.alerts.somethingWentWrong'));
    } finally {
      setRespondingId(null);
    }
  };

  const respondJoin = async (r: KitchenJoinRequest, approve: boolean) => {
    setRespondingId(r.id);
    try {
      await respondToKitchenJoinRequest(r.id, approve);
      setJoinRequests((cur) => cur.filter((x) => x.id !== r.id));
      await load();
    } catch (e: any) {
      Alert.alert(t('kitchen.alerts.couldNotRespondTitle'), e?.message ?? t('kitchen.alerts.somethingWentWrong'));
    } finally {
      setRespondingId(null);
    }
  };

  const dismissNotice = async (n: KitchenLeaveNotice) => {
    setLeaveNotices((cur) => cur.filter((x) => x.id !== n.id));
    await dismissKitchenLeaveNotice(n.id).catch(() => {});
  };

  const startEditingName = () => {
    if (!ownedKitchen) return;
    setNameDraft(ownedKitchen.name);
    setEditingName(true);
  };

  const saveName = async () => {
    if (!ownedKitchen) return;
    setSavingName(true);
    try {
      await renameKitchen(ownedKitchen.id, nameDraft);
      setEditingName(false);
      await load();
    } catch (e: any) {
      Alert.alert(t('kitchen.alerts.couldNotRenameTitle'), e?.message ?? t('kitchen.alerts.somethingWentWrong'));
    } finally {
      setSavingName(false);
    }
  };

  const shareInvite = () => {
    if (!ownedKitchen) return;
    const link = Linking.createURL('kitchen/join', { queryParams: { code: ownedKitchen.inviteCode } });
    Share.share({ message: t('kitchen.shareInviteMessage', { name: ownedKitchen.name, code: ownedKitchen.inviteCode, link }) });
  };

  const onLeave = (k: KitchenInfo) => {
    Alert.alert(
      t('kitchen.alerts.leaveKitchenTitle'),
      t('kitchen.alerts.leaveKitchenBody', { name: k.name, owner: k.ownerName ?? t('kitchen.theOwner') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('kitchen.leave'),
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveKitchen(k.id);
              await load();
            } catch (e: any) {
              Alert.alert(t('kitchen.alerts.couldNotLeaveTitle'), e?.message ?? t('kitchen.alerts.somethingWentWrong'));
            }
          },
        },
      ],
    );
  };

  const subscribed = settings ? isSubscriptionActive(settings) : false;
  const ownedKitchen = kitchens.find((k) => k.myRole === 'owner') ?? null;
  const joinedKitchens = kitchens.filter((k) => k.myRole === 'member');

  return (
    <Screen withTabBarSpace={false}>
      <HeaderBar title={t('kitchen.title')} onBack={() => navigation.goBack()} />

      {loading ? (
        <ActivityIndicator color={colors.tealDark} style={{ marginTop: 40 }} />
      ) : !subscribed ? (
        <PremiumGate
          icon="👨‍🍳"
          title={t('kitchen.premiumFeatureTitle')}
          body={t('kitchen.premiumFeatureBody')}
          onGoPremium={() => navigation.navigate('Paywall')}
        />
      ) : (
        <>
          <Text style={styles.subtitle}>{t('kitchen.subtitle')}</Text>

          {(joinRequests.length > 0 || recipeRequests.length > 0 || leaveNotices.length > 0) && (
            <>
              <SectionLabel>{t('kitchen.requests')}</SectionLabel>
              <View style={{ gap: 10 }}>
                {joinRequests.map((r) => (
                  <View key={r.id} style={[styles.requestCard, shadow.soft]}>
                    <Text style={styles.requestText}>
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{r.fromUserName}</Text> {t('kitchen.wantsToJoinMiddle')}{' '}
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{r.kitchenName}</Text>.
                    </Text>
                    <View style={styles.requestActions}>
                      <PillButton
                        label={t('kitchen.decline')}
                        onPress={() => respondJoin(r, false)}
                        loading={respondingId === r.id}
                        disabled={respondingId !== null}
                        variant="secondary"
                        style={{ flex: 1 }}
                      />
                      <PillButton
                        label={t('kitchen.approve')}
                        onPress={() => respondJoin(r, true)}
                        loading={respondingId === r.id}
                        disabled={respondingId !== null}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                ))}
                {recipeRequests.map((r) => (
                  <View key={r.id} style={[styles.requestCard, shadow.soft]}>
                    <Text style={styles.requestText}>
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{r.fromUserName}</Text> {t('kitchen.wantsToAddRecipeMiddle')}{' '}
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{r.recipeName}</Text> {t('kitchen.wantsToAddRecipeSuffix')}
                    </Text>
                    <View style={styles.requestActions}>
                      <PillButton
                        label={t('kitchen.decline')}
                        onPress={() => respondRecipe(r, false)}
                        loading={respondingId === r.id}
                        disabled={respondingId !== null}
                        variant="secondary"
                        style={{ flex: 1 }}
                      />
                      <PillButton
                        label={t('kitchen.approve')}
                        onPress={() => respondRecipe(r, true)}
                        loading={respondingId === r.id}
                        disabled={respondingId !== null}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                ))}
                {leaveNotices.map((n) => (
                  <View key={n.id} style={[styles.requestCard, shadow.soft]}>
                    <Text style={styles.requestText}>
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{n.userName}</Text> {t('kitchen.userLeftMiddle')}{' '}
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{n.kitchenName}</Text>.
                    </Text>
                    <PillButton label={t('kitchen.dismiss')} onPress={() => dismissNotice(n)} variant="secondary" style={{ marginTop: 12 }} />
                  </View>
                ))}
              </View>
            </>
          )}

          <SectionLabel>{t('kitchen.yourKitchen')}</SectionLabel>
          {ownedKitchen ? (
            <View style={[styles.card, shadow.soft]}>
              {editingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    placeholder={t('kitchen.kitchenNamePlaceholder')}
                    placeholderTextColor={colors.tertiaryText}
                    style={styles.nameInput}
                    autoFocus
                  />
                  <Pressable onPress={saveName} disabled={savingName} hitSlop={8}>
                    <Text style={styles.nameActionLink}>{savingName ? t('addRecipeReview.saving') : t('common.save')}</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditingName(false)} disabled={savingName} hitSlop={8}>
                    <Text style={[styles.nameActionLink, { color: colors.secondaryText }]}>{t('common.cancel')}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={startEditingName} style={styles.nameRow}>
                  <Text style={styles.kitchenName}>{ownedKitchen.name}</Text>
                  <Text style={styles.nameActionLink}>{t('common.edit')}</Text>
                </Pressable>
              )}
              <Text style={styles.kitchenSub}>{t('kitchen.recipeCount', { count: recipeCount })}</Text>
              <Pressable onPress={shareInvite} style={styles.codeRow}>
                <Text style={styles.codeLabel}>{t('kitchen.inviteCodeTapToShare')}</Text>
                <Text style={styles.codeValue}>{ownedKitchen.inviteCode}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.emptyCrew, shadow.soft]}>
              <Text style={styles.emptyCrewText}>{t('kitchen.settingUp')}</Text>
            </View>
          )}

          <SectionLabel>{t('kitchen.joinedKitchens')}</SectionLabel>
          {joinedKitchens.length === 0 ? (
            <View style={[styles.emptyCrew, shadow.soft]}>
              <Text style={styles.emptyCrewText}>{t('kitchen.noJoinedKitchens')}</Text>
            </View>
          ) : (
            <GroupedList>
              {joinedKitchens.map((k, i) => (
                <ListRow
                  key={k.id}
                  label={k.name}
                  value={t('kitchen.viewRecipes')}
                  isLast={i === joinedKitchens.length - 1}
                  onPress={() => navigation.navigate('MemberKitchen', { memberId: k.ownerId!, kitchenName: k.name })}
                  right={
                    <Pressable onPress={() => onLeave(k)} hitSlop={8}>
                      <Text style={styles.leaveLink}>{t('kitchen.leave')}</Text>
                    </Pressable>
                  }
                />
              ))}
            </GroupedList>
          )}

          {sentJoinRequests.length > 0 && (
            <View style={[styles.pendingBox, shadow.soft]}>
              {sentJoinRequests.map((r) => (
                <Text key={r.id} style={styles.pendingText}>
                  {t('kitchen.waitingForApprovalPrefix')} <Text style={{ fontFamily: fonts.bodyExtraBold }}>{r.kitchenName}</Text>
                </Text>
              ))}
            </View>
          )}

          <SectionLabel>{t('kitchen.requestToJoinWithCode')}</SectionLabel>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder={t('kitchen.inviteCodePlaceholder')}
            placeholderTextColor={colors.tertiaryText}
            autoCapitalize="characters"
            style={styles.input}
          />
          <PillButton
            label={t('kitchen.requestToJoin')}
            onPress={onJoin}
            loading={joining}
            disabled={joining}
            variant="secondary"
            style={{ marginTop: 12, marginBottom: 24 }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, color: colors.sageMuted, marginTop: 16, lineHeight: 21 },
  input: { height: 50, backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 16, fontSize: 14, color: colors.ink, fontFamily: fonts.bodyMedium },
  card: { marginTop: 0, backgroundColor: colors.white, borderRadius: radii.xl, padding: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  kitchenName: { flex: 1, fontFamily: fonts.heading, fontSize: 20, color: colors.ink, letterSpacing: -0.2 },
  nameActionLink: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.tealLink },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
  },
  kitchenSub: { fontSize: 12.5, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, marginTop: 4 },
  codeRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeLabel: { fontSize: 13, color: colors.sageText, fontFamily: fonts.bodySemiBold },
  codeValue: { fontSize: 18, color: colors.tealLink, fontFamily: fonts.heading, letterSpacing: 2 },
  emptyCrew: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 18, alignItems: 'center' },
  emptyCrewText: { fontSize: 13, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, textAlign: 'center' },
  requestCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 16 },
  requestText: { fontSize: 13.5, color: colors.ink, lineHeight: 19, fontFamily: fonts.body },
  requestActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  pendingBox: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 14, marginTop: 12, gap: 6 },
  pendingText: { fontSize: 12.5, color: colors.secondaryText, fontFamily: fonts.bodySemiBold },
  leaveLink: { color: colors.coralSoft, fontFamily: fonts.bodyBold, fontSize: 13 },
});
