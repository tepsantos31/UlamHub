import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radii } from '../../theme/theme';
import { Screen } from '../../components/Screen';
import { Chip } from '../../components/Chip';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { PillButton } from '../../components/PillButton';
import { COUNTRIES, DIETS, HOUSEHOLDS, SKILLS } from '../../storage/seed';
import { getOnboarding, setOnboarding } from '../../storage/onboarding';
import { ensureOwnKitchen, getMyKitchens, renameKitchen } from '../../lib/kitchen';
import { Country, Diet, Household, QuizState, Skill } from '../../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingQuiz'>;

export function QuizScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [quiz, setQuiz] = useState<QuizState>({
    household: 'family',
    countries: ['Filipino'],
    skill: 'home',
    diet: [],
    diaspora: false,
  });
  const [kitchenName, setKitchenName] = useState('');
  // Only ask for a kitchen name the very first time through — once onboarding
  // is already complete, this screen is reached from Profile to edit answers,
  // and renaming an existing kitchen from here (rather than from My Kitchen
  // itself) would be a confusing second way to do the same thing.
  const [isFirstRun, setIsFirstRun] = useState(false);

  // Pre-fill from whatever's already saved — this screen is also reached from
  // Profile > "Dietary & cuisine prefs" to edit existing answers, not just
  // first-run onboarding, so it must not silently reset them to defaults.
  useEffect(() => {
    getOnboarding().then((o) => {
      setQuiz(o.quiz);
      setIsFirstRun(!o.complete);
    });
  }, []);

  const toggleCountry = (c: Country) =>
    setQuiz((q) => ({ ...q, countries: q.countries.includes(c) ? q.countries.filter((x) => x !== c) : [...q.countries, c] }));
  const toggleDiet = (d: Diet) =>
    setQuiz((q) => ({ ...q, diet: q.diet.includes(d) ? q.diet.filter((x) => x !== d) : [...q.diet, d] }));

  const finish = async () => {
    const prev = await getOnboarding();
    await setOnboarding({ ...prev, complete: true, quiz });
    if (isFirstRun && kitchenName.trim()) {
      // Best-effort, same spirit as ensureOwnKitchen itself — a hiccup here
      // (offline, local-only/no-backend mode) shouldn't block finishing
      // onboarding. ensureOwnKitchen already raced a default-named kitchen
      // into existence at sign-in, so this renames whatever it created
      // rather than assuming it hasn't run yet.
      try {
        await ensureOwnKitchen();
        const owned = (await getMyKitchens()).find((k) => k.myRole === 'owner');
        if (owned) await renameKitchen(owned.id, kitchenName.trim());
      } catch {
        // ignore — the kitchen just keeps its default name until the user
        // renames it themselves from My Kitchen.
      }
    }
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  return (
    <Screen withTabBarSpace={false} contentContainerStyle={{ paddingBottom: 140 }}>
      <Text style={styles.title}>{t('quiz.title')}</Text>
      <Text style={styles.body}>{t('quiz.body')}</Text>

      {isFirstRun && (
        <>
          <Text style={styles.label}>{t('quiz.kitchenName')}</Text>
          <TextInput
            value={kitchenName}
            onChangeText={setKitchenName}
            placeholder={t('quiz.kitchenNamePlaceholder')}
            placeholderTextColor={colors.tertiaryText}
            style={styles.input}
          />
          <Text style={styles.inputSub}>{t('quiz.kitchenNameSub')}</Text>
        </>
      )}

      <Text style={styles.label}>{t('quiz.whoCookingFor')}</Text>
      <View style={styles.wrapRow}>
        {HOUSEHOLDS.map(([v, l]) => (
          <Chip key={v} label={l} active={quiz.household === v} onPress={() => setQuiz((q) => ({ ...q, household: v as Household }))} />
        ))}
      </View>

      <Text style={styles.label}>{t('quiz.cuisinesYouLove')}</Text>
      <View style={styles.wrapRow}>
        {COUNTRIES.map((c) => (
          <Chip key={c} label={c} active={quiz.countries.includes(c)} onPress={() => toggleCountry(c)} small />
        ))}
      </View>

      <Text style={styles.label}>{t('quiz.howConfident')}</Text>
      <View style={[styles.wrapRow, { flexWrap: 'nowrap' }]}>
        {SKILLS.map(([v, l]) => (
          <View key={v} style={{ flex: 1 }}>
            <Chip label={l} active={quiz.skill === v} onPress={() => setQuiz((q) => ({ ...q, skill: v as Skill }))} />
          </View>
        ))}
      </View>

      <Text style={styles.label}>{t('quiz.dietaryNeeds')}</Text>
      <View style={styles.wrapRow}>
        {DIETS.map((d) => (
          <Chip key={d} label={d} active={quiz.diet.includes(d)} onPress={() => toggleDiet(d)} small />
        ))}
      </View>

      <View style={styles.diasporaRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.diasporaTitle}>{t('quiz.cookingAbroad')}</Text>
          <Text style={styles.diasporaSub}>{t('quiz.cookingAbroadSub')}</Text>
        </View>
        <ToggleSwitch value={quiz.diaspora} onValueChange={() => setQuiz((q) => ({ ...q, diaspora: !q.diaspora }))} />
      </View>

      <PillButton
        label={t('quiz.seeRecommendations')}
        onPress={finish}
        disabled={isFirstRun && !kitchenName.trim()}
        style={{ marginTop: 26 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.heading, fontSize: 27, color: colors.ink, marginTop: 0, letterSpacing: -0.3 },
  body: { fontSize: 14, color: colors.sageMuted, marginTop: 6, lineHeight: 21 },
  label: { fontFamily: fonts.bodyBold, fontSize: 15, marginTop: 28, marginBottom: 12, color: colors.ink },
  input: {
    height: 52,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
  },
  inputSub: { fontSize: 12.5, color: colors.sageMuted, marginTop: 8, lineHeight: 18 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  diasporaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.mint,
  },
  diasporaTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  diasporaSub: { fontSize: 12.5, color: colors.sageMuted, marginTop: 2 },
});
