import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { SectionLabel, GroupedList, ListRow } from '../components/GroupedList';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { OnboardingState, PantryItem, ProfileState, SettingsState } from '../types/models';
import { getOnboarding, setOnboarding } from '../storage/onboarding';
import { getProfile, getSettings, setSettings } from '../storage/settings';
import { listRecipes } from '../storage/recipes';
import { getPantry, toggleHave } from '../storage/pantry';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useAuth, signOut } from '../lib/auth';
import { supabaseConfigured } from '../lib/supabase';
import { isSubscriptionActive } from '../utils/subscription';

type Nav = CompositeNavigationProp<BottomTabNavigationProp<MainTabParamList, 'Profile'>, NativeStackNavigationProp<RootStackParamList>>;

export function ProfileSettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [profile, setProfileState] = useState<ProfileState | null>(null);
  const [onboarding, setOnboardingState] = useState<OnboardingState | null>(null);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);
  const [recipeCount, setRecipeCount] = useState(0);
  const [pantry, setPantryState] = useState<PantryItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [p, o, s, recipes, pantryItems] = await Promise.all([
          getProfile(),
          getOnboarding(),
          getSettings(),
          listRecipes(),
          getPantry(),
        ]);
        setProfileState(p);
        setOnboardingState(o);
        setSettingsState(s);
        setRecipeCount(recipes.length);
        setPantryState(pantryItems);
      })();
    }, []),
  );

  const onTogglePantry = async (name: string) => {
    setPantryState(await toggleHave(name));
  };

  if (!profile || !onboarding || !settings) return <View style={{ flex: 1, backgroundColor: colors.screenBg }} />;

  const patchSettings = async (patch: Partial<SettingsState>) => {
    const next = { ...settings, ...patch };
    setSettingsState(next);
    await setSettings(next);
  };

  const toggleNotif = async (key: keyof SettingsState['notif']) => {
    await patchSettings({ notif: { ...settings.notif, [key]: !settings.notif[key] } });
  };

  const toggleCookingAbroad = async () => {
    const next = { ...onboarding, quiz: { ...onboarding.quiz, diaspora: !onboarding.quiz.diaspora } };
    setOnboardingState(next);
    await setOnboarding(next);
  };

  const toggleUnit = async () => {
    await patchSettings({ unit: settings.unit === 'metric' ? 'imperial' : 'metric' });
  };

  const logOut = () => {
    Alert.alert('Log out', session ? 'You can sign back in any time.' : 'This clears your local onboarding so you can go through it again. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          if (session) await signOut();
          await setOnboarding({ ...onboarding, complete: false });
          navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.reset({
            index: 0,
            routes: [{ name: 'OnboardingCarousel' }],
          });
        },
      },
    ]);
  };

  const subscriptionActive = isSubscriptionActive(settings);
  const planLabel = !settings.plan
    ? 'FREE PLAN'
    : subscriptionActive
      ? `${settings.plan.toUpperCase()} PLAN`
      : `${settings.plan.toUpperCase()} · EXPIRED`;
  const planBadgeColors = !settings.plan
    ? { bg: colors.mint, fg: colors.tealLink }
    : subscriptionActive
      ? { bg: colors.mint, fg: colors.tealLink }
      : { bg: colors.coralBg, fg: colors.coralSoft };
  const expiryNote =
    settings.plan && settings.planExpiresAt
      ? subscriptionActive
        ? `Renews ${new Date(settings.planExpiresAt).toLocaleDateString()}`
        : `Expired ${new Date(settings.planExpiresAt).toLocaleDateString()} — created/shared recipes are locked`
      : null;

  return (
    <Screen>
      <Text style={styles.title}>Profile</Text>

      <View style={[styles.profileCard, shadow.soft]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.avatarInitial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.handle}>
              {profile.handle} · {onboarding.quiz.household === 'family' ? 'Family' : onboarding.quiz.household} ·{' '}
              {onboarding.quiz.countries[0] ?? 'All cuisines'}
            </Text>
            <View style={[styles.planBadge, { backgroundColor: planBadgeColors.bg }]}>
              <Text style={[styles.planBadgeText, { color: planBadgeColors.fg }]}>{planLabel}</Text>
            </View>
            {expiryNote && <Text style={styles.expiryNote}>{expiryNote}</Text>}
          </View>
        </View>
        <View style={styles.statsRow}>
          {[
            { n: String(recipeCount), l: 'Recipes' },
            { n: '5', l: 'Cookbooks' },
            { n: '87', l: 'Following' },
          ].map((s) => (
            <View key={s.l} style={styles.statCell}>
              <Text style={styles.statNum}>{s.n}</Text>
              <Text style={styles.statLabel}>{s.l}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable onPress={() => navigation.navigate('Paywall')} style={styles.premiumBanner}>
        <View style={styles.premiumGlow} />
        <View style={styles.premiumIcon}>
          <Text style={{ fontSize: 22 }}>✨</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.premiumTitle}>Go Premium</Text>
          <Text style={styles.premiumSub}>Unlimited imports, AI engine & family sync</Text>
        </View>
      </Pressable>

      <SectionLabel>Preferences</SectionLabel>
      <GroupedList>
        <ListRow
          label="Dietary & cuisine prefs"
          value={`${onboarding.quiz.household} · ${onboarding.quiz.countries[0] ?? 'Any'}`}
          onPress={() => navigation.navigate('OnboardingQuiz')}
        />
        <ListRow label="Unit system" value={settings.unit === 'metric' ? 'Metric' : 'US'} onPress={toggleUnit} />
        <ListRow label="Language display" value="English" isLast onPress={() => Alert.alert('Language', 'English only for now.')} />
      </GroupedList>

      <SectionLabel>Cooking Abroad</SectionLabel>
      <GroupedList>
        <ListRow
          label="Cooking abroad mode"
          isLast
          right={<ToggleSwitch value={onboarding.quiz.diaspora} onValueChange={toggleCookingAbroad} />}
        />
      </GroupedList>

      <SectionLabel>Pantry Staples</SectionLabel>
      <GroupedList>
        {pantry.map((item, i) => (
          <ListRow
            key={item.name}
            label={item.name}
            isLast={i === pantry.length - 1}
            right={<ToggleSwitch value={item.have} onValueChange={() => onTogglePantry(item.name)} />}
          />
        ))}
      </GroupedList>

      <SectionLabel>Notifications</SectionLabel>
      <GroupedList>
        <ListRow label="Meal reminders" right={<ToggleSwitch value={settings.notif.mealRem} onValueChange={() => toggleNotif('mealRem')} />} />
        <ListRow label="Pantry low-stock alerts" right={<ToggleSwitch value={settings.notif.pantry} onValueChange={() => toggleNotif('pantry')} />} />
        <ListRow label="Grocery reminders" right={<ToggleSwitch value={settings.notif.grocery} onValueChange={() => toggleNotif('grocery')} />} />
        <ListRow label="Social notifications" isLast right={<ToggleSwitch value={settings.notif.social} onValueChange={() => toggleNotif('social')} />} />
      </GroupedList>

      <SectionLabel>Household</SectionLabel>
      <GroupedList>
        <ListRow
          label="Household"
          value={session ? undefined : 'Sign in to share'}
          isLast
          onPress={() => {
            if (!supabaseConfigured) {
              Alert.alert('Not set up yet', 'Cloud accounts aren’t configured on this build.');
              return;
            }
            if (!session) {
              Alert.alert('Sign in required', 'Log out and sign in with an account to set up a shared household.');
              return;
            }
            navigation.navigate('Household');
          }}
        />
      </GroupedList>

      <SectionLabel>Account</SectionLabel>
      <GroupedList>
        <ListRow
          label={session ? session.user.email ?? 'Signed in' : 'Email & password'}
          value={session ? 'Signed in' : supabaseConfigured ? 'Not signed in' : undefined}
          onPress={() =>
            Alert.alert(
              'Account',
              session
                ? 'Signed in with a real account — synced to the cloud.'
                : supabaseConfigured
                  ? 'Log out to sign in or create a cloud account.'
                  : 'Cloud accounts aren’t configured on this build — this is a local-only profile.',
            )
          }
        />
        <ListRow label="Export my data" onPress={() => Alert.alert('Export', 'Your data lives on-device in AsyncStorage, and syncs to the cloud if you’re signed in.')} />
        <ListRow label="Delete account" danger isLast onPress={() => Alert.alert('Delete account', 'Not available in this build yet — contact support to delete your cloud data.')} />
      </GroupedList>

      <SectionLabel>Support</SectionLabel>
      <GroupedList>
        <ListRow label="Need Help?" isLast onPress={() => navigation.navigate('SupportChat')} />
      </GroupedList>

      <Text style={styles.logout} onPress={logOut}>
        Log out
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.ink, letterSpacing: -0.5 },
  profileCard: { marginTop: 16, backgroundColor: colors.white, borderRadius: radii.xl, padding: 20 },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.placeholderA, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.heading, fontSize: 24, color: '#8A8A7A' },
  name: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink },
  handle: { fontSize: 12.5, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, marginTop: 1 },
  planBadge: { marginTop: 7, alignSelf: 'flex-start', backgroundColor: colors.mint, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  planBadgeText: { fontSize: 11, fontFamily: fonts.bodyExtraBold, color: colors.tealLink },
  expiryNote: { fontSize: 11, color: colors.secondaryText, marginTop: 4 },
  statsRow: { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 14 },
  statCell: { flex: 1, alignItems: 'center' },
  statNum: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink },
  statLabel: { fontSize: 11, color: colors.secondaryText, fontFamily: fonts.bodySemiBold, marginTop: 1 },
  premiumBanner: {
    marginTop: 14,
    borderRadius: radii.xl,
    padding: 17,
    backgroundColor: colors.deepGreen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  premiumGlow: { position: 'absolute', right: -24, top: -24, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(67,193,180,0.16)' },
  premiumIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  premiumTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.mint },
  premiumSub: { fontSize: 12, color: colors.tealDark, marginTop: 1 },
  logout: { textAlign: 'center', marginTop: 18, color: colors.tertiaryText, fontFamily: fonts.bodyBold, fontSize: 14 },
});
