import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';
import { sessionColors } from '@/constants/session-theme';

export type TranscriptCardProps = {
  transcript: string;
};

/** Freestyle results: what you said, in place of the Word Breakdown. */
export function TranscriptCard({ transcript }: TranscriptCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const foreground = palette[scheme].foreground;
  const dimmed = sessionColors[scheme].dimmed;

  const empty = transcript.trim().length === 0;

  return (
    <View>
      <Text style={[styles.header, { color: foreground }]}>What You Said</Text>
      <Text style={[styles.body, { color: empty ? dimmed : foreground }]}>
        {empty ? 'No speech was recognized this session.' : transcript}
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
  body: {
    fontSize: 17,
    lineHeight: 25,
    fontFamily: fonts.regular,
    letterSpacing: -0.2,
  },
});
