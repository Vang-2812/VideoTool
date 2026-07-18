/**
 * Utility functions for parsing script text into sentences and mapping aligned word timestamps.
 */

/**
 * Splits script text into distinct sentence blocks based on punctuation (. ! ?) and newlines (\n).
 * Preserves exact sentence text.
 */
export function parseScriptSentences(scriptText, options = {}) {
  if (!scriptText || !scriptText.trim()) return [];

  const text = scriptText.trim();
  const regex = options.splitExtendedPunctuation
    ? /(?<=[.!?,;:]["'”’‘“]?)|["'”’‘“]|\r?\n/
    : /(?<=[.!?])|\r?\n/;

  const rawSegments = text.split(regex);
  const sentences = [];

  for (const seg of rawSegments) {
    const trimmed = seg.trim();
    if (/[\p{L}\p{N}]/u.test(trimmed)) {
      const words = trimmed.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
      if (words.length > 0) {
        sentences.push({
          text: trimmed,
          words: words
        });
      }
    }
  }

  return sentences;
}

/**
 * Groups aligned words into subtitle cues matching the original script sentences 1:1.
 */
export function groupWordsByScriptSentences(alignedWords, scriptText, options = {}) {
  const sentences = parseScriptSentences(scriptText, options);
  if (sentences.length === 0 || !alignedWords || alignedWords.length === 0) {
    return [];
  }

  const cues = [];
  let wordPointer = 0;

  for (const sentence of sentences) {
    const wordCount = sentence.words.length;
    if (wordCount === 0) continue;

    const sentenceAlignedWords = [];
    for (let k = 0; k < wordCount && wordPointer < alignedWords.length; k++) {
      sentenceAlignedWords.push(alignedWords[wordPointer]);
      wordPointer++;
    }

    if (sentenceAlignedWords.length > 0) {
      const startTime = sentenceAlignedWords[0].start;
      const endTime = sentenceAlignedWords[sentenceAlignedWords.length - 1].end;
      cues.push({
        text: sentence.text,
        start: startTime,
        end: endTime
      });
    }
  }

  return cues;
}
