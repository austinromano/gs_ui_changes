export interface LoadedTrack {
  id: string;
  buffer: AudioBuffer;
  source: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
  volume: number;
  muted: boolean;
  soloed: boolean;
  bpm: number;
  pitch: number;
  trimStart: number;   // seconds from buffer start
  trimEnd: number;     // seconds from buffer start (0 = use full length)
  startOffset: number; // seconds from project start (timeline position)
}

export interface UndoSnapshot {
  trackId: string;
  buffer: AudioBuffer;
  fileId?: string;
}

export interface ArrangementClipState {
  trackId: string;
  trimStart: number;
  trimEnd: number;
  startOffset: number;
  volume: number;
  muted: boolean;
  soloed: boolean;
  pitch: number;
  parentTrackId?: string;
  parentFileId?: string;
}

export interface ArrangementState {
  clips: ArrangementClipState[];
}
