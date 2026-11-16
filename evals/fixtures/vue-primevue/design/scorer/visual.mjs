// Visual similarity of a render to its mockup (see ../README.md "Metric"). Pure: decoded PNGs in, numbers out.
//
// Plain SSIM punishes a section that sits 8 px lower as hard as a missing one, because every window
// after the shift compares misaligned pixels. So the comparison is tile-wise and shift-tolerant: each
// 32 px tile with content (in either image) is matched to the best spot in the other image within a
// small search window and judged there at design-review precision: its credit is the product of a
// structure credit (SSIM over 8 x 8 windows), a colour credit (worst aligned 8 px sub-block ΔE) and a
// shift credit (how far it had to move).

const TILE = 32;
// Tolerances (see ../README.md "Metric"; tuned on the D1 mutants and a real solution).
export const VISUAL = {
  searchX: 8, // px searched left and right
  searchY: 16, // px searched up and down
  ssimRamp: [0.8, 0.97], // tile SSIM giving no credit, full credit
  deltaRamp: [2, 8], // worst sub-block ΔE76 giving full credit, no credit
  shiftRamp: [2, 16], // shift (px) with full credit, and where it is down to half credit
  flatColour: 3 // a flat tile still counts when its mean colour is this ΔE76 from the page background
};
const rampUp = (value, [zero, full]) => Math.min(1, Math.max(0, (value - zero) / (full - zero)));
const COARSE = 4; // coarse search step, refined to 1 px around the best coarse offset
const WINDOW = 8;
const STRIDE = 4;
const FLAT = 4; // a tile has content when its luminance variance exceeds this
const SUB = 8; // colour term: 8 x 8 px sub-blocks of an aligned tile
const CONTENT_DELTA = 2; // a sub-block counts when it differs from the page background by more than this ΔE
const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;

/** Copies `image` onto a `width` x `height` canvas filled with `bg` (crops what lies outside). */
function canvas(image, width, height, bg) {
  const data = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) data.set(bg, index * 4);
  const copyWidth = Math.min(width, image.width);
  for (let y = 0; y < Math.min(height, image.height); y += 1) {
    image.data.copy(data, y * width * 4, y * image.width * 4, (y * image.width + copyWidth) * 4);
  }
  return { width, height, data };
}

/** Luminance plus summed-area tables of luminance, luminance² and each RGB channel. */
function prepare(image) {
  const { width, height, data } = image;
  const stride = width + 1;
  const luma = new Float32Array(width * height);
  const tables = Array.from({ length: 5 }, () => new Float64Array(stride * (height + 1)));
  const [sum, square, red, green, blue] = tables;
  for (let y = 0; y < height; y += 1) {
    const row = [0, 0, 0, 0, 0];
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
      luma[y * width + x] = value;
      const values = [value, value * value, data[offset], data[offset + 1], data[offset + 2]];
      const here = (y + 1) * stride + x + 1;
      for (let table = 0; table < 5; table += 1) {
        row[table] += values[table];
        tables[table][here] = tables[table][here - stride] + row[table];
      }
    }
  }
  return { width, height, stride, luma, sum, square, red, green, blue };
}

const boxSum = (table, stride, x, y, w, h) => table[(y + h) * stride + x + w] - table[y * stride + x + w] - table[(y + h) * stride + x] + table[y * stride + x];

/** SSIM of the `size` square at (ax, ay) in A and (bx, by) in B, as one window. */
function ssimAt(A, ax, ay, B, bx, by, size) {
  const n = size * size;
  const ma = boxSum(A.sum, A.stride, ax, ay, size, size) / n;
  const mb = boxSum(B.sum, B.stride, bx, by, size, size) / n;
  const va = boxSum(A.square, A.stride, ax, ay, size, size) / n - ma * ma;
  const vb = boxSum(B.square, B.stride, bx, by, size, size) / n - mb * mb;
  let cross = 0;
  for (let y = 0; y < size; y += 1) {
    const rowA = (ay + y) * A.width + ax;
    const rowB = (by + y) * B.width + bx;
    for (let x = 0; x < size; x += 1) cross += A.luma[rowA + x] * B.luma[rowB + x];
  }
  const cov = cross / n - ma * mb;
  return ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
}

/** The offset (dx, dy) where A's tile at (x, y) best matches B: coarse grid, then a 1 px refinement. */
function bestOffset(A, x, y, B) {
  const fits = (dx, dy) => x + dx >= 0 && y + dy >= 0 && x + dx + TILE <= B.width && y + dy + TILE <= B.height;
  let best = { dx: 0, dy: 0, score: fits(0, 0) ? ssimAt(A, x, y, B, x, y, TILE) : -Infinity };
  const consider = (dx, dy) => {
    if (!fits(dx, dy)) return;
    const score = ssimAt(A, x, y, B, x + dx, y + dy, TILE);
    // Ties go to the smaller move, so a flat area never "moves".
    if (score > best.score + 1e-6 || (Math.abs(score - best.score) <= 1e-6 && Math.hypot(dx, dy) < Math.hypot(best.dx, best.dy))) best = { dx, dy, score };
  };
  for (let dy = -VISUAL.searchY; dy <= VISUAL.searchY; dy += COARSE) for (let dx = -VISUAL.searchX; dx <= VISUAL.searchX; dx += COARSE) consider(dx, dy);
  const { dx: cx, dy: cy } = best;
  for (let dy = cy - COARSE + 1; dy < cy + COARSE; dy += 1) for (let dx = cx - COARSE + 1; dx < cx + COARSE; dx += 1) consider(dx, dy);
  return best;
}

