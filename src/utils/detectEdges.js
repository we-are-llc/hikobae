// Document corner detection using Sobel edges + row/column projection scanning.
// Works entirely offline with Canvas API — no external dependencies.
// Returns [{id:'tl',x,y}, {id:'tr',x,y}, {id:'br',x,y}, {id:'bl',x,y}] (fractional coords)
// or null when detection is unreliable.

const SCALE_MAX = 400;      // Downsample to ≤400px for speed
const MARGIN = 0.06;        // Ignore 6% from image edges (avoid camera vignette / image borders)
const EDGE_THRESH = 0.15;   // Threshold = 15% of max Sobel magnitude
const PROJ_THRESH = 0.30;   // Row/col projection peak threshold (30% of max)
const MIN_REGION = 0.30;    // Detected region must be ≥30% of image size
const MAX_REGION = 0.96;    // Detected region must be ≤96% (avoid detecting whole image)

export function detectDocumentCorners(imgEl) {
  const iw = imgEl.naturalWidth;
  const ih = imgEl.naturalHeight;
  if (!iw || !ih) return null;

  // Downsample to speed up processing
  const scale = Math.min(1, SCALE_MAX / Math.max(iw, ih));
  const w = Math.round(iw * scale);
  const h = Math.round(ih * scale);

  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Grayscale (integer approximation: 0.299R + 0.587G + 0.114B ≈ (77R+150G+29B)>>8)
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = (77 * data[i * 4] + 150 * data[i * 4 + 1] + 29 * data[i * 4 + 2]) >> 8;
  }

  // 3×3 box blur — simple noise reduction
  const blurred = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      blurred[y * w + x] = Math.round(
        (gray[(y-1)*w+(x-1)] + gray[(y-1)*w+x] + gray[(y-1)*w+(x+1)] +
         gray[y*w+(x-1)]     + gray[y*w+x]     + gray[y*w+(x+1)] +
         gray[(y+1)*w+(x-1)] + gray[(y+1)*w+x] + gray[(y+1)*w+(x+1)]) / 9
      );
    }
  }

  // Sobel edge magnitude
  let maxMag = 1;
  const edgeMag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -blurred[(y-1)*w+(x-1)] - 2*blurred[y*w+(x-1)] - blurred[(y+1)*w+(x-1)] +
         blurred[(y-1)*w+(x+1)] + 2*blurred[y*w+(x+1)] + blurred[(y+1)*w+(x+1)];
      const gy =
        -blurred[(y-1)*w+(x-1)] - 2*blurred[(y-1)*w+x] - blurred[(y-1)*w+(x+1)] +
         blurred[(y+1)*w+(x-1)] + 2*blurred[(y+1)*w+x] + blurred[(y+1)*w+(x+1)];
      const mag = Math.sqrt(gx * gx + gy * gy);
      edgeMag[y * w + x] = mag;
      if (mag > maxMag) maxMag = mag;
    }
  }

  // Binary threshold
  const thresh = maxMag * EDGE_THRESH;
  const binary = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    binary[i] = edgeMag[i] > thresh ? 1 : 0;
  }

  // Row and column edge-pixel counts (projections)
  const rowSum = new Float32Array(h);
  const colSum = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (binary[y * w + x]) {
        rowSum[y]++;
        colSum[x]++;
      }
    }
  }

  // 5-element moving-average smoothing of projections
  function smooth(arr) {
    const out = new Float32Array(arr.length);
    for (let i = 2; i < arr.length - 2; i++) {
      out[i] = (arr[i-2] + arr[i-1] + arr[i] + arr[i+1] + arr[i+2]) / 5;
    }
    return out;
  }
  const rowS = smooth(rowSum);
  const colS = smooth(colSum);

  const my = Math.floor(MARGIN * h);
  const mx = Math.floor(MARGIN * w);

  // Max projection in the inner (non-margin) region
  let maxRow = 1, maxCol = 1;
  for (let y = my; y < h - my; y++) if (rowS[y] > maxRow) maxRow = rowS[y];
  for (let x = mx; x < w - mx; x++) if (colS[x] > maxCol) maxCol = colS[x];

  const rThresh = maxRow * PROJ_THRESH;
  const cThresh = maxCol * PROJ_THRESH;

  // Scan from each margin inward to find the first strong projection peak
  let top = my;
  for (let y = my; y < Math.floor(h / 2); y++) {
    if (rowS[y] > rThresh) { top = y; break; }
  }

  let bottom = h - my - 1;
  for (let y = h - my - 1; y > Math.ceil(h / 2); y--) {
    if (rowS[y] > rThresh) { bottom = y; break; }
  }

  let left = mx;
  for (let x = mx; x < Math.floor(w / 2); x++) {
    if (colS[x] > cThresh) { left = x; break; }
  }

  let right = w - mx - 1;
  for (let x = w - mx - 1; x > Math.ceil(w / 2); x--) {
    if (colS[x] > cThresh) { right = x; break; }
  }

  // Sanity check: region must be a plausible document size
  const rw = right - left;
  const rh = bottom - top;
  if (rw < w * MIN_REGION || rh < h * MIN_REGION) return null;
  if (rw > w * MAX_REGION || rh > h * MAX_REGION) return null;

  return [
    { id: 'tl', x: left  / w, y: top    / h },
    { id: 'tr', x: right / w, y: top    / h },
    { id: 'br', x: right / w, y: bottom / h },
    { id: 'bl', x: left  / w, y: bottom / h },
  ];
}
