import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../../navigation/types';
import { colors, fonts } from '../../theme/theme';
import { Screen } from '../../components/Screen';
import { Chip } from '../../components/Chip';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { PillButton } from '../../components/PillButton';
import { COUNTRIES, DIETS, HOUSEHOLDS, SKILLS } from '../../storage/seed';
import { getOnboarding, setOnboarding } from '../../storage/onboarding';
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

  // Pre-fill from whatever's already saved — this screen is also reached from
  // Profile > "Dietary & cuisine prefs" to edit existing answers, not just
  // first-run onboarding, so it must not silently reset them to defaults.
  useEffect(() => {
    getOnboarding().then((o) => setQuiz(o.quiz));
  }, []);

  const toggleCountry = (c: Country) =>
    setQuiz((q) => ({ ...q, countries: q.countries.includes(c) ? q.countries.filter((x) => x !== c) : [...q.countries, c] }));
  const toggleDiet = (d: Diet) =>
    setQuiz((q) => ({ ...q, diet: q.diet.includes(d) ? q.diet.filter((x) => x !== d) : [...q.diet, d] }));

  const finish = async () => {
    const prev = await getOnboarding();
    await setOnboarding({ ...prev, complete: true, quiz });
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  return (
    <Screen withTabBarSpace={false} contentContainerStyle={{ paddingBottom: 140 }}>
      <Text style={styles.title}>{t('quiz.title')}</Text>
      <Text style={styles.body}>{t('quiz.body')}</Text>

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

      <PillButton label={t('quiz.seeRecommendations')} onPress={finish} style={{ marginTop: 26 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.heading, fontSize: 27, color: colors.ink, marginTop: 0, letterSpacing: -0.3 },
  body: { fontSize: 14, color: colors.sageMuted, marginTop: 6, lineHeight: 21 },
  label: { fontFamily: fonts.bodyBold, fontSize: 15, marginTop: 28, marginBottom: 12, color: colors.ink },
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
