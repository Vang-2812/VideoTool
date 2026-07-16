export type TtsProvider = 'chirp-streaming' | 'cloud-rest' | 'gemini';

export interface TtsChunk {
  id: number;
  text: string;
  byteCount: number;
  status: 'pending' | 'success' | 'error';
  audioPath?: string;
  errorMsg?: string;
  isHardCut: boolean;
}

export interface TtsChunkOptions {
  provider?: TtsProvider;
  prompt?: string;
  languageCode?: string;
}

export const TTS_CHUNK_LIMITS: Readonly<Record<TtsProvider, number>>;
export function chunkTextForTTS(text: string, options?: TtsChunkOptions | string): TtsChunk[];
