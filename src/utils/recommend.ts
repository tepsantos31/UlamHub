import { QuizState, Recipe } from '../types/models';

/** Simple rule-based personalization score — no ML needed, just reflects
 * the onboarding quiz (countries/diet/skill) the way the design intends. */
export function scoreRecipe(recipe: Recipe, quiz: QuizState): number {
  let score = recipe.rating;
  if (quiz.countries.includes(recipe.country as any)) score += 2;
  if (quiz.diet.length > 0 && recipe.dietTags?.some((d) => quiz.diet.includes(d))) score += 1.5;
  if (quiz.skill === 'beginner' && recipe.diff === 'Experienced') score -= 1.5;
  if (quiz.skill === 'pro' && recipe.diff === 'Beginner') score -= 0.3;
  return score;
}

export function rankRecipes(recipes: Recipe[], quiz: QuizState): Recipe[] {
  return [...recipes].sort((a, b) => scoreRecipe(b, quiz) - scoreRecipe(a, quiz));
}
