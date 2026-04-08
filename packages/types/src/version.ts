export interface Version {
  id: string;
  projectId: string;
  versionNumber: number;
  name: string;
  description: string;
  createdBy: string;
  createdByName: string;
  fileManifest: FileManifestEntry[];
  snapshot: ProjectSnapshot | null;
  createdAt: string;
}

export interface FileManifestEntry {
  fileId: string;
  fileName: string;
  trackId: string | null;
  trackName: string | null;
  fileSize: number;
}

export interface TrackSnapshot {
  id: string;
  name: string;
  type: string;
  ownerId: string;
  fileId: string | null;
  fileName: string | null;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  bpm: number | null;
  key: string | null;
  position: number;
}

export interface ProjectSnapshot {
  name: string;
  description: string;
  tempo: number;
  key: string;
  genre: string;
  timeSignature: string;
  tracks: TrackSnapshot[];
}
