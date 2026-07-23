/**
 * Azure Speech Pronunciation Assessment over the short-audio REST endpoint.
 *
 * Each chunk POSTs raw WAV bytes (16kHz/16-bit/mono PCM — exactly what the
 * recognition recorder persists) with the assessment params in the
 * base64-encoded `Pronunciation-Assessment` header. The short-audio endpoint
 * caps audio at 30s, so callers chunk to <=28s (services/scoring.ts).
 *
 * Any failure (network, non-2xx, NoMatch, malformed JSON) resolves to `null`
 * for that chunk — the engine NEVER dead-ends on Azure.
 */

import { fetch } from 'expo/fetch';

export type AzureSpeechConfig = {
  key: string;
  region: string;
  /** BCP-47, default en-US. */
  locale?: string;
};

export type AzureErrorType = 'None' | 'Omission' | 'Insertion' | 'Mispronunciation';

export type AzureWordResult = {
  word: string;
  accuracyScore: number | null;
  errorType: AzureErrorType;
};

export type ChunkAssessment = {
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  /** Absent in some regions/locales — callers fall back to fluency. */
  prosodyScore: number | null;
  pronScore: number;
  words: AzureWordResult[];
};

const REQUEST_TIMEOUT_MS = 30_000;

/** UTF-8 → base64, dependency-free (Hermes lacks Buffer; btoa chokes on non-Latin-1). */
export function utf8ToBase64(input: string): string {
  const bytes: number[] = [];
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += table[b0 >> 2];
    out += table[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? table[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? table[b2 & 0x3f] : '=';
  }
  return out;
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toErrorType(value: unknown): AzureErrorType {
  switch (value) {
    case 'Omission':
    case 'Insertion':
    case 'Mispronunciation':
      return value;
    default:
      return 'None';
  }
}

/** Parse a `format=detailed` recognition response with assessment scores. Exported for tests. */
export function parseAssessmentResponse(json: unknown): ChunkAssessment | null {
  const root = json as Record<string, unknown> | null;
  if (!root || root.RecognitionStatus !== 'Success') return null;
  const nbest = (root.NBest as Record<string, unknown>[] | undefined)?.[0];
  if (!nbest) return null;

  // Scores appear either at the NBest root or nested under PronunciationAssessment.
  const pa = (nbest.PronunciationAssessment as Record<string, unknown> | undefined) ?? nbest;
  const accuracyScore = toNumber(pa.AccuracyScore) ?? toNumber(nbest.AccuracyScore);
  const fluencyScore = toNumber(pa.FluencyScore) ?? toNumber(nbest.FluencyScore);
  const completenessScore = toNumber(pa.CompletenessScore) ?? toNumber(nbest.CompletenessScore);
  const pronScore = toNumber(pa.PronScore) ?? toNumber(nbest.PronScore);
  const prosodyScore = toNumber(pa.ProsodyScore) ?? toNumber(nbest.ProsodyScore);
  if (accuracyScore == null || pronScore == null) return null;

  const rawWords = Array.isArray(nbest.Words) ? (nbest.Words as Record<string, unknown>[]) : [];
  const words: AzureWordResult[] = rawWords.map((w) => {
    const wpa = (w.PronunciationAssessment as Record<string, unknown> | undefined) ?? w;
    return {
      word: typeof w.Word === 'string' ? w.Word : '',
      accuracyScore: toNumber(wpa.AccuracyScore) ?? toNumber(w.AccuracyScore),
      errorType: toErrorType(wpa.ErrorType ?? w.ErrorType),
    };
  });

  return {
    accuracyScore,
    fluencyScore: fluencyScore ?? accuracyScore,
    completenessScore: completenessScore ?? 100,
    prosodyScore,
    pronScore,
    words,
  };
}

/**
 * Assess one <=30s WAV chunk against its reference text.
 * Resolves `null` on any failure or NoMatch.
 */
export async function assessChunk(
  wavBytes: Uint8Array,
  referenceText: string,
  config: AzureSpeechConfig,
): Promise<ChunkAssessment | null> {
  const locale = config.locale ?? 'en-US';
  const url = `https://${config.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=detailed`;
  const assessmentParams = utf8ToBase64(
    JSON.stringify({
      ReferenceText: referenceText,
      GradingSystem: 'HundredMark',
      Granularity: 'Word',
      Dimension: 'Comprehensive',
      EnableMiscue: 'True',
      EnableProsodyAssessment: 'True',
    }),
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // Copy into a fresh ArrayBuffer-backed view so the body satisfies BodyInit
  // regardless of the source buffer's typing (ArrayBufferLike).
  const body: Uint8Array<ArrayBuffer> = new Uint8Array(wavBytes);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.key,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        'Pronunciation-Assessment': assessmentParams,
        Accept: 'application/json',
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      if (__DEV__) console.warn(`[azure] chunk failed: HTTP ${response.status}`);
      return null;
    }
    return parseAssessmentResponse(await response.json());
  } catch (error) {
    if (__DEV__) console.warn('[azure] chunk failed:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Assess all chunks SEQUENTIALLY (free-tier throttling). Per-chunk failures
 * yield `null` entries; the caller aggregates whatever succeeded.
 */
export async function assessSession(
  chunks: { wavBytes: Uint8Array; referenceText: string }[],
  config: AzureSpeechConfig,
): Promise<(ChunkAssessment | null)[]> {
  const results: (ChunkAssessment | null)[] = [];
  for (const chunk of chunks) {
    results.push(await assessChunk(chunk.wavBytes, chunk.referenceText, config));
  }
  return results;
}
