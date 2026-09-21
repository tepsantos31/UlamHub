import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, shadow } from '../theme/theme';
import { BackChevronIcon } from './Icon';

interface Props {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function HeaderBar({ title, onBack, right }: Props) {
  return (
    <View style={styles.row}>
      {onBack && (
        <Pressable onPress={onBack} style={[styles.circleBtn, shadow.soft]}>
          <BackChevronIcon />
        </Pressable>
      )}
      {title != null && <Text style={styles.title}>{title}</Text>}
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.ink,
  },
});
