import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Animated, PanResponder, PanResponderGestureState, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme/theme';
import { Screen } from '../components/Screen';
import { HeaderBar } from '../components/HeaderBar';
import { PillButton } from '../components/PillButton';
import { PlaceholderImage } from '../components/PlaceholderImage';
import { Ingredient, Recipe } from '../types/models';
import { makeRecipeId, saveRecipe, listRecipes } from '../storage/recipes';
import { getSettings } from '../storage/settings';
import { generateRecipePhoto } from '../api/client';
import { canAddRecipe, FREE_RECIPE_CAP, isSubscriptionActive } from '../utils/subscription';

type Props = NativeStackScreenProps<RootStackParamList, 'AddRecipeReview'>;

// Local-only editing shape: `id` exists purely so drag-reordering and React
// keys survive a reorder correctly — it never reaches the saved Recipe.
interface EditableStep {
  id: string;
  n: number;
  text: string;
  sec: number;
}

let stepIdSeq = 0;
const newStepId = () => `step-${Date.now()}-${stepIdSeq++}`;

const ROW_HEIGHT_ESTIMATE = 60; // fallback before a row's real height is measured

function offsetOf(steps: EditableStep[], heights: Record<string, number>, id: string): number {
  let acc = 0;
  for (const s of steps) {
    if (s.id === id) return acc;
    acc += heights[s.id] ?? ROW_HEIGHT_ESTIMATE;
  }
  return acc;
}

