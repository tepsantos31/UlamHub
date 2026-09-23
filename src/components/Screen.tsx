import React from 'react';
import { ScrollView, View, KeyboardAvoidingView, Platform, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/theme';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  scrollEnabled?: boolean;
  withTabBarSpace?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/** Standard screen padding: safe-area top + prototype's 20px side gutter,
 * plus extra bottom room when the floating tab bar is visible over the content. */
export function Screen({ children, scroll = true, scrollEnabled = true, withTabBarSpace = true, style, contentContainerStyle }: Props) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + 10,
    paddingHorizontal: 20,
    paddingBottom: (withTabBarSpace ? 110 : 24) + insets.bottom,
  };
  if (!scroll) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <View style={[styles.flex, { backgroundColor: colors.screenBg }, padding, style]}>{children}</View>
      </KeyboardAvoidingView>
    );
  }
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        style={[styles.flex, { backgroundColor: colors.screenBg }, style]}
        contentContainerStyle={[padding, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
