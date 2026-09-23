import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';
import { PillButton } from './PillButton';

interface Props {
  icon: string;
  title: string;
  body: string;
  onGoPremium: () => void;
}

/** Full-width upsell card shown in place of a premium-only tool's normal
 * content when the account isn't subscribed. Matches RecipeDetailScreen's
 * "This recipe is locked" card so the app has one consistent locked-state look. */
export function PremiumGate({ icon, title, body, onGoPremium }: Props) {
  return (
    <View style={styles.card}>
      <Text style={{ fontSize: 30 }}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <PillButton label="Go Premium" onPress={onGoPremium} style={{ marginTop: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: 28, alignItems: 'center', marginTop: 22 },
  title: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink, marginTop: 12, textAlign: 'center' },
  body: { fontSize: 13, color: colors.sageMuted, textAlign: 'center', marginTop: 8, lineHeight: 19 },
});
