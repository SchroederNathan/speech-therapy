import { PlayIcon } from '@hugeicons-pro/core-solid-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { fonts } from '@/constants/fonts';

/** Opal-style layout: 2 full cards centered with a 15% peek of the next card
 * on each side, so the row reads as horizontally scrollable at a glance. */
const ITEMS_CENTERED = 2;
const PEEK_RATIO = 0.15;
const VISIBLE_RATIO = ITEMS_CENTERED + PEEK_RATIO * 2;
/** Outer padding (not margin/gap) on each item keeps the visual gap stable
 * while the card scales down inside its layout box. */
const ITEM_GAP = 6;
const CARD_RADIUS = 36;
/** Width / height of the card's layout box, matched to the design mock. */
const CARD_ASPECT = 0.88;

const THEME = {
  light: {
    // Light backgrounds shine through glass more, so the tint is stronger.
    glassTint: 'rgba(14,14,22,0.60)',
    solidFallback: 'rgba(20,20,28,0.98)',
    buttonTint: 'rgba(20,20,26,0.35)',
    buttonSolid: 'rgba(255,255,255,0.22)',
  },
  dark: {
    glassTint: 'rgba(10,10,16,0.45)',
    solidFallback: 'rgba(18,18,24,0.98)',
    buttonTint: 'rgba(20,20,26,0.35)',
    buttonSolid: 'rgba(255,255,255,0.22)',
  },
} as const;

export type PassageItem = {
  id: string;
  title: string;
  /** Display string, e.g. "~2 mins". */
  duration: string;
  /** Card art: vertical base gradient pair + a radial accent blob pair,
   * as CSS color strings. Alphas < 1 let the card's glass read through. */
  artwork: { base: [string, string]; blob: [string, string] };
};

export type PassageCarouselProps = {
  items: PassageItem[];
  onStart: (item: PassageItem) => void;
  /** The consuming screen's content padding; the carousel bleeds past it
   * edge-to-edge and re-pads its content so cards align with the column. */
  horizontalPadding?: number;
};

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export function PassageCarousel({
  items,
  onStart,
  horizontalPadding = 20,
}: PassageCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const itemWidth = (screenWidth - horizontalPadding * 2) / VISIBLE_RATIO;
  // Inset by the item gap so the first card's VISUAL edge (inside its 6pt
  // gap padding) lines up with the consuming screen's content column.
  const edgePadding = horizontalPadding - ITEM_GAP;

  // Single source of truth for every card's scale/blur interpolation.
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.set(event.contentOffset.x);
    },
  });

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={{ marginHorizontal: -horizontalPadding }}
      contentContainerStyle={{ paddingHorizontal: edgePadding }}>
      {items.map((item, index) => (
        <PassageCard
          key={item.id}
          item={item}
          index={index}
          scrollX={scrollX}
          itemWidth={itemWidth}
          screenWidth={screenWidth}
          edgePadding={edgePadding}
          onStart={onStart}
        />
      ))}
    </Animated.ScrollView>
  );
}

type PassageCardProps = {
  item: PassageItem;
  index: number;
  scrollX: SharedValue<number>;
  itemWidth: number;
  screenWidth: number;
  edgePadding: number;
  onStart: (item: PassageItem) => void;
};

