// Document corner detection — Otsu threshold + diagonal-extreme quadrilateral.
// Finds the actual 4 perspective-distorted corners (trapezoid), not just
// the axis-aligned bounding box.
//
// Algorithm:
//   1. Downsample → grayscale → Otsu binary mask
//   2. Dilate mask to fill text/grid lines inside paper
//   3. Find 4 corners as diagonal extremes of the dilated bright region:
//        tl = min(x+y),  tr = max(x-y),  br = max(x+y),  bl = min(x-y)
//
// Returns [{id:'tl',x,y}, {id:'tr',x,y}, {id:'br',x,y}, {id:'bl',x,y}]
// in fractional [0,1] coords, or null when detection is unreliable.

const SCALE_MAX  = 400;  // Downsample to ≤ 400px for performance
const MARGIN_F   = 0.04; // Ignore 4% from image edges
const DILATE_R   = 5;    // Dilation radius (fills lines/text gaps inside paper)
const MIN_SIZE_F = 0.25; // Detected region must be ≥ 25% of image in each dimension

function otsu(gray) {
  const hist = new Int32Array(256);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wB = 0, sumB = 0, maxVar = 0, thr = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > maxVar) { maxVar = v; thr = i; }
  }
  return thr;
}

// O(n) sliding-window 1D dilation
function dilate1D(src, len, r) {
  const out = new Uint8Array(len);
  let count = 0;
  for (let i = 0; i < Math.min(r, len); i++) if (src[i]) count++;
  for (let i = 0; i < len; i++) {
    const add = i + r;
    const rem = i - r - 1;
    if (add < len && src[add]) count++;
    if (rem >= 0 && src[rem]) count--;
    out[i] = count > 0 ? 1 : 0;
  }
  return out;
}

// Separable 2D dilation: horizontal pass then vertical pass → O(w*h)
function dilate2D(binary, w, h, r) {
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = dilate1D(binary.subarray(y * w, (y + 1) * w), w, r);
    tmp.set(row, y * w);
  }
  const out = new Uint8Array(w * h);
  const col = new Uint8Array(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) col[y] = tmp[y * w + x];
    const d = dilate1D(col, h, r);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  return out;
}

export function detectDocumentCorners(imgEl) {
  const iw = imgEl.naturalWidth;
  const ih = imgEl.naturalHeight;
  if (!iw || !ih) return null;

  const scale = Math.min(1, SCALE_MAX / Math.max(iw, ih));
  const w = Math.round(iw * scale);
  const h = Math.round(ih * scale);

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Grayscale (integer: 0.299R + 0.587G + 0.114B)
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = (77 * data[i*4] + 150 * data[i*4+1] + 29 * data[i*4+2]) >> 8;
  }

  // Otsu threshold — separates dark background from bright paper
  const thr = otsu(gray);
  if (thr < 30 || thr > 225) return null; // Poor contrast

  // Binary mask: 1 = bright (paper), 0 = dark (background)
  const binary = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) binary[i] = gray[i] > thr ? 1 : 0;

  // Dilate to fill text and grid lines inside the paper region
  const dilated = dilate2D(binary, w, h, DILATE_R);

  // Find 4 corners as diagonal extremes of the dilated bright region.
  // For a convex quadrilateral:
  //   tl = min(x+y)  — leftmost/topmost
  //   tr = max(x-y)  — rightmost/topmost
  //   br = max(x+y)  — rightmost/bottommost
  //   bl = min(x-y)  — leftmost/bottommost
  const my = Math.max(1, Math.floor(MARGIN_F * h));
  const mx = Math.max(1, Math.floor(MARGIN_F * w));

  let tlS = Infinity,  tlX = -1, tlY = -1;
  let trS = -Infinity, trX = -1, trY = -1;
  let brS = -Infinity, brX = -1, brY = -1;
  let blS = Infinity,  blX = -1, blY = -1;

  for (let y = my; y < h - my; y++) {
    for (let x = mx; x < w - mx; x++) {
      if (!dilated[y * w + x]) continue;
      const s1 = x + y;
      const s2 = x - y;
      if (s1 < tlS) { tlS = s1; tlX = x; tlY = y; }
      if (s2 > trS) { trS = s2; trX = x; trY = y; }
      if (s1 > brS) { brS = s1; brX = x; brY = y; }
      if (s2 < blS) { blS = s2; blX = x; blY = y; }
    }
  }

  if (tlX < 0 || trX < 0 || brX < 0 || blX < 0) return null;

  // Sanity checks: quadrilateral must span a plausible document size
  const spanW = Math.max(trX, brX) - Math.min(tlX, blX);
  const spanH = Math.max(blY, brY) - Math.min(tlY, trY);
  if (spanW < w * MIN_SIZE_F || spanH < h * MIN_SIZE_F) return null;
  if (spanW > w * 0.97     || spanH > h * 0.97)         return null;

  // Each corner should roughly be in its own quadrant of the image
  const cx = w / 2, cy = h / 2;
  if (tlX > cx || tlY > cy) return null;
  if (trX < cx || trY > cy) return null;
  if (brX < cx || brY < cy) return null;
  if (blX > cx || blY < cy) return null;

  return [
    { id: 'tl', x: tlX / w, y: tlY / h },
    { id: 'tr', x: trX / w, y: trY / h },
    { id: 'br', x: brX / w, y: brY / h },
    { id: 'bl', x: blX / w, y: blY / h },
  ];
}
