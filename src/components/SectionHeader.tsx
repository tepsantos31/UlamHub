import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme/theme';

interface Props {
  title: string;
  right?: string;
}

export function SectionHeader({ title, right }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {right != null && <Text style={styles.right}>{right}</Text>}
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
