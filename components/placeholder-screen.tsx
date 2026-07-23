import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMinimizeOnScroll } from '@/components/glass-tabs';
import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';

/** Temporary screen body: enough scrollable content to exercise the
 * tab bar's minimize-on-scroll while the real screens are built.
 * No backgroundColor here — the navigation theme paints the screen
 * container, which keeps tab-switch fades flash-free. */
export function PlaceholderScreen({ title }: { title: string }) {
  const onScroll = useMinimizeOnScroll();
  const insets = useSafeAreaInsets();
  const colors = useColorScheme() === 'dark' ? palette.dark : palette.light;

  return (
    <Animated.ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingHorizontal: 20,
        paddingBottom: 140,
      }}>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={[styles.card, { backgroundColor: colors.card }]} />
      ))}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 34,
    fontFamily: fonts.bold,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  card: {
    height: 96,
    borderRadius: 20,
    borderCurve: 'continuous',
    marginBottom: 12,
  },
});
