import { FFT_SIZE, SMOOTHING_TIME_CONSTANT } from '../../lib/constants';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let analyserNode: AnalyserNode | null = null;

function init() {
  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = FFT_SIZE;
  analyserNode.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
  masterGain.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);
}

export function getCtx(): AudioContext {
  if (!audioCtx) init();
  return audioCtx!;
}

export function getMaster(): GainNode {
  if (!masterGain) init();
  return masterGain!;
}

export function getAnalyser(): AnalyserNode | null {
  return analyserNode;
}

export function safeStop(source: AudioBufferSourceNode | null) {
  if (!source) return;
  try { source.stop(); } catch { /* already stopped */ }
}
