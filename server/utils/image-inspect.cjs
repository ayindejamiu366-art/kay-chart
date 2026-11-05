/**
 * Image identification from magic bytes.
 *
 * Shared by the avatar and song-cover uploads. Both previously trusted the
 * client-supplied filename or Content-Type, which is attacker-controlled: a file
 * called `cover.png` can contain anything. Sniffing the real bytes means the
 * extension we store is derived from what the file actually is, so an uploaded
 * "image" that is really HTML or a script never lands in a directory that is
 * served back as an image.
 *
 * Dimensions come from the container header (PNG IHDR, GIF logical screen,
 * WebP VP8/VP8L/VP8X, JPEG SOFn) rather than by decoding, which is cheap and
 * needs no image library.
 */

/**
 * @param {Buffer} buffer
 * @returns {{mime: string, width: number, height: number}|null} null if unrecognised.
 */
function inspectImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;

  // PNG: 8-byte signature, then an IHDR chunk carrying width/height.
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    if (buffer.slice(12, 16).toString('latin1') !== 'IHDR') return null;
    return { mime: 'image/png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  // GIF: 'GIF87a' / 'GIF89a', then little-endian logical screen dimensions.
  const gif = buffer.slice(0, 6).toString('latin1');
  if (gif === 'GIF87a' || gif === 'GIF89a') {
    return { mime: 'image/gif', width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  // WebP: RIFF container whose first chunk is VP8, VP8L or VP8X.
  if (buffer.slice(0, 4).toString('latin1') === 'RIFF' && buffer.slice(8, 12).toString('latin1') === 'WEBP') {
    const chunk = buffer.slice(12, 16).toString('latin1');
    if (chunk === 'VP8 ') {
      return { mime: 'image/webp', width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return { mime: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') {
      const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      return { mime: 'image/webp', width, height };
    }
    return null;
  }

  // JPEG: walk the segment markers to the first SOFn frame header.
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      // SOF0/1/2/3/5/6/7/9/10/11/13/14/15 carry the frame size.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: 'image/jpeg', height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) return null;
      offset += 2 + length;
    }
    return null;
  }

  return null;
}

module.exports = { inspectImage };