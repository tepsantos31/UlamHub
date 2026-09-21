import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  small?: boolean;
}

export function Chip({ label, active, onPress, small }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        small && styles.chipSmall,
        { backgroundColor: active ? colors.deepGreen : colors.white, borderColor: active ? colors.deepGreen : colors.borderMuted },
      ]}
    >
      <Text style={[styles.label, small && styles.labelSmall, { color: active ? colors.mint : colors.inkSoft }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  chipSmall: {
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: radii.pill,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  labelSmall: {
    fontSize: 13,
  },
});
