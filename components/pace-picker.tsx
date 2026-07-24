import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';

export type PacePickerProps = {
  options: readonly { label: string; wpm: number }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

const THEME = {
  light: {
    bed: 'rgba(17,17,20,0.06)',
    active: '#1C1C21',
    activeLabel: '#FFFFFF',
  },
  dark: {
    bed: 'rgba(255,255,255,0.08)',
    active: '#F2F2F5',
    activeLabel: '#111114',
  },
} as const;

/** Non-iOS fallback for the reading-pace control; iOS uses the native
 * SwiftUI segmented picker in pace-picker.ios.tsx. */
export function PacePicker({ options, selectedIndex, onSelect }: PacePickerProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = THEME[scheme];
  const colors = palette[scheme];

  return (
    <View style={[styles.segments, { backgroundColor: theme.bed }]}>
      {options.map((option, index) => {
        const active = index === selectedIndex;
        return (
          <Pressable
            key={option.label}
            onPress={() => onSelect(index)}
            style={[styles.segment, active && { backgroundColor: theme.active }]}>
            <Text
              style={[
                styles.segmentLabel,
                { color: active ? theme.activeLabel : colors.foreground },
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    fontSize: 15,
    fontFamily: fonts.semibold,
  },
});
