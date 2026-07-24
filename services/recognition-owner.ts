import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/**
 * Only one session hook may drive the native recognizer at a time. Both the
 * passage and freestyle hooks claim ownership on start() and release on
 * cancel/stop/unmount; claiming aborts any stale owner's session.
 */

let owner: symbol | null = null;

export function claimEngine(id: symbol) {
  if (owner != null && owner !== id) {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // stale owner's recognizer already inactive
    }
  }
  owner = id;
}

export function releaseEngine(id: symbol) {
  if (owner === id) owner = null;
}
