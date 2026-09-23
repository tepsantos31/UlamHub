import { getJSON, setJSON, KEYS } from './db';
import { OnboardingState } from '../types/models';
import { pushOnboarding } from '../lib/sync';

const DEFAULT_STATE: OnboardingState = {
  complete: false,
  quiz: { household: 'family', countries: ['Filipino'], skill: 'home', diet: [], diaspora: false },
};

// Older saved onboarding state (before the Region -> Country rebrand) stored
// `quiz.regions` instead of `quiz.countries`. AsyncStorage just deserializes
// whatever JSON was persisted, so a device that onboarded before this change
// would otherwise crash every screen that reads `quiz.countries`.
function migrateQuiz(quiz: any): OnboardingState['quiz'] {
  if (Array.isArray(quiz?.countries)) return quiz;
  return { ...quiz, countries: DEFAULT_STATE.quiz.countries };
}

export async function getOnboarding(): Promise<OnboardingState> {
  const state = await getJSON<OnboardingState>(KEYS.onboarding, DEFAULT_STATE);
  return { ...state, quiz: migrateQuiz(state.quiz) };
}

export async function setOnboarding(state: OnboardingState): Promise<void> {
  await setJSON(KEYS.onboarding, state);
  pushOnboarding(state).catch(() => {});
}
