import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp, ActivityIndicator } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
  disabled?: boolean;
  textColor?: string;
}

export function PillButton({ label, onPress, variant = 'primary', style, loading, disabled, textColor }: Props) {
  const bg = variant === 'primary' ? colors.deepGreen : variant === 'secondary' ? colors.white : 'transparent';
  const fg = textColor ?? (variant === 'primary' ? colors.screenBg : colors.ink);
  const border = variant === 'secondary' || variant === 'ghost' ? { borderWidth: 1, borderColor: colors.borderMuted } : null;
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.base, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, border, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.label, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
});
