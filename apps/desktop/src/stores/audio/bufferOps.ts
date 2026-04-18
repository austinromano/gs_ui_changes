import { getCtx } from './graph';

export function cloneBuffer(src: AudioBuffer): AudioBuffer {
  const ctx = getCtx();
  const copy = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate);
  for (let c = 0; c < src.numberOfChannels; c++) {
    copy.getChannelData(c).set(src.getChannelData(c));
  }
  return copy;
}

export function loopBufferToLength(src: AudioBuffer, targetDurationSeconds: number): AudioBuffer {
  const ctx = getCtx();
  const targetLength = Math.round(targetDurationSeconds * src.sampleRate);
  const out = ctx.createBuffer(src.numberOfChannels, targetLength, src.sampleRate);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const dst = out.getChannelData(ch);
    const orig = src.getChannelData(ch);
    for (let i = 0; i < targetLength; i++) {
      dst[i] = orig[i % orig.length];
    }
  }
  return out;
}

export function splitBufferAt(src: AudioBuffer, seconds: number): [AudioBuffer, AudioBuffer] | null {
  if (seconds <= 0 || seconds >= src.duration) return null;
  const ctx = getCtx();
  const sr = src.sampleRate;
  const channels = src.numberOfChannels;
  const len1 = Math.round(seconds * sr);
  const len2 = src.length - len1;

  const first = ctx.createBuffer(channels, len1, sr);
  const second = ctx.createBuffer(channels, len2, sr);

  for (let c = 0; c < channels; c++) {
    const source = src.getChannelData(c);
    const dst1 = first.getChannelData(c);
    const dst2 = second.getChannelData(c);
    for (let i = 0; i < len1; i++) dst1[i] = source[i] || 0;
    for (let i = 0; i < len2; i++) dst2[i] = source[len1 + i] || 0;
  }
  return [first, second];
}
