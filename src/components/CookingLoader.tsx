import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

interface Props {
  /** Any single emoji/short glyph — kept contextual per screen (🧪 for
   * Leftover Alchemist, 🔍 for Ingredient Scanner, etc.) rather than one
   * generic spinner everywhere. */
  icon?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** A small looping bounce + wobble on a single emoji — used in place of a
 * plain ActivityIndicator wherever the app is actually generating/importing
 * something (recipe import, AI kitchen tools, substitutes, auto-fill), so
 * that wait feels like active work rather than a stalled spinner. Pure
 * Animated API (transform-only, useNativeDriver) — no new dependency, so it
 * doesn't need a native rebuild to ship. */
export function CookingLoader({ icon = '🍳', size = 40, style }: Props) {
  const bounce = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(bounce, { toValue: -10, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(bounce, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(rotate, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(rotate, { toValue: -1, duration: 840, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, rotate]);

  const rotateDeg = rotate.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] });

  return (
    <Animated.Text
      style={[{ fontSize: size, transform: [{ translateY: bounce }, { rotate: rotateDeg }] }, style]}
    >
      {icon}
    </Animated.Text>
  );
}
