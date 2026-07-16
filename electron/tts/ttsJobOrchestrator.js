import { chunkTextForTTS } from '../../shared/ttsChunker.js';
import {
  buildChirpVoiceName,
  resolveNeural2Voice,
  validateTtsJobRequest
} from '../../shared/ttsConfig.js';

function providerForEngine(engine) {
  if (engine === 'chirp-streaming') return 'chirp-streaming';
  if (engine === 'gemini-rest') return 'gemini';
  return 'cloud-rest';
}

function modelForEngine(engine, request) {
  if (engine === 'gemini-rest') return request.modelName;
  if (engine === 'neural2-rest') return 'Neural2';
  return 'Chirp3-HD';
}

export function createTtsJobOrchestrator(deps) {
  async function runAttempt(engine, request, context) {
    const attempt = await deps.createAttempt(engine);

    try {
      const chunks = chunkTextForTTS(request.text, {
        provider: providerForEngine(engine),
        prompt: request.prompt,
        languageCode: request.languageCode
      });
      const synthesizeOptions = {
        ...request,
        engine,
        chunks,
        sink: attempt.sink,
        signal: context.signal,
        onProgress: context.onProgress
      };

      if (engine === 'chirp-streaming') {
        await deps.stream(synthesizeOptions);
      } else {
        await deps.rest(synthesizeOptions);
      }

      await attempt.close();
      context.onProgress?.({
        phase: 'encoding',
        progress: 95,
        engine
      });
      await deps.finalize({
        pcmPath: attempt.pcmPath,
        outputPath: request.outputPath,
        outputFormat: request.outputFormat,
        engine,
        signal: context.signal
      });
      await attempt.remove().catch(() => {});

      return {
        success: true,
        outputPath: request.outputPath,
        engine,
        modelName: modelForEngine(engine, request),
        voiceName: request.voiceName
      };
    } catch (error) {
      await attempt.close().catch(() => {});
      await attempt.remove().catch(() => {});
      throw error;
    }
  }

  return {
    async run(rawRequest, context) {
      try {
        const validation = validateTtsJobRequest(rawRequest);
        if (!validation.ok) return { success: false, error: validation.error };

        context.onProgress?.({
          phase: 'validating',
          progress: 0,
          engine: rawRequest.mode === 'expressive' ? 'gemini-rest' : 'chirp-streaming'
        });

        if (rawRequest.mode === 'expressive') {
          return await runAttempt('gemini-rest', rawRequest, context);
        }

        const chirpRequest = {
          ...rawRequest,
          voiceName: buildChirpVoiceName(rawRequest.languageCode, rawRequest.speaker)
        };
        let fallbackReason;

        if (await deps.hasStreamingCredentials()) {
          for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
            try {
              const result = await runAttempt('chirp-streaming', chirpRequest, context);
              return fallbackReason ? { ...result, fallbackReason } : result;
            } catch (error) {
              if (context.signal.aborted) throw error;
              fallbackReason = error.message;
              context.onProgress?.({
                phase: attemptNumber === 1 ? 'retrying' : 'fallback',
                progress: 0,
                engine: 'chirp-streaming',
                message: error.message
              });
            }
          }
        }

        try {
          const result = await runAttempt('chirp-rest', chirpRequest, context);
          return fallbackReason ? { ...result, fallbackReason } : result;
        } catch (error) {
          if (context.signal.aborted) throw error;
          fallbackReason = error.message;
          const neuralVoice = resolveNeural2Voice(
            rawRequest.languageCode,
            rawRequest.speaker
          );
          if (!neuralVoice) {
            return {
              success: false,
              error: `No Neural2 fallback for ${rawRequest.languageCode}.`
            };
          }

          context.onProgress?.({
            phase: 'fallback',
            progress: 0,
            engine: 'neural2-rest',
            message: error.message
          });
          const result = await runAttempt('neural2-rest', {
            ...rawRequest,
            voiceName: neuralVoice,
            modelName: 'Neural2'
          }, context);
          return { ...result, fallbackReason };
        }
      } catch (error) {
        if (error?.name === 'AbortError' || context.signal.aborted) {
          return {
            success: false,
            cancelled: true,
            error: 'TTS job cancelled.'
          };
        }
        const redacted = deps.redactError
          ? deps.redactError(error)
          : error?.message ?? String(error);
        return { success: false, error: redacted };
      }
    }
  };
}
