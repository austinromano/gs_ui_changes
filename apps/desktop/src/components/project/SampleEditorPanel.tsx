import { useMemo } from 'react';
import { useAudioStore } from '../../stores/audioStore';
import { useProjectStore } from '../../stores/projectStore';
import Waveform from '../tracks/Waveform';
import { samplePreview } from '../../lib/samplePreview';

// Bottom sample editor / clip inspector. Mounts at the bottom of the
// arrangement view; shows when exactly one clip is selected. Big waveform,
// metadata pills (BPM, character, duration), and the per-clip controls
// the audio store already supports (volume, pitch, mute, fine-trim).

const PITCH_MIN = -12;
const PITCH_MAX = 12;

export default function SampleEditorPanel({ projectId }: { projectId: string }) {
  const selectedTrackIds = useAudioStore((s) => s.selectedTrackIds);
  const loadedTracks = useAudioStore((s) => s.loadedTracks);
  const setTrackVolume = useAudioStore((s) => s.setTrackVolume);
  const setTrackMuted = useAudioStore((s) => s.setTrackMuted);
  const setTrackPitch = useAudioStore((s) => s.setTrackPitch);
  const currentProject = useProjectStore((s) => s.currentProject);

  // Show only when there's exactly one selected clip — the panel is for
  // single-clip detail. Multi-select keeps the inspector dormant.
  const trackId = selectedTrackIds.size === 1 ? Array.from(selectedTrackIds)[0] : null;

  const projectTrack = useMemo(() => {
    if (!trackId || !currentProject?.tracks) return null;
    return (currentProject.tracks as any[]).find((t) => t.id === trackId) || null;
  }, [trackId, currentProject?.tracks]);

  const loaded = trackId ? loadedTracks.get(trackId) : undefined;

  if (!trackId || !projectTrack) {
    return (
      <div className="shrink-0 h-[112px] mt-2 rounded-2xl glass flex items-center justify-center text-[11px] text-white/30 italic">
        Click a clip to inspect it
      </div>
    );
  }

  const fileName = projectTrack.name || projectTrack.fileName || 'Untitled';
  const detectedBpm: number | null = projectTrack.detectedBpm ?? null;
  const sampleCharacter: string | null = projectTrack.sampleCharacter ?? null;
  const durationSec = loaded?.buffer?.duration ?? 0;
  const volume = loaded?.volume ?? 1;
  const pitch = loaded?.pitch ?? 0;
  const muted = loaded?.muted ?? false;

  const fmtDuration = (s: number) => {
    if (!s || !Number.isFinite(s)) return '–';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${r}`;
  };

  const handlePreview = () => samplePreview.toggle(`clip:${trackId}`);

  return (
    <div className="shrink-0 h-[140px] mt-2 rounded-2xl glass flex overflow-hidden">
      {/* Left: file info + metadata pills */}
      <div className="shrink-0 w-[220px] flex flex-col gap-2 px-3 py-2 border-r border-white/[0.05]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={handlePreview}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-ghost-green/20 text-ghost-green hover:bg-ghost-green/30 transition-colors"
            title="Preview clip"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9" /></svg>
          </button>
          <span className="text-[12px] font-semibold text-white/90 truncate" title={fileName}>{fileName}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {detectedBpm != null && (
            <Pill icon="bpm" label={`${Math.round(detectedBpm)} BPM`} />
          )}
          <Pill icon="time" label={fmtDuration(durationSec)} />
          {sampleCharacter && (
            <Pill icon="dot" label={sampleCharacter[0].toUpperCase() + sampleCharacter.slice(1)} />
          )}
        </div>
        <button
          onClick={() => setTrackMuted(trackId, !muted)}
          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded transition-colors mt-auto ${
            muted
              ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
              : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white'
          }`}
        >
          {muted ? 'Muted' : 'Mute'}
        </button>
      </div>

      {/* Centre: big waveform */}
      <div className="flex-1 min-w-0 px-3 py-2 flex">
        <Waveform
          seed={`editor:${trackId}`}
          height={120}
          fileId={projectTrack.fileId}
          projectId={projectId}
          trackId={trackId}
          showPlayhead={true}
        />
      </div>

      {/* Right: knobs (volume + pitch). Plain range inputs for now —
           swap for proper rotary knobs in a follow-up. */}
      <div className="shrink-0 w-[180px] flex flex-col justify-center gap-3 px-3 py-2 border-l border-white/[0.05]">
        <Slider
          label="Vol"
          value={volume}
          min={0}
          max={1.5}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => setTrackVolume(trackId, v)}
        />
        <Slider
          label="Pitch"
          value={pitch}
          min={PITCH_MIN}
          max={PITCH_MAX}
          step={1}
          format={(v) => `${v >= 0 ? '+' : ''}${v} st`}
          onChange={(v) => setTrackPitch(trackId, v)}
        />
      </div>
    </div>
  );
}

function Pill({ icon, label }: { icon: 'bpm' | 'time' | 'dot'; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-white/70"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ghost-green/80">
        {icon === 'bpm' && (<><circle cx="12" cy="12" r="9" /><polyline points="12 6 12 12 16 14" /></>)}
        {icon === 'time' && (<><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 13 17 13" /></>)}
        {icon === 'dot' && (<circle cx="12" cy="12" r="3" fill="currentColor" />)}
      </svg>
      {label}
    </span>
  );
}

function Slider({ label, value, min, max, step, format, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] font-semibold text-white/60">
        <span className="uppercase tracking-wider">{label}</span>
        <span className="tabular-nums text-white/80">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-ghost-green"
      />
    </div>
  );
}
