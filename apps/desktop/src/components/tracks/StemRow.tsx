import { useState, useRef, useEffect, memo } from 'react';
import { useAudioStore } from '../../stores/audioStore';
import { api } from '../../lib/api';
import { audioBufferCache, cacheBuffer, formatDate } from '../../lib/audio';
import Waveform from './Waveform';

export default memo(function StemRow({
  name, type, onDelete, onRename, fileId, projectId, trackId, createdAt, compact, widthPercent,
}: {
  name: string; type: string;
  onDelete: () => void;
  onRename: (newName: string) => void;
  fileId?: string | null; projectId?: string; trackId: string;
  createdAt?: string | null;
  compact?: boolean;
  widthPercent?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [isPlaying, setIsPlaying] = useState(false);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const isMuted = useAudioStore((s) => s.loadedTracks.get(trackId)?.muted ?? false);
  const setTrackMuted = useAudioStore((s) => s.setTrackMuted);
  const trackPitch = useAudioStore((s) => s.loadedTracks.get(trackId)?.pitch ?? 0);
  const setTrackPitch = useAudioStore((s) => s.setTrackPitch);
  const [showPitch, setShowPitch] = useState(false);
  const pitchRef = useRef<HTMLDivElement>(null);
  const trimStart = useAudioStore((s) => s.loadedTracks.get(trackId)?.trimStart ?? 0);
  const trimEnd = useAudioStore((s) => s.loadedTracks.get(trackId)?.trimEnd ?? 0);
  const bufferDuration = useAudioStore((s) => s.loadedTracks.get(trackId)?.buffer?.duration ?? 0);
  const setTrackTrim = useAudioStore((s) => s.setTrackTrim);
  const splitTrack = useAudioStore((s) => s.splitTrack);
  const duplicateTrack = useAudioStore((s) => s.duplicateTrack);
  const currentTime = useAudioStore((s) => s.currentTime);
  const isProjectPlaying = useAudioStore((s) => s.isPlaying);
  const isTrimmed = trimStart > 0 || trimEnd > 0;
  const trimClip = isTrimmed && trimEnd > 0 && bufferDuration > 0
    ? `inset(0 ${100 - (trimEnd / bufferDuration) * 100}% 0 ${(trimStart / bufferDuration) * 100}%)`
    : undefined;

  const downloadUrl = fileId && projectId ? api.getDirectDownloadUrl(projectId, fileId) : null;

  const [ready, setReady] = useState(fileId ? audioBufferCache.has(fileId) : false);
  useEffect(() => {
    if (!fileId || ready) return;
    const id = setInterval(() => {
      if (audioBufferCache.has(fileId)) { setReady(true); clearInterval(id); }
    }, 200);
    return () => clearInterval(id);
  }, [fileId, ready]);

  const startTimeRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const handlePlay = () => {
    if (isPlaying && sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
      setIsPlaying(false);
      useAudioStore.setState({ soloPlayingTrackId: null, soloCurrentTime: 0, soloDuration: 0 });
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    const buffer = fileId ? audioBufferCache.get(fileId) : null;
    if (!buffer) return;
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    startTimeRef.current = ctx.currentTime;
    source.onended = () => {
      setIsPlaying(false);
      sourceRef.current = null;
      useAudioStore.setState({ soloPlayingTrackId: null, soloCurrentTime: 0, soloDuration: 0 });
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
    source.start(0);
    sourceRef.current = source;
    setIsPlaying(true);
    useAudioStore.setState({ soloPlayingTrackId: trackId, soloDuration: buffer.duration });

    const updatePlayhead = () => {
      if (!sourceRef.current) return;
      const elapsed = ctx.currentTime - startTimeRef.current;
      useAudioStore.setState({ soloCurrentTime: elapsed });
      animFrameRef.current = requestAnimationFrame(updatePlayhead);
    };
    updatePlayhead();
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = name + '.wav';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const dragTriggeredRef = useRef(false);

  const handleDragStart = (e: React.DragEvent) => {
    if (!downloadUrl) return;
    e.dataTransfer.clearData();
    e.dataTransfer.effectAllowed = 'copy';
    if (dragTriggeredRef.current) return;
    dragTriggeredRef.current = true;
    setTimeout(() => { dragTriggeredRef.current = false; }, 2000);
    const params = `url=${encodeURIComponent(downloadUrl)}&fileName=${encodeURIComponent(name + '.wav')}`;
    try {
      (window as any).chrome?.webview?.postMessage?.('drag-to-daw:' + params);
    } catch {}
    // Fallback: iframe approach
    const ghostUrl = `ghost://drag-to-daw?${params}`;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = ghostUrl;
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 1000);
  };

  return (
    <div className="relative rounded-xl overflow-visible">
    <div
      className={`group relative flex items-center rounded-xl overflow-hidden ${compact ? 'h-[48px]' : 'h-[95px]'}`}
      style={widthPercent !== undefined && widthPercent < 100 ? { width: `${widthPercent}%` } : undefined}
    >
      <div className="flex-1 h-full overflow-hidden relative">
        {/* Background that clips with trim */}
        <div className="absolute inset-0 bg-[#0A0412]" style={{ clipPath: trimClip }} />
        <Waveform seed={name + type} height={compact ? 48 : 95} fileId={fileId} projectId={projectId} trackId={trackId} showTrimHandles={true} />
        <div className="absolute left-3 top-2 z-10 max-w-[40%]">
          {editing ? (
            <input
              autoFocus
              className="text-[13px] font-semibold text-white bg-black/60 border border-ghost-green/50 rounded px-1.5 py-0.5 outline-none focus:border-ghost-green w-full"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => {
                if (editName.trim() && editName !== name) onRename(editName.trim());
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') { setEditName(name); setEditing(false); }
              }}
            />
          ) : (
            <p
              className="text-[13px] font-bold text-white truncate cursor-pointer hover:text-ghost-green transition-colors"
              onClick={() => { setEditName(name); setEditing(true); }}
              title={name}
            >
              {name}
            </p>
          )}
          <p className="text-[10px] text-white/40 uppercase font-medium mt-0.5">{type === 'audio' ? 'stem' : type === 'fullmix' ? 'mix' : type}</p>
        </div>
        {createdAt && (
          <div className="absolute left-3 bottom-2 z-10">
            <p className="text-[11px] text-ghost-green font-medium" title={new Date(createdAt).toLocaleString()}>
              {formatDate(createdAt)}
            </p>
          </div>
        )}
      </div>
      <div className={`absolute top-1/2 -translate-y-1/2 z-20 flex items-center gap-0 transition-opacity rounded-lg overflow-hidden ${isTrimmed ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{
        right: isTrimmed && trimEnd > 0 && bufferDuration > 0
          ? `calc(${100 - (trimEnd / bufferDuration) * 100}% + 8px)`
          : '8px',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      }}>
        <button onClick={handlePlay} disabled={!ready} title={isPlaying ? 'Pause' : 'Play'} className={`w-8 h-8 flex items-center justify-center transition-colors ${ready ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-white/20'}`}>
          {isPlaying ? (
            <svg width="10" height="10" viewBox="0 0 12 14" fill="currentColor"><rect x="1" y="1" width="3.5" height="12" rx="1" /><rect x="7.5" y="1" width="3.5" height="12" rx="1" /></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 12" fill="currentColor"><polygon points="0,0 10,6 0,12" /></svg>
          )}
        </button>
        <button onClick={onDelete} title="Delete" className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
        </button>
        <button onClick={handleDownload} title="Download" className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        </button>
        <button onClick={() => duplicateTrack(trackId)} title="Duplicate" className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        </button>
        <button title="Post to Feed" className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 3L3 10l7 3 3 7 8-17z" /></svg>
        </button>
      </div>
    </div>
    </div>
  );
});
