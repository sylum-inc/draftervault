#!/usr/bin/env node
/**
 * Draws the app icons that index.html and manifest.json ask for.
 *
 *   node scripts/build-icons.mjs
 *
 * Both files referenced /icons/*.png from the start and the directory never
 * existed, so every install prompt and every home-screen shortcut fell back to
 * a browser default.
 *
 * The mark is drawn here rather than committed as a binary blob nobody can
 * edit: it is a vault door — a ring with a chevron inside it — in the draft
 * room's own accent over its own ground, so the icon and the app cannot drift
 * apart. PNGs are written with zlib and a CRC, which Node has, so this needs no
 * image library and no headless browser to run.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/icons');

/** Straight from src/styles/draft-room.css. */
const GROUND = [8, 10, 15];
const ACCENT = [77, 124, 255];
const INK = [237, 241, 247];

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
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

/** RGBA pixels -> a PNG buffer. */
const encodePng = (pixels, size) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  // 10-12: deflate, adaptive filtering, no interlace — all zero.

  // One filter byte per scanline; filter 0 (none) keeps this readable and the
  // icons are small enough that the extra bytes do not matter.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// ---------------------------------------------------------------------------
// the mark
// ---------------------------------------------------------------------------

/** Distance from a point to a line segment, for drawing strokes with width. */
const distanceToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/**
 * What the icon is made of, in a unit square, so one description scales to
 * every size. Returns the colour at a point, or null for the ground.
 */
const markAt = (x, y) => {
  const cx = 0.5;
  const cy = 0.5;
  const radius = Math.hypot(x - cx, y - cy);

  // The vault door: a heavy accent ring.
  if (radius > 0.3 && radius < 0.4) return ACCENT;

  // The chevron inside it, in ink, pointing down like a falling price.
  const stroke = 0.052;
  const left = distanceToSegment(x, y, 0.355, 0.42, 0.5, 0.61);
  const right = distanceToSegment(x, y, 0.5, 0.61, 0.645, 0.42);
  if (Math.min(left, right) < stroke) return INK;

  // Four bolts around the ring, at the diagonals, which is what stops it
  // reading as a plain circle at 72px.
  for (const angle of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const bx = cx + Math.cos(angle) * 0.47;
    const by = cy + Math.sin(angle) * 0.47;
    if (Math.hypot(x - bx, y - by) < 0.045) return ACCENT;
  }

  return null;
};

/** True inside a rounded square covering most of the canvas. */
const insideGround = (x, y) => {
  const inset = 0.02;
  const r = 0.18;
  const dx = Math.max(inset + r - x, 0, x - (1 - inset - r));
  const dy = Math.max(inset + r - y, 0, y - (1 - inset - r));
  if (x < inset || x > 1 - inset || y < inset || y > 1 - inset) return false;
  return Math.hypot(dx, dy) <= r;
};

/**
 * Draw one icon.
 *
 * Every pixel is sampled on a 4x4 subgrid and averaged, which is what keeps the
 * ring and the chevron from crawling with jaggies at 72px — there is no
 * rasteriser here to do it for us.
 */
const draw = (size) => {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = 4;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          if (!insideGround(x, y)) continue;
          const colour = markAt(x, y) ?? GROUND;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          a += 255;
        }
      }

      const total = samples * samples;
      const offset = (py * size + px) * 4;
      const covered = a / 255;
      // Premultiplication would darken the edge against a light home screen;
      // averaging only the covered samples keeps the colour true.
      pixels[offset] = covered ? Math.round(r / covered) : 0;
      pixels[offset + 1] = covered ? Math.round(g / covered) : 0;
      pixels[offset + 2] = covered ? Math.round(b / covered) : 0;
      pixels[offset + 3] = Math.round(a / total);
    }
  }

  return encodePng(pixels, size);
};

mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT, `icon-${size}x${size}.png`);
  writeFileSync(file, draw(size));
  console.log(`  wrote public/icons/icon-${size}x${size}.png`);
}
console.log(`\n  ${SIZES.length} icons written.`);