export function AddRecipeReviewScreen({ route, navigation }: Props) {
  const { extracted, sourceUrl: initialSourceUrl, method } = route.params;

  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [generatingPhoto, setGeneratingPhoto] = useState(false);
  const [name, setName] = useState(extracted?.name ?? '');
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl ?? extracted?.sourceUrl ?? '');
  const [country, setCountry] = useState(extracted?.country ?? 'Filipino');
  const [region, setRegion] = useState(extracted?.region ?? '');
  const [type, setType] = useState(extracted?.type ?? 'Guisado');
  const [servings, setServings] = useState(String(extracted?.servings ?? 4));
  const [time, setTime] = useState(String(extracted?.timeMinutes ?? 30));
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    extracted?.ingredients?.length ? extracted.ingredients : [{ name: '', qty: 1, unit: 'pc' }],
  );
  const [steps, setSteps] = useState<EditableStep[]>(
    extracted?.steps?.length
      ? extracted.steps.map((s) => ({ ...s, id: newStepId() }))
      : [{ id: newStepId(), n: 1, text: '', sec: 0 }],
  );
  const rowHeightsRef = useRef<Record<string, number>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragMetaRef = useRef<{ id: string; grantOffset: number; height: number } | null>(null);

  const updateIngredient = (i: number, patch: Partial<Ingredient>) =>
    setIngredients((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)));
  const addIngredient = () => setIngredients((prev) => [...prev, { name: '', qty: 1, unit: 'pc' }]);
  const removeIngredient = (i: number) => setIngredients((prev) => prev.filter((_, idx) => idx !== i));

  const updateStep = (id: string, text: string) => setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  const addStep = () => setSteps((prev) => [...prev, { id: newStepId(), n: prev.length + 1, text: '', sec: 0 }]);
  const removeStep = (id: string) =>
    setSteps((prev) => prev.filter((s) => s.id !== id).map((s, idx) => ({ ...s, n: idx + 1 })));

  const handleDragGrant = (id: string, height: number) => {
    dragMetaRef.current = { id, grantOffset: offsetOf(steps, rowHeightsRef.current, id), height };
    dragY.setValue(0);
    setDragId(id);
  };

  const handleDragMove = (gesture: PanResponderGestureState) => {
    const meta = dragMetaRef.current;
    if (!meta) return;
    dragY.setValue(gesture.dy);
    const centerY = meta.grantOffset + gesture.dy + meta.height / 2;
    setSteps((prev) => {
      const dragged = prev.find((s) => s.id === meta.id);
      if (!dragged) return prev;
      const others = prev.filter((s) => s.id !== meta.id);
      let acc = 0;
      let targetIdx = others.length;
      for (let i = 0; i < others.length; i++) {
        const h = rowHeightsRef.current[others[i].id] ?? ROW_HEIGHT_ESTIMATE;
        if (centerY < acc + h / 2) {
          targetIdx = i;
          break;
        }
        acc += h;
      }
      const next = [...others];
      next.splice(targetIdx, 0, dragged);
      if (next.every((s, idx) => s.id === prev[idx]?.id)) return prev;
      return next.map((s, idx) => ({ ...s, n: idx + 1 }));
    });
  };

  const handleDragRelease = () => {
    dragMetaRef.current = null;
    setDragId(null);
    dragY.setValue(0);
  };

  // StepRow's PanResponder is created once (on first mount of that row) so an
  // in-progress gesture never gets interrupted by a re-render. It calls
  // through this ref rather than closing over the handlers above directly,
  // so it always runs the latest logic (with the latest `steps`) even though
  // the responder object itself is never recreated.
  const dragHandlersRef = useRef({ onDragGrant: handleDragGrant, onDragMove: handleDragMove, onDragRelease: handleDragRelease });
  dragHandlersRef.current = { onDragGrant: handleDragGrant, onDragMove: handleDragMove, onDragRelease: handleDragRelease };

  const canSave = name.trim().length > 0 && ingredients.some((i) => i.name.trim());

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to add a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (result.canceled || !result.assets[0]?.uri) return;
    setPhotoUri(result.assets[0].uri);
  };

  const generatePhoto = async () => {
    if (!name.trim()) {
      Alert.alert('Add a name first', 'Give the recipe a name so the AI knows what to generate.');
      return;
    }
    const settings = await getSettings();
    if (!isSubscriptionActive(settings)) {
      Alert.alert('Premium feature', 'Generating a photo with AI is available to UlamHub Premium members.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Go Premium', onPress: () => navigation.navigate('Paywall') },
      ]);
      return;
    }
    setGeneratingPhoto(true);
    try {
      const { imageBase64 } = await generateRecipePhoto({
        name: name.trim(),
        country,
        type,
        ingredients: ingredients.map((i) => i.name).filter(Boolean),
      });
      setPhotoUri(`data:image/png;base64,${imageBase64}`);
    } catch (e: any) {
      Alert.alert('Could not generate photo', e?.message ?? 'Something went wrong — please try again.');
    } finally {
      setGeneratingPhoto(false);
    }
  };

  const choosePhotoSource = () => {
    Alert.alert('Add a photo', undefined, [
      { text: 'Choose from library', onPress: pickPhoto },
      { text: 'Generate with AI', onPress: generatePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const save = async () => {
    const [existing, settings] = await Promise.all([listRecipes(), getSettings()]);
    if (!canAddRecipe(settings, existing)) {
      Alert.alert(
        'Recipe limit reached',
        `Free accounts can save up to ${FREE_RECIPE_CAP} recipes. Subscribe to UlamHub Premium for unlimited recipes.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Go Premium', onPress: () => navigation.navigate('Paywall') },
        ],
      );
      return;
    }
    const id = makeRecipeId(name);
    const recipe: Recipe = {
      id,
      name: name.trim(),
      country,
      region: region.trim() || undefined,
      type,
      time: parseInt(time, 10) || 30,
      kcal: extracted?.kcal ?? 0,
      rating: 0,
      cooks: 0,
      budget: '$$',
      diff: 'Home cook',
      author: 'You',
      servingsBase: parseInt(servings, 10) || 4,
      sourceUrl: sourceUrl.trim() || undefined,
      photoUri,
      ingredients: ingredients.filter((i) => i.name.trim()),
      steps: steps
        .filter((s) => s.text.trim())
        .map(({ id, ...s }, idx) => ({ ...s, n: idx + 1 })),
      nutrition: extracted?.nutrition ?? { protein: 0, carbs: 0, fat: 0, sodium: 0, fiber: 0 },
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
    <Screen withTabBarSpace={false} scrollEnabled={!dragId}>
      <HeaderBar onBack={() => navigation.goBack()} />
      <Text style={styles.title}>Review your recipe</Text>
      <Text style={styles.subtitle}>
        {method === 'leftover'
          ? 'AI dreamed this up from your leftovers — edit anything, then save it to your cookbook.'
          : 'Edit anything the AI got wrong, then save it to your cookbook.'}
      </Text>

      <Pressable onPress={generatingPhoto ? undefined : choosePhotoSource} style={styles.photoPicker}>
        <PlaceholderImage uri={photoUri} style={StyleSheet.absoluteFill} borderRadius={radii.lg} />
        <View style={styles.photoPickerOverlay}>
          {generatingPhoto ? (
            <>
              <ActivityIndicator color={colors.white} />
              <Text style={styles.photoPickerText}>Generating…</Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 20 }}>📷</Text>
              <Text style={styles.photoPickerText}>{photoUri ? 'Change photo' : 'Add a photo'}</Text>
            </>
          )}
        </View>
      </Pressable>

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
      <Field
        label="Source link (optional)"
        value={sourceUrl}
        onChangeText={setSourceUrl}
        placeholder="https://…"
        keyboardType="url"
        autoCapitalize="none"
      />
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
      <Text style={styles.h2Sub}>Drag the ⠿ handle to reorder a step</Text>
      <View style={{ position: 'relative' }}>
        {steps.map((st, i) => (
          <StepRow
            key={st.id}
            step={st}
            isDragging={dragId === st.id}
            dragY={dragY}
            onChangeText={(text) => updateStep(st.id, text)}
            onRemove={() => removeStep(st.id)}
            onLayoutHeight={(h) => {
              rowHeightsRef.current[st.id] = h;
            }}
            dragHandlersRef={dragHandlersRef}
          />
        ))}
        {dragId &&
          (() => {
            const dragged = steps.find((s) => s.id === dragId);
            const meta = dragMetaRef.current;
            if (!dragged || !meta) return null;
            return (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.stepRow,
                  styles.floatingStepRow,
                  { top: meta.grantOffset, transform: [{ translateY: dragY }] },
                ]}
              >
                <Text style={styles.dragHandle}>⠿</Text>
                <Text style={styles.stepNum}>{dragged.n}</Text>
                <View style={[styles.input, { flex: 1, minHeight: 44, justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 14, color: colors.ink, fontFamily: fonts.bodyMedium }} numberOfLines={3}>
                    {dragged.text || 'Describe this step…'}
                  </Text>
                </View>
                <View style={styles.removeBtn} />
              </Animated.View>
            );
          })()}
      </View>
      <Pressable onPress={addStep}>
        <Text style={styles.addLink}>＋ Add step</Text>
      </Pressable>

      <PillButton label="Save recipe" onPress={save} disabled={!canSave} style={{ marginTop: 26 }} />
    </Screen>
  );
}

function StepRow({
  step,
  isDragging,
  dragY,
  onChangeText,
  onRemove,
  onLayoutHeight,
  dragHandlersRef,
}: {
  step: EditableStep;
  isDragging: boolean;
  dragY: Animated.Value;
  onChangeText: (text: string) => void;
  onRemove: () => void;
  onLayoutHeight: (height: number) => void;
  dragHandlersRef: React.MutableRefObject<{
    onDragGrant: (id: string, height: number) => void;
    onDragMove: (gesture: PanResponderGestureState) => void;
    onDragRelease: () => void;
  }>;
}) {
  const heightRef = useRef(ROW_HEIGHT_ESTIMATE);

  // Created once per row (rows are keyed by stable `id`, so this survives
  // reorders without remounting) so an active drag gesture is never
  // interrupted by the parent re-rendering mid-gesture.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => dragHandlersRef.current.onDragGrant(step.id, heightRef.current),
      onPanResponderMove: (_evt, gesture) => dragHandlersRef.current.onDragMove(gesture),
      onPanResponderRelease: () => dragHandlersRef.current.onDragRelease(),
      onPanResponderTerminate: () => dragHandlersRef.current.onDragRelease(),
    }),
  ).current;

  return (
    <View
      style={[styles.stepRow, isDragging && { opacity: 0 }]}
      onLayout={(e) => {
        heightRef.current = e.nativeEvent.layout.height;
        onLayoutHeight(e.nativeEvent.layout.height);
      }}
    >
      <View {...panResponder.panHandlers} style={styles.dragHandleHit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.dragHandle}>⠿</Text>
      </View>
      <Text style={styles.stepNum}>{step.n}</Text>
      <TextInput
        value={step.text}
        onChangeText={onChangeText}
        placeholder="Describe this step…"
        placeholderTextColor={colors.tertiaryText}
        multiline
        style={[styles.input, { flex: 1, minHeight: 44 }]}
      />
      <Pressable onPress={onRemove} style={styles.removeBtn}>
        <Text style={styles.removeBtnText}>✕</Text>
      </Pressable>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'numeric' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
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
        autoCapitalize={props.autoCapitalize}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, marginTop: 6 },
  subtitle: { fontSize: 13.5, color: colors.sageMuted, marginTop: 6, lineHeight: 20 },
  photoPicker: { height: 150, borderRadius: radii.lg, overflow: 'hidden', marginTop: 18, backgroundColor: colors.white },
  photoPickerOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,59,57,0.28)', gap: 4 },
  photoPickerText: { color: colors.white, fontFamily: fonts.bodyExtraBold, fontSize: 12.5 },
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
  h2Sub: { fontSize: 12, color: colors.secondaryText, marginTop: -6, marginBottom: 10 },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  dragHandleHit: { width: 22, alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingVertical: 6 },
  dragHandle: { fontSize: 18, color: colors.tertiaryText },
  stepNum: { width: 22, fontFamily: fonts.bodyBold, color: colors.tealLink, fontSize: 14, marginTop: 12 },
  removeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.coralBg, alignItems: 'center', justifyContent: 'center' },
  floatingStepRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingVertical: 4,
    shadowColor: '#14190C',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  removeBtnText: { color: colors.coral, fontWeight: '700' },
  addLink: { color: colors.tealLink, fontFamily: fonts.bodyBold, fontSize: 13.5, marginTop: 4 },
});
