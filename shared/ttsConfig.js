export const DEFAULT_TTS_SETTINGS = Object.freeze({
  mode: 'stable',
  languageCode: 'en-US',
  speaker: 'Charon',
  speakingRate: 1,
  outputFormat: 'mp3',
  model: 'gemini-3.1-flash-tts-preview',
  prompt: 'Read aloud in a warm, welcoming tone.'
});

const FEMALE_SPEAKERS = new Set([
  'Aoede', 'Kore', 'Callirrhoe', 'Leda', 'Zephyr', 'Autonoe',
  'Laomedeia', 'Despina', 'Erinome', 'Achird', 'Algieba',
  'Pulcherrima', 'Sadachbia', 'Sadaltager', 'Sulafat', 'Vindemiatrix'
]);

const NEURAL2_DEFAULTS = Object.freeze({
  'en-US': { male: 'en-US-Neural2-D', female: 'en-US-Neural2-F' },
  'en-GB': { male: 'en-GB-Neural2-B', female: 'en-GB-Neural2-A' },
  'vi-VN': { male: 'vi-VN-Neural2-D', female: 'vi-VN-Neural2-A' }
});

const utf8Bytes = (value = '') => new TextEncoder().encode(value).length;

export function normalizeTtsSettings(value = {}) {
  return {
    ...DEFAULT_TTS_SETTINGS,
    ...value,
    mode: value.mode ?? 'stable'
  };
}

export function migrateTtsProfile(profile) {
  return {
    ...profile,
    mode: profile.mode ?? 'expressive'
  };
}

export function buildChirpVoiceName(languageCode, speaker) {
  return `${languageCode}-Chirp3-HD-${speaker}`;
}

export function resolveNeural2Voice(languageCode, speaker) {
  const gender = FEMALE_SPEAKERS.has(speaker) ? 'female' : 'male';
  return NEURAL2_DEFAULTS[languageCode]?.[gender] ?? null;
}

export function validateTtsJobRequest(request) {
  if (!request?.text?.trim()) return { ok: false, error: 'Script is empty.' };
  if (!['stable', 'expressive', 'legacy'].includes(request.mode)) {
    return { ok: false, error: 'Invalid TTS mode.' };
  }
  if (!request.languageCode?.trim()) {
    return { ok: false, error: 'TTS language is required.' };
  }
  if (!request.speaker?.trim() || !request.voiceName?.trim()) {
    return { ok: false, error: 'TTS speaker and voice are required.' };
  }
  if (request.mode === 'expressive' && !request.modelName?.trim()) {
    return { ok: false, error: 'Expressive TTS model is required.' };
  }
  if (!request.outputPath) return { ok: false, error: 'Output path is required.' };
  if (!['wav', 'mp3'].includes(request.outputFormat)) {
    return { ok: false, error: 'Invalid output format.' };
  }
  if (!(request.speakingRate >= 0.25 && request.speakingRate <= 2)) {
    return { ok: false, error: 'Speaking rate must be between 0.25 and 2.0.' };
  }
  if (request.mode === 'expressive' && utf8Bytes(request.prompt) >= 4000) {
    return { ok: false, error: 'Gemini prompt must be below 4000 bytes.' };
  }
  return { ok: true };
}
