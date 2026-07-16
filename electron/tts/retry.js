function isRetryable(error) {
  return error?.status === 429
    || error?.status >= 500
    || error?.code === 'ECONNRESET'
    || error?.code === 'ETIMEDOUT'
    || error instanceof TypeError;
}

function abortError() {
  return Object.assign(new Error('TTS job cancelled.'), {
    name: 'AbortError'
  });
}

async function abortableDelay(milliseconds, signal, sleep) {
  if (signal?.aborted) throw abortError();
  if (sleep) {
    await sleep(milliseconds);
    if (signal?.aborted) throw abortError();
    return;
  }

  await new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => {
      clearTimeout(timer);
      cleanup();
      reject(abortError());
    };
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function withRetry(operation, {
  attempts = 3,
  signal,
  sleep,
  random = Math.random
} = {}) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal?.aborted) throw abortError();

    try {
      return await operation(attempt + 1);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === attempts - 1) throw error;
      const delay = error.retryAfterMs
        ?? Math.round(500 * (2 ** attempt) + random() * 250);
      await abortableDelay(delay, signal, sleep);
    }
  }

  throw lastError;
}
