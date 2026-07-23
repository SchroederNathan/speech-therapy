import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveWpm } from '@/components/session/live-wpm';
import { PracticeControls } from '@/components/session/practice-controls';
import { SessionTopBar } from '@/components/session/session-top-bar';
import {
  Teleprompter,
  type TeleprompterColors,
} from '@/components/session/teleprompter';
import { palette } from '@/constants/colors';
import { getPassage, PASSAGES } from '@/constants/passages';
import {
  sessionColors,
  TELEPROMPTER_TEXT_SIZES,
} from '@/constants/session-theme';
import { usePracticeSession } from '@/hooks/use-practice-session';
import { tokenizePassage } from '@/lib/passage-text';

import { useSessionContext } from './_layout';

function dismissToHome() {
  try {
    router.dismissTo('/');
  } catch {
    router.dismissAll();
  }
}

export default function PracticeScreen() {
  const { passageId } = useLocalSearchParams<{ passageId: string }>();
  const found = getPassage(passageId);
  // Hooks must run unconditionally; the guard effect below backs out of the
  // route when the id is unknown before anything is visible.
  const passage = found ?? PASSAGES[0];

  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = sessionColors[scheme];
  const screenPalette = palette[scheme];
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { setResult, retryToken } = useSessionContext();

  const session = usePracticeSession(passage);
  const tokenized = useMemo(() => tokenizePassage(passage.text), [passage.text]);

  const [sizeIndex, setSizeIndex] = useState(1);
  const fontSize = TELEPROMPTER_TEXT_SIZES[sizeIndex];

  // The session object is rebuilt every render (live fields); keep a ref so
  // stable effects/callbacks always act on the latest instance.
  const sessionRef = useRef(session);
  const navigatedRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!found) router.back();
  }, [found]);

  // Explicit start on mount (per contract — never auto inside the hook), and
  // cancel anything still running if the whole session flow unmounts.
  useEffect(() => {
    sessionRef.current.start();
    return () => {
      const s = sessionRef.current;
      if (s.status === 'listening' || s.status === 'paused') s.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Results screen's Retry bumps the token; restart a fresh attempt.
  const prevRetryRef = useRef(retryToken);
  useEffect(() => {
    if (retryToken === prevRetryRef.current) return;
    prevRetryRef.current = retryToken;
    navigatedRef.current = false;
    sessionRef.current.restart();
  }, [retryToken]);

  const finishSession = useCallback(async () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    try {
      const result = await sessionRef.current.stop();
      setResult(result);
      router.push('/session/results');
    } catch {
      navigatedRef.current = false;
    }
  }, [setResult]);

  // The session can complete on its own (end of passage reached).
  useEffect(() => {
    if (session.status === 'done') finishSession();
  }, [session.status, finishSession]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sessionRef.current.cancel();
    dismissToHome();
  }, []);

  const handleTextSize = useCallback(() => {
    Haptics.selectionAsync();
    setSizeIndex((i) => (i + 1) % TELEPROMPTER_TEXT_SIZES.length);
  }, []);

  const handlePauseToggle = useCallback(() => {
    const s = sessionRef.current;
    if (s.status === 'listening') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      s.pause();
    } else if (s.status === 'paused') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      s.resume();
    }
  }, []);

  const handleRestart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigatedRef.current = false;
    sessionRef.current.restart();
  }, []);

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    finishSession();
  }, [finishSession]);

  const teleColors: TeleprompterColors = useMemo(
    () => ({
      foreground: screenPalette.foreground,
      dimmed: colors.dimmed,
      accent: colors.accent,
      accentFaded: colors.accentFaded,
    }),
    [screenPalette, colors],
  );

  if (!found) return null;

  const contentTop = insets.top + 82;

  return (
    <View style={[styles.screen, { backgroundColor: screenPalette.background }]}>
      <Teleprompter
        tokenized={tokenized}
        currentWordIndex={session.currentWordIndex}
        wordProgress={session.currentWordFraction}
        fontSize={fontSize}
        colors={teleColors}
        topInset={contentTop}
        bottomInset={windowHeight * 0.55}
      />

      <SessionTopBar onDismiss={handleDismiss} onTextSize={handleTextSize}>
        <LiveWpm liveWpm={session.liveWpm} targetWpm={passage.targetWpm} />
      </SessionTopBar>

      <PracticeControls
        status={session.status}
        error={session.error}
        elapsedMs={session.elapsedMs}
        meterLevel={session.meterLevel}
        onPauseToggle={handlePauseToggle}
        onRestart={handleRestart}
        onStop={handleStop}
        onErrorDismiss={handleDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
