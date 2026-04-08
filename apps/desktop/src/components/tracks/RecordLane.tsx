import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useProjectStore } from '../../stores/projectStore';
import { api } from '../../lib/api';

interface RecordLaneProps {
  projectId?: string;
}

export default function RecordLane({ projectId }: RecordLaneProps) {
  const [levelL, setLevelL] = useState(0);
  const [levelR, setLevelR] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const wasRecordingRef = useRef(false);
  const [recordTime, setRecordTime] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [hasRecording, setHasRecording] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const levelHistoryRef = useRef<{ l: number; r: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fetchProject = useProjectStore((s) => s.fetchProject);
  // Track the recording file blob URL from C++ for browser-side upload
  const recordingBlobRef = useRef<{ fileName: string; sizeKB: number } | null>(null);

  const sendMessage = useCallback((msg: string) => {
    if ((window as any).chrome?.webview?.postMessage) {
      (window as any).chrome.webview.postMessage(msg);
    }
  }, []);

  useEffect(() => {
    const levelHandler = (left: number, right: number, recording: boolean) => {
      setLevelL(left);
      setLevelR(right);
      // Detect recording stopped transition
      if (wasRecordingRef.current && !recording) {
        setHasRecording(true);
      }
      wasRecordingRef.current = recording;
      setIsRecording(recording);
      if (recording) {
        levelHistoryRef.current.push({ l: left, r: right });
      }
    };
    // Use shared listener system so TransportBar and RecordLane both get callbacks
    if (!(window as any).__ghostAudioListeners__) {
      (window as any).__ghostAudioListeners__ = new Set();
      (window as any).__ghostAudioLevels__ = (left: number, right: number, recording: boolean) => {
        for (const fn of (window as any).__ghostAudioListeners__) fn(left, right, recording);
      };
    }
    (window as any).__ghostAudioListeners__.add(levelHandler);

    (window as any).__ghostRecordingComplete__ = async (fileName: string, sizeKB: number) => {
      setHasRecording(true);
      recordingBlobRef.current = { fileName, sizeKB };

      if (!projectId) return;

      // Upload via C++ (which has access to the local file)
      setUploadStatus(`Uploading ${fileName}...`);
      sendMessage(`upload-recording:projectId=${encodeURIComponent(projectId)}&fileName=${encodeURIComponent(fileName)}`);
    };

    (window as any).__ghostUploadComplete__ = async (fileId: string, fileName: string) => {
      if (!projectId) return;

      // Now create a track entry so it shows up as a proper StemRow
      try {
        const trackName = fileName.replace(/\.[^.]+$/, '');
        await api.addTrack(projectId, { name: trackName, type: 'audio', fileId, fileName });
        setUploadStatus('');
        // Reset the RecordLane — the recording is now a proper stem
        levelHistoryRef.current = [];
        setHasRecording(false);
        recordingBlobRef.current = null;
        // Refresh project to show the new track
        fetchProject(projectId);
      } catch (err: any) {
        setUploadStatus('Failed to add track');
        setTimeout(() => setUploadStatus(''), 3000);
      }
    };

    return () => {
      (window as any).__ghostAudioListeners__?.delete(levelHandler);
      delete (window as any).__ghostRecordingComplete__;
      delete (window as any).__ghostUploadComplete__;
    };
  }, [projectId]);

  // Record timer
  useEffect(() => {
    if (isRecording) {
      startTimeRef.current = Date.now();
      levelHistoryRef.current = [];
      setHasRecording(false);
      recordingBlobRef.current = null;
      timerRef.current = window.setInterval(() => {
        setRecordTime((Date.now() - startTimeRef.current) / 1000);
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    let animId: number;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const history = levelHistoryRef.current;

      if ((isRecording || history.length > 0) && history.length > 0) {
        const pixelsPerSample = isRecording ? 2 : Math.max(1, w / history.length);
        const totalWidth = history.length * pixelsPerSample;
        const offsetX = isRecording ? Math.max(0, totalWidth - w) : 0;

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        for (let i = 0; i < history.length; i++) {
          const x = i * pixelsPerSample - offsetX;
          if (x < -pixelsPerSample || x > w) continue;
          const sample = history[i];
          const ampL = sample.l * h * 0.45;
          const ampR = sample.r * h * 0.45;

          const gradTop = ctx.createLinearGradient(x, h / 2 - ampL, x, h / 2);
          gradTop.addColorStop(0, 'rgba(0, 255, 200, 0.8)');
          gradTop.addColorStop(1, 'rgba(124, 58, 237, 0.6)');
          ctx.fillStyle = gradTop;
          ctx.fillRect(x, h / 2 - ampL, Math.max(1, pixelsPerSample - 1), ampL);

          const gradBot = ctx.createLinearGradient(x, h / 2, x, h / 2 + ampR);
          gradBot.addColorStop(0, 'rgba(124, 58, 237, 0.6)');
          gradBot.addColorStop(1, 'rgba(0, 255, 200, 0.8)');
          ctx.fillStyle = gradBot;
          ctx.fillRect(x, h / 2, Math.max(1, pixelsPerSample - 1), ampR);
        }

        // Recording playhead
        if (isRecording) {
          const px = Math.min(totalWidth - offsetX, w);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.shadowColor = 'rgba(255,255,255,0.5)';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(px, 0);
          ctx.lineTo(px, h);
          ctx.stroke();
          ctx.shadowBlur = 0;

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.moveTo(px - 4, 0);
          ctx.lineTo(px + 4, 0);
          ctx.lineTo(px, 6);
          ctx.closePath();
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [levelL, levelR, isRecording]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const hasSignal = levelL > 0.005 || levelR > 0.005;
  const hasData = levelHistoryRef.current.length > 0;
  const meterPct = (v: number) => Math.min(100, Math.round(v * 100));

  if (!isRecording && !hasSignal && !hasData) return null;

  return (
    <div className="relative rounded-xl overflow-visible mt-2">
      <motion.div
        className="absolute -inset-px rounded-xl opacity-40 pointer-events-none"
        style={{
          background: isRecording
            ? 'linear-gradient(90deg, #ED4245, #F59E0B, #ED4245, #F59E0B, #ED4245)'
            : 'linear-gradient(90deg, #00FFC8, #7C3AED, #EC4899, #F59E0B, #00B4D8, #00FFC8)',
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: isRecording ? 2 : 6, repeat: Infinity, ease: 'linear' }}
      />
      <div className="group relative flex items-center rounded-xl overflow-hidden h-[95px]">
        <div className="flex-1 h-full overflow-hidden bg-[#0A0412] relative">
          <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />

          <div className="absolute inset-y-0 left-0 w-[45%] pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(10,4,18,0.85) 0%, rgba(10,4,18,0.4) 60%, transparent 100%)' }} />

          <div className="absolute left-4 top-2 z-10">
            <p className="text-[13px] font-bold text-white truncate">
              {isRecording ? 'Recording...' : hasRecording ? 'Saving...' : hasData ? 'Recorded Audio' : 'Record Armed'}
            </p>
            <p className="text-[10px] text-white/40 uppercase font-medium mt-0.5">
              {isRecording ? 'REC' : 'STEM'}
            </p>
          </div>

          {(isRecording || hasData) && (
            <div className="absolute left-4 bottom-2 z-10">
              <p className="text-[11px] text-ghost-green font-medium">
                {isRecording
                  ? formatTime(recordTime)
                  : formatTime(levelHistoryRef.current.length / 30)}
              </p>
            </div>
          )}

          {isRecording && (
            <div className="absolute top-2 right-3 z-10">
              <motion.span
                className="flex items-center gap-1.5"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] text-red-400 font-bold uppercase">REC</span>
              </motion.span>
            </div>
          )}

          <div className="absolute top-1/2 -translate-y-1/2 right-3 z-10 flex items-center gap-1">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-2.5 h-12 rounded-sm bg-black/50 overflow-hidden flex flex-col-reverse">
                <div className="w-full rounded-sm transition-all duration-75" style={{ height: `${meterPct(levelL)}%`, background: levelL > 0.85 ? '#ED4245' : levelL > 0.5 ? '#F0B232' : '#23A559' }} />
              </div>
              <span className="text-[7px] text-white/30">L</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-2.5 h-12 rounded-sm bg-black/50 overflow-hidden flex flex-col-reverse">
                <div className="w-full rounded-sm transition-all duration-75" style={{ height: `${meterPct(levelR)}%`, background: levelR > 0.85 ? '#ED4245' : levelR > 0.5 ? '#F0B232' : '#23A559' }} />
              </div>
              <span className="text-[7px] text-white/30">R</span>
            </div>
          </div>

          {uploadStatus && (
            <div className="absolute bottom-2 right-3 z-10">
              <span className="text-[10px] text-ghost-green font-medium">{uploadStatus}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
