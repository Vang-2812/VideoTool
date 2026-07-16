import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createPcmWavHeader } from './wav.js';

export function buildMp3Args(inputWavPath, outputPath) {
  return [
    '-y',
    '-i', inputWavPath,
    '-c:a', 'libmp3lame',
    '-b:a', '256k',
    outputPath
  ];
}

export async function createPcmFileSink(pcmPath, fsImpl = fs) {
  await fsImpl.mkdir(path.dirname(pcmPath), { recursive: true });
  const handle = await fsImpl.open(pcmPath, 'w');
  let writeChain = Promise.resolve();
  let byteLength = 0;
  let closed = false;

  return {
    path: pcmPath,
    get byteLength() {
      return byteLength;
    },
    append(value) {
      if (closed) return Promise.reject(new Error('PCM sink is closed.'));
      const copy = Buffer.from(value);
      writeChain = writeChain.then(async () => {
        await handle.write(copy);
        byteLength += copy.length;
      });
      return writeChain;
    },
    async close() {
      if (closed) return;
      closed = true;
      try {
        await writeChain;
      } finally {
        await handle.close();
      }
    }
  };
}

async function writeWavFromPcm(pcmPath, wavPath, fsImpl) {
  const { size } = await fsImpl.stat(pcmPath);
  await fsImpl.writeFile(wavPath, createPcmWavHeader(size));
  await pipeline(
    createReadStream(pcmPath),
    createWriteStream(wavPath, { flags: 'a' })
  );
}

async function runFfmpeg(ffmpegPath, args, { spawnImpl, signal }) {
  if (!ffmpegPath) throw new Error('FFmpeg path is required for MP3 output.');
  if (signal?.aborted) {
    throw Object.assign(new Error('TTS job cancelled.'), { name: 'AbortError' });
  }

  await new Promise((resolve, reject) => {
    const child = spawnImpl(ffmpegPath, args, { windowsHide: true });
    let stderr = '';
    let settled = false;

    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () => {
      child.kill();
      settle(reject, Object.assign(new Error('TTS job cancelled.'), {
        name: 'AbortError'
      }));
    };

    child.stderr?.on('data', (value) => {
      stderr += value.toString();
    });
    child.once('error', (error) => settle(reject, error));
    child.once('close', (code) => {
      if (code === 0) settle(resolve);
      else settle(reject, new Error(`FFmpeg exited with code ${code}: ${stderr}`));
    });
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function finalizePcmOutput({
  pcmPath,
  outputPath,
  outputFormat,
  ffmpegPath,
  spawnImpl = spawn,
  signal,
  fsImpl = fs
}) {
  if (!['wav', 'mp3'].includes(outputFormat)) {
    throw new Error(`Unsupported TTS output format: ${outputFormat}`);
  }
  if (signal?.aborted) {
    throw Object.assign(new Error('TTS job cancelled.'), { name: 'AbortError' });
  }

  await fsImpl.mkdir(path.dirname(outputPath), { recursive: true });
  const partialPath = `${outputPath}.partial.${outputFormat}`;
  const sourceWavPath = outputFormat === 'wav'
    ? partialPath
    : `${outputPath}.source.wav`;

  await fsImpl.unlink(partialPath).catch(() => {});
  if (sourceWavPath !== partialPath) {
    await fsImpl.unlink(sourceWavPath).catch(() => {});
  }

  try {
    await writeWavFromPcm(pcmPath, sourceWavPath, fsImpl);
    if (outputFormat === 'mp3') {
      await runFfmpeg(
        ffmpegPath,
        buildMp3Args(sourceWavPath, partialPath),
        { spawnImpl, signal }
      );
    }
    await fsImpl.rename(partialPath, outputPath);
    return outputPath;
  } finally {
    if (sourceWavPath !== partialPath) {
      await fsImpl.unlink(sourceWavPath).catch(() => {});
    }
    await fsImpl.unlink(partialPath).catch(() => {});
  }
}
