/** Colors shared across the practice/results session components. */
export const sessionColors = {
  light: {
    accent: '#3478F6',
    accentFaded: '#AECBFA',
    dimmed: '#B9B9BE',
    good: '#2FCC59',
    warn: '#FF9F0A',
    bad: '#FF3B30',
    controlCard: 'rgba(255,255,255,0.72)',
    controlCardSolid: '#FFFFFF',
    circleButton: '#EDEDF0',
    pillDark: '#141418',
    pillDarkText: '#FFFFFF',
    waveformBar: '#C7C7CC',
  },
  dark: {
    accent: '#4C8DFF',
    accentFaded: '#2E4A79',
    dimmed: '#5A5A62',
    good: '#30D158',
    warn: '#FF9F0A',
    bad: '#FF453A',
    controlCard: 'rgba(30,30,34,0.72)',
    controlCardSolid: '#1A1A1E',
    circleButton: '#2A2A2F',
    pillDark: '#F2F2F5',
    pillDarkText: '#111114',
    waveformBar: '#4A4A52',
  },
} as const;

export type SessionColors = (typeof sessionColors)['light'];

/** Aa button presets for the live reading text. */
export const TELEPROMPTER_TEXT_SIZES = [28, 34, 40] as const;
