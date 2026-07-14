/**
 * Assigns sound effects randomly from a pool to a list of storyboard files.
 * Enforces FR-3.2.2 (no consecutive repeats) and handles FR-3.2.3 (single SFX pool).
 * 
 * @param {Array} files - List of StoryboardFile objects
 * @param {Array} sfxPool - List of SFX items { path, name, duration }
 * @returns {Array} Updated storyboard files with sfxPath and sfxName
 */
export function assignRandomSfx(files, sfxPool) {
  if (!files || files.length === 0) return [];
  if (!sfxPool || sfxPool.length === 0) {
    // If no SFX in pool, clear assignments
    return files.map(f => ({
      ...f,
      sfxPath: null,
      sfxName: null
    }));
  }

  const poolSize = sfxPool.length;
  const result = [];
  let previousSfxPath = null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let selectedSfx;

    if (poolSize === 1) {
      // Rule FR-3.2.3: Single sound effect pool, repeat it everywhere
      selectedSfx = sfxPool[0];
    } else {
      // Rule FR-3.2.2: Do not repeat same SFX consecutively
      const candidates = sfxPool.filter(sfx => sfx.path !== previousSfxPath);
      
      // Fallback in case of unexpected empty candidates list
      const activeCandidates = candidates.length > 0 ? candidates : sfxPool;
      
      const randomIndex = Math.floor(Math.random() * activeCandidates.length);
      selectedSfx = activeCandidates[randomIndex];
    }

    result.push({
      ...file,
      sfxPath: selectedSfx.path,
      sfxName: selectedSfx.name
    });

    previousSfxPath = selectedSfx.path;
  }

  return result;
}

/**
 * Assigns Ken Burns parameters (zoom direction, limit, pan anchor) randomly to a list of files.
 * Ensures that if parameters are already assigned, they are preserved (lock once).
 * 
 * @param {Array} files - List of StoryboardFile objects
 * @returns {Array} Updated storyboard files with Ken Burns parameters
 */
export function assignKenBurns(files) {
  if (!files || files.length === 0) return [];
  
  const anchors = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
  
  return files.map(file => {
    if (file.kbZoomDirection && file.kbZoomLimit && file.kbPanAnchor) {
      return file;
    }
    
    const zoomDir = Math.random() > 0.5 ? 'in' : 'out';
    const zoomLimit = parseFloat((1.05 + Math.random() * 0.10).toFixed(3));
    const anchorIdx = Math.floor(Math.random() * anchors.length);
    
    return {
      ...file,
      kbZoomDirection: zoomDir,
      kbZoomLimit: zoomLimit,
      kbPanAnchor: anchors[anchorIdx]
    };
  });
}

/**
 * Forces reshuffling of Ken Burns parameters on all files.
 * 
 * @param {Array} files - List of StoryboardFile objects
 * @returns {Array} Updated storyboard files with new Ken Burns parameters
 */
export function reshuffleKenBurns(files) {
  if (!files || files.length === 0) return [];
  
  const anchors = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
  
  return files.map(file => {
    const zoomDir = Math.random() > 0.5 ? 'in' : 'out';
    const zoomLimit = parseFloat((1.05 + Math.random() * 0.10).toFixed(3));
    const anchorIdx = Math.floor(Math.random() * anchors.length);
    
    return {
      ...file,
      kbZoomDirection: zoomDir,
      kbZoomLimit: zoomLimit,
      kbPanAnchor: anchors[anchorIdx]
    };
  });
}
