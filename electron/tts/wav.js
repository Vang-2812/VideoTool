const EXPECTED_FORMAT = Object.freeze({
  encoding: 1,
  channels: 1,
  sampleRate: 24000,
  bitsPerSample: 16
});

export function createPcmWavHeader(dataBytes, format = {}) {
  if (!Number.isInteger(dataBytes) || dataBytes < 0 || dataBytes > 0xffffffff - 36) {
    throw new Error('Invalid PCM data length for WAV output.');
  }

  const sampleRate = format.sampleRate ?? EXPECTED_FORMAT.sampleRate;
  const channels = format.channels ?? EXPECTED_FORMAT.channels;
  const bitsPerSample = format.bitsPerSample ?? EXPECTED_FORMAT.bitsPerSample;
  const blockAlign = channels * bitsPerSample / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(EXPECTED_FORMAT.encoding, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataBytes, 40);

  return header;
}

export function extractPcmFromWav(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    throw new Error('Expected a RIFF/WAVE buffer.');
  }
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Expected a RIFF/WAVE buffer.');
  }

  let offset = 12;
  let format = null;
  let pcm = null;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + size;

    if (end > buffer.length) throw new Error(`WAV ${id} chunk is truncated.`);

    if (id === 'fmt ') {
      if (size < 16) throw new Error('WAV fmt chunk is invalid.');
      format = {
        encoding: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        bitsPerSample: buffer.readUInt16LE(start + 14)
      };
    } else if (id === 'data') {
      pcm = buffer.subarray(start, end);
    }

    offset = end + (size % 2);
  }

  if (!format || !pcm) throw new Error('WAV is missing fmt or data chunks.');
  if (
    format.encoding !== EXPECTED_FORMAT.encoding
    || format.channels !== EXPECTED_FORMAT.channels
    || format.sampleRate !== EXPECTED_FORMAT.sampleRate
    || format.bitsPerSample !== EXPECTED_FORMAT.bitsPerSample
  ) {
    throw new Error('Expected mono 24000 Hz 16-bit PCM WAV.');
  }

  return pcm;
}
