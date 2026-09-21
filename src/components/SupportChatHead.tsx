import React, { useRef } from 'react';
import { Animated, PanResponder, Dimensions, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BUBBLE = 56;
const MARGIN = 14;
const DRAG_THRESHOLD = 6; // below this, a gesture counts as a tap, not a drag
const BOTTOM_CLEARANCE = 110; // stays clear of the floating pill nav

const START = { x: SCREEN_W - BUBBLE - MARGIN, y: SCREEN_H - 240 };

/** Messenger-style floating bubble: drag it anywhere, it snaps to the nearest
 * edge on release; a plain tap (no meaningful movement) opens Support chat. */
export function SupportChatHead() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const pan = useRef(new Animated.ValueXY(START)).current;
  const lastPos = useRef(START);
  const dragged = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragged.current = false;
        pan.setOffset(lastPos.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gesture) => {
        if (Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD) {
          dragged.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(evt, gesture);
      },
      onPanResponderRelease: (_evt, gesture) => {
        pan.flattenOffset();
        const rawX = lastPos.current.x + gesture.dx;
        const rawY = lastPos.current.y + gesture.dy;
        const clampedY = Math.max(60, Math.min(SCREEN_H - BUBBLE - BOTTOM_CLEARANCE, rawY));
        const snapX = rawX + BUBBLE / 2 < SCREEN_W / 2 ? MARGIN : SCREEN_W - BUBBLE - MARGIN;
        lastPos.current = { x: snapX, y: clampedY };
        Animated.spring(pan, { toValue: lastPos.current, useNativeDriver: false, friction: 6 }).start();

        if (!dragged.current) {
          navigation.navigate('SupportChat');
        }
      },
    }),
  ).current;

  return (
    <Animated.View style={[styles.bubble, { transform: pan.getTranslateTransform() }]} {...panResponder.panHandlers}>
      <Text style={{ fontSize: 22 }}>💬</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    backgroundColor: colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#14190C',
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 50,
  },
});
