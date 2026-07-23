/** App-wide surface colors, keyed by color scheme. Single source of truth —
 * the navigation theme paints screen containers with `background`, so screens
 * don't need their own backgroundColor. */
export const palette = {
  light: {
    background: '#F4F4F6',
    foreground: '#111114',
    card: '#FFFFFF',
  },
  dark: {
    background: '#0B0B0D',
    foreground: '#FFFFFF',
    card: '#1A1A1E',
  },
} as const;
