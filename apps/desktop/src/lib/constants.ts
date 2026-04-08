// Audio engine
export const FFT_SIZE = 256;
export const SMOOTHING_TIME_CONSTANT = 0.8;
export const PITCH_MIN = -12;
export const PITCH_MAX = 12;

// Frequency visualizer
export const FREQ_BAR_COUNT = 128;
export const FREQ_SMOOTH_RISE = 0.4;
export const FREQ_SMOOTH_FALL = 0.08;
export const FREQ_GLOW_THRESHOLD = 0.7;

// Waveform rendering
export const WAVEFORM_PEAK_RATIO = 0.42;
export const WAVEFORM_COLOR_START = '#00FFC8';
export const WAVEFORM_COLOR_END = '#8B5CF6';

// Collaborator colour palette
export const COLLAB_COLOURS = [
  '#1ABC9C', '#2ECC71', '#3498DB', '#9B59B6',
  '#E91E63', '#F1C40F', '#E67E22', '#E74C3C',
  '#00BCD4', '#FF6B6B', '#A29BFE', '#FD79A8',
  '#00CEC9', '#6C5CE7', '#FDCB6E', '#55EFC4',
] as const;

// API
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
export const SERVER_BASE = API_BASE.replace('/api/v1', '');

// Socket
export const SOCKET_TRANSPORTS = ['websocket'] as const;
