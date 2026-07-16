import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPcmWavHeader, extractPcmFromWav } from '../electron/tts/wav.js';
import {
  buildMp3Args,
  createPcmFileSink,
  finalizePcmOutput
} from '../electron/tts/audioAssembler.js';

test('extracts only PCM data from a valid mono 24 kHz WAV', () => {
  const pcm = Buffer.from([1, 0, 2, 0, 3, 0]);
  const wav = Buffer.concat([createPcmWavHeader(pcm.length), pcm]);
  assert.deepEqual(extractPcmFromWav(wav), pcm);
});

test('rejects a WAV with unsupported sample format', () => {
  const wav = createPcmWavHeader(4, {
    sampleRate: 44100,
    channels: 2,
    bitsPerSample: 16
  });
  assert.throws(
    () => extractPcmFromWav(Buffer.concat([wav, Buffer.alloc(4)])),
    /mono 24000 Hz 16-bit/i
  );
});

test('PCM sink serializes appended audio in order', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tts-pcm-'));
  const pcmPath = join(dir, 'audio.pcm');
  const sink = await createPcmFileSink(pcmPath);
  await Promise.all([
    sink.append(Buffer.from([1, 0])),
    sink.append(Buffer.from([2, 0]))
  ]);
  await sink.close();
  assert.equal(sink.byteLength, 4);
  assert.deepEqual(await readFile(pcmPath), Buffer.from([1, 0, 2, 0]));
});

test('builds one final MP3 encode without raw PCM input flags', () => {
  const args = buildMp3Args('C:/tmp/all.wav', 'C:/tmp/out.mp3');
  assert.deepEqual(args, [
    '-y', '-i', 'C:/tmp/all.wav', '-c:a', 'libmp3lame',
    '-b:a', '256k', 'C:/tmp/out.mp3'
  ]);
  assert.equal(args.includes('s16le'), false);
  assert.equal(args.join(' ').includes('acrossfade'), false);
});

test('finalizes a WAV by adding exactly one header', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tts-wav-'));
  const pcmPath = join(dir, 'audio.pcm');
  const outputPath = join(dir, 'audio.wav');
  const pcm = Buffer.from([1, 0, 2, 0]);
  await writeFile(pcmPath, pcm);
  await finalizePcmOutput({ pcmPath, outputPath, outputFormat: 'wav' });
  assert.deepEqual(extractPcmFromWav(await readFile(outputPath)), pcm);
});
