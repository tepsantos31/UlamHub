import React from 'react';
import { Image, ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/theme';

interface Props {
  uri?: string;
  source?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
}

/** Recipe photo if one is available (a photo the user attached, or a bundled
 * seed-dish asset) — otherwise the same diagonal placeholder swatch the
 * design prototype uses everywhere. `uri` wins over `source` so a custom
 * photo the user uploads for a seed dish actually overrides its bundled art
 * instead of being silently shadowed by it. */
const fillStyle = { width: '100%' as const, height: '100%' as const };

export function PlaceholderImage({ uri, source, style, borderRadius = 0 }: Props) {
  if (uri) {
    return (
      <Image source={{ uri }} style={[fillStyle, { borderRadius }, style] as StyleProp<any>} resizeMode="cover" />
    );
  }
  if (source) {
    return (
      <Image source={source} style={[fillStyle, { borderRadius }, style] as StyleProp<any>} resizeMode="cover" />
    );
  }
  return (
    <LinearGradient
      colors={[colors.placeholderA, colors.placeholderB]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius }, style]}
    />
  );
}
