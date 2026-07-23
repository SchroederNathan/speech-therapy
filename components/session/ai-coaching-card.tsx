import { Refresh01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { LoadingSpinner } from '@/components/loading-spinner';
import { palette } from '@/constants/colors';
import { fonts } from '@/constants/fonts';
import { sessionColors } from '@/constants/session-theme';
import { useAiCoaching } from '@/hooks/use-ai-coaching';
import type { SessionResult } from '@/types/session';

const SECONDARY = { light: '#77777E', dark: '#A7A7AE' } as const;
const ICON_BACKGROUND = {
  light: 'rgba(52,120,246,0.12)',
  dark: 'rgba(76,141,255,0.18)',
} as const;
const DIVIDER = {
  light: 'rgba(17,17,20,0.09)',
  dark: 'rgba(255,255,255,0.11)',
} as const;

export type AiCoachingCardProps = {
  result: SessionResult;
};

export function AiCoachingCard({ result }: AiCoachingCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = sessionColors[scheme];
  const foreground = palette[scheme].foreground;
  const secondary = SECONDARY[scheme];
  const hasGlass = isLiquidGlassAvailable();
  const coaching = useAiCoaching(result);

  const isLoading = coaching.status === 'loading';
  // Keep the loading row mounted after the request settles so the spinner's
  // stop animation can play out before the result swaps in.
  const [spinnerDone, setSpinnerDone] = useState(false);
  useEffect(() => {
    if (isLoading) setSpinnerDone(false);
  }, [isLoading]);
  const showLoading = isLoading || !spinnerDone;

  // Streaming partials and the final result render through the same view.
  const breakdown =
    coaching.status === 'streaming' || coaching.status === 'success'
      ? coaching.breakdown
      : null;
  const tips = (breakdown?.tips ?? []).filter(
    (tip): tip is NonNullable<typeof tip> => !!tip?.title,
  );

  return (
    <View>
      <Text style={[styles.heading, { color: foreground }]}>AI Coach</Text>

      <View style={styles.card}>
        {hasGlass ? (
          <GlassView
            glassEffectStyle="regular"
            style={[
              StyleSheet.absoluteFill,
              styles.cardShape,
              { backgroundColor: colors.controlCard },
            ]}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.cardShape,
              { backgroundColor: colors.controlCardSolid },
            ]}
          />
        )}

        {showLoading ? (
          <View style={styles.state}>
            <LoadingSpinner active={isLoading} onFinish={() => setSpinnerDone(true)} />
            <View style={styles.stateCopy}>
              <Text style={[styles.stateTitle, { color: foreground }]}>Reviewing your session</Text>
              <Text style={[styles.stateBody, { color: secondary }]}>
                Putting together a few pointers for you.
              </Text>
            </View>
          </View>
        ) : null}

        {!showLoading && coaching.status === 'error' ? (
          <View style={styles.errorState}>
            <Text style={[styles.stateTitle, { color: foreground }]}>Coaching couldn’t load</Text>
            <Text style={[styles.stateBody, { color: secondary }]}>{coaching.error}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry AI coaching"
              onPress={coaching.retry}
              style={({ pressed }) => [
                styles.retryButton,
                { backgroundColor: ICON_BACKGROUND[scheme] },
                pressed && styles.pressed,
              ]}>
              <HugeiconsIcon icon={Refresh01Icon} size={17} color={colors.accent} strokeWidth={1.8} />
              <Text style={[styles.retryLabel, { color: colors.accent }]}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!showLoading && breakdown ? (
          <View>
            <Text style={[styles.summary, { color: foreground }]}>{breakdown.summary ?? ''}</Text>
            {tips.length > 0 ? (
              <View style={styles.tips}>
                {tips.map((tip, index) => (
                  <View
                    key={index}
                    style={[
                      styles.tip,
                      index > 0 && { borderTopColor: DIVIDER[scheme], borderTopWidth: 1 },
                    ]}>
                    <View style={[styles.tipNumber, { backgroundColor: ICON_BACKGROUND[scheme] }]}>
                      <Text style={[styles.tipNumberText, { color: colors.accent }]}>{index + 1}</Text>
                    </View>
                    <View style={styles.tipCopy}>
                      <Text style={[styles.tipTitle, { color: foreground }]}>{tip.title}</Text>
                      {tip.guidance ? (
                        <Text style={[styles.tipGuidance, { color: foreground }]}>
                          {tip.guidance}
                        </Text>
                      ) : null}
                      {tip.evidence ? (
                        <Text style={[styles.evidence, { color: secondary }]}>{tip.evidence}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 20,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  card: {
    minHeight: 104,
    borderRadius: 28,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: 18,
  },
  cardShape: {
    borderRadius: 28,
    borderCurve: 'continuous',
  },
  state: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stateCopy: {
    flex: 1,
    gap: 3,
  },
  stateTitle: {
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  stateBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  errorState: {
    gap: 7,
    alignItems: 'flex-start',
  },
  retryButton: {
    height: 38,
    borderRadius: 19,
    marginTop: 5,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  retryLabel: {
    fontSize: 14,
    fontFamily: fonts.semibold,
  },
  pressed: {
    opacity: 0.72,
  },
  summary: {
    fontSize: 17,
    lineHeight: 23,
    fontFamily: fonts.semibold,
    letterSpacing: -0.15,
  },
  tips: {
    marginTop: 10,
  },
  tip: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
  },
  tipNumber: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tipNumberText: {
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  tipCopy: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fonts.semibold,
  },
  tipGuidance: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.regular,
  },
  evidence: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.medium,
  },
});
