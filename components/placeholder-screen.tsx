import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMinimizeOnScroll } from '@/components/glass-tabs';

/** Temporary screen body: enough scrollable content to exercise the
 * tab bar's minimize-on-scroll while the real screens are built. */
export function PlaceholderScreen({ title }: { title: string }) {
  const onScroll = useMinimizeOnScroll();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';

  return (
    <Animated.ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={{ flex: 1, backgroundColor: dark ? '#0B0B0D' : '#F4F4F6' }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingHorizontal: 20,
        paddingBottom: 140,
      }}>
      <Text style={[styles.title, { color: dark ? '#FFFFFF' : '#111114' }]}>{title}</Text>
      {Array.from({ length: 12 }, (_, i) => (
        <View
          key={i}
          style={[styles.card, { backgroundColor: dark ? '#1A1A1E' : '#FFFFFF' }]}
        />
      ))}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 34,
    fontWeight: '700',
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
