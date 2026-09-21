import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { colors } from '../theme/theme';

interface Props {
  value: boolean;
  onValueChange: () => void;
}

export function ToggleSwitch({ value, onValueChange }: Props) {
  return (
    <Pressable
      onPress={onValueChange}
      style={[styles.track, { backgroundColor: value ? colors.tealDark : 'rgba(35,51,28,0.18)' }]}
    >
      <View style={[styles.thumb, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 52,
    height: 31,
    borderRadius: 20,
    padding: 3,
    justifyContent: 'center',
  },
  thumb: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
