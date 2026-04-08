import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAudioStore } from '../../stores/audioStore';
import { api } from '../../lib/api';
import { audioBufferCache, snapToBar } from '../../lib/audio';
import StemRow from '../tracks/StemRow';
import Waveform from '../tracks/Waveform';

const VISIBLE_BARS = 16;
const LABEL_WIDTH = 110;

/* ── track‑type colours (matches VST getTrackColour) ── */
function trackColour(type: string) {
  switch (type) {
    case 'audio': return '#00FFC8';
    case 'midi': return '#7C3AED';
    case 'drum': return '#EC4899';
    case 'loop': return '#F59E0B';
    case 'fullmix': return '#00B4D8';
    default: return '#00FFC8';
  }
}

function useBarMetrics() {
  const duration = useAudioStore((s) => s.duration);
  const projectBpm = useAudioStore((s) => s.projectBpm);
  const bpm = projectBpm > 0 ? projectBpm : 120;
  const secondsPerBar = (60 / bpm) * 4;
  const totalBars = duration > 0 ? Math.max(VISIBLE_BARS, Math.ceil(duration / secondsPerBar)) : VISIBLE_BARS;
  return { duration, bpm, secondsPerBar, totalBars };
}

/* ── single clip block inside a track lane ── */
function TimelineClip({
  track,
  selectedProjectId,
  deleteTrack,
  updateTrack,
  trackZoom,
  fetchProject,
  colour,
}: {
  track: any;
  selectedProjectId: string;
  deleteTrack: any;
  updateTrack: any;
  trackZoom: 'full' | 'half';
  fetchProject: any;
  colour: string;
}) {
  const trackBuffer = useAudioStore((s) => s.loadedTracks.get(track.id)?.buffer);
  const { duration: maxDur, bpm, secondsPerBar, totalBars } = useBarMetrics();
  const startOffset = useAudioStore((s) => s.loadedTracks.get(track.id)?.startOffset ?? 0);
  const setTrackOffset = useAudioStore((s) => s.setTrackOffset);
  const trackDur = trackBuffer?.duration || 0;

  // Timeline total is measured in bars, so use totalBars * secondsPerBar as the reference width
  const timelineDur = totalBars * secondsPerBar;
  const widthPct = timelineDur > 0 && trackDur > 0 ? Math.min((trackDur / timelineDur) * 100, 100) : 100;
  const leftPct = timelineDur > 0 ? (startOffset / timelineDur) * 100 : 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartOffset = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, [data-no-drag]')) return;
    e.preventDefault();
    setDragging(true);
    dragStartX.current = e.clientX;
    dragStartOffset.current = startOffset;
  }, [startOffset]);

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const parentWidth = parent.getBoundingClientRect().width;
      const dx = e.clientX - dragStartX.current;
      const dtSeconds = (dx / parentWidth) * timelineDur;
      const newOffset = Math.max(0, dragStartOffset.current + dtSeconds);
      setTrackOffset(track.id, newOffset);
    };
    const onMouseUp = () => {
      const current = useAudioStore.getState().loadedTracks.get(track.id)?.startOffset ?? 0;
      const snapped = snapToBar(current, bpm, 'nearest');
      setTrackOffset(track.id, Math.max(0, snapped));
      setDragging(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, timelineDur, bpm, track.id, setTrackOffset]);

  const height = trackZoom === 'half' ? 40 : 54;

  return (
    <div
      ref={containerRef}
      className="absolute group"
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        top: 3,
        bottom: 3,
        cursor: dragging ? 'grabbing' : 'grab',
        borderRadius: 4,
        overflow: 'hidden',
        background: `${colour}0D`,               /* 5% track colour fill */
        border: `1px solid ${colour}33`,          /* 20% track colour border */
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Waveform fill */}
      <Waveform
        seed={track.name + track.type}
        height={height}
        fileId={track.fileId}
        projectId={selectedProjectId}
        trackId={track.id}
        showTrimHandles={false}
      />

      {/* Track name label inside clip */}
      <div className="absolute left-2 top-1 z-10 pointer-events-none">
        <p className="text-[10px] font-bold text-white/80 truncate max-w-[120px]">{track.name || track.fileName || 'Track'}</p>
      </div>

      {/* Hover controls */}
      <div className="absolute top-1/2 -translate-y-1/2 right-1 z-20 flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity rounded overflow-hidden" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
        <button
          onClick={() => { useAudioStore.getState().removeTrack(track.id); deleteTrack(selectedProjectId, track.id); }}
          title="Delete"
          className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
        </button>
        <button
          onClick={() => useAudioStore.getState().duplicateTrack(track.id)}
          title="Duplicate"
          className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ── legacy full‑width track (kept for backward compat) ── */
