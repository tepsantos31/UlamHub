import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert, Platform, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, radii, shadow } from '../theme/theme';
import { Screen } from '../components/Screen';
import { SectionLabel, GroupedList, ListRow } from '../components/GroupedList';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { OnboardingState, ProfileState, SettingsState } from '../types/models';
import { getOnboarding, setOnboarding } from '../storage/onboarding';
import { getProfile, getSettings, setSettings } from '../storage/settings';
import { listRecipes } from '../storage/recipes';
import { clearAllLocalData } from '../storage/db';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useAuth, signOut } from '../lib/auth';
import { supabaseConfigured } from '../lib/supabase';
import { getMyKitchens } from '../lib/kitchen';
import { purchasesConfigured, openSubscriptionManagement, cancelDemoSubscription, syncEntitlementToSettings } from '../lib/purchases';
import { deleteAccount as deleteAccountRemote } from '../api/client';
import { isSubscriptionActive, FREE_RECIPE_CAP } from '../utils/subscription';

type Nav = CompositeNavigationProp<BottomTabNavigationProp<MainTabParamList, 'Profile'>, NativeStackNavigationProp<RootStackParamList>>;

export function ProfileSettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [profile, setProfileState] = useState<ProfileState | null>(null);
  const [onboarding, setOnboardingState] = useState<OnboardingState | null>(null);
  const [settings, setSettingsState] = useState<SettingsState | null>(null);
  const [recipeCount, setRecipeCount] = useState(0);
  const [joinedKitchenCount, setJoinedKitchenCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        // Refresh entitlement status first — picks up a cancellation made
        // through the App Store/Play Store's own subscription settings, so
        // the "Renews"/"Cancelled" note below reflects reality when the
        // user comes back to the app rather than only on next sign-in.
        if (purchasesConfigured) await syncEntitlementToSettings().catch(() => {});
        const [p, o, s, recipes] = await Promise.all([getProfile(), getOnboarding(), getSettings(), listRecipes()]);
        setProfileState(p);
        setOnboardingState(o);
        setSettingsState(s);
        setRecipeCount(recipes.filter((r) => r.userAdded).length);
        if (supabaseConfigured && session) {
          const kitchens = await getMyKitchens().catch(() => []);
          setJoinedKitchenCount(kitchens.filter((k) => k.myRole === 'member').length);
        } else {
          setJoinedKitchenCount(0);
        }
      })();
    }, [session]),
  );

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

  const toggleLanguage = async () => {
    await patchSettings({ language: settings.language === 'en' ? 'es' : 'en' });
  };

  const logOut = () => {
    Alert.alert(t('profile.logOut'), session ? t('profile.alerts.logOutTitleSignedIn') : t('profile.alerts.logOutTitleLocal'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logOut'),
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

  const goToKitchen = () => {
    if (!supabaseConfigured) {
      Alert.alert(t('profile.alerts.notSetUpTitle'), t('profile.alerts.notSetUpBody'));
      return;
    }
    if (!session) {
      Alert.alert(t('profile.alerts.signInRequiredTitle'), t('profile.alerts.signInRequiredBody'));
      return;
    }
    navigation.navigate('Kitchen');
  };

  const deleteAccount = () => {
    if (!session) {
      Alert.alert(t('profile.alerts.noCloudAccountTitle'), t('profile.alerts.noCloudAccountBody'));
      return;
    }
    Alert.alert(
      t('profile.alerts.deleteAccountTitle'),
      t('profile.alerts.deleteAccountBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccountRemote();
              await signOut();
              await clearAllLocalData();
              navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.reset({
                index: 0,
                routes: [{ name: 'OnboardingCarousel' }],
              });
            } catch (e: any) {
              Alert.alert(t('profile.alerts.deleteFailedTitle'), e?.message ?? t('profile.alerts.deleteFailedDefault'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const subscriptionActive = isSubscriptionActive(settings);
  const planLabel = !settings.plan
    ? t('profile.planFree')
    : subscriptionActive
      ? t('profile.planActive', { plan: settings.plan.toUpperCase() })
      : t('profile.planExpired', { plan: settings.plan.toUpperCase() });
  const planBadgeColors = !settings.plan
    ? { bg: colors.mint, fg: colors.tealLink }
    : subscriptionActive
      ? { bg: colors.mint, fg: colors.tealLink }
      : { bg: colors.coralBg, fg: colors.coralSoft };
  const expiryNote =
    settings.plan && settings.planExpiresAt
      ? subscriptionActive
        ? settings.planCancelled
          ? t('profile.cancelledUntil', { date: new Date(settings.planExpiresAt).toLocaleDateString() })
          : t('profile.renews', { date: new Date(settings.planExpiresAt).toLocaleDateString() })
        : t('profile.expiredNote', { date: new Date(settings.planExpiresAt).toLocaleDateString() })
      : null;

  const cancelSubscription = () => {
    const expiry = settings.planExpiresAt ? new Date(settings.planExpiresAt).toLocaleDateString() : t('profile.alerts.yourCurrentPeriodEnds');
    if (purchasesConfigured) {
      Alert.alert(
        t('profile.cancelSubscription'),
        t('profile.alerts.cancelSubBodyStore', { store: Platform.OS === 'ios' ? t('profile.alerts.appStore') : t('profile.alerts.playStore'), expiry }),
        [
          { text: t('profile.alerts.notNow'), style: 'cancel' },
          { text: t('profile.alerts.continue'), onPress: () => openSubscriptionManagement().catch(() => {}) },
        ],
      );
    } else {
      Alert.alert(
        t('profile.cancelSubscription'),
        t('profile.alerts.cancelSubBodyDemo', { plan: settings.plan, expiry }),
        [
          { text: t('profile.alerts.keepSubscription'), style: 'cancel' },
          {
            text: t('profile.cancelSubscription'),
            style: 'destructive',
            onPress: async () => {
              await cancelDemoSubscription();
              setSettingsState((s) => (s ? { ...s, planCancelled: true } : s));
            },
          },
        ],
      );
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>{t('profile.title')}</Text>

      <View style={[styles.profileCard, shadow.soft]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile.avatarInitial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.handle}>
              {profile.handle} · {onboarding.quiz.household === 'family' ? t('profile.familyLabel') : onboarding.quiz.household} ·{' '}
              {onboarding.quiz.countries[0] ?? t('profile.anyCuisine')}
            </Text>
            <View style={[styles.planBadge, { backgroundColor: planBadgeColors.bg }]}>
              <Text style={[styles.planBadgeText, { color: planBadgeColors.fg }]}>{planLabel}</Text>
            </View>
            {expiryNote && <Text style={styles.expiryNote}>{expiryNote}</Text>}
          </View>
        </View>
        <View style={styles.statsRow}>
          <Pressable style={styles.statCell} onPress={() => navigation.navigate('MyRecipes')}>
            <Text style={styles.statNum}>
              {recipeCount}
              {!isSubscriptionActive(settings) && <Text style={styles.statNumCap}>/{FREE_RECIPE_CAP}</Text>}
            </Text>
            <Text style={styles.statLabel}>{t('profile.recipes')}</Text>
          </Pressable>
          <Pressable style={styles.statCell} onPress={goToKitchen}>
            <Text style={styles.statNum}>{joinedKitchenCount}</Text>
            <Text style={styles.statLabel}>{t('profile.kitchensJoined')}</Text>
          </Pressable>
        </View>
      </View>

      {!subscriptionActive ? (
        <Pressable onPress={() => navigation.navigate('Paywall')} style={styles.premiumBanner}>
          <View style={styles.premiumGlow} />
          <View style={styles.premiumIcon}>
            <Text style={{ fontSize: 22 }}>✨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumTitle}>{t('profile.goPremium')}</Text>
            <Text style={styles.premiumSub}>{t('profile.goPremiumSub')}</Text>
          </View>
        </Pressable>
      ) : (
        settings.plan === 'monthly' && (
          <Pressable onPress={() => navigation.navigate('Paywall')} style={styles.premiumBanner}>
            <View style={styles.premiumGlow} />
            <View style={styles.premiumIcon}>
              <Text style={{ fontSize: 22 }}>💰</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumTitle}>{t('profile.switchAnnual')}</Text>
              <Text style={styles.premiumSub}>{t('profile.switchAnnualSub')}</Text>
            </View>
          </Pressable>
        )
      )}

      <SectionLabel>{t('profile.preferences')}</SectionLabel>
      <GroupedList>
        <ListRow
          label={t('profile.dietaryCuisinePrefs')}
          value={`${onboarding.quiz.household} · ${onboarding.quiz.countries[0] ?? t('profile.anyShort')}`}
          onPress={() => navigation.navigate('OnboardingQuiz')}
        />
        <ListRow label={t('profile.unitSystem')} value={settings.unit === 'metric' ? t('profile.metric') : t('profile.us')} onPress={toggleUnit} />
        <ListRow label={t('profile.languageDisplay')} value={settings.language === 'en' ? t('profile.english') : t('profile.spanish')} isLast onPress={toggleLanguage} />
      </GroupedList>

      <SectionLabel>{t('profile.cookingAbroad')}</SectionLabel>
      <GroupedList>
        <ListRow
          label={t('profile.cookingAbroadMode')}
          isLast
          right={<ToggleSwitch value={onboarding.quiz.diaspora} onValueChange={toggleCookingAbroad} />}
        />
      </GroupedList>

      <SectionLabel>{t('profile.notifications')}</SectionLabel>
      <GroupedList>
        {/* Gates the reminder PartyPlannerScreen schedules from "Remind me
            how many days before" — see onSave() there. */}
        <ListRow label={t('profile.partyReminders')} right={<ToggleSwitch value={settings.notif.party} onValueChange={() => toggleNotif('party')} />} />
        {/* Covers kitchen join requests and recipe requests — see the
            "Kitchen requests" group on NotificationsScreen. */}
        <ListRow label={t('profile.socialNotifications')} isLast right={<ToggleSwitch value={settings.notif.social} onValueChange={() => toggleNotif('social')} />} />
      </GroupedList>

      <SectionLabel>{t('profile.kitchen')}</SectionLabel>
      <GroupedList>
        <ListRow label={t('profile.kitchen')} value={session ? undefined : t('profile.signInToJoin')} isLast onPress={goToKitchen} />
      </GroupedList>

      <SectionLabel>{t('profile.account')}</SectionLabel>
      <GroupedList>
        <ListRow
          label={session ? session.user.email ?? t('profile.signedIn') : t('profile.emailPassword')}
          value={session ? t('profile.signedIn') : supabaseConfigured ? t('profile.notSignedIn') : undefined}
          onPress={() =>
            Alert.alert(
              t('profile.account'),
              session
                ? t('profile.alerts.accountSignedInBody')
                : supabaseConfigured
                  ? t('profile.alerts.accountNotSignedInConfigured')
                  : t('profile.alerts.accountNotConfigured'),
            )
          }
        />
        <ListRow label={t('profile.exportMyData')} onPress={() => Alert.alert(t('profile.exportMyData'), t('profile.alerts.exportBody'))} />
        {subscriptionActive && !settings.planCancelled && <ListRow label={t('profile.cancelSubscription')} onPress={cancelSubscription} />}
        <ListRow label={deleting ? t('profile.deleting') : t('profile.deleteAccount')} danger isLast onPress={deleting ? () => {} : deleteAccount} />
      </GroupedList>

      <SectionLabel>{t('profile.support')}</SectionLabel>
      <GroupedList>
        <ListRow label={t('profile.needHelp')} onPress={() => navigation.navigate('SupportChat')} />
        <ListRow label={t('profile.privacyPolicy')} onPress={() => navigation.navigate('Legal', { doc: 'privacy' })} />
        <ListRow label={t('profile.termsOfService')} isLast onPress={() => navigation.navigate('Legal', { doc: 'terms' })} />
      </GroupedList>

      <Text style={styles.logout} onPress={logOut}>
        {t('profile.logOut')}
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
  statNumCap: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.secondaryText },
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
