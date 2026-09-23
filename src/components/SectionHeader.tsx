import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme/theme';

interface Props {
  title: string;
  right?: string;
  onPressRight?: () => void;
}

export function SectionHeader({ title, right, onPressRight }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {right != null &&
        (onPressRight ? (
          <Pressable onPress={onPressRight} hitSlop={8}>
            <Text style={styles.right}>{right}</Text>
          </Pressable>
        ) : (
          <Text style={styles.right}>{right}</Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.ink,
  },
  right: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.tealDark,
  },
});
