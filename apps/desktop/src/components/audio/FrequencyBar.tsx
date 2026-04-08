import { useRef, useEffect, memo } from 'react';
import { getAnalyser } from '../../stores/audioStore';

export type VizMode = 'bars' | 'wave' | 'radial' | 'ghost';

export default memo(function FrequencyBar({ seekBarRef, progress, isPlaying, onSeekClick, onSeekDrag, onSeekEnd, children, vizMode = 'bars' }: {
  seekBarRef: React.RefObject<HTMLDivElement>;
  progress: number;
  isPlaying: boolean;
  onSeekClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSeekDrag: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSeekEnd: () => void;
  children?: React.ReactNode;
  vizMode?: VizMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const prevData = useRef<Float32Array | null>(null);
  const vizModeRef = useRef(vizMode);
  vizModeRef.current = vizMode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const BAR_COUNT = 128;
    if (!prevData.current) prevData.current = new Float32Array(BAR_COUNT);
    let frameCount = 0;

    const draw = () => {
      if (!running) return;
      frameCount++;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const dpr = window.devicePixelRatio || 2;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const midY = h / 2;
      const analyser = getAnalyser();
      const smoothed = prevData.current!;

      if (analyser && isPlaying) {
        const bufLen = analyser.frequencyBinCount;
        const raw = new Uint8Array(bufLen);
        analyser.getByteFrequencyData(raw);
        for (let i = 0; i < BAR_COUNT; i++) {
          const idx = Math.floor(i * bufLen / BAR_COUNT);
          const target = raw[idx] / 255;
          smoothed[i] += (target - smoothed[i]) * (target > smoothed[i] ? 0.4 : 0.08);
        }
      } else {
        for (let i = 0; i < BAR_COUNT; i++) smoothed[i] *= 0.92;
      }

      const mode = vizModeRef.current;

      if (mode === 'bars') {
        drawBars(ctx, smoothed, w, h, midY, BAR_COUNT);
      } else if (mode === 'wave') {
        drawWave(ctx, smoothed, w, h, midY, BAR_COUNT, frameCount);
      } else if (mode === 'radial') {
        drawRadial(ctx, smoothed, w, h, BAR_COUNT, frameCount);
      } else if (mode === 'ghost') {
        drawGhost(ctx, smoothed, w, h, midY, BAR_COUNT, frameCount);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [isPlaying]);

  return (
    <div
      ref={seekBarRef}
      className="w-full h-7 cursor-pointer relative group"
      style={{ background: 'rgba(6,2,14,0.95)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      onMouseDown={onSeekClick}
      onMouseMove={onSeekDrag}
      onMouseUp={onSeekEnd}
      onMouseLeave={onSeekEnd}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-[1]" />
      <div className="absolute inset-y-0 left-0 pointer-events-none z-[2]" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, rgba(0,255,200,0.03), rgba(124,58,237,0.06))' }} />
      <div className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-[3]" style={{ left: `${progress}%`, background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 8px rgba(0,255,200,0.5), 0 0 2px rgba(255,255,255,0.8)' }} />
      <div className="absolute inset-0 z-[4]">{children}</div>
    </div>
  );
});

// ── Mode 1: Default mirrored bars ──
function drawBars(ctx: CanvasRenderingContext2D, smoothed: Float32Array, w: number, h: number, midY: number, count: number) {
  const HALF = count / 2;
  const gap = 1;
  const barW = Math.max(1, (w - gap * count) / count);

  for (let i = 0; i < count; i++) {
    const freqIdx = i < HALF ? i : (count - 1 - i);
    const val = smoothed[freqIdx];
    const barH = val * midY * 0.9;
    const x = i * (barW + gap);
    const ratio = freqIdx / HALF;
    const { r, g, b } = freqColor(ratio);
    const alpha = 0.5 + val * 0.5;

    const grad = ctx.createLinearGradient(x, midY, x, midY - barH);
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.2})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},${alpha * 0.8})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, midY - barH, barW, barH, [2, 2, 0, 0]);
    ctx.fill();

    const grad2 = ctx.createLinearGradient(x, midY, x, midY + barH);
    grad2.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.15})`);
    grad2.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad2;
    ctx.beginPath();
    ctx.roundRect(x, midY, barW, barH * 0.6, [0, 0, 2, 2]);
    ctx.fill();

    if (val > 0.7) {
      ctx.shadowColor = `rgba(${r},${g},${b},${(val - 0.7) * 2})`;
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(${r},${g},${b},${(val - 0.7) * 0.6})`;
      ctx.fillRect(x, midY - barH, barW, 2);
      ctx.shadowBlur = 0;
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(0, midY - 0.5, w, 1);
}

