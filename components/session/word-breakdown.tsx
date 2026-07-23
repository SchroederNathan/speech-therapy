import { Fragment } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';
import { sessionColors } from '@/constants/session-theme';
import type { ResultWord } from '@/types/session';

export type WordBreakdownProps = {
  words: ResultWord[];
};

/** Per-word verdicts over the whole passage: good = foreground,
 * mispronounced = orange, omitted = red strikethrough, inserted = blue. */
export function WordBreakdown({ words }: WordBreakdownProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = sessionColors[scheme];
  const foreground = palette[scheme].foreground;

  const colorFor = (status: ResultWord['status']) => {
    switch (status) {
      case 'good':
        return foreground;
      case 'mispronounced':
        return colors.warn;
      case 'omitted':
        return colors.bad;
      case 'inserted':
        return colors.accent;
    }
  };

  return (
    <View>
      <Text style={[styles.header, { color: foreground }]}>Word Breakdown</Text>
      <Text style={styles.passage}>
        {words.map((w, i) => (
          <Fragment key={i}>
            <Text
              style={{
                color: colorFor(w.status),
                textDecorationLine: w.status === 'omitted' ? 'line-through' : 'none',
              }}>
              {w.word}
            </Text>
            {i < words.length - 1 ? ' ' : null}
          </Fragment>
        ))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 20,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  passage: {
    fontSize: 17,
    lineHeight: 26,
    fontFamily: fonts.medium,
  },
});
