import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { fonts } from '@/constants/fonts';

const TRACK_PADDING = 3;
const HEIGHT = 44;
/** Snappy but settled; interruptible when the user taps quickly. */
const SPRING = { damping: 32, stiffness: 420, mass: 0.9 } as const;

const THEME = {
  light: {
    track: 'rgba(17,17,20,0.07)',
    thumb: '#1C1C21',
    label: '#111114',
    activeLabel: '#FFFFFF',
  },
  dark: {
    track: 'rgba(255,255,255,0.08)',
    thumb: '#F2F2F5',
    label: '#FFFFFF',
    activeLabel: '#111114',
  },
} as const;

export type SegmentedControlProps = {
  segments: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  style?: StyleProp<ViewStyle>;
};

/** Custom segmented control in the app's pill language: inverted sliding
 * thumb (same colors as the Start buttons), SF Pro Rounded labels, spring
 * slide between segments. */
export function SegmentedControl({
  segments,
  selectedIndex,
  onChange,
  style,
}: SegmentedControlProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = THEME[scheme];

  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / segments.length : 0;

  const offset = useSharedValue(selectedIndex);
  useEffect(() => {
    offset.value = withSpring(selectedIndex, SPRING);
  }, [selectedIndex, offset]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * segmentWidth }],
  }));

  return (
    <View
      style={[styles.track, { backgroundColor: theme.track }, style]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            { width: segmentWidth, backgroundColor: theme.thumb },
            thumbStyle,
          ]}
        />
      )}
      {segments.map((segment, index) => (
        <Pressable
          key={segment}
          onPress={() => {
            if (index !== selectedIndex) onChange(index);
          }}
          style={styles.segment}>
          <Text
            style={[
              styles.label,
              { color: index === selectedIndex ? theme.activeLabel : theme.label },
            ]}>
            {segment}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    borderCurve: 'continuous',
    padding: TRACK_PADDING,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: (HEIGHT - TRACK_PADDING * 2) / 2,
    borderCurve: 'continuous',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontFamily: fonts.semibold,
  },
});
