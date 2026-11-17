#!/usr/bin/env node
// Generates the fixture's binary assets so they stay out of git history.
// Usage: node scaffold.mjs <projectDir>
// Writes deliberately large, unoptimised PNGs (hero, gallery photos, avatars) so the
// gallery performance task has real weight to fix. Output is deterministic.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

const png = (width, height, hue) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let seed = hue * 7919 + width;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 24) - 12;
  const [r0, g0, b0] = [(hue * 3) % 256, (hue * 5 + 80) % 256, (hue * 7 + 160) % 256];
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const t = (x / width + y / height) / 2;
      const offset = row + 1 + x * 3;
      raw[offset] = Math.max(0, Math.min(255, r0 * (1 - t) + 40 * t + noise()));
      raw[offset + 1] = Math.max(0, Math.min(255, g0 * (1 - t) + 30 * t + noise()));
      raw[offset + 2] = Math.max(0, Math.min(255, b0 * (1 - t) + 60 * t + noise()));
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
};

const projectDir = process.argv[2];
if (!projectDir) {
  console.error('Usage: node scaffold.mjs <projectDir>');
  process.exit(1);
}
const images = path.join(projectDir, 'public', 'images');
fs.mkdirSync(images, { recursive: true });
fs.writeFileSync(path.join(images, 'hero.png'), png(2000, 1000, 200));
for (let index = 1; index <= 12; index += 1) fs.writeFileSync(path.join(images, `photo-${index}.png`), png(1200, 900, index * 29));
for (let index = 1; index <= 5; index += 1) fs.writeFileSync(path.join(images, `avatar-${index}.png`), png(256, 256, index * 70));