function lab(r, g, b) {
  const linear = (value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const meanLab = (P, x, y) => {
  const n = SUB * SUB;
  return lab(boxSum(P.red, P.stride, x, y, SUB, SUB) / n, boxSum(P.green, P.stride, x, y, SUB, SUB) / n, boxSum(P.blue, P.stride, x, y, SUB, SUB) / n);
};

/** Scores A's content tile at (x, y) against its best match in B: `{ structureCredit, colourCredit, credit }`. */
function scoreTile(A, x, y, B, background) {
  const { dx, dy } = bestOffset(A, x, y, B);
  const bx = x + dx;
  const by = y + dy;
  let windows = 0;
  let total = 0;
  for (let wy = 0; wy + WINDOW <= TILE; wy += STRIDE) {
    for (let wx = 0; wx + WINDOW <= TILE; wx += STRIDE) {
      total += ssimAt(A, x + wx, y + wy, B, bx + wx, by + wy, WINDOW);
      windows += 1;
    }
  }
  let worst = 0;
  for (let sy = 0; sy < TILE; sy += SUB) {
    for (let sx = 0; sx < TILE; sx += SUB) {
      const a = meanLab(A, x + sx, y + sy);
      const b = meanLab(B, bx + sx, by + sy);
      if (deltaE(a, background) <= CONTENT_DELTA && deltaE(b, background) <= CONTENT_DELTA) continue;
      worst = Math.max(worst, deltaE(a, b));
    }
  }
  const structureCredit = rampUp(total / windows, VISUAL.ssimRamp);
  const colourCredit = 1 - rampUp(worst, VISUAL.deltaRamp);
  const shiftCredit = 1 - 0.5 * rampUp(Math.hypot(dx, dy), VISUAL.shiftRamp);
  return { structureCredit, colourCredit, credit: structureCredit * colourCredit * shiftCredit };
}

/**
 * Raw similarity of `render` to `mockup` (pngjs images). Both are laid on a canvas of the mockup's
 * width and the taller height, filled with the mockup's background (its bottom-left pixel); `masks`
 * (`[x, y, width, height]` in mockup pixels) are painted with the background in both. Every 32 px tile
 * with content (luminance variance, or a colour away from the page background) in either image is
 * matched in the other (see the file comment). `sim` = mean tile credit x heightRatio (shorter page
 * height / taller page height); `ssim` and `colour` are the mean structure and colour credits (diagnostics).
 */
export function similarity(mockup, render, masks = []) {
  const bg = [...mockup.data.subarray(((mockup.height - 1) * mockup.width) * 4, ((mockup.height - 1) * mockup.width) * 4 + 4)];
  const height = Math.max(mockup.height, render.height);
  const a = canvas(mockup, mockup.width, height, bg);
  const b = canvas(render, mockup.width, height, bg);
  for (const [mx, my, mw, mh] of masks) {
    for (let y = my; y < Math.min(height, my + mh); y += 1) {
      for (let x = mx; x < Math.min(mockup.width, mx + mw); x += 1) {
        a.data.set(bg, (y * mockup.width + x) * 4);
        b.data.set(bg, (y * mockup.width + x) * 4);
      }
    }
  }
  const A = prepare(a);
  const B = prepare(b);
  const background = lab(bg[0], bg[1], bg[2]);
  let tiles = 0;
  let credit = 0;
  let structureCredit = 0;
  let colourCredit = 0;
  for (const [from, to] of [[A, B], [B, A]]) {
    for (let y = 0; y + TILE <= height; y += TILE) {
      for (let x = 0; x + TILE <= mockup.width; x += TILE) {
        const n = TILE * TILE;
        const mean = boxSum(from.sum, from.stride, x, y, TILE, TILE) / n;
        const flat = boxSum(from.square, from.stride, x, y, TILE, TILE) / n - mean * mean <= FLAT;
        // A flat tile counts too when it is coloured (a filled area, a tinted band), not page background.
        if (flat && (deltaE(lab(boxSum(from.red, from.stride, x, y, TILE, TILE) / n, boxSum(from.green, from.stride, x, y, TILE, TILE) / n, boxSum(from.blue, from.stride, x, y, TILE, TILE) / n), background) <= VISUAL.flatColour)) continue;
        const tile = scoreTile(from, x, y, to, background);
        tiles += 1;
        credit += tile.credit;
        structureCredit += tile.structureCredit;
        colourCredit += tile.colourCredit;
      }
    }
  }
  const heightRatio = Math.min(mockup.height, render.height) / Math.max(mockup.height, render.height);
  return { sim: (tiles ? credit / tiles : 1) * heightRatio, ssim: tiles ? structureCredit / tiles : 1, colour: tiles ? colourCredit / tiles : 1, heightRatio };
}

/** Baseline-normalised score: 0 at the untouched app's similarity (`base`), 1 at identical. */
export const normalise = (sim, base) => Math.min(1, Math.max(0, (sim - base) / (1 - base)));
