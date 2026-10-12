import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../theme/theme';

interface Props {
  style?: TextStyle;
}

/** Short, consistent disclosure shown near any photo/text input that gets
 * sent to OpenAI — distinct from a recipe's own photo, which stays with the
 * recipe in cloud storage rather than going to an AI provider. */
export function AIDisclosureNote({ style }: Props) {
  const { t } = useTranslation();
  return <Text style={[styles.text, style]}>{t('common.aiDisclosure')}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.tertiaryText,
    fontFamily: fonts.bodyMedium,
    textAlign: 'center',
    marginTop: 14,
  },
});
