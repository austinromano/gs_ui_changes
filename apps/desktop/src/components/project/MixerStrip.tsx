import { useRef, useState, useEffect, useCallback } from 'react';
import { useAudioStore } from '../../stores/audioStore';

function VerticalFader({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const update = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    onChange(1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)));
  }, [onChange]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    update(e);
  }, [update]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => update(e);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, update]);

  return (
    <div
      ref={ref}
      className="relative cursor-pointer"
      style={{ width: 6, height: '100%', background: 'rgba(255,255,255,0.07)', borderRadius: 3 }}
      onMouseDown={onMouseDown}
    >
      <div
        className="absolute bottom-0 left-0 right-0 rounded-b-[3px]"
        style={{ height: `${value * 100}%`, background: 'rgba(124,58,237,0.25)' }}
      />
      <div
        className="absolute left-[-3px] right-[-3px] h-[6px] rounded-sm"
        style={{
          bottom: `calc(${value * 100}% - 3px)`,
          background: 'linear-gradient(180deg, #F2F3F5 0%, #B5BAC1 100%)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
        }}
      />
    </div>
  );
}

function Channel({ track, index }: { track: any; index: number }) {
  const volume = useAudioStore((s) => s.loadedTracks.get(track.id)?.volume ?? 0.8);
  const isMuted = useAudioStore((s) => s.loadedTracks.get(track.id)?.muted ?? false);
  const isSoloed = useAudioStore((s) => s.loadedTracks.get(track.id)?.soloed ?? false);
  const setTrackVolume = useAudioStore((s) => s.setTrackVolume);
  const setTrackMuted = useAudioStore((s) => s.setTrackMuted);
  const setTrackSoloed = useAudioStore((s) => s.setTrackSoloed);

  return (
    <div
      className="flex flex-col items-center select-none py-[6px]"
      style={{
        width: 48,
        flexShrink: 0,
        background: 'rgba(10,4,18,0.95)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Fader */}
      <div className="flex-1 flex justify-center min-h-0">
        <VerticalFader value={volume} onChange={(v) => setTrackVolume(track.id, v)} />
      </div>

      {/* Track number */}
      <button
        onClick={() => setTrackMuted(track.id, !isMuted)}
        className="mt-[4px] w-[24px] h-[18px] rounded flex items-center justify-center text-[10px] font-bold transition-colors"
        style={{
          background: isMuted ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.3)',
          color: isMuted ? '#6D6F78' : '#7C3AED',
        }}
      >
        {index + 1}
      </button>

      {/* S button */}
      <button
        onClick={() => setTrackSoloed(track.id, !isSoloed)}
        className="mt-[2px] w-[24px] h-[14px] rounded text-[8px] font-bold flex items-center justify-center transition-colors"
        style={{
          background: isSoloed ? 'rgba(0,255,200,0.15)' : 'rgba(255,255,255,0.06)',
          color: isSoloed ? '#00FFC8' : '#6D6F78',
        }}
      >
        S
      </button>
    </div>
  );
}

export default function MixerStrip({ tracks }: { tracks: any[]; selectedProjectId: string }) {
  if (tracks.length === 0) return null;
  const reversed = [...tracks].reverse();

  return (
    <div
      className="flex overflow-x-auto"
      style={{
        background: 'rgba(10,4,18,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        height: 110,
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(124,58,237,0.3) transparent',
      }}
    >
      {reversed.map((track, idx) => (
        <Channel key={track.id} track={track} index={idx} />
      ))}
    </div>
  );
}
