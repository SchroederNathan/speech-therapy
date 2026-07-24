/**
 * User-authored passages: same JSON-file store pattern as session-history
 * (document directory, sync hydration so `getAnyPassage` can resolve ids at
 * first render, subscribe/snapshot for useSyncExternalStore).
 */

import { Directory, File, Paths } from 'expo-file-system';

import { tokenizePassage } from '@/lib/passage-text';
import type { CustomPassage } from '@/types/session';

const STORE_VERSION = 1;

type StoreFile = {
  version: number;
  passages: CustomPassage[];
};

/** Base/blob gradient pairs assigned round-robin; alphas stay < 1 so the
 * cards' glass material reads through (same convention as PASSAGES). */
const ARTWORK_PRESETS: CustomPassage['artwork'][] = [
  {
    base: ['rgba(50,120,246,0.92)', 'rgba(40,70,190,0.85)'],
    blob: ['rgba(140,220,255,0.9)', 'rgba(90,160,255,0.55)'],
  },
  {
    base: ['rgba(220,90,40,0.92)', 'rgba(180,50,100,0.85)'],
    blob: ['rgba(255,220,140,0.92)', 'rgba(255,140,110,0.55)'],
  },
  {
    base: ['rgba(40,160,110,0.92)', 'rgba(20,110,140,0.85)'],
    blob: ['rgba(190,255,210,0.9)', 'rgba(90,230,190,0.5)'],
  },
  {
    base: ['rgba(140,60,220,0.92)', 'rgba(80,50,180,0.85)'],
    blob: ['rgba(255,180,230,0.92)', 'rgba(190,130,255,0.55)'],
  },
  {
    base: ['rgba(200,60,70,0.92)', 'rgba(150,40,130,0.85)'],
    blob: ['rgba(255,190,160,0.92)', 'rgba(255,120,160,0.55)'],
  },
  {
    base: ['rgba(30,130,170,0.92)', 'rgba(30,80,180,0.85)'],
    blob: ['rgba(170,250,255,0.9)', 'rgba(110,190,255,0.55)'],
  },
];

let passages: readonly CustomPassage[] | null = null;
const listeners = new Set<() => void>();

function storeFile(): File {
  return new File(Paths.document, 'user', 'passages.json');
}

function hydrate(): readonly CustomPassage[] {
  if (passages) return passages;
  try {
    const file = storeFile();
    if (file.exists) {
      const parsed = JSON.parse(file.textSync()) as StoreFile;
      passages = Array.isArray(parsed.passages) ? parsed.passages : [];
    } else {
      passages = [];
    }
  } catch (error) {
    console.warn('[user-passages] failed to hydrate, starting empty', error);
    passages = [];
  }
  return passages;
}

function persist(next: readonly CustomPassage[]) {
  try {
    new Directory(Paths.document, 'user').create({ intermediates: true, idempotent: true });
    const payload: StoreFile = { version: STORE_VERSION, passages: [...next] };
    storeFile().write(JSON.stringify(payload));
  } catch (error) {
    console.warn('[user-passages] failed to persist', error);
  }
}

export function getCustomPassages(): readonly CustomPassage[] {
  return hydrate();
}

export function getCustomPassage(id: string | undefined): CustomPassage | undefined {
  return hydrate().find((p) => p.id === id);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addPassage(input: { title: string; text: string; targetWpm: number }): CustomPassage {
  const existing = hydrate();
  const createdAt = Date.now();
  const wordCount = tokenizePassage(input.text).words.length;
  const minutes = Math.max(1, Math.round(wordCount / input.targetWpm));
  const passage: CustomPassage = {
    id: `custom-${createdAt.toString(36)}`,
    title: input.title.trim(),
    text: input.text.trim(),
    targetWpm: input.targetWpm,
    duration: `~${minutes} min${minutes > 1 ? 's' : ''}`,
    artwork: ARTWORK_PRESETS[existing.length % ARTWORK_PRESETS.length],
    category: 'custom',
    custom: true,
    createdAt,
  };
  passages = [...existing, passage];
  persist(passages);
  for (const listener of listeners) listener();
  return passage;
}

export function removePassage(id: string) {
  passages = hydrate().filter((p) => p.id !== id);
  persist(passages);
  for (const listener of listeners) listener();
}
