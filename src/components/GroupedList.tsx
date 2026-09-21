import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';
import { ChevronRightIcon } from './Icon';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function GroupedList({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

interface RowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
  danger?: boolean;
  right?: React.ReactNode;
}

export function ListRow({ label, value, onPress, isLast, danger, right }: RowProps) {
  const content = (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <Text style={[styles.rowLabel, danger && { color: colors.coralSoft }]}>{label}</Text>
      {value != null && <Text style={styles.rowValue}>{value}</Text>}
      {right}
      {onPress && !right && <ChevronRightIcon />}
    </View>
  );
  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.bodyExtraBold,
    color: colors.tertiaryText,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 9,
  },
  group: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.secondaryText,
  },
});
