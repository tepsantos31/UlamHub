import { getJSON, setJSON, KEYS } from './db';
import { OnboardingState } from '../types/models';
import { pushOnboarding } from '../lib/sync';

const DEFAULT_STATE: OnboardingState = {
  complete: false,
  quiz: { household: 'family', countries: ['Filipino'], skill: 'home', diet: [], diaspora: false },
};

export async function getOnboarding(): Promise<OnboardingState> {
  return getJSON<OnboardingState>(KEYS.onboarding, DEFAULT_STATE);
}

export async function setOnboarding(state: OnboardingState): Promise<void> {
  await setJSON(KEYS.onboarding, state);
  pushOnboarding(state).catch(() => {});
}
