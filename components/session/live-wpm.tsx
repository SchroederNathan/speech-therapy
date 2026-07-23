import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AnimatedRoundedNumber } from '@/components/animated-rounded-number';
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
      {/* Fixed-height container: SwiftUI Hosts don't reliably self-size in flex rows. */}
      <View style={styles.wpmBox}>
        <AnimatedRoundedNumber
          text={wpmText}
          value={liveWpm}
          color={accent}
          fontSize={20}
          fontFamily={fonts.semibold}
          weight="semibold"
          duration={0.5}
        />
      </View>
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
  caption: {
    fontSize: 13,
    fontFamily: fonts.medium,
  },
});
