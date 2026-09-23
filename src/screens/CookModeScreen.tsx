import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, fonts, radii } from '../theme/theme';
import { CloseIcon } from '../components/Icon';
import { Recipe } from '../types/models';
import { getRecipe, listRecipes } from '../storage/recipes';
import { getSettings } from '../storage/settings';
import { canAccessRecipe } from '../utils/subscription';

type Props = NativeStackScreenProps<RootStackParamList, 'CookMode'>;

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function CookModeScreen({ route, navigation }: Props) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [timer, setTimer] = useState<{ total: number; remaining: number; running: boolean } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Defense-in-depth: RecipeDetailScreen already hides the entry point for
    // a locked recipe, but this guards CookMode itself against any other
    // path in (e.g. a future deep link) reaching it directly.
    (async () => {
      const [r, settings, all] = await Promise.all([getRecipe(route.params.recipeId), getSettings(), listRecipes()]);
      if (!r) return;
      if (!canAccessRecipe(r, settings, all)) {
        Alert.alert('Recipe locked', 'This recipe needs an active subscription to cook.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setRecipe(r);
    })();
  }, [route.params.recipeId]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timer?.running) {
      intervalRef.current = setInterval(() => {
        setTimer((t) => {
          if (!t) return t;
          if (t.remaining <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return { ...t, remaining: 0, running: false };
          }
          return { ...t, remaining: t.remaining - 1 };
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer?.running]);

  if (!recipe) return <View style={styles.wrap} />;

  const step = recipe.steps[stepIndex];
  const progress = ((stepIndex + 1) / recipe.steps.length) * 100;

  const goStep = (i: number) => {
    setStepIndex(i);
    setTimer(null);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.topRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.exitBtn}>
          <CloseIcon />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.modeLabel}>COOK MODE · {recipe.name.toUpperCase()}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.stepEyebrow}>
          STEP {stepIndex + 1} OF {recipe.steps.length}
        </Text>
        <Text style={styles.stepText}>{step.text}</Text>

        {timer ? (
          <View style={styles.timerBox}>
            <Text style={styles.timerName}>STEP {step.n} TIMER</Text>
            <View style={styles.timerRow}>
              <Text style={styles.timerVal}>{fmtTime(timer.remaining)}</Text>
              <Pressable
                onPress={() => setTimer((t) => (t ? { ...t, running: !t.running } : t))}
                style={styles.timerBtn}
              >
                <Text style={styles.timerBtnText}>{timer.running ? 'Pause' : timer.remaining === 0 ? 'Done' : 'Resume'}</Text>
              </Pressable>
            </View>
            <View style={styles.timerTrack}>
              <View style={[styles.timerFill, { width: `${((timer.total - timer.remaining) / timer.total) * 100}%` }]} />
            </View>
          </View>
        ) : step.sec > 0 ? (
          <Pressable onPress={() => setTimer({ total: step.sec, remaining: step.sec, running: true })} style={styles.startTimerBtn}>
            <Text style={styles.startTimerText}>⏱ Start {step.tl} timer</Text>
          </Pressable>
        ) : null}

        <View style={{ flex: 1 }} />
        <View style={styles.dotsRow}>
          {recipe.steps.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i <= stepIndex ? colors.teal : 'rgba(255,255,255,0.16)' }]} />
          ))}
        </View>
        <Text style={styles.voiceHint}>🎙️ Say "next step", "set timer", or "repeat"</Text>
      </View>

      <View style={styles.navRow}>
        <Pressable onPress={() => goStep(Math.max(0, stepIndex - 1))} style={styles.prevBtn} disabled={stepIndex === 0}>
          <Text style={styles.prevBtnText}>‹</Text>
        </Pressable>
        <Pressable
          onPress={() => (stepIndex === recipe.steps.length - 1 ? navigation.goBack() : goStep(stepIndex + 1))}
          style={styles.nextBtn}
        >
          <Text style={styles.nextBtnText}>{stepIndex === recipe.steps.length - 1 ? 'Finish' : 'Next step ›'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.nearBlack, paddingHorizontal: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  exitBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  modeLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.tealDark },
  progressTrack: { height: 5, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.teal, borderRadius: 4 },
  body: { marginTop: 36, flex: 1 },
  stepEyebrow: { fontFamily: fonts.headingMedium, fontSize: 15, color: '#7E8A6C', letterSpacing: 0.5 },
  stepText: { fontFamily: fonts.headingMedium, fontSize: 29, color: colors.screenBg, lineHeight: 37, marginTop: 16 },
  timerBox: { marginTop: 26, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radii.xl, padding: 20 },
  timerName: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.tealDark, textTransform: 'uppercase', letterSpacing: 0.4 },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  timerVal: { fontFamily: fonts.heading, fontSize: 44, color: colors.screenBg, letterSpacing: 1 },
  timerBtn: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 14, backgroundColor: colors.teal },
  timerBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.deepGreenLight },
  timerTrack: { height: 6, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 14, overflow: 'hidden' },
  timerFill: { height: '100%', backgroundColor: colors.tealDark, borderRadius: 4 },
  startTimerBtn: { marginTop: 22, height: 52, borderRadius: radii.lg, borderWidth: 1.5, borderColor: 'rgba(67,193,180,0.5)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  startTimerText: { color: colors.teal, fontFamily: fonts.bodyBold, fontSize: 15 },
  dotsRow: { flexDirection: 'row', gap: 7, marginBottom: 18 },
  dot: { flex: 1, height: 5, borderRadius: 4 },
  voiceHint: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12.5, fontFamily: fonts.bodySemiBold, marginBottom: 18 },
  navRow: { flexDirection: 'row', gap: 12 },
  prevBtn: { width: 64, height: 58, borderRadius: radii.lg, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  prevBtnText: { color: colors.screenBg, fontSize: 22 },
  nextBtn: { flex: 1, height: 58, borderRadius: radii.lg, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.deepGreenLight },
});
