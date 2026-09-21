import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

export function BackChevronIcon({ size = 15, color = '#17302D' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5l-7 7 7 7" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 14, color = '#F4F2EC' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function HeartIcon({ size = 18, color = '#E85C43' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21z" />
    </Svg>
  );
}

export function ShareIcon({ size = 17, color = '#17302D' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SearchIcon({ size = 19, color = '#9AA290' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path d="m20 20-3.5-3.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function BellIcon({ size = 20, color = '#2C4642' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.7 21a2 2 0 0 1-3.4 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 9, color = '#C4CBB8' }: IconProps) {
  return (
    <Svg width={size} height={size * 1.55} viewBox="0 0 9 15">
      <Path d="M1.5 1l6 6.5-6 6.5" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ size = 22, color = '#0E3B39' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function HouseIcon({ size = 21, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
    </Svg>
  );
}

export function CompassIcon({ size = 21, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={1.9} />
      <Path d="m20 20-3.5-3.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

export function CalendarIcon({ size = 21, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={5} width={17} height={16} rx={2.5} stroke={color} strokeWidth={1.9} />
      <Path d="M3.5 9.5h17M8 3v4M16 3v4" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

export function CartIcon({ size = 21, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16l-1.4 9a2 2 0 0 1-2 1.7H7.4a2 2 0 0 1-2-1.7L4 6z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
      <Path d="M9 6a3 3 0 0 1 6 0" stroke={color} strokeWidth={1.9} />
    </Svg>
  );
}

export function SendIcon({ size = 20, color = '#D2ECE7', fill = '#43C1B4' }: IconProps & { fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12l16-8-6 16-3-6-7-2z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" fill={fill} />
    </Svg>
  );
}

export function BookmarkIcon({ size = 22, color = '#17302D' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
    </Svg>
  );
}
