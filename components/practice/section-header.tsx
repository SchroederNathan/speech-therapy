import { StyleSheet, Text, useColorScheme } from 'react-native';

import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';

/** Section title + optional subtitle, matching Home's "For you" styles. */
export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const dark = useColorScheme() === 'dark';
  const colors = dark ? palette.dark : palette.light;

  return (
    <>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {subtitle != null && (
        <Text style={[styles.subtitle, { color: dark ? '#9E9EA6' : '#77777E' }]}>
          {subtitle}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
    marginTop: 28,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.regular,
    marginTop: 4,
    marginBottom: 4,
  },
});
