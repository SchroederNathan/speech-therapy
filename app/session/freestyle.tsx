import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveTranscript } from '@/components/session/live-transcript';
import { LiveWpm } from '@/components/session/live-wpm';
import { PracticeControls } from '@/components/session/practice-controls';
import { SessionTopBar } from '@/components/session/session-top-bar';
import { palette } from '@/constants/colors';
import {
  sessionColors,
  TELEPROMPTER_TEXT_SIZES,
} from '@/constants/session-theme';
import { getTopic, TOPICS } from '@/constants/topics';
import { useFreestyleSession } from '@/hooks/use-freestyle-session';
import { recordSession } from '@/services/session-history';
import { FREESTYLE_TARGET_WPM } from '@/services/scoring';

import { useSessionContext } from './_layout';

function dismissToHome() {
  try {
    router.dismissTo('/');
  } catch {
    router.dismissAll();
  }
}

export default function FreestyleScreen() {
  const { topicId } = useLocalSearchParams<{ topicId?: string }>();
  const topic = getTopic(topicId) ?? TOPICS[0];

  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = sessionColors[scheme];
  const screenPalette = palette[scheme];
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { setResult, retryToken } = useSessionContext();

  const session = useFreestyleSession();

  const [sizeIndex, setSizeIndex] = useState(1);
  const fontSize = TELEPROMPTER_TEXT_SIZES[sizeIndex];

  // Same contract as the passage screen: live fields rebuild the session
  // object every render; stable effects/callbacks act through a ref.
  const sessionRef = useRef(session);
  const navigatedRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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
      // Once per attempt (navigatedRef); each retry becomes its own record.
      recordSession(result, { mode: 'freestyle', topicId: topic.id });
      setResult(result);
      router.push('/session/results');
    } catch {
      navigatedRef.current = false;
    }
  }, [setResult, topic.id]);

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

  const contentTop = insets.top + 82;

  return (
    <View style={[styles.screen, { backgroundColor: screenPalette.background }]}>
      <LiveTranscript
        finalText={session.finalTranscript}
        interimText={session.interimTranscript}
        placeholder={topic.prompt}
        fontSize={fontSize}
        colors={{
          foreground: screenPalette.foreground,
          dimmed: colors.dimmed,
          accent: colors.accent,
        }}
        topInset={contentTop}
        bottomInset={windowHeight * 0.55}
      />

      <SessionTopBar onDismiss={handleDismiss} onTextSize={handleTextSize}>
        <LiveWpm liveWpm={session.liveWpm} targetWpm={FREESTYLE_TARGET_WPM} />
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
