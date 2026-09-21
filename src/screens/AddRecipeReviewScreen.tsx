import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PillButton } from '../components/PillButton';
import { Ingredient, Recipe, RecipeStep } from '../types/models';
import { makeRecipeId, saveRecipe } from '../storage/recipes';

type Props = NativeStackScreenProps<RootStackParamList, 'AddRecipeReview'>;

export function AddRecipeReviewScreen({ route, navigation }: Props) {
  const { extracted, sourceUrl, method } = route.params;

  const [name, setName] = useState(extracted?.name ?? '');
  const [country, setCountry] = useState(extracted?.country ?? 'Filipino');
  const [region, setRegion] = useState(extracted?.region ?? '');
  const [type, setType] = useState(extracted?.type ?? 'Guisado');
  const [servings, setServings] = useState(String(extracted?.servings ?? 4));
  const [time, setTime] = useState(String(extracted?.timeMinutes ?? 30));
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    extracted?.ingredients?.length ? extracted.ingredients : [{ name: '', qty: 1, unit: 'pc' }],
  );
  const [steps, setSteps] = useState<RecipeStep[]>(
    extracted?.steps?.length ? extracted.steps : [{ n: 1, text: '', sec: 0 }],
  );

  const updateIngredient = (i: number, patch: Partial<Ingredient>) =>
    setIngredients((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)));
  const addIngredient = () => setIngredients((prev) => [...prev, { name: '', qty: 1, unit: 'pc' }]);
  const removeIngredient = (i: number) => setIngredients((prev) => prev.filter((_, idx) => idx !== i));

  const updateStep = (i: number, text: string) => setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, text } : s)));
  const addStep = () => setSteps((prev) => [...prev, { n: prev.length + 1, text: '', sec: 0 }]);
  const removeStep = (i: number) =>
    setSteps((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, n: idx + 1 })));

  const canSave = name.trim().length > 0 && ingredients.some((i) => i.name.trim());

  const save = async () => {
    const id = makeRecipeId(name);
    const recipe: Recipe = {
      id,
      name: name.trim(),
      country,
      region: region.trim() || undefined,
      type,
      time: parseInt(time, 10) || 30,
      kcal: 0,
      rating: 0,
      cooks: 0,
      budget: '$$',
      diff: 'Home cook',
      author: 'You',
      servingsBase: parseInt(servings, 10) || 4,
      sourceUrl,
      ingredients: ingredients.filter((i) => i.name.trim()),
      steps: steps.filter((s) => s.text.trim()).map((s, idx) => ({ ...s, n: idx + 1 })),
      nutrition: { protein: 0, carbs: 0, fat: 0, sodium: 0, fiber: 0 },
      saucePairings: [],
      flavorBalance: [
        { label: 'Sour', val: 40, color: '#8BAF3E' },
        { label: 'Salty', val: 50, color: '#E0982F' },
        { label: 'Sweet', val: 30, color: '#D98A8A' },
      ],
      userAdded: true,
    };
    await saveRecipe(recipe);
    navigation.replace('RecipeDetail', { recipeId: id });
  };

  return (
    <Screen withTabBarSpace={false}>
      <HeaderBar onBack={() => navigation.goBack()} />
      <Text style={styles.title}>Review your recipe</Text>
      <Text style={styles.subtitle}>
        {method === 'leftover'
          ? 'AI dreamed this up from your leftovers — edit anything, then save it to your cookbook.'
          : 'Edit anything the AI got wrong, then save it to your cookbook.'}
      </Text>

      <Field label="Name" value={name} onChangeText={setName} placeholder="Chicken Adobo" />
      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <Field label="Country" value={country} onChangeText={setCountry} placeholder="Filipino" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Type" value={type} onChangeText={setType} placeholder="Guisado" />
        </View>
      </View>
      <Field label="Region (optional)" value={region} onChangeText={setRegion} placeholder="Tagalog" />
      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <Field label="Servings" value={servings} onChangeText={setServings} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Time (min)" value={time} onChangeText={setTime} keyboardType="number-pad" />
        </View>
      </View>

      <Text style={styles.h2}>Ingredients</Text>
      {ingredients.map((ing, i) => (
        <View key={i} style={styles.ingRow}>
          <TextInput
            value={ing.name}
            onChangeText={(v) => updateIngredient(i, { name: v })}
            placeholder="Ingredient"
            placeholderTextColor={colors.tertiaryText}
            style={[styles.input, { flex: 2 }]}
          />
          <TextInput
            value={String(ing.qty)}
            onChangeText={(v) => updateIngredient(i, { qty: parseFloat(v) || 0 })}
            placeholder="Qty"
            keyboardType="numeric"
            placeholderTextColor={colors.tertiaryText}
            style={[styles.input, { flex: 0.7 }]}
          />
          <TextInput
            value={ing.unit}
            onChangeText={(v) => updateIngredient(i, { unit: v })}
            placeholder="unit"
            placeholderTextColor={colors.tertiaryText}
            style={[styles.input, { flex: 0.8 }]}
          />
          <Pressable onPress={() => removeIngredient(i)} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addIngredient}>
        <Text style={styles.addLink}>＋ Add ingredient</Text>
      </Pressable>

      <Text style={styles.h2}>Steps</Text>
      {steps.map((st, i) => (
        <View key={i} style={styles.stepRow}>
          <Text style={styles.stepNum}>{i + 1}</Text>
          <TextInput
            value={st.text}
            onChangeText={(v) => updateStep(i, v)}
            placeholder="Describe this step…"
            placeholderTextColor={colors.tertiaryText}
            multiline
            style={[styles.input, { flex: 1, minHeight: 44 }]}
          />
          <Pressable onPress={() => removeStep(i)} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addStep}>
        <Text style={styles.addLink}>＋ Add step</Text>
      </Pressable>

      <PillButton label="Save recipe" onPress={save} disabled={!canSave} style={{ marginTop: 26 }} />
    </Screen>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'numeric';
}) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.tertiaryText}
        keyboardType={props.keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, marginTop: 6 },
  subtitle: { fontSize: 13.5, color: colors.sageMuted, marginTop: 6, lineHeight: 20 },
  row2: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.sageText, marginBottom: 6 },
  input: {
    height: 46,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
  },
  h2: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, marginTop: 24, marginBottom: 10 },
  ingRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  stepNum: { width: 22, fontFamily: fonts.bodyBold, color: colors.tealLink, fontSize: 14, marginTop: 12 },
  removeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.coralBg, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: colors.coral, fontWeight: '700' },
  addLink: { color: colors.tealLink, fontFamily: fonts.bodyBold, fontSize: 13.5, marginTop: 4 },
});
