import { devWarn } from '../../lib/log';
import type { LoadedTrack, ArrangementClipState, ArrangementState } from './types';

const key = (projectId: string) => `ghost_arrangement_${projectId}`;

export function save(
  projectId: string,
  loadedTracks: Map<string, LoadedTrack>,
  serverTrackFileIds: Map<string, string>,
) {
  const clips: ArrangementClipState[] = [];
  loadedTracks.forEach((track, id) => {
    const isChild = id.includes('_split_') || id.includes('_dup_');
    const parentId = isChild ? id.split(/_split_|_dup_/)[0] : undefined;
    clips.push({
      trackId: id,
      trimStart: track.trimStart,
      trimEnd: track.trimEnd,
      startOffset: track.startOffset,
      volume: track.volume,
      muted: track.muted,
      soloed: track.soloed,
      pitch: track.pitch,
      parentTrackId: parentId,
      parentFileId: parentId ? serverTrackFileIds.get(parentId) : undefined,
    });
  });
  try {
    localStorage.setItem(key(projectId), JSON.stringify({ clips }));
  } catch (err) {
    devWarn('arrangement.save', err);
  }
}

export function load(projectId: string): ArrangementState | null {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    devWarn('arrangement.load', err);
    return null;
  }
}
