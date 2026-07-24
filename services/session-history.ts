/**
 * Persisted session history: the single store behind Home stats, Practice
 * recommendations, and the future Analytics screen.
 *
 * JSON file in the document directory (cache would get purged), hydrated
 * synchronously on first access so first-frame renders see real data, held
 * in memory (records are ~300 bytes — even years of use is trivial), and
 * exposed through a subscribe/snapshot pair for useSyncExternalStore.
 */

import { Directory, File, Paths } from 'expo-file-system';

import { summarizeWords } from '@/services/ai-coaching';
import type { SessionMode, SessionRecord } from '@/types/history';
import type { SessionResult } from '@/types/session';

const STORE_VERSION = 1;

type StoreFile = {
  version: number;
  records: SessionRecord[];
};

/** Attempts shorter than this with nothing spoken are accidental starts. */
const MIN_MEANINGFUL_MS = 10_000;

let records: readonly SessionRecord[] | null = null;
const listeners = new Set<() => void>();

function storeFile(): File {
  return new File(Paths.document, 'user', 'sessions.json');
}

function hydrate(): readonly SessionRecord[] {
  if (records) return records;
  try {
    const file = storeFile();
    if (file.exists) {
      const parsed = JSON.parse(file.textSync()) as StoreFile;
      records = Array.isArray(parsed.records) ? parsed.records : [];
    } else {
      records = [];
    }
  } catch (error) {
    // A corrupt store shouldn't brick the app; start fresh in memory and
    // let the next successful write replace it.
    console.warn('[session-history] failed to hydrate, starting empty', error);
    records = [];
  }
  return records;
}

function persist(next: readonly SessionRecord[]) {
  try {
    new Directory(Paths.document, 'user').create({ intermediates: true, idempotent: true });
    const payload: StoreFile = { version: STORE_VERSION, records: [...next] };
    storeFile().write(JSON.stringify(payload));
  } catch (error) {
    console.warn('[session-history] failed to persist', error);
  }
}

export function getRecords(): readonly SessionRecord[] {
  return hydrate();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addRecord(record: SessionRecord) {
  records = [...hydrate(), record];
  persist(records);
  for (const listener of listeners) listener();
}

export function recordFromResult(
  result: SessionResult,
  meta: { mode: SessionMode; passageId?: string; topicId?: string },
): SessionRecord {
  const completedAt = Date.now();
  const { wordCounts, challengingWords } = summarizeWords(result.words);
  return {
    id: `${completedAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    completedAt,
    mode: meta.mode,
    ...(meta.passageId != null ? { passageId: meta.passageId } : {}),
    ...(meta.topicId != null ? { topicId: meta.topicId } : {}),
    durationMs: result.durationMs,
    overallScore: result.overallScore,
    accuracy: result.accuracy,
    fluency: result.fluency,
    completeness: result.completeness,
    intonation: result.intonation,
    paceWpm: result.paceWpm,
    targetWpm: result.targetWpm,
    fillerCount: result.fillerCount,
    source: result.source,
    wordCounts,
    challengingWords,
  };
}

/**
 * The one call sites use: guards out accidental starts (a few seconds with
 * nothing spoken), builds the slim record, and persists it. Returns the
 * record, or null when the attempt was skipped.
 */
export function recordSession(
  result: SessionResult,
  meta: { mode: SessionMode; passageId?: string; topicId?: string },
): SessionRecord | null {
  const record = recordFromResult(result, meta);
  const nothingSpoken =
    record.wordCounts.good === 0 && (result.transcript ?? '').trim().length === 0;
  if (result.durationMs < MIN_MEANINGFUL_MS && nothingSpoken) return null;
  addRecord(record);
  return record;
}
