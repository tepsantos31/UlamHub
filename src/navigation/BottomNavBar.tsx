import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/theme';
import { HouseIcon, CompassIcon, CalendarIcon, CartIcon, PlusIcon } from '../components/Icon';
import { RootStackParamList } from './types';

// Custom floating pill nav ported from the design prototype — only 4 real tabs
// are shown as icons (Home/Browse/Planner/Grocery); Profile is reached from the
// Home screen's avatar and has no icon here, matching the prototype exactly.
export function BottomNavBar({ state, navigation }: BottomTabBarProps) {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const active = state.routes[state.index].name;

  const iconFor = (route: string) => {
    const on = active === route;
    const color = on ? colors.deepGreen : 'rgba(255,255,255,0.72)';
    switch (route) {
      case 'Home':
        return <HouseIcon color={color} />;
      case 'Browse':
        return <CompassIcon color={color} />;
      case 'Planner':
        return <CalendarIcon color={color} />;
      case 'Grocery':
        return <CartIcon color={color} />;
      default:
        return null;
    }
  };

  const tab = (route: 'Home' | 'Browse' | 'Planner' | 'Grocery') => {
    const on = active === route;
    return (
      <Pressable
        key={route}
        onPress={() => navigation.navigate(route)}
        style={[styles.tabBtn, { backgroundColor: on ? colors.teal : 'transparent' }]}
      >
        {iconFor(route)}
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.pill}>
        {tab('Home')}
        {tab('Browse')}
        <Pressable onPress={() => rootNav.navigate('AddRecipe')} style={styles.fab}>
          <PlusIcon color={colors.deepGreen} />
        </Pressable>
        {tab('Planner')}
        {tab('Grocery')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 26,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30,30,27,0.94)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 30,
    shadowColor: '#14190C',
    shadowOpacity: 0.34,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  tabBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28968C',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
