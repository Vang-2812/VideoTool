export type TtsMode = 'stable' | 'expressive';
export type TtsOutputFormat = 'wav' | 'mp3';

export interface TtsSettings {
  mode: TtsMode;
  languageCode: string;
  speaker: string;
  speakingRate: number;
  outputFormat: TtsOutputFormat;
  model: string;
  prompt: string;
}

export interface TtsProfileLike {
  id: string;
  mode?: TtsMode;
  [key: string]: unknown;
}

export interface TtsJobRequestLike {
  mode: TtsMode;
  text: string;
  prompt?: string;
  outputPath: string;
  outputFormat: TtsOutputFormat;
  speakingRate: number;
}

export const DEFAULT_TTS_SETTINGS: Readonly<TtsSettings>;
export function normalizeTtsSettings(value?: Partial<TtsSettings>): TtsSettings;
export function migrateTtsProfile<T extends TtsProfileLike>(profile: T): T & { mode: TtsMode };
export function buildChirpVoiceName(languageCode: string, speaker: string): string;
export function resolveNeural2Voice(languageCode: string, speaker: string): string | null;
export function validateTtsJobRequest(request: TtsJobRequestLike): { ok: true } | { ok: false; error: string };
