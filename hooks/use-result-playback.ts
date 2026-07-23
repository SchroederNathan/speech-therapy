import { useEffect, useRef, useState } from 'react';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';

import type { ResultPlayback } from '@/types/session';

const RESULT_PLAYBACK_AUDIO_MODE = {
  allowsRecording: false,
  playsInSilentMode: true,
  shouldRouteThroughEarpiece: false,
} as const;

async function routeAudioToSpeaker() {
  try {
    await setAudioModeAsync(RESULT_PLAYBACK_AUDIO_MODE);
  } catch (error) {
    if (__DEV__) {
      console.warn('[results] Could not configure audio playback routing:', error);
    }
  }
}

/**
 * Playback for the results screen's audio pill.
 *
 * When audioUri is non-null the session's recorded WAV plays through
 * expo-audio's useAudioPlayer (status polled at 250ms). When audioUri is null
 * (mock sessions / recording failure) a simulated ticking position keeps the
 * UI fully exercisable. Both paths expose the same frozen interface.
 */
export function useResultPlayback(audioUri: string | null, durationMs: number): ResultPlayback {
  const player = useAudioPlayer(audioUri, { updateInterval: 250 });
  const playerStatus = useAudioPlayerStatus(player);

  // Simulated path state (used only when audioUri is null).
  const [simPlaying, setSimPlaying] = useState(false);
  const [simPositionMs, setSimPositionMs] = useState(0);
  const simPositionRef = useRef(0);

  // Speech recognition uses iOS's play-and-record category. Restore the
  // standard playback category so the recording comes from the main speaker,
  // not the receiver used for calls. Re-assert this in toggle() in case another
  // native module changes the shared audio session after this effect runs.
  useEffect(() => {
    if (audioUri) void routeAudioToSpeaker();
  }, [audioUri]);

  useEffect(() => {
    if (audioUri || !simPlaying) return;
    const interval = setInterval(() => {
      simPositionRef.current += 250;
      if (simPositionRef.current >= durationMs) {
        simPositionRef.current = 0;
        setSimPositionMs(0);
        setSimPlaying(false);
        return;
      }
      setSimPositionMs(simPositionRef.current);
    }, 250);
    return () => clearInterval(interval);
  }, [audioUri, simPlaying, durationMs]);

  // Real path: rewind after the clip finishes so the pill resets.
  useEffect(() => {
    if (audioUri && playerStatus.didJustFinish) {
      player.seekTo(0).catch(() => {});
    }
  }, [audioUri, playerStatus.didJustFinish, player]);

  if (audioUri) {
    return {
      isPlaying: playerStatus.playing,
      positionMs: Math.round(playerStatus.currentTime * 1000),
      async toggle() {
        if (playerStatus.playing) {
          player.pause();
          return;
        }
        const durationSec = playerStatus.duration;
        if (durationSec > 0 && playerStatus.currentTime >= durationSec - 0.05) {
          player.seekTo(0).catch(() => {});
        }
        await routeAudioToSpeaker();
        player.play();
      },
    };
  }

  return {
    isPlaying: simPlaying,
    positionMs: simPositionMs,
    toggle() {
      setSimPlaying((p) => !p);
    },
  };
}
