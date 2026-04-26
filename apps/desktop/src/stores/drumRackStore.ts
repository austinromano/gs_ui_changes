import { create } from 'zustand';
import { getCtx, getMaster, safeStop } from './audio/graph';
import { audioBufferCache } from '../lib/audio';
void audioBufferCache;
import { useAudioStore } from './audioStore';

// Drum-rack / step-sequencer store.
// Each rack holds N rows (one sample per row) and a single pattern of
// M steps. While the project transport is playing, a lookahead scheduler
// runs every ~25 ms and queues any active step that falls in the next
// ~120 ms window — same pattern Web Audio scheduling tutorials teach
// (Chris Wilson "A Tale of Two Clocks"). Step time = projectBPM-derived
// 16th-note duration; the pattern repeats indefinitely while the project
// plays, so the rack feels like it's part of the arrangement.

export interface DrumRow {
  id: string;
  name: string;
  fileId: string | null;        // project file id (audioBufferCache key)
  buffer?: AudioBuffer;         // resolved at trigger time
  volume: number;               // 0..1.5
  muted: boolean;
  steps: boolean[];             // length = patternSteps; true = on
}

interface DrumRackState {
  open: boolean;
  rows: DrumRow[];
  patternSteps: number;         // 16 = one bar of 16ths, 32 = two bars
  setOpen: (v: boolean) => void;
  addEmptyRow: () => void;
  removeRow: (rowId: string) => void;
  setRowBuffer: (rowId: string, name: string, buffer: AudioBuffer, fileId?: string | null) => void;
  setRowVolume: (rowId: string, v: number) => void;
  toggleRowMuted: (rowId: string) => void;
  toggleStep: (rowId: string, stepIdx: number) => void;
  clearRow: (rowId: string) => void;
  setPatternSteps: (n: 16 | 32) => void;
  // Scheduler hooks called from PluginLayout when transport state changes.
  startScheduler: (projectId: string) => void;
  stopScheduler: () => void;
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let activeSources: Set<AudioBufferSourceNode> = new Set();
// Bookkeeping for the scheduler — `nextStepIdx` walks the pattern, and
// `nextStepCtxTime` is the AudioContext time at which that step fires.
let nextStepIdx = 0;
let nextStepCtxTime = 0;

function makeRow(): DrumRow {
  return {
    id: crypto.randomUUID(),
    name: 'Empty',
    fileId: null,
    volume: 1,
    muted: false,
    steps: new Array(16).fill(false),
  };
}

function stepDurationSec(projectBpm: number, patternSteps: number): number {
  // 16 steps = 1 bar of 16th notes when the pattern is "16". For 32, it
  // covers 2 bars of 16ths. Either way each step is the project's 16th-
  // note duration.
  void patternSteps;
  const bpm = projectBpm > 0 ? projectBpm : 120;
  return 60 / bpm / 4; // 16th note
}

export const useDrumRack = create<DrumRackState>((set, get) => ({
  open: false,
  rows: [makeRow(), makeRow(), makeRow(), makeRow()],
  patternSteps: 16,

  setOpen: (v) => set({ open: v }),

  addEmptyRow: () => set((s) => ({ rows: [...s.rows, makeRow()] })),

  removeRow: (rowId) => set((s) => ({ rows: s.rows.filter((r) => r.id !== rowId) })),

  setRowBuffer: (rowId, name, buffer, fileId) =>
    set((s) => ({
      rows: s.rows.map((r) => (r.id === rowId ? { ...r, name, buffer, fileId: fileId ?? null } : r)),
    })),

  setRowVolume: (rowId, v) =>
    set((s) => ({ rows: s.rows.map((r) => (r.id === rowId ? { ...r, volume: Math.max(0, Math.min(1.5, v)) } : r)) })),

  toggleRowMuted: (rowId) =>
    set((s) => ({ rows: s.rows.map((r) => (r.id === rowId ? { ...r, muted: !r.muted } : r)) })),

  toggleStep: (rowId, stepIdx) =>
    set((s) => ({
      rows: s.rows.map((r) => {
        if (r.id !== rowId) return r;
        const steps = r.steps.slice();
        steps[stepIdx] = !steps[stepIdx];
        return { ...r, steps };
      }),
    })),

  clearRow: (rowId) =>
    set((s) => ({ rows: s.rows.map((r) => (r.id === rowId ? { ...r, steps: new Array(s.patternSteps).fill(false) } : r)) })),

  setPatternSteps: (n) =>
    set((s) => ({
      patternSteps: n,
      rows: s.rows.map((r) => {
        const steps = new Array(n).fill(false);
        for (let i = 0; i < Math.min(n, r.steps.length); i++) steps[i] = r.steps[i];
        return { ...r, steps };
      }),
    })),

  startScheduler: () => {
    if (schedulerTimer) return;
    const ctx = getCtx();
    nextStepIdx = 0;
    nextStepCtxTime = ctx.currentTime + 0.05; // tiny lead-in so the first hit isn't dropped

    const tick = () => {
      const { rows, patternSteps } = get();
      const audio = useAudioStore.getState();
      if (!audio.isPlaying) return;
      const lookahead = 0.12; // schedule 120 ms ahead
      const stepDur = stepDurationSec(audio.projectBpm, patternSteps);
      const horizon = ctx.currentTime + lookahead;

      while (nextStepCtxTime < horizon) {
        const stepIdx = nextStepIdx % patternSteps;
        for (const r of rows) {
          if (r.muted || !r.buffer || !r.steps[stepIdx]) continue;
          const src = ctx.createBufferSource();
          src.buffer = r.buffer;
          const g = ctx.createGain();
          g.gain.value = r.volume;
          src.connect(g);
          g.connect(getMaster());
          src.start(nextStepCtxTime);
          activeSources.add(src);
          src.onended = () => {
            activeSources.delete(src);
            try { src.disconnect(); g.disconnect(); } catch { /* ignore */ }
          };
        }
        nextStepCtxTime += stepDur;
        nextStepIdx++;
      }
    };

    // Manual interval — Web Audio's clock and JS's clock drift, so the
    // scheduler keeps the next-step time in audio-time and just fires
    // every 25 ms to TOP UP the schedule horizon.
    schedulerTimer = setInterval(tick, 25);
    tick();
  },

  stopScheduler: () => {
    if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
    for (const src of activeSources) { safeStop(src); }
    activeSources.clear();
  },
}));
