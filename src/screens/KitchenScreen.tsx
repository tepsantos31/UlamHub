import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, Share, ActivityIndicator, Alert, StyleSheet } from 'react-native';
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
      Alert.alert('Could not load kitchens', e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
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
      Alert.alert('Request sent', `We'll let you know once ${name} approves it.`);
      await load();
    } catch (e: any) {
      Alert.alert('Could not send request', e?.message ?? 'Something went wrong.');
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
      Alert.alert('Could not respond', e?.message ?? 'Something went wrong.');
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
      Alert.alert('Could not respond', e?.message ?? 'Something went wrong.');
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
      Alert.alert('Could not rename kitchen', e?.message ?? 'Something went wrong.');
    } finally {
      setSavingName(false);
    }
  };

  const shareInvite = () => {
    if (!ownedKitchen) return;
    const link = Linking.createURL('kitchen/join', { queryParams: { code: ownedKitchen.inviteCode } });
    Share.share({ message: `Join my kitchen "${ownedKitchen.name}" on UlamHub! Use code ${ownedKitchen.inviteCode}, or just tap: ${link}` });
  };

  const onLeave = (k: KitchenInfo) => {
    Alert.alert('Leave kitchen', `You'll lose access to ${k.name}, and ${k.ownerName ?? 'the owner'} will be notified.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveKitchen(k.id);
            await load();
          } catch (e: any) {
            Alert.alert('Could not leave', e?.message ?? 'Something went wrong.');
          }
        },
      },
    ]);
  };

  const subscribed = settings ? isSubscriptionActive(settings) : false;
  const ownedKitchen = kitchens.find((k) => k.myRole === 'owner') ?? null;
  const joinedKitchens = kitchens.filter((k) => k.myRole === 'member');

  return (
    <Screen withTabBarSpace={false}>
      <HeaderBar title="My Kitchen" onBack={() => navigation.goBack()} />

      {loading ? (
        <ActivityIndicator color={colors.tealDark} style={{ marginTop: 40 }} />
      ) : !subscribed ? (
        <PremiumGate
          icon="👨‍🍳"
          title="Kitchen is a Premium feature"
          body="Joining other kitchens with your crew is available to UlamHub Premium members."
          onGoPremium={() => navigation.navigate('Paywall')}
        />
      ) : (
        <>
          <Text style={styles.subtitle}>
            Join others by request — once the owner approves, you can browse their recipes and request to add them to yours.
          </Text>

          {(joinRequests.length > 0 || recipeRequests.length > 0 || leaveNotices.length > 0) && (
            <>
              <SectionLabel>Requests</SectionLabel>
              <View style={{ gap: 10 }}>
                {joinRequests.map((r) => (
                  <View key={r.id} style={[styles.requestCard, shadow.soft]}>
                    <Text style={styles.requestText}>
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{r.fromUserName}</Text> wants to join{' '}
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{r.kitchenName}</Text>.
                    </Text>
                    <View style={styles.requestActions}>
                      <PillButton
                        label="Decline"
                        onPress={() => respondJoin(r, false)}
                        loading={respondingId === r.id}
                        disabled={respondingId !== null}
                        variant="secondary"
                        style={{ flex: 1 }}
                      />
                      <PillButton
                        label="Approve"
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
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{r.fromUserName}</Text> wants to add{' '}
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{r.recipeName}</Text> to their cookbook.
                    </Text>
                    <View style={styles.requestActions}>
                      <PillButton
                        label="Decline"
                        onPress={() => respondRecipe(r, false)}
                        loading={respondingId === r.id}
                        disabled={respondingId !== null}
                        variant="secondary"
                        style={{ flex: 1 }}
                      />
                      <PillButton
                        label="Approve"
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
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{n.userName}</Text> left{' '}
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{n.kitchenName}</Text>.
                    </Text>
                    <PillButton label="Dismiss" onPress={() => dismissNotice(n)} variant="secondary" style={{ marginTop: 12 }} />
                  </View>
                ))}
              </View>
            </>
          )}

          <SectionLabel>Your kitchen</SectionLabel>
          {ownedKitchen ? (
            <View style={[styles.card, shadow.soft]}>
              {editingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    placeholder="Kitchen name"
                    placeholderTextColor={colors.tertiaryText}
                    style={styles.nameInput}
                    autoFocus
                  />
                  <Pressable onPress={saveName} disabled={savingName} hitSlop={8}>
                    <Text style={styles.nameActionLink}>{savingName ? 'Saving…' : 'Save'}</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditingName(false)} disabled={savingName} hitSlop={8}>
                    <Text style={[styles.nameActionLink, { color: colors.secondaryText }]}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={startEditingName} style={styles.nameRow}>
                  <Text style={styles.kitchenName}>{ownedKitchen.name}</Text>
                  <Text style={styles.nameActionLink}>Edit</Text>
                </Pressable>
              )}
              <Text style={styles.kitchenSub}>
                {recipeCount} recipe{recipeCount === 1 ? '' : 's'}
              </Text>
              <Pressable onPress={shareInvite} style={styles.codeRow}>
                <Text style={styles.codeLabel}>Invite code · tap to share</Text>
                <Text style={styles.codeValue}>{ownedKitchen.inviteCode}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.emptyCrew, shadow.soft]}>
              <Text style={styles.emptyCrewText}>Setting up your kitchen…</Text>
            </View>
          )}

          <SectionLabel>Joined kitchens</SectionLabel>
          {joinedKitchens.length === 0 ? (
            <View style={[styles.emptyCrew, shadow.soft]}>
              <Text style={styles.emptyCrewText}>You haven't joined anyone else's kitchen yet — request to join one below.</Text>
            </View>
          ) : (
            <GroupedList>
              {joinedKitchens.map((k, i) => (
                <ListRow
                  key={k.id}
                  label={k.name}
                  value="View recipes →"
                  isLast={i === joinedKitchens.length - 1}
                  onPress={() => navigation.navigate('MemberKitchen', { memberId: k.ownerId!, kitchenName: k.name })}
                  right={
                    <Pressable onPress={() => onLeave(k)} hitSlop={8}>
                      <Text style={styles.leaveLink}>Leave</Text>
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
                  Waiting for approval to join <Text style={{ fontFamily: fonts.bodyExtraBold }}>{r.kitchenName}</Text>
                </Text>
              ))}
            </View>
          )}

          <SectionLabel>Request to join with a code</SectionLabel>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="Invite code"
            placeholderTextColor={colors.tertiaryText}
            autoCapitalize="characters"
            style={styles.input}
          />
          <PillButton
            label="Request to join"
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
