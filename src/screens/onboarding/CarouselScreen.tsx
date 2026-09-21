import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../navigation/types';
import { colors, fonts, radii } from '../../theme/theme';
import { PlaceholderImage } from '../../components/PlaceholderImage';
import { PillButton } from '../../components/PillButton';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingCarousel'>;

const SLIDES = [
  {
    title: 'Bring every recipe home',
    body: "Import from Instagram, TikTok, YouTube, or a photo of grandma's handwritten notes — AI turns it into a clean recipe card.",
  },
  {
    title: 'Cook cuisines from around the world',
    body: 'Filipino, Italian, American, Mexican and more — with local names and ingredient glossaries.',
  },
  {
    title: 'Let AI plan your week',
    body: 'Meal plans that respect your budget, pantry, and dietary needs — down to the grocery list.',
  },
  {
    title: 'Cook together, wherever',
    body: 'Share a family cookbook and grocery list. Attribute every dish to whoever in the family made it.',
  },
];

export function CarouselScreen({ navigation }: Props) {
  const [slide, setSlide] = useState(0);
  const insets = useSafeAreaInsets();
  const isLast = slide === SLIDES.length - 1;

  const next = () => {
    if (isLast) navigation.navigate('OnboardingAuth');
    else setSlide((s) => s + 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg }}>
      <View style={styles.imageArea}>
        <PlaceholderImage style={{ flex: 1 }} />
        <Pressable style={[styles.skip, { top: insets.top + 16 }]} onPress={() => navigation.navigate('OnboardingAuth')}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, { width: i === slide ? 22 : 7, backgroundColor: i === slide ? colors.tealDark : 'rgba(35,51,28,0.15)' }]} />
          ))}
        </View>
        <Text style={styles.title}>{SLIDES[slide].title}</Text>
        <Text style={styles.body}>{SLIDES[slide].body}</Text>
        <View style={{ flex: 1 }} />
        <PillButton label={isLast ? 'Get started' : 'Next'} onPress={next} style={{ width: '100%' }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageArea: { height: 470 },
  skip: { position: 'absolute', right: 22 },
  skipText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.sage },
  bottom: { flex: 1, paddingHorizontal: 30, paddingBottom: 34, paddingTop: 8, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 7, marginBottom: 26 },
  dot: { height: 7, borderRadius: radii.pill },
  title: {
    fontFamily: fonts.heading,
    fontSize: 29,
    lineHeight: 33,
    color: colors.ink,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22.5,
    color: colors.sageMuted,
    marginTop: 14,
    maxWidth: 300,
    textAlign: 'center',
  },
});