export function TrackWithWidth({ track, selectedProjectId, deleteTrack, updateTrack, trackZoom, fetchProject }: { track: any; selectedProjectId: string; deleteTrack: any; updateTrack: any; trackZoom: 'full' | 'half'; fetchProject: any }) {
  const trackBuffer = useAudioStore((s) => s.loadedTracks.get(track.id)?.buffer);
  const maxDur = useAudioStore((s) => s.duration);
  const bufferVersion = useAudioStore((s) => s.bufferVersion);
  const startOffset = useAudioStore((s) => s.loadedTracks.get(track.id)?.startOffset ?? 0);
  const projectBpm = useAudioStore((s) => s.projectBpm);
  const setTrackOffset = useAudioStore((s) => s.setTrackOffset);
  const trackDur = trackBuffer?.duration || 0;
  const widthPct = maxDur > 0 && trackDur > 0 ? (trackDur / maxDur) * 100 : 100;
  const leftPct = maxDur > 0 ? (startOffset / maxDur) * 100 : 0;
  const bpm = projectBpm > 0 ? projectBpm : 120;

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartOffset = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, [data-no-drag]')) return;
    e.preventDefault();
    setDragging(true);
    dragStartX.current = e.clientX;
    dragStartOffset.current = startOffset;
  }, [startOffset]);

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const parentWidth = parent.getBoundingClientRect().width;
      const dx = e.clientX - dragStartX.current;
      const dtSeconds = (dx / parentWidth) * maxDur;
      const newOffset = Math.max(0, dragStartOffset.current + dtSeconds);
      setTrackOffset(track.id, newOffset);
    };
    const onMouseUp = () => {
      const current = useAudioStore.getState().loadedTracks.get(track.id)?.startOffset ?? 0;
      const snapped = snapToBar(current, bpm, 'nearest');
      setTrackOffset(track.id, Math.max(0, snapped));
      setDragging(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, maxDur, bpm, track.id, setTrackOffset]);

  return (
    <div
      ref={containerRef}
      style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%`, cursor: dragging ? 'grabbing' : 'grab', overflow: 'visible' }}
      onMouseDown={handleMouseDown}
    >
      <StemRow
        key={`${track.id}-${bufferVersion}`}
        trackId={track.id}
        name={track.name || track.fileName || 'Track'}
        type={track.type || 'audio'}
        fileId={track.fileId}
        projectId={selectedProjectId}
        createdAt={track.createdAt}
        onDelete={() => { useAudioStore.getState().removeTrack(track.id); deleteTrack(selectedProjectId, track.id); }}
        onRename={(newName) => updateTrack(selectedProjectId, track.id, { name: newName })}
        compact={trackZoom === 'half'}
      />
    </div>
  );
}

export function ArrangementDropZone({ projectId, onFilesAdded, children }: { projectId: string; onFilesAdded: () => void; children: React.ReactNode }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('audio/') || f.name.match(/\.(wav|mp3|flac|aiff|ogg|m4a|aac)$/i)
    );
    if (droppedFiles.length === 0) return;
    for (const file of droppedFiles) {
      const { fileId } = await api.uploadFile(projectId, file);
      const trackName = file.name.replace(/\.[^.]+$/, '');
      await api.addTrack(projectId, { name: trackName, type: 'fullmix', fileId, fileName: file.name } as any);
    }
    onFilesAdded();
  };

  return (
    <div
      className={`relative transition-all ${dragOver ? 'ring-2 ring-ghost-green/50 ring-inset' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {children}
      {dragOver && (
        <div className="absolute inset-0 bg-ghost-green/5 pointer-events-none z-30 rounded-xl" />
      )}
    </div>
  );
}

