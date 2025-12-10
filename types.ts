export type MusicStyle = 'techno' | 'ambient' | 'industrial' | 'house' | 'glitch' | 'symphony' | 'easy_listening';

export interface SonicParameters {
  bpm: number;
  complexity: number; // 0.0 to 1.0
  darkness: number; // 0.0 to 1.0 (Controls distortion/bass)
  space: number; // 0.0 to 1.0 (Reverb/Delay mix)
  synthType: 'sawtooth' | 'square' | 'sine' | 'triangle';
  baseNoteFrequency: number;
  style: MusicStyle;
}

export interface HandGestures {
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
  isPinching: boolean;
  isFist: boolean;
  isPalmOpen: boolean;
  isVisible: boolean;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  PLAYING = 'PLAYING',
  ERROR = 'ERROR'
}