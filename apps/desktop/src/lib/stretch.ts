// Client-side time-stretching.
//
// Three algorithms share a signature so the audio store can swap strategies
// based on the sample's character (classified server-side at upload):
//
//   1. `timeStretch` — default WSOLA (Waveform Similarity Overlap-Add).
//      Good all-rounder: Hann windows with 75% overlap and a tail
//      cross-correlation search to preserve phase continuity. Mixed content
//      lands here.
//
//   2. `timeStretchPercussive` — runs the default WSOLA first, then OVERLAYS
//      unmodified transient windows from the input at every detected beat
//      position (scaled to the output timeline). This is what stops a
//      stretched kick from smearing — the attack lives in the first ~25ms
//      after the onset, so we keep that segment pristine and let WSOLA
//      handle the sustain around it. Same trick Ableton's Beats mode uses.
//
//   3. `timeStretchTonal` — WSOLA with longer frames (8192 vs 4096) and a
//      wider search range. Longer frames resolve pitch better on sustained
//      harmonic content (pads, bass, tonal one-shots) at the cost of
//      slightly slurrier transients — the right trade-off for tonal.
//
// `adaptiveStretch` picks the right algorithm from the sample's classified
// character + beat markers, so call sites just hand it a buffer + factor +
// metadata and don't think about DSP.
//
// Rubber Band WASM drops into this shape with minimal changes when we add
// it — swap the internals of `timeStretch`, keep the public API.

export type SampleCharacter = 'percussive' | 'tonal' | 'mixed' | 'ambient';

interface StretchInternalOpts {
  frameSize?: number;
  synthHop?: number;
  searchRange?: number;
}

const DEFAULT_FRAME = 4096;
const DEFAULT_SYNTH_HOP = 1024;
const DEFAULT_SEARCH = 512;

const hannCache = new Map<number, Float32Array>();
function hann(size: number): Float32Array {
  const cached = hannCache.get(size);
  if (cached) return cached;
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  hannCache.set(size, w);
  return w;
}

/** Core WSOLA. `factor > 1` slows down; `factor < 1` speeds up. Preserves pitch. */
export function timeStretch(
  input: AudioBuffer,
  factor: number,
  audioContext: AudioContext,
  opts: StretchInternalOpts = {},
): AudioBuffer {
  if (factor <= 0) throw new Error('stretch factor must be positive');
  if (Math.abs(factor - 1) < 0.005) return input;

  const frame = opts.frameSize ?? DEFAULT_FRAME;
  const synthHop = opts.synthHop ?? DEFAULT_SYNTH_HOP;
  const searchRange = opts.searchRange ?? DEFAULT_SEARCH;
  const analysisHop = synthHop / factor;
  const win = hann(frame);

  const sampleRate = input.sampleRate;
  const channels = input.numberOfChannels;
  const inputLen = input.length;
  const outputLen = Math.max(frame, Math.floor(inputLen * factor) + frame);
  const output = audioContext.createBuffer(channels, outputLen, sampleRate);

  const tailLen = searchRange;
  for (let ch = 0; ch < channels; ch++) {
    const inData = input.getChannelData(ch);
    const outData = output.getChannelData(ch);

    let outPos = 0;
    let analysisPos = 0;
    const prevTail = new Float32Array(tailLen);
    let hasPrev = false;

    while (outPos + frame < outputLen) {
      const center = Math.floor(analysisPos);
      let inStart = center;
      if (hasPrev) {
        const half = searchRange >> 1;
        const lo = Math.max(0, center - half);
        const hi = Math.min(inputLen - frame - tailLen, center + half);
        let bestScore = -Infinity;
        let bestOff = center;
        for (let off = lo; off <= hi; off += 2) {
          let score = 0;
          for (let i = 0; i < tailLen; i++) score += prevTail[i] * inData[off + i];
          if (score > bestScore) { bestScore = score; bestOff = off; }
        }
        inStart = bestOff;
      }
      if (inStart + frame >= inputLen) break;

      for (let i = 0; i < frame; i++) outData[outPos + i] += inData[inStart + i] * win[i];

      if (inStart + synthHop + tailLen < inputLen) {
        for (let i = 0; i < tailLen; i++) prevTail[i] = inData[inStart + synthHop + i] * win[synthHop + i];
        hasPrev = true;
      } else {
        hasPrev = false;
      }
      outPos += synthHop;
      analysisPos += analysisHop;
    }

    // Hann + 75% overlap sums to ~1.5; compensate.
    const norm = 1 / 1.5;
    for (let i = 0; i < outputLen; i++) outData[i] *= norm;

    // Safety limiter.
    let peak = 0;
    for (let i = 0; i < outputLen; i++) if (Math.abs(outData[i]) > peak) peak = Math.abs(outData[i]);
    if (peak > 0.98) {
      const scale = 0.98 / peak;
      for (let i = 0; i < outputLen; i++) outData[i] *= scale;
    }
  }

  // Trim to expected length.
  const trimmedLen = Math.floor(inputLen * factor);
  const trimmed = audioContext.createBuffer(channels, trimmedLen, sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    trimmed.copyToChannel(output.getChannelData(ch).subarray(0, trimmedLen), ch);
  }
  return trimmed;
}

