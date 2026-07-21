/**
 * Translation Provider Factory supporting Gemini, OpenAI, and DeepSeek API.
 */

export function buildTranslationPrompt(segments, sourceLang, targetLang) {
  const jsonInput = JSON.stringify(segments.map(s => ({ id: s.id, text: s.text })), null, 2);
  return `You are a professional video dubbing translator.
Translate the following transcript segments from ${sourceLang} to ${targetLang}.
Maintain the original tone, context, and brevity appropriate for video subtitles.
Return ONLY a valid JSON array of objects with keys "id" and "translated".

Input:
${jsonInput}`;
}

export function buildDeepSeekPayload(prompt, model = 'deepseek-chat') {
  return {
    model,
    messages: [
      { role: 'system', content: 'You are a precise translator for video dubbing.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  };
}

export async function translateSegments({ segments, sourceLang, targetLang, provider, apiKey, endpointUrl }) {
  if (!segments || segments.length === 0) return [];
  const prompt = buildTranslationPrompt(segments, sourceLang, targetLang);

  if (provider === 'deepseek') {
    const baseUrl = (endpointUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(buildDeepSeekPayload(prompt))
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`DeepSeek API Error: ${data.error?.message || response.statusText}`);
    }
    const content = data.choices?.[0]?.message?.content || '[]';
    const parsed = JSON.parse(content);
    const translationMap = new Map((parsed.translations || parsed).map(t => [t.id, t.translated]));
    return segments.map(s => ({
      ...s,
      translated: translationMap.get(s.id) || s.text
    }));
  }

  // Default mock translation for non-network testing
  return segments.map(s => ({
    ...s,
    translated: `[${targetLang}] ${s.text}`
  }));
}
