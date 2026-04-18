import { useState, useRef, useEffect } from 'react';
import Avatar from '../common/Avatar';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import type { SamplePack } from '../../hooks/useSamplePacks';
import FullMixDropZone from '../tracks/FullMixDropZone';
import { ArrangementDropZone, DraggableTrackList } from '../project/ArrangementComponents';

interface Props {
  pack: SamplePack & { items?: any[] };
  onRenamePack: (id: string, name: string) => void;
  onDeletePack: (id: string) => void;
  onRemoveSample: (packId: string, itemId: string) => void;
  onRefresh: (id: string) => void;
  members: { userId: string; displayName: string; role: string; avatarUrl?: string | null }[];
  onInvite: () => void;
}

export default function SamplePackContentView({
  pack, onRenamePack, onDeletePack, onRemoveSample, onRefresh, members, onInvite,
}: Props) {
  const items = pack.items || [];
  const [packDragOver, setPackDragOver] = useState(false);
  const [packUploading, setPackUploading] = useState(false);
  const [showPackMenu, setShowPackMenu] = useState(false);
  const packMenuRef = useRef<HTMLDivElement>(null);
  const [packStatus, setPackStatus] = useState('');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (packMenuRef.current && !packMenuRef.current.contains(e.target as Node)) {
        setShowPackMenu(false);
      }
    };
    if (showPackMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPackMenu]);

  const handlePackDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setPackDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('audio/') || f.name.match(/\.(wav|mp3|flac|aiff|ogg|m4a|aac)$/i)
    );
    if (droppedFiles.length === 0) {
      setPackStatus('No audio files detected');
      setTimeout(() => setPackStatus(''), 2000);
      return;
    }
    setPackUploading(true);
    setPackStatus(`Uploading ${droppedFiles.length} file(s)...`);
    try {
      for (const file of droppedFiles) {
        const { fileId } = await api.uploadFile(pack.id, file);
        const sampleName = file.name.replace(/\.[^.]+$/, '');
        await api.addSamplePackItem(pack.id, { name: sampleName, fileId });
      }
      setPackStatus(`Added ${droppedFiles.length} sample(s)`);
      onRefresh(pack.id);
    } catch (err: any) {
      setPackStatus(err.message || 'Upload failed');
    } finally {
      setPackUploading(false);
      setTimeout(() => setPackStatus(''), 3000);
    }
  };

  const handlePackBrowse = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'audio/*,.wav,.mp3,.flac,.aiff,.ogg,.m4a,.aac';
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        const fakeEvent = { preventDefault: () => {}, dataTransfer: { files: input.files } } as unknown as React.DragEvent;
        handlePackDrop(fakeEvent);
      }
    };
    input.click();
  };

  const { user } = useAuthStore.getState();
  const displayMembers = members.length > 0
    ? members
    : user ? [{ userId: user.id, displayName: user.displayName, role: 'owner', avatarUrl: user.avatarUrl }] : [];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-3 shrink-0 rounded-2xl mb-1 pl-6 pr-3 min-w-0 h-[50px] glass glass-glow">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00FFC8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
        <input
          className="text-[15px] font-bold text-white bg-transparent border border-transparent hover:bg-white/[0.04] hover:border-white/[0.08] focus:bg-white/[0.04] focus:border-ghost-green/30 outline-none px-2 py-0 rounded-md transition-colors min-w-[60px] flex-1 cursor-text"
          value={pack.name}
          onChange={(e) => onRenamePack(pack.id, e.target.value)}
        />
        {pack.updatedAt && (
          <>
            <div className="w-px h-5 bg-white/10 shrink-0" />
            <span className="text-[14px] text-ghost-green font-semibold shrink-0 whitespace-nowrap">
              {new Date(pack.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </>
        )}
        <div className="relative" ref={packMenuRef}>
          <button onClick={() => setShowPackMenu(!showPackMenu)} className="w-9 h-9 flex items-center justify-center rounded-md text-ghost-text-muted hover:text-white hover:bg-white/[0.1] transition-colors cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.5" /><circle cx="12" cy="12" r="2.5" /><circle cx="12" cy="19" r="2.5" /></svg>
          </button>
          {showPackMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-[#111214] rounded-lg shadow-popup animate-popup z-50 border border-white/5 py-1">
              <button onClick={() => { if (confirm('Delete this sample pack?')) onDeletePack(pack.id); setShowPackMenu(false); }} className="w-full px-3 py-1.5 text-[13px] text-left text-ghost-error-red hover:bg-ghost-error-red/10 transition-colors flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete Pack
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 glass glass-glow rounded-2xl overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-4">
        {displayMembers.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-5 glass-subtle px-6 h-[76px] rounded-xl">
              <div className="flex items-center -space-x-2">
                {[...displayMembers].sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0)).map((m) => (
                  <div key={m.userId} className="relative" style={{ border: '2.5px solid #0A0A0F', borderRadius: '50%' }}>
                    <Avatar name={m.displayName || '?'} src={m.avatarUrl} size="lg" colour={m.role === 'owner' ? '#F0B232' : '#23A559'} />
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {displayMembers.filter((m) => m.role === 'owner').map((m) => (
                    <span key={m.userId} className="flex items-center gap-1.5">
                      <span className="text-[17px] font-bold text-ghost-text-primary">{m.displayName}</span>
                      <span className="text-[12px] font-bold uppercase tracking-wider text-white bg-[#5865F2] px-2.5 py-0.5 rounded-md">HOST</span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[15px] text-ghost-text-muted">{displayMembers.length} collaborator{displayMembers.length !== 1 ? 's' : ''} online</span>
                </div>
              </div>
              <button onClick={onInvite} className="px-5 py-2 rounded-full text-white text-[14px] font-semibold flex items-center gap-2 shrink-0" style={{ background: '#7C3AED' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                Invite
              </button>
            </div>
          </div>
        )}

        {packStatus && (
          <div className="mb-3 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-[13px] text-purple-300 font-medium text-center">
            {packStatus}
          </div>
        )}

        <div className="flex items-center gap-1 mb-3">
          <button onClick={handlePackBrowse} disabled={packUploading} className="flex items-center gap-2 px-5 py-2 rounded-lg text-[14px] font-bold tracking-wide transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50" style={{ background: '#7C3AED', color: '#fff' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Stems
          </button>
          <div className="flex-1" />
        </div>

        <ArrangementDropZone projectId={pack.id} onFilesAdded={() => onRefresh(pack.id)}>
          <FullMixDropZone projectId={pack.id} onFilesAdded={() => onRefresh(pack.id)} compact={true} />
          <DraggableTrackList
            tracks={items.map((s: any) => ({ ...s, type: 'audio' }))}
            selectedProjectId={pack.id}
            deleteTrack={(pid: string, tid: string) => onRemoveSample(pid, tid)}
            updateTrack={() => {}}
            trackZoom="half"
            fetchProject={() => onRefresh(pack.id)}
          />
        </ArrangementDropZone>
      </div>
      </div>
      </div>
    </div>
  );
}
