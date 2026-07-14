export interface TtsChunk {
  id: number;
  text: string;
  byteCount: number;
  status: 'pending' | 'success' | 'error';
  audioPath?: string;
  errorMsg?: string;
  isHardCut?: boolean;
}

export function chunkTextForTTS(text: string, prompt: string): TtsChunk[] {
  if (!text.trim()) return [];

  const MAX_BYTES = 4000;
  const BUFFER = 200;
  const encoder = new TextEncoder();
  const promptBytes = encoder.encode(prompt).length;
  const availableBytes = MAX_BYTES - BUFFER - promptBytes;
  
  // Note: Intl.Segmenter is fully supported in Chromium 92+ (Electron 14+)
  const segmenter = new Intl.Segmenter(['vi', 'en'], { granularity: 'sentence' });
  const segments = Array.from(segmenter.segment(text)).map(s => s.segment);
  
  const chunks: TtsChunk[] = [];
  let currentChunkText = '';
  let chunkId = 1;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const potentialText = currentChunkText ? currentChunkText + segment : segment;
    const potentialBytes = encoder.encode(potentialText).length;

    if (potentialBytes <= availableBytes) {
      currentChunkText = potentialText;
    } else {
      // Chunk what we have so far
      if (currentChunkText) {
        chunks.push({
          id: chunkId++,
          text: currentChunkText.trim(),
          byteCount: encoder.encode(currentChunkText.trim()).length,
          status: 'pending',
          isHardCut: false
        });
      } 
      
      currentChunkText = segment;
      
      // Check if the new segment ALONE exceeds the availableBytes limit
      if (encoder.encode(currentChunkText).length > availableBytes) {
        let remainingSegment = currentChunkText;
        while (remainingSegment.length > 0) {
          let cutLen = remainingSegment.length;
          // Shrink by 10% until it fits
          while (cutLen > 0 && encoder.encode(remainingSegment.substring(0, cutLen)).length > availableBytes) {
            cutLen = Math.floor(cutLen * 0.9);
            if (cutLen === 0) cutLen = 1;
          }
          const cutText = remainingSegment.substring(0, cutLen);
          chunks.push({
            id: chunkId++,
            text: cutText.trim(),
            byteCount: encoder.encode(cutText.trim()).length,
            status: 'pending',
            isHardCut: true
          });
          remainingSegment = remainingSegment.substring(cutLen);
        }
        currentChunkText = ''; // Hard cut is fully resolved
      }
    }
  }

  if (currentChunkText && currentChunkText.trim()) {
    chunks.push({
      id: chunkId++,
      text: currentChunkText.trim(),
      byteCount: encoder.encode(currentChunkText.trim()).length,
      status: 'pending',
      isHardCut: false
    });
  }

  return chunks;
}
