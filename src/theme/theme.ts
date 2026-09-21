// Colors, type scale and radii ported 1:1 from the UlamHub design prototype
// (design/UlamHub.dc.html <style> block + inline styles).

export const colors = {
  pageBg: '#E7E5DE',
  screenBg: '#F4F2EC',
  ink: '#17302D',
  inkSoft: '#24423E',

  deepGreen: '#0E3B39',
  deepGreenLight: '#14524E',
  black: '#1E1E1B',
  nearBlack: '#1C1C1A',

  teal: '#43C1B4',
  tealDark: '#34A79A',
  tealLink: '#17897B',
  mint: '#D2ECE7',
  mintText: '#2C534C',

  sage: '#7C8A6E',
  sageMuted: '#6D7A62',
  sageText: '#5C6B52',
  secondaryText: '#8A937D',
  tertiaryText: '#9AA290',
  borderMuted: 'rgba(35,51,28,0.12)',
  divider: 'rgba(35,51,28,0.06)',

  gold: '#F7ECD9',
  goldDeep: '#F3E2C4',
  goldChip: '#E9C888',
  goldText: '#B07A25',
  goldTextDeep: '#5C4318',
  goldTextMid: '#8A6A34',
  amber: '#E0982F',

  coral: '#E85C43',
  coralSoft: '#C97A7A',
  coralBg: '#F5E4E4',

  white: '#FFFFFF',
  placeholderA: '#E1DDCF',
  placeholderB: '#E9E5D8',
} as const;

export const fonts = {
  heading: 'Fredoka_600SemiBold',
  headingMedium: 'Fredoka_500Medium',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemiBold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyExtraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const radii = {
  sm: 9,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 26,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
} as const;

export const shadow = {
  card: {
    shadowColor: '#23331C',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  soft: {
    shadowColor: '#23331C',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;
