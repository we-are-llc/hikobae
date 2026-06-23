// Document corner detection — brightness-profile approach.
// Uses Otsu threshold to separate bright paper from dark background,
// then scans row/column brightness fractions to locate document edges.
// Works offline; no external dependencies.
//
// Returns [{id:'tl',x,y}, {id:'tr',x,y}, {id:'br',x,y}, {id:'bl',x,y}]
// in fractional [0,1] coords, or null when detection is unreliable.

const SCALE_MAX = 400;  // Downsample to ≤ 400px for speed
const MARGIN_F  = 0.04; // Ignore 4% from image edges
const PEAK_F    = 0.25; // Row/col frac must exceed 25% of peak to count as paper
const MIN_F     = 0.25; // Detected region must be ≥ 25% of image size

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

function smooth7(arr) {
  const out = new Float32Array(arr.length);
  for (let i = 3; i < arr.length - 3; i++) {
    out[i] = (arr[i-3]+arr[i-2]+arr[i-1]+arr[i]+arr[i+1]+arr[i+2]+arr[i+3]) / 7;
  }
  // Fill edges with nearest interior value
  for (let i = 0; i < 3; i++) out[i] = out[3];
  for (let i = arr.length - 3; i < arr.length; i++) out[i] = out[arr.length - 4];
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
  // If threshold is too extreme the image has poor contrast; bail out
  if (thr < 30 || thr > 225) return null;

  // Per-row and per-column bright-pixel fractions
  const rowFrac = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let cnt = 0;
    for (let x = 0; x < w; x++) if (gray[y*w+x] > thr) cnt++;
    rowFrac[y] = cnt / w;
  }
  const colFrac = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let cnt = 0;
    for (let y = 0; y < h; y++) if (gray[y*w+x] > thr) cnt++;
    colFrac[x] = cnt / h;
  }

  const rowS = smooth7(rowFrac);
  const colS = smooth7(colFrac);

  // Peak bright fraction (should be well inside the paper region)
  let maxRow = 0, maxCol = 0;
  for (let y = 0; y < h; y++) if (rowS[y] > maxRow) maxRow = rowS[y];
  for (let x = 0; x < w; x++) if (colS[x] > maxCol) maxCol = colS[x];

  // If the peak is too small, the paper might not be distinguishable; bail out
  if (maxRow < 0.10 || maxCol < 0.10) return null;

  const rThr = maxRow * PEAK_F;
  const cThr = maxCol * PEAK_F;

  const my = Math.max(1, Math.floor(MARGIN_F * h));
  const mx = Math.max(1, Math.floor(MARGIN_F * w));

  let top = -1, bottom = -1, left = -1, right = -1;

  for (let y = my; y < h - my; y++) {
    if (rowS[y] >= rThr) { top = y; break; }
  }
  for (let y = h - 1 - my; y >= my; y--) {
    if (rowS[y] >= rThr) { bottom = y; break; }
  }
  for (let x = mx; x < w - mx; x++) {
    if (colS[x] >= cThr) { left = x; break; }
  }
  for (let x = w - 1 - mx; x >= mx; x--) {
    if (colS[x] >= cThr) { right = x; break; }
  }

  // All four edges must have been found
  if (top < 0 || bottom < 0 || left < 0 || right < 0) return null;
  if (top >= bottom || left >= right) return null;

  // Region size sanity check
  const rw = right - left;
  const rh = bottom - top;
  if (rw < w * MIN_F || rh < h * MIN_F) return null;
  if (rw > w * 0.97 || rh > h * 0.97) return null;

  return [
    { id: 'tl', x: left  / w, y: top    / h },
    { id: 'tr', x: right / w, y: top    / h },
    { id: 'br', x: right / w, y: bottom / h },
    { id: 'bl', x: left  / w, y: bottom / h },
  ];
}
