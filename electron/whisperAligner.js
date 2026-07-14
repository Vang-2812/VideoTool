/**
 * Whisper Aligner (v1.5)
 * Matches the original user script with Whisper word-level timestamps using the Needleman-Wunsch algorithm.
 * Interpolates missing timestamps for words not recognized by Whisper.
 */

// Helper to compute Levenshtein distance between two words
function getEditDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => 
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,    // Deletion
          matrix[i][j - 1] + 1,    // Insertion
          matrix[i - 1][j - 1] + 1 // Substitution
        );
      }
    }
  }

  return matrix[a.length][b.length];
}

// Clean word from punctuation and convert to lowercase for comparison
function cleanWord(word) {
  return word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“”]/g, '').trim();
}

/**
 * Needleman-Wunsch Alignment
 * S: Array of Original Script words { original: string, clean: string }
 * W: Array of Whisper words { word: string, clean: string, start: number, end: number }
 */
export function alignScriptAndWhisper(originalScript, whisperWords, audioDuration) {
  // 1. Tokenize script
  const scriptTokens = originalScript.split(/\s+/).filter(Boolean).map(token => ({
    original: token,
    clean: cleanWord(token)
  }));

  const whisperTokens = whisperWords.map(w => ({
    word: w.word,
    clean: cleanWord(w.word),
    start: w.start,
    end: w.end
  }));

  const N = scriptTokens.length;
  const M = whisperTokens.length;

  if (N === 0) return [];

  // Needleman-Wunsch parameters
  const MATCH_SCORE = 2;
  const NEAR_MATCH_SCORE = 1;
  const MISMATCH_SCORE = -1;
  const GAP_PENALTY = -1.5;

  // Initialize DP Matrix
  const scoreMatrix = Array.from({ length: N + 1 }, () => Array(M + 1).fill(0));
  const pathMatrix = Array.from({ length: N + 1 }, () => Array(M + 1).fill('')); // 'diag', 'up', 'left'

  for (let i = 0; i <= N; i++) {
    scoreMatrix[i][0] = i * GAP_PENALTY;
    pathMatrix[i][0] = 'up';
  }
  for (let j = 0; j <= M; j++) {
    scoreMatrix[0][j] = j * GAP_PENALTY;
    pathMatrix[0][j] = 'left';
  }

  // Populate DP Matrix
  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      const cleanS = scriptTokens[i - 1].clean;
      const cleanW = whisperTokens[j - 1].clean;
      
      let matchScore = MISMATCH_SCORE;
      if (cleanS === cleanW && cleanS !== '') {
        matchScore = MATCH_SCORE;
      } else if (cleanS !== '' && cleanW !== '') {
        const dist = getEditDistance(cleanS, cleanW);
        if (dist <= 2 || cleanS.includes(cleanW) || cleanW.includes(cleanS)) {
          matchScore = NEAR_MATCH_SCORE;
        }
      }

      const diag = scoreMatrix[i - 1][j - 1] + matchScore;
      const up = scoreMatrix[i - 1][j] + GAP_PENALTY;
      const left = scoreMatrix[i][j - 1] + GAP_PENALTY;

      const maxScore = Math.max(diag, up, left);
      scoreMatrix[i][j] = maxScore;

      if (maxScore === diag) {
        pathMatrix[i][j] = 'diag';
      } else if (maxScore === up) {
        pathMatrix[i][j] = 'up';
      } else {
        pathMatrix[i][j] = 'left';
      }
    }
  }

  // Backtracking to align
  let i = N;
  let j = M;
  const alignmentResult = []; // List of original script words with assigned or empty times
  let matchedCount = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && pathMatrix[i][j] === 'diag') {
      // S[i-1] aligned with W[j-1]
      const isMatch = scriptTokens[i - 1].clean === whisperTokens[j - 1].clean || 
                      getEditDistance(scriptTokens[i - 1].clean, whisperTokens[j - 1].clean) <= 2;
      
      alignmentResult.unshift({
        original: scriptTokens[i - 1].original,
        clean: scriptTokens[i - 1].clean,
        start: whisperTokens[j - 1].start,
        end: whisperTokens[j - 1].end,
        aligned: true,
        isMatch
      });
      if (isMatch) matchedCount++;
      i--;
      j--;
    } else if (i > 0 && (j === 0 || pathMatrix[i][j] === 'up')) {
      // S[i-1] aligned with a gap (deletion of word from audio)
      alignmentResult.unshift({
        original: scriptTokens[i - 1].original,
        clean: scriptTokens[i - 1].clean,
        start: null,
        end: null,
        aligned: false,
        isMatch: false
      });
      i--;
    } else {
      // W[j-1] aligned with a gap (insertion of word in audio) - ignore for output SRT
      j--;
    }
  }

  // Calculate matches and average word duration
  const matchRate = N > 0 ? (matchedCount / N) * 100 : 0;
  
  let totalAlignedDuration = 0;
  let alignedCount = 0;
  alignmentResult.forEach(w => {
    if (w.aligned && w.start !== null && w.end !== null) {
      totalAlignedDuration += (w.end - w.start);
      alignedCount++;
    }
  });
  const avgWordDuration = alignedCount > 0 ? (totalAlignedDuration / alignedCount) : 0.3;

  // 4. Linear Interpolation for Missing Timestamps (FR-2.2)
  for (let k = 0; k < N; k++) {
    if (alignmentResult[k].aligned) continue;

    // Find nearest preceding aligned word
    let prevIdx = -1;
    for (let p = k - 1; p >= 0; p--) {
      if (alignmentResult[p].aligned) {
        prevIdx = p;
        break;
      }
    }

    // Find nearest succeeding aligned word
    let nextIdx = -1;
    for (let n = k + 1; n < N; n++) {
      if (alignmentResult[n].aligned) {
        nextIdx = n;
        break;
      }
    }

    // Count how many consecutive unaligned words exist between prevIdx and nextIdx
    const count = nextIdx !== -1 ? (nextIdx - prevIdx - 1) : (N - prevIdx - 1);

    // Calculate smart bounds based on average word duration to prevent end-of-audio drift
    let t_left = 0;
    let t_right = audioDuration;

    if (prevIdx !== -1 && nextIdx !== -1) {
      t_left = alignmentResult[prevIdx].end;
      t_right = alignmentResult[nextIdx].start;
    } else if (prevIdx !== -1) {
      t_left = alignmentResult[prevIdx].end;
      t_right = Math.min(audioDuration, t_left + count * avgWordDuration);
    } else if (nextIdx !== -1) {
      t_right = alignmentResult[nextIdx].start;
      t_left = Math.max(0, t_right - count * avgWordDuration);
    }

    const gapDuration = t_right - t_left;
    const stepDuration = gapDuration > 0 && count > 0 ? gapDuration / count : avgWordDuration;

    // Relative offset of current unaligned word in the gap block
    const offset = k - prevIdx - 1;

    alignmentResult[k].start = t_left + offset * stepDuration;
    alignmentResult[k].end = t_left + (offset + 1) * stepDuration;
    
    // Cap times to audio duration limit
    if (alignmentResult[k].start > audioDuration) alignmentResult[k].start = audioDuration;
    if (alignmentResult[k].end > audioDuration) alignmentResult[k].end = audioDuration;
  }

  return {
    words: alignmentResult.map(w => ({
      word: w.original,
      start: w.start,
      end: w.end
    })),
    matchRate
  };
}
