/** SF Pro Rounded — the app-wide typeface, loaded at runtime in the root
 * layout. Use these families instead of `fontWeight`: each entry is a single
 * face, and pairing a face with a mismatched fontWeight makes iOS synthesize
 * or fall back to the system font. */
export const fonts = {
  regular: 'SFProRounded-Regular',
  medium: 'SFProRounded-Medium',
  semibold: 'SFProRounded-Semibold',
  bold: 'SFProRounded-Bold',
  heavy: 'SFProRounded-Heavy',
} as const;

/** Font map for expo-font's useFonts, keyed by PostScript name so runtime
 * loading (Expo Go) and build-time embedding (dev builds) resolve the same
 * fontFamily strings. */
export const fontAssets = {
  [fonts.regular]: require('@/assets/fonts/SF-Pro-Rounded-Regular.otf'),
  [fonts.medium]: require('@/assets/fonts/SF-Pro-Rounded-Medium.otf'),
  [fonts.semibold]: require('@/assets/fonts/SF-Pro-Rounded-Semibold.otf'),
  [fonts.bold]: require('@/assets/fonts/SF-Pro-Rounded-Bold.otf'),
  [fonts.heavy]: require('@/assets/fonts/SF-Pro-Rounded-Heavy.otf'),
};
