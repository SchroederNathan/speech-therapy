import { useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import type { ResultPlayback } from '@/types/session';

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
      toggle() {
        if (playerStatus.playing) {
          player.pause();
          return;
        }
        const durationSec = playerStatus.duration;
        if (durationSec > 0 && playerStatus.currentTime >= durationSec - 0.05) {
          player.seekTo(0).catch(() => {});
        }
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
