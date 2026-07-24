/**
 * Minimal WAV (RIFF/PCM) handling for the practice engine: header parsing
 * (walking chunks — never assuming a 44-byte header), block-aligned slicing
 * with a fresh canonical header, concatenation across recording segments,
 * and amplitude-bucket downsampling for the playback waveform.
 *
 * PURE module: no react / react-native imports, so it runs under bun for
 * the self-test scripts.
 */

export type WavFormat = {
  /** PCM = 1 (also accepts WAVE_FORMAT_EXTENSIBLE payloads that resolve to PCM). */
  audioFormat: number;
  channels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  /** Byte offset of the first sample in the file. */
  dataOffset: number;
  /** Byte length of the sample data. */
  dataByteLength: number;
};

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) s += String.fromCharCode(bytes[offset + i]);
  return s;
}

/** Parse a WAV header by walking RIFF chunks. Throws on malformed input. */
export function parseWavHeader(bytes: Uint8Array): WavFormat {
  if (bytes.length < 44) throw new Error(`WAV too short (${bytes.length} bytes)`);
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let fmt: Omit<WavFormat, 'dataOffset' | 'dataByteLength'> | null = null;
  let dataOffset = -1;
  let dataByteLength = -1;

  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const id = ascii(bytes, pos, 4);
    const size = view.getUint32(pos + 4, true);
    const body = pos + 8;
    if (id === 'fmt ') {
      if (body + 16 > bytes.length) throw new Error('Truncated fmt chunk');
      fmt = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        byteRate: view.getUint32(body + 8, true),
        blockAlign: view.getUint16(body + 12, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      dataOffset = body;
      // Some recorders leave a placeholder/overflowed size — clamp to the file.
      dataByteLength = Math.min(size, bytes.length - body);
      // A streaming recorder may write size 0xFFFFFFFF or 0; trust the file tail.
      if (size === 0 || size === 0xffffffff) dataByteLength = bytes.length - body;
    }
    pos = body + size + (size % 2); // chunks are word-aligned
    if (size === 0xffffffff) break;
  }

  if (!fmt) throw new Error('Missing fmt chunk');
  if (dataOffset < 0) throw new Error('Missing data chunk');
  if (fmt.blockAlign <= 0 || fmt.byteRate <= 0) throw new Error('Invalid WAV format fields');

  // Truncate to whole blocks.
  dataByteLength -= dataByteLength % fmt.blockAlign;

  return { ...fmt, dataOffset, dataByteLength };
}

export function wavDurationMs(bytes: Uint8Array): number {
  const f = parseWavHeader(bytes);
  return Math.round((f.dataByteLength / f.byteRate) * 1000);
}

/** Build a canonical 44-byte PCM WAV header. */
export function buildWavHeader(
  format: Pick<WavFormat, 'channels' | 'sampleRate' | 'bitsPerSample'>,
  dataByteLength: number,
): Uint8Array {
  const { channels, sampleRate, bitsPerSample } = format;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);
  const writeAscii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) header[offset + i] = s.charCodeAt(i);
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataByteLength, true);
  return header;
}

/**
 * Extract [startMs, endMs) as a standalone WAV with a fresh canonical header.
 * Boundaries are clamped and block-aligned.
 */
export function sliceWav(bytes: Uint8Array, startMs: number, endMs: number): Uint8Array {
  const f = parseWavHeader(bytes);
  const align = (b: number) => Math.floor(b / f.blockAlign) * f.blockAlign;
  const clamp = (b: number) => Math.max(0, Math.min(f.dataByteLength, b));
  const startByte = align(clamp((startMs / 1000) * f.byteRate));
  const endByte = align(clamp((endMs / 1000) * f.byteRate));
  const length = Math.max(0, endByte - startByte);

  const header = buildWavHeader(f, length);
  const out = new Uint8Array(44 + length);
  out.set(header, 0);
  out.set(bytes.subarray(f.dataOffset + startByte, f.dataOffset + startByte + length), 44);
  return out;
}

/** Concatenate same-format WAVs into a single playable file. */
export function concatWavs(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 0) throw new Error('concatWavs: no parts');
  const formats = parts.map(parseWavHeader);
  const first = formats[0];
  for (const f of formats) {
    if (
      f.sampleRate !== first.sampleRate ||
      f.channels !== first.channels ||
      f.bitsPerSample !== first.bitsPerSample
    ) {
      throw new Error('concatWavs: mismatched formats');
    }
  }
  const totalData = formats.reduce((sum, f) => sum + f.dataByteLength, 0);
  const out = new Uint8Array(44 + totalData);
  out.set(buildWavHeader(first, totalData), 0);
  let cursor = 44;
  parts.forEach((part, i) => {
    const f = formats[i];
    out.set(part.subarray(f.dataOffset, f.dataOffset + f.dataByteLength), cursor);
    cursor += f.dataByteLength;
  });
  return out;
}

/**
 * Downsample 16-bit PCM into `buckets` normalized 0..1 RMS amplitude buckets
 * for the results playback pill.
 */
export function downsampleWaveform(bytes: Uint8Array, buckets = 30): number[] {
  const f = parseWavHeader(bytes);
  if (f.bitsPerSample !== 16) throw new Error('downsampleWaveform expects 16-bit PCM');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleCount = Math.floor(f.dataByteLength / f.blockAlign);
  const out = new Array<number>(buckets).fill(0);
  if (sampleCount === 0) return out.map(() => 0.08);

  const perBucket = sampleCount / buckets;
  // Cap the per-bucket work so 3-minute files stay cheap: stride-sample.
  const maxSamplesPerBucket = 2000;

  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * perBucket);
    const end = Math.max(start + 1, Math.floor((b + 1) * perBucket));
    const span = end - start;
    const stride = Math.max(1, Math.floor(span / maxSamplesPerBucket));
    let sumSquares = 0;
    let n = 0;
    for (let s = start; s < end; s += stride) {
      // First channel of each block.
      const sample = view.getInt16(f.dataOffset + s * f.blockAlign, true) / 32768;
      sumSquares += sample * sample;
      n++;
    }
    out[b] = n > 0 ? Math.sqrt(sumSquares / n) : 0;
  }

  const peak = Math.max(...out, 1e-6);
  return out.map((v) => Math.min(1, Math.max(0.08, v / peak)));
}

/** ~30 normalized 0..1 amplitude buckets from the live meter history — the
 * playback-pill waveform fallback when no full WAV could be assembled.
 * (Shared by the passage and freestyle session hooks.) */
export function waveformFromMeterHistory(history: number[]): number[] {
  if (history.length === 0) return Array.from({ length: 30 }, () => 0.15);
  const buckets = Array.from({ length: 30 }, (_, b) => {
    const start = Math.floor((b * history.length) / 30);
    const end = Math.max(start + 1, Math.floor(((b + 1) * history.length) / 30));
    let sum = 0;
    for (let i = start; i < end; i++) sum += history[i];
    return sum / (end - start);
  });
  const peak = Math.max(...buckets, 1e-6);
  return buckets.map((value) => Math.min(1, Math.max(0.08, value / peak)));
}