const PassageCard = memo(function PassageCard({
  item,
  index,
  scrollX,
  itemWidth,
  screenWidth,
  edgePadding,
  onStart,
}: PassageCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = THEME[scheme];
  const hasGlass = isLiquidGlassAvailable();

  // Cards at the visual center stay full size and sharp; they shrink to 0.88
  // and (on iOS) blur up to 15 as they move a card-and-a-half away from it.
  const rCardStyle = useAnimatedStyle(() => {
    const screenCenter = (screenWidth - edgePadding * 2) / 2;
    const itemCenter = index * itemWidth - scrollX.get() + itemWidth / 2;
    const distance = Math.abs(itemCenter - screenCenter);
    const scale = interpolate(
      distance,
      [0, itemWidth, itemWidth * 1.5],
      [1, 1, 0.88],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }] };
  });

  const rBlurProps = useAnimatedProps(() => {
    const screenCenter = (screenWidth - edgePadding * 2) / 2;
    const itemCenter = index * itemWidth - scrollX.get() + itemWidth / 2;
    const distance = Math.abs(itemCenter - screenCenter);
    return {
      intensity: interpolate(
        distance,
        [0, itemWidth, itemWidth * 1.5],
        [0, 0, 15],
        Extrapolation.CLAMP,
      ),
    };
  });

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart(item);
  };

  const buttonContent = (
    <>
      <HugeiconsIcon icon={PlayIcon} size={15} color="#FFFFFF" />
      <Text style={styles.buttonLabel}>Start</Text>
    </>
  );

  return (
    <Animated.View style={[{ width: itemWidth }, styles.item, rCardStyle]}>
      <View style={styles.clip}>
        {/* The card's glass sits as an absolute sibling under the content, so
            the button's own GlassView below is never nested inside another
            glass effect (nested glass doesn't render on iOS 26). */}
        {hasGlass ? (
          <GlassView
            glassEffectStyle="regular"
            style={[
              StyleSheet.absoluteFill,
              styles.cardShape,
              { backgroundColor: theme.glassTint },
            ]}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.cardShape,
              { backgroundColor: theme.solidFallback },
            ]}
          />
        )}

        {/* Art fades out by ~78% height so the bottom third stays true glass;
            one gradient per view — multi-background strings aren't supported. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              experimental_backgroundImage: `linear-gradient(to bottom, ${item.artwork.base[0]} 0%, ${item.artwork.base[1]} 45%, transparent 78%)`,
            },
          ]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              // Explicit radii keep the blob an accent on the top-right
              // corner (default farthest-corner size floods the card). Both
              // radii are spelled out: RN's parser mis-eats `at` after a
              // single-size `circle Npx`, dropping the position.
              experimental_backgroundImage: `radial-gradient(ellipse ${Math.round(itemWidth * 0.6)}px ${Math.round(itemWidth * 0.6)}px at 100% 0%, ${item.artwork.blob[0]} 0%, ${item.artwork.blob[1]} 40%, transparent 100%)`,
            },
          ]}
        />
        {/* Scheme-invariant dark bed keeps the white text legible over both
            the artwork and whatever shows through the glass. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              experimental_backgroundImage:
                'linear-gradient(to bottom, transparent 38%, rgba(0,0,0,0.38) 66%, rgba(0,0,0,0.68) 100%)',
            },
          ]}
        />

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.duration}>{item.duration}</Text>
          <Pressable onPress={handleStart} style={({ pressed }) => pressed && { opacity: 0.85 }}>
            {hasGlass ? (
              <GlassView
                glassEffectStyle="regular"
                isInteractive
                tintColor={theme.buttonTint}
                style={styles.button}>
                {buttonContent}
              </GlassView>
            ) : (
              <View style={[styles.button, { backgroundColor: theme.buttonSolid }]}>
                {buttonContent}
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Off-center depth blur, iOS only (parity with the reference app). */}
      {Platform.OS === 'ios' && (
        <View style={styles.blurClip} pointerEvents="none">
          <AnimatedBlurView
            animatedProps={rBlurProps}
            tint="systemThinMaterialDark"
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  item: {
    aspectRatio: CARD_ASPECT,
    padding: ITEM_GAP,
  },
  clip: {
    flex: 1,
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardShape: {
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
  },
  content: {
    flex: 1,
    padding: 14,
    justifyContent: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
    color: '#FFFFFF',
  },
  duration: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
    marginBottom: 10,
  },
  button: {
    height: 40,
    borderRadius: 20,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonLabel: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: '#FFFFFF',
  },
  blurClip: {
    position: 'absolute',
    top: ITEM_GAP,
    left: ITEM_GAP,
    right: ITEM_GAP,
    bottom: ITEM_GAP,
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});
