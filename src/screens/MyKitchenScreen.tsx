import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, Share, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PillButton } from '../components/PillButton';
import { PremiumGate } from '../components/PremiumGate';
import { GroupedList, ListRow, SectionLabel } from '../components/GroupedList';
import {
  getMyKitchen,
  createKitchen,
  joinKitchen,
  leaveKitchen,
  getIncomingRequests,
  respondToRequest,
  KitchenInfo,
  RecipeRequest,
} from '../lib/kitchen';
import { getSettings } from '../storage/settings';
import { isSubscriptionActive } from '../utils/subscription';
import { SettingsState } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'MyKitchen'>;

export function MyKitchenScreen({ navigation }: Props) {
  const [kitchen, setKitchen] = useState<KitchenInfo | null>(null);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [requests, setRequests] = useState<RecipeRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, k] = await Promise.all([getSettings(), getMyKitchen()]);
      setSettingsState(s);
      setKitchen(k);
      if (k) setRequests(await getIncomingRequests());
    } catch (e: any) {
      Alert.alert('Could not load kitchen', e?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onCreate = async () => {
    setBusy('create');
    try {
      const k = await createKitchen(name.trim() || 'My Kitchen');
      setKitchen(k);
    } catch (e: any) {
      Alert.alert('Could not create kitchen', e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const onJoin = async () => {
    if (!code.trim()) return;
    setBusy('join');
    try {
      const k = await joinKitchen(code);
      setKitchen(k);
    } catch (e: any) {
      Alert.alert('Could not join kitchen', e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const onLeave = () => {
    Alert.alert('Leave kitchen', 'You’ll lose access to your crew’s recipes, and they’ll lose access to yours.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveKitchen();
          setKitchen(null);
        },
      },
    ]);
  };

  const respond = async (req: RecipeRequest, approve: boolean) => {
    setRespondingId(req.id);
    try {
      await respondToRequest(req.id, approve);
      setRequests((cur) => cur.filter((r) => r.id !== req.id));
    } catch (e: any) {
      Alert.alert('Could not respond', e?.message ?? 'Something went wrong.');
    } finally {
      setRespondingId(null);
    }
  };

  const shareCode = () => {
    if (!kitchen) return;
    Share.share({ message: `Join my kitchen on UlamHub with the code ${kitchen.inviteCode}` });
  };

  const subscribed = settings ? isSubscriptionActive(settings) : false;

  return (
    <Screen withTabBarSpace={false}>
      <HeaderBar title="My Kitchen" onBack={() => navigation.goBack()} />

      {loading ? (
        <ActivityIndicator color={colors.tealDark} style={{ marginTop: 40 }} />
      ) : !subscribed ? (
        <PremiumGate
          icon="👨‍🍳"
          title="Kitchen is a Premium feature"
          body="Creating or joining a kitchen crew with other subscribers is available to UlamHub Premium members."
          onGoPremium={() => navigation.navigate('Paywall')}
        />
      ) : kitchen ? (
        <>
          <View style={[styles.card, shadow.soft]}>
            <Text style={styles.kitchenName}>{kitchen.name}</Text>
            <Text style={styles.kitchenSub}>{kitchen.crew.length + 1} member{kitchen.crew.length === 0 ? '' : 's'}</Text>
            <Pressable onPress={shareCode} style={styles.codeRow}>
              <Text style={styles.codeLabel}>Invite code</Text>
              <Text style={styles.codeValue}>{kitchen.inviteCode}</Text>
            </Pressable>
          </View>

          {requests.length > 0 && (
            <>
              <SectionLabel>Requests</SectionLabel>
              <View style={{ gap: 10 }}>
                {requests.map((r) => (
                  <View key={r.id} style={[styles.requestCard, shadow.soft]}>
                    <Text style={styles.requestText}>
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{r.fromUserName}</Text> wants to add{' '}
                      <Text style={{ fontFamily: fonts.bodyExtraBold }}>{r.recipeName}</Text> to their cookbook.
                    </Text>
                    <View style={styles.requestActions}>
                      <PillButton
                        label="Decline"
                        onPress={() => respond(r, false)}
                        loading={respondingId === r.id}
                        disabled={respondingId !== null}
                        variant="secondary"
                        style={{ flex: 1 }}
                      />
                      <PillButton
                        label="Approve"
                        onPress={() => respond(r, true)}
                        loading={respondingId === r.id}
                        disabled={respondingId !== null}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          <SectionLabel>Kitchen crew</SectionLabel>
          {kitchen.crew.length === 0 ? (
            <View style={[styles.emptyCrew, shadow.soft]}>
              <Text style={styles.emptyCrewText}>Nobody's joined yet — share your invite code with other subscribers.</Text>
            </View>
          ) : (
            <GroupedList>
              {kitchen.crew.map((m, i) => (
                <ListRow
                  key={m.id}
                  label={m.name}
                  value="View kitchen →"
                  isLast={i === kitchen.crew.length - 1}
                  onPress={() => navigation.navigate('MemberKitchen', { memberId: m.id, memberName: m.name })}
                />
              ))}
            </GroupedList>
          )}

          <Text style={styles.leaveLink} onPress={onLeave}>
            Leave kitchen
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>
            Create your own kitchen and invite other subscribers to your crew — everyone in it can browse each other's recipes.
          </Text>

          <SectionLabel>Create a new kitchen</SectionLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Kitchen name (e.g. The Cruz Kitchen)"
            placeholderTextColor={colors.tertiaryText}
            style={styles.input}
          />
          <PillButton label="Create kitchen" onPress={onCreate} loading={busy === 'create'} disabled={busy !== null} style={{ marginTop: 12 }} />

          <SectionLabel>Or join with a code</SectionLabel>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="Invite code"
            placeholderTextColor={colors.tertiaryText}
            autoCapitalize="characters"
            style={styles.input}
          />
          <PillButton label="Join kitchen" onPress={onJoin} loading={busy === 'join'} disabled={busy !== null} variant="secondary" style={{ marginTop: 12 }} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, color: colors.sageMuted, marginTop: 16, lineHeight: 21 },
  card: { marginTop: 16, backgroundColor: colors.white, borderRadius: radii.xl, padding: 20 },
  kitchenName: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  kitchenSub: { fontSize: 12.5, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, marginTop: 2 },
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
  input: { height: 50, backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 16, fontSize: 14, color: colors.ink, fontFamily: fonts.bodyMedium },
  leaveLink: { textAlign: 'center', marginTop: 20, color: colors.coralSoft, fontFamily: fonts.bodyBold, fontSize: 14 },
  emptyCrew: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 18, alignItems: 'center' },
  emptyCrewText: { fontSize: 13, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, textAlign: 'center' },
  requestCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 16 },
  requestText: { fontSize: 13.5, color: colors.ink, lineHeight: 19, fontFamily: fonts.body },
  requestActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