// ── Mode 2: Flowing wave ──
function drawWave(ctx: CanvasRenderingContext2D, smoothed: Float32Array, w: number, h: number, midY: number, count: number, frame: number) {
  const time = frame * 0.02;

  // Top wave
  ctx.beginPath();
  ctx.moveTo(0, midY);
  for (let i = 0; i <= count; i++) {
    const x = (i / count) * w;
    const val = smoothed[Math.min(i, count - 1)];
    const wave = Math.sin(i * 0.15 + time) * 3;
    const y = midY - val * midY * 0.8 + wave;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(w, midY);
  ctx.closePath();
  const grad1 = ctx.createLinearGradient(0, 0, w, 0);
  grad1.addColorStop(0, 'rgba(0,255,200,0.4)');
  grad1.addColorStop(0.5, 'rgba(124,58,237,0.5)');
  grad1.addColorStop(1, 'rgba(236,72,153,0.4)');
  ctx.fillStyle = grad1;
  ctx.fill();

  // Glow line on top
  ctx.beginPath();
  for (let i = 0; i <= count; i++) {
    const x = (i / count) * w;
    const val = smoothed[Math.min(i, count - 1)];
    const wave = Math.sin(i * 0.15 + time) * 3;
    const y = midY - val * midY * 0.8 + wave;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(0,255,200,0.8)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(0,255,200,0.6)';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Bottom reflection
  ctx.beginPath();
  ctx.moveTo(0, midY);
  for (let i = 0; i <= count; i++) {
    const x = (i / count) * w;
    const val = smoothed[Math.min(i, count - 1)];
    const wave = Math.sin(i * 0.15 + time) * 2;
    const y = midY + val * midY * 0.4 - wave;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(w, midY);
  ctx.closePath();
  const grad2 = ctx.createLinearGradient(0, midY, 0, h);
  grad2.addColorStop(0, 'rgba(124,58,237,0.2)');
  grad2.addColorStop(1, 'rgba(124,58,237,0)');
  ctx.fillStyle = grad2;
  ctx.fill();
}

// ── Mode 3: Radial/circular ──
function drawRadial(ctx: CanvasRenderingContext2D, smoothed: Float32Array, w: number, h: number, count: number, frame: number) {
  const cx = w / 2;
  const cy = h / 2;
  const baseRadius = Math.min(w, h) * 0.2;
  const time = frame * 0.01;

  // Outer glow
  const avg = smoothed.reduce((a, b) => a + b, 0) / count;
  const glowR = baseRadius + avg * 30;
  const glowGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.5, cx, cy, glowR);
  glowGrad.addColorStop(0, `rgba(124,58,237,${avg * 0.3})`);
  glowGrad.addColorStop(0.5, `rgba(0,255,200,${avg * 0.15})`);
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, w, h);

  // Radial bars
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2 + time;
    const val = smoothed[i];
    const barLen = val * baseRadius * 1.5;
    const ratio = i / count;
    const { r, g, b } = freqColor(ratio);

    const x1 = cx + Math.cos(angle) * baseRadius;
    const y1 = cy + Math.sin(angle) * baseRadius;
    const x2 = cx + Math.cos(angle) * (baseRadius + barLen);
    const y2 = cy + Math.sin(angle) * (baseRadius + barLen);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = `rgba(${r},${g},${b},${0.4 + val * 0.6})`;
    ctx.lineWidth = 2;
    if (val > 0.6) {
      ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
      ctx.shadowBlur = 6;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Inner circle
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.95, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(0,255,200,${0.15 + avg * 0.3})`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ── Mode 4: Ghost particles ──
function drawGhost(ctx: CanvasRenderingContext2D, smoothed: Float32Array, w: number, h: number, midY: number, count: number, frame: number) {
  const time = frame * 0.015;

  // Floating particles that react to audio
  for (let i = 0; i < count; i++) {
    const val = smoothed[i];
    if (val < 0.05) continue;

    const baseX = (i / count) * w;
    const drift = Math.sin(i * 0.7 + time) * 20;
    const rise = val * midY * 0.9;
    const x = baseX + drift;
    const y = midY - rise + Math.cos(i * 0.3 + time * 1.5) * 5;
    const size = 1.5 + val * 4;
    const ratio = i / count;

    // Color: ghost green → purple → pink
    let r: number, g: number, b: number;
    if (ratio < 0.33) {
      r = 0; g = Math.round(255 * (1 - ratio * 3)); b = Math.round(200 + 55 * ratio * 3);
    } else if (ratio < 0.66) {
      const t = (ratio - 0.33) * 3;
      r = Math.round(124 * t); g = Math.round(58 * (1 - t)); b = Math.round(237);
    } else {
      const t = (ratio - 0.66) * 3;
      r = Math.round(124 + 112 * t); g = Math.round(40 * t); b = Math.round(237 - 80 * t);
    }

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${val * 0.8})`;
    if (val > 0.5) {
      ctx.shadowColor = `rgba(${r},${g},${b},${val})`;
      ctx.shadowBlur = size * 3;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // Trail
    const trailY = y + rise * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x, trailY);
    ctx.strokeStyle = `rgba(${r},${g},${b},${val * 0.15})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Bottom reflection shimmer
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(0, midY - 0.5, w, 1);
}

// ── Shared color helper ──
function freqColor(ratio: number): { r: number; g: number; b: number } {
  if (ratio < 0.33) {
    const t = ratio / 0.33;
    return { r: Math.round(124 * t), g: Math.round(255 - 197 * t), b: Math.round(200 + 37 * t) };
  } else if (ratio < 0.66) {
    const t = (ratio - 0.33) / 0.33;
    return { r: Math.round(124 + 112 * t), g: Math.round(58 - 18 * t), b: Math.round(237 - 80 * t) };
  } else {
    const t = (ratio - 0.66) / 0.34;
    return { r: Math.round(236 + 19 * t), g: Math.round(40 + 26 * t), b: Math.round(157 + 98 * t) };
  }
}
