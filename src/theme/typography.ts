import type { TextStyle } from 'react-native';

/**
 * Archivo static instances generated from the variable font
 * (wght 100–900, wdth 62–125). See assets/fonts.
 */
export const fontFiles = {
  'Archivo-Regular': require('../../assets/fonts/Archivo-Regular.ttf'),
  'Archivo-Medium': require('../../assets/fonts/Archivo-Medium.ttf'),
  'Archivo-SemiBold': require('../../assets/fonts/Archivo-SemiBold.ttf'),
  'Archivo-Bold': require('../../assets/fonts/Archivo-Bold.ttf'),
  'Archivo-Black': require('../../assets/fonts/Archivo-Black.ttf'),
  'Archivo-ExpandedBold': require('../../assets/fonts/Archivo-ExpandedBold.ttf'),
  'Archivo-ExpandedExtraBold': require('../../assets/fonts/Archivo-ExpandedExtraBold.ttf'),
} as const;

export type FontFamily = keyof typeof fontFiles;

export const fonts = {
  regular: 'Archivo-Regular',
  medium: 'Archivo-Medium',
  semibold: 'Archivo-SemiBold',
  bold: 'Archivo-Bold',
  black: 'Archivo-Black',
  expanded: 'Archivo-ExpandedBold',
  expandedHeavy: 'Archivo-ExpandedExtraBold',
} as const satisfies Record<string, FontFamily>;

export type TextVariant =
  | 'display'
  | 'title'
  | 'number'
  | 'headline'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'poster';

/** fontWeight is left unset: each family is a single static instance. */
export const textVariants: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.expandedHeavy, fontSize: 40, lineHeight: 42, letterSpacing: -1 },
  title: { fontFamily: fonts.expandedHeavy, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  number: { fontFamily: fonts.expandedHeavy, fontSize: 56, lineHeight: 58, letterSpacing: -1.5 },
  headline: { fontFamily: fonts.expanded, fontSize: 18, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  poster: { fontFamily: fonts.black, fontSize: 236, lineHeight: 200, letterSpacing: -14 },
};