export function ArrangementScrollView({ children, showAll }: { children: React.ReactNode; showAll?: boolean }) {
  const { duration, secondsPerBar, totalBars } = useBarMetrics();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const currentTime = useAudioStore((s) => s.currentTime);
  const isPlaying = useAudioStore((s) => s.isPlaying);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (showAll || !isPlaying || !containerRef.current || duration <= 0) return;
    const pxPerBar = containerWidth / VISIBLE_BARS;
    const totalWidth = totalBars * pxPerBar;
    const playheadX = (currentTime / duration) * totalWidth;
    const scrollLeft = containerRef.current.scrollLeft;
    const viewEnd = scrollLeft + containerWidth;
    if (playheadX > viewEnd - 50 || playheadX < scrollLeft) {
      containerRef.current.scrollLeft = Math.max(0, playheadX - containerWidth * 0.25);
    }
  }, [currentTime, isPlaying, duration, totalBars, containerWidth, showAll]);

  const totalWidth = showAll ? '100%' : totalBars * (containerWidth / VISIBLE_BARS);

  return (
    <div ref={containerRef} className={showAll ? 'relative' : 'overflow-x-auto overflow-y-visible relative'} style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(124,58,237,0.3) transparent' }}>
      <div style={{ width: totalWidth, minWidth: '100%', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

export function BarRuler() {
  const { duration, secondsPerBar, totalBars } = useBarMetrics();
  const seekTo = useAudioStore((s) => s.seekTo);
  const rulerRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (!rulerRef.current || duration <= 0) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left + (rulerRef.current.parentElement?.parentElement?.scrollLeft || 0)) / rulerRef.current.offsetWidth;
    seekTo(pct * duration);
  };

  return (
    <div className="flex sticky top-0 z-30" style={{ background: 'rgba(10,4,18,0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Timeline ruler */}
      <div
        ref={rulerRef}
        className="h-7 relative cursor-pointer select-none flex-1"
        onClick={handleClick}
      >
        {Array.from({ length: totalBars }).map((_, i) => {
          const leftPct = duration > 0 ? (i * secondsPerBar / duration) * 100 : (i / totalBars) * 100;
          return (
            <div key={i} className="absolute top-0 bottom-0" style={{ left: `${leftPct}%` }}>
              <div className="absolute top-0 w-px bottom-0 bg-white/[0.12]" />
              <span className="text-[9px] font-mono text-white/35 pl-1 leading-7 select-none whitespace-nowrap">{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BarGridOverlay() {
  const { duration, secondsPerBar, totalBars } = useBarMetrics();
  if (totalBars === 0) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {Array.from({ length: totalBars }).map((_, i) => {
        const leftPct = (i * secondsPerBar / duration) * 100;
        return (
          <div key={i} className="absolute top-0 bottom-0 w-px bg-white/[0.06]" style={{ left: `${leftPct}%` }} />
        );
      })}
    </div>
  );
}

/* ── Track label column (left side — matches VST) ── */
function TrackLabel({ track, colour, compact }: { track: any; colour: string; compact: boolean }) {
  const isMuted = useAudioStore((s) => s.loadedTracks.get(track.id)?.muted ?? false);
  const isSoloed = useAudioStore((s) => s.loadedTracks.get(track.id)?.soloed ?? false);
  const setTrackMuted = useAudioStore((s) => s.setTrackMuted);
  const setTrackSoloed = useAudioStore((s) => s.setTrackSoloed);
  const volume = useAudioStore((s) => s.loadedTracks.get(track.id)?.volume ?? 0.8);
  const setTrackVolume = useAudioStore((s) => s.setTrackVolume);
  const [draggingVol, setDraggingVol] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleVolMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingVol(true);
  }, []);

  useEffect(() => {
    if (!draggingVol) return;
    const onMove = (e: MouseEvent) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setTrackVolume(track.id, pct);
    };
    const onUp = () => setDraggingVol(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [draggingVol, track.id, setTrackVolume]);

  return (
    <div
      className="flex flex-col justify-center px-2 border-r border-white/[0.06] relative select-none"
      style={{ width: LABEL_WIDTH, flexShrink: 0, background: 'rgba(10,4,18,0.6)' }}
    >
      {/* Colour strip */}
      <div className="absolute left-[6px] top-[6px] bottom-[6px] w-[3px] rounded-full" style={{ background: colour }} />

      {/* Track name */}
      <p className="text-[10px] font-bold text-white truncate pl-3 leading-tight">{track.name || track.fileName || 'Track'}</p>
      <p className="text-[8px] text-white/40 uppercase font-medium pl-3 leading-tight">{track.type === 'audio' ? 'stem' : track.type === 'fullmix' ? 'mix' : track.type}</p>

      {!compact && (
        <>
          {/* Mute / Solo */}
          <div className="flex gap-1 pl-3 mt-1">
            <button
              onClick={() => setTrackMuted(track.id, !isMuted)}
              className="flex items-center justify-center rounded text-[8px] font-bold transition-colors"
              style={{
                width: 16, height: 14,
                background: isMuted ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)',
                color: isMuted ? '#F59E0B' : 'rgba(255,255,255,0.4)',
              }}
            >M</button>
            <button
              onClick={() => setTrackSoloed(track.id, !isSoloed)}
              className="flex items-center justify-center rounded text-[8px] font-bold transition-colors"
              style={{
                width: 16, height: 14,
                background: isSoloed ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.08)',
                color: isSoloed ? '#FFD700' : 'rgba(255,255,255,0.4)',
              }}
            >S</button>
          </div>

          {/* Volume slider */}
          <div
            ref={sliderRef}
            className="ml-3 mr-1 mt-1 relative cursor-pointer"
            style={{ height: 6 }}
            onMouseDown={handleVolMouseDown}
          >
            <div className="absolute top-[2px] left-0 right-0 h-[2px] rounded-full bg-white/10" />
            <div className="absolute top-[2px] left-0 h-[2px] rounded-full" style={{ width: `${volume * 100}%`, background: `${colour}B3` }} />
            <div
              className="absolute top-0 w-[6px] h-[6px] rounded-full bg-white"
              style={{ left: `calc(${volume * 100}% - 3px)` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function DraggableTrackList({ tracks, selectedProjectId, deleteTrack, updateTrack, trackZoom, fetchProject }: {
  tracks: any[];
  selectedProjectId: string;
  deleteTrack: any;
  updateTrack: any;
  trackZoom: 'full' | 'half';
  fetchProject: any;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const loadedTracks = useAudioStore((s) => s.loadedTracks);
  const bufferVersion = useAudioStore((s) => s.bufferVersion);

  const trackLanes = useMemo(() => {
    const serverIds = new Set(tracks.map((t: any) => t.id));
    const childMap = new Map<string, any[]>();

    loadedTracks.forEach((lt, id) => {
      if (!serverIds.has(id) && (id.includes('_split_') || id.includes('_dup_'))) {
        const parentId = id.split(/_split_|_dup_/)[0];
        if (!childMap.has(parentId)) childMap.set(parentId, []);
        const parent = tracks.find((t: any) => t.id === parentId);
        const label = id.includes('_dup_') ? '' : ' (split)';
        childMap.get(parentId)!.push({
          id,
          name: (parent?.name || 'Track') + label,
          type: parent?.type || 'audio',
          fileId: null,
          projectId: selectedProjectId,
          createdAt: parent?.createdAt || new Date().toISOString(),
        });
      }
    });

    return tracks.map((t: any) => ({
      parent: t,
      children: childMap.get(t.id) || [],
    }));
  }, [tracks, loadedTracks, bufferVersion, selectedProjectId]);

  const reversedLanes = [...trackLanes].reverse();

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const reordered = [...reversedLanes];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    const newOrder = [...reordered].reverse();
    const trackIds = newOrder.map((l: any) => l.parent.id);
    setDragIdx(null);
    setOverIdx(null);
    await api.reorderTracks(selectedProjectId, trackIds);
    fetchProject(selectedProjectId);
  }, [dragIdx, reversedLanes, selectedProjectId, fetchProject]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  const laneH = trackZoom === 'half' ? 48 : 60;

  return (
    <div className="relative" style={{ background: 'rgba(10,4,18,0.3)', borderRadius: 6 }}>
      {reversedLanes.map((lane: any, idx: number) => {
        const allClips = [lane.parent, ...lane.children];
        const colour = trackColour(lane.parent.type || 'audio');

        return (
          <div
            key={lane.parent.id}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`relative transition-transform duration-150 ${
              overIdx === idx && dragIdx !== idx ? 'ring-1 ring-purple-500/60 ring-inset' : ''
            }`}
            style={{
              height: laneH,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {/* ── Track number badge ── */}
            <div className="absolute left-1 top-1 z-10 w-[18px] h-[18px] rounded flex items-center justify-center text-[9px] font-bold pointer-events-none" style={{ background: 'rgba(124,58,237,0.3)', color: '#7C3AED' }}>
              {idx + 1}
            </div>
            {/* ── Aura glow in empty space ── */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, #00FFC8, #7C3AED, #EC4899, #F59E0B, #00B4D8, #00FFC8)',
                backgroundSize: '200% 100%',
                opacity: 0.08,
                filter: 'blur(20px)',
              }}
              animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
            {/* ── Timeline area (full width — mixer below handles controls) ── */}
            <div className="absolute inset-0 overflow-hidden">
              {allClips.map((clip: any) => (
                <TimelineClip
                  key={clip.id}
                  track={clip}
                  selectedProjectId={selectedProjectId}
                  deleteTrack={deleteTrack}
                  updateTrack={updateTrack}
                  trackZoom={trackZoom}
                  fetchProject={fetchProject}
                  colour={colour}
                />
              ))}
            </div>
          </div>
        );
      })}
      <BarGridOverlay />
    </div>
  );
}

export function ArrangementPlayhead() {
  const currentTime = useAudioStore((s) => s.currentTime);
  const duration = useAudioStore((s) => s.duration);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  if (!isPlaying && currentTime === 0) return null;

  return (
    <div
      className="absolute top-0 bottom-0 w-[2px] pointer-events-none z-20"
      style={{
        left: `${Math.min(pct, 100)}%`,
        background: 'rgba(0,255,200,0.7)',
        boxShadow: '0 0 6px rgba(0,255,200,0.4), 0 0 12px rgba(0,255,200,0.1)',
      }}
    >
      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full" style={{ background: '#00FFC8', boxShadow: '0 0 4px rgba(0,255,200,0.6)' }} />
    </div>
  );
}
