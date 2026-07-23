import { Host, Text as SwiftUIText } from '@expo/ui/swift-ui';
import {
  animation,
  Animation,
  contentTransition,
  font,
  foregroundStyle,
} from '@expo/ui/swift-ui/modifiers';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { fonts } from '@/constants/fonts';
import { paceLabel } from '@/lib/metrics';
import { sessionColors } from '@/constants/session-theme';

const SECONDARY = { light: '#77777E', dark: '#9E9EA6' } as const;

export type LiveWpmProps = {
  liveWpm: number;
  targetWpm: number;
};

/** Practice header center slot: blue live WPM (SwiftUI numericText transition
 * so digits roll) over a gray "target 179 · good pace" caption. */
export function LiveWpm({ liveWpm, targetWpm }: LiveWpmProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const accent = sessionColors[scheme].accent;
  const secondary = SECONDARY[scheme];

  const wpmText = `${liveWpm > 0 ? liveWpm : '–'} WPM`;

  return (
    <View style={styles.wrap}>
      {Platform.OS === 'ios' ? (
        // Fixed-height container: SwiftUI Hosts don't reliably self-size in
        // flex rows (same finding as DailyGoalCard).
        <View style={styles.wpmBox}>
          <Host matchContents>
            <SwiftUIText
              modifiers={[
                contentTransition('numericText'),
                animation(Animation.spring({ duration: 0.5 }), liveWpm),
                // SwiftUI can't use the runtime-loaded OTFs; design:'rounded'
                // resolves to the same SF Pro Rounded face natively.
                font({ size: 20, weight: 'semibold', design: 'rounded' }),
                foregroundStyle(accent),
              ]}>
              {wpmText}
            </SwiftUIText>
          </Host>
        </View>
      ) : (
        <Text style={[styles.wpmFallback, { color: accent }]}>{wpmText}</Text>
      )}
      <Text style={[styles.caption, { color: secondary }]}>
        {`target ${targetWpm} · ${paceLabel(liveWpm, targetWpm)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 1,
  },
  wpmBox: {
    height: 25,
    justifyContent: 'center',
  },
  wpmFallback: {
    fontSize: 20,
    fontFamily: fonts.semibold,
  },
  caption: {
    fontSize: 13,
    fontFamily: fonts.medium,
  },
});
