import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, Share, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PillButton } from '../components/PillButton';
import { GroupedList, ListRow, SectionLabel } from '../components/GroupedList';
import { getMyHousehold, createHousehold, joinHousehold, leaveHousehold, HouseholdInfo } from '../lib/household';

type Props = NativeStackScreenProps<RootStackParamList, 'Household'>;

export function HouseholdScreen({ navigation }: Props) {
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHousehold(await getMyHousehold());
    } catch (e: any) {
      Alert.alert('Could not load household', e?.message ?? 'Something went wrong.');
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
      const h = await createHousehold(name.trim() || 'My Household');
      setHousehold(h);
    } catch (e: any) {
      Alert.alert('Could not create household', e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const onJoin = async () => {
    if (!code.trim()) return;
    setBusy('join');
    try {
      const h = await joinHousehold(code);
      setHousehold(h);
    } catch (e: any) {
      Alert.alert('Could not join household', e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const onLeave = () => {
    Alert.alert('Leave household', 'Your recipes, plan, and grocery list will switch back to just yours.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveHousehold();
          setHousehold(null);
        },
      },
    ]);
  };

  const shareCode = () => {
    if (!household) return;
    Share.share({ message: `Join our household on Ulam with the code ${household.inviteCode}` });
  };

  return (
    <Screen withTabBarSpace={false}>
      <HeaderBar title="Household" onBack={() => navigation.goBack()} />

      {loading ? (
        <ActivityIndicator color={colors.tealDark} style={{ marginTop: 40 }} />
      ) : household ? (
        <>
          <View style={[styles.card, shadow.soft]}>
            <Text style={styles.householdName}>{household.name}</Text>
            <Text style={styles.householdSub}>{household.members.length} member{household.members.length === 1 ? '' : 's'}</Text>
            <Pressable onPress={shareCode} style={styles.codeRow}>
              <Text style={styles.codeLabel}>Invite code</Text>
              <Text style={styles.codeValue}>{household.inviteCode}</Text>
            </Pressable>
          </View>

          <SectionLabel>Members</SectionLabel>
          <GroupedList>
            {household.members.map((m, i) => (
              <ListRow key={m.id} label={m.name} isLast={i === household.members.length - 1} />
            ))}
          </GroupedList>

          <Text style={styles.leaveLink} onPress={onLeave}>
            Leave household
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>
            Share a household so recipes, the meal plan, and the grocery list are the same for everyone in it.
          </Text>

          <SectionLabel>Create a new household</SectionLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Household name (e.g. The Cruz Kitchen)"
            placeholderTextColor={colors.tertiaryText}
            style={styles.input}
          />
          <PillButton label="Create household" onPress={onCreate} loading={busy === 'create'} disabled={busy !== null} style={{ marginTop: 12 }} />

          <SectionLabel>Or join with a code</SectionLabel>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="Invite code"
            placeholderTextColor={colors.tertiaryText}
            autoCapitalize="characters"
            style={styles.input}
          />
          <PillButton label="Join household" onPress={onJoin} loading={busy === 'join'} disabled={busy !== null} variant="secondary" style={{ marginTop: 12 }} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, color: colors.sageMuted, marginTop: 16, lineHeight: 21 },
  card: { marginTop: 16, backgroundColor: colors.white, borderRadius: radii.xl, padding: 20 },
  householdName: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  householdSub: { fontSize: 12.5, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, marginTop: 2 },
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
});