/**
 * Transient-preserving stretch. Runs WSOLA first, then overlays the
 * unmodified input transient window at each beat position (scaled to
 * output time) with a short crossfade. The attack transient of each hit
 * survives stretching cleanly — no smearing on kicks, crisp hi-hats.
 */
export function timeStretchPercussive(
  input: AudioBuffer,
  factor: number,
  beats: number[],
  audioContext: AudioContext,
): AudioBuffer {
  const stretched = timeStretch(input, factor, audioContext);
  if (!beats || beats.length === 0) return stretched;

  const sr = input.sampleRate;
  const channels = input.numberOfChannels;
  const preSamp = Math.floor(0.004 * sr);   // 4ms pre-attack lead
  const postSamp = Math.floor(0.025 * sr);  // 25ms post-attack (the transient body)
  const fadeSamp = Math.floor(0.002 * sr);  // 2ms crossfade at each edge

  for (let ch = 0; ch < channels; ch++) {
    const inData = input.getChannelData(ch);
    const outData = stretched.getChannelData(ch);

    for (const beatTime of beats) {
      const inIdx = Math.floor(beatTime * sr);
      const outIdx = Math.floor(beatTime * factor * sr);
      const winStart = Math.max(0, inIdx - preSamp);
      const winEnd = Math.min(inData.length, inIdx + postSamp);
      const len = winEnd - winStart;
      const outStart = Math.max(0, outIdx - preSamp);

      for (let i = 0; i < len; i++) {
        if (outStart + i >= outData.length) break;
        // Weight = 1 inside the transient, fading to 0 at edges. Stretched
        // content dominates at edges (so the overlay blends smoothly); the
        // pristine attack dominates in the middle.
        let w = 1;
        if (i < fadeSamp) w = i / fadeSamp;
        else if (i > len - fadeSamp) w = Math.max(0, (len - i) / fadeSamp);
        outData[outStart + i] = outData[outStart + i] * (1 - w) + inData[winStart + i] * w;
      }
    }
  }

  return stretched;
}

/** Longer-frame WSOLA for tonal content — smoother sustain, slightly slurrier transients. */
export function timeStretchTonal(input: AudioBuffer, factor: number, audioContext: AudioContext): AudioBuffer {
  return timeStretch(input, factor, audioContext, {
    frameSize: 8192,
    synthHop: 2048,
    searchRange: 1024,
  });
}

/**
 * Route a sample to the right algorithm based on its analysed character.
 * Falls back to default WSOLA when character/beats aren't available.
 */
export function adaptiveStretch(
  input: AudioBuffer,
  factor: number,
  audioContext: AudioContext,
  meta: { character?: SampleCharacter | null; beats?: number[] | null } = {},
): AudioBuffer {
  if (factor <= 0) throw new Error('stretch factor must be positive');
  if (Math.abs(factor - 1) < 0.005) return input;

  const character = meta.character ?? 'mixed';
  const beats = meta.beats ?? [];

  if (character === 'percussive' && beats.length > 0) {
    return timeStretchPercussive(input, factor, beats, audioContext);
  }
  if (character === 'tonal') {
    return timeStretchTonal(input, factor, audioContext);
  }
  // mixed + ambient fall through to the balanced default
  return timeStretch(input, factor, audioContext);
}
