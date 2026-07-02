// 取込画像の仕上げ調整（プリセット＋微調整）。
// ワープ済みキャンバスに対して、色かぶり除去・明るさ/コントラスト・
// グレースケール・アンシャープマスクを適用する。
import { autoContrast } from './perspective.js';

// プリセット定義。
// base: whiten（背景白色化）/ grayscale / auto（自動コントラスト=カラー）の on/off、
//       および brightness / contrast / sharpen の初期スライダー値。
export const PRESETS = {
  text: {
    label: '文字くっきり',
    whiten: true,
    grayscale: true,
    auto: false,
    brightness: 5,
    contrast: 35,
    sharpen: 60,
  },
  auto: {
    label: 'オート（カラー）',
    whiten: false,
    grayscale: false,
    auto: true,
    brightness: 0,
    contrast: 0,
    sharpen: 0,
  },
  bw: {
    label: 'しろくろ',
    whiten: true,
    grayscale: true,
    auto: false,
    brightness: 0,
    contrast: 80,
    sharpen: 40,
  },
  none: {
    label: 'そのまま',
    whiten: false,
    grayscale: false,
    auto: false,
    brightness: 0,
    contrast: 0,
    sharpen: 0,
  },
};

export const PRESET_ORDER = ['text', 'auto', 'bw', 'none'];

// プレビュー用に長辺をこのサイズまで縮小してから処理する（スマホでの軽快さ確保）
export const PREVIEW_MAX_SIDE = 900;

// src（canvas or img）を長辺 maxSide 以内に縮小したキャンバスを返す
export function downscale(src, maxSide) {
  const w = src.width ?? src.naturalWidth;
  const h = src.height ?? src.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// 調整を適用した新しいキャンバスを返す。
// opts: { whiten, grayscale, auto, brightness(-100..100), contrast(-100..100), sharpen(0..100) }
export function applyAdjustments(srcCanvas, opts) {
  const { whiten, grayscale, auto, brightness = 0, contrast = 0, sharpen = 0 } = opts;
  const w = srcCanvas.width;
  const h = srcCanvas.height;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.drawImage(srcCanvas, 0, 0);

  // オート（カラー）は既存の per-channel ヒストグラムストレッチで完結
  if (auto) {
    autoContrast(out, ctx);
    return out;
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const n = w * h;

  if (whiten) whitenBackground(data, n);

  // 明るさ・コントラスト
  const b = brightness * 2.55; // -255..255 相当
  // コントラスト係数（標準式）
  const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
  if (brightness !== 0 || contrast !== 0) {
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      data[p]     = clamp(cf * (data[p]     - 128) + 128 + b);
      data[p + 1] = clamp(cf * (data[p + 1] - 128) + 128 + b);
      data[p + 2] = clamp(cf * (data[p + 2] - 128) + 128 + b);
    }
  }

  if (grayscale) {
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      const g = clamp(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]);
      data[p] = data[p + 1] = data[p + 2] = g;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  if (sharpen > 0) unsharpMask(out, ctx, sharpen / 100);

  return out;
}

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

// 背景（用紙の地色）を検出して白に正規化する＝照明の色かぶり除去。
// 明るい上位のピクセルの各チャンネル平均を「紙の色」とみなし、245 になるよう
// チャンネルごとにゲインをかける。
function whitenBackground(data, n) {
  // 輝度ヒストグラムから上位20%の明るさしきい値を求める
  const lumHist = new Int32Array(256);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const lum = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) | 0;
    lumHist[lum]++;
  }
  const target = n * 0.2;
  let cumul = 0;
  let thr = 200;
  for (let v = 255; v >= 0; v--) {
    cumul += lumHist[v];
    if (cumul >= target) { thr = v; break; }
  }

  // しきい値以上のピクセルでチャンネル平均（＝紙の地色）を推定
  let sr = 0, sg = 0, sb = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    if (lum >= thr) { sr += data[p]; sg += data[p + 1]; sb += data[p + 2]; cnt++; }
  }
  if (cnt === 0) return;
  const ar = sr / cnt, ag = sg / cnt, ab = sb / cnt;

  // 各チャンネルのゲイン（紙 → 245）。極端な増幅は抑制
  const TARGET = 245;
  const gr = Math.min(3, TARGET / Math.max(1, ar));
  const gg = Math.min(3, TARGET / Math.max(1, ag));
  const gb = Math.min(3, TARGET / Math.max(1, ab));

  for (let i = 0; i < n; i++) {
    const p = i * 4;
    data[p]     = clamp(data[p]     * gr);
    data[p + 1] = clamp(data[p + 1] * gg);
    data[p + 2] = clamp(data[p + 2] * gb);
  }
}

// アンシャープマスク：分離ボックスぼかしで低周波を作り、
// out = src + amount * (src - blur) でエッジを強調する。
function unsharpMask(canvas, ctx, amount) {
  const w = canvas.width, h = canvas.height;
  const src = ctx.getImageData(0, 0, w, h);
  const blur = boxBlurRGB(src.data, w, h, 2);
  const d = src.data;
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    d[p]     = clamp(d[p]     + amount * (d[p]     - blur[p]));
    d[p + 1] = clamp(d[p + 1] + amount * (d[p + 1] - blur[p + 1]));
    d[p + 2] = clamp(d[p + 2] + amount * (d[p + 2] - blur[p + 2]));
  }
  ctx.putImageData(src, 0, 0);
}

// 分離ボックスぼかし（半径 r）。RGB のみ、アルファは無視。
function boxBlurRGB(data, w, h, r) {
  const tmp = new Float32Array(w * h * 4);
  const out = new Float32Array(w * h * 4);
  const win = 2 * r + 1;

  // 横方向
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) {
        const xx = Math.min(w - 1, Math.max(0, x));
        sum += data[(y * w + xx) * 4 + c];
      }
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + c] = sum / win;
        const xOut = Math.min(w - 1, Math.max(0, x - r));
        const xIn = Math.min(w - 1, Math.max(0, x + r + 1));
        sum += data[(y * w + xIn) * 4 + c] - data[(y * w + xOut) * 4 + c];
      }
    }
  }
  // 縦方向
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) {
        const yy = Math.min(h - 1, Math.max(0, y));
        sum += tmp[(yy * w + x) * 4 + c];
      }
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = sum / win;
        const yOut = Math.min(h - 1, Math.max(0, y - r));
        const yIn = Math.min(h - 1, Math.max(0, y + r + 1));
        sum += tmp[(yIn * w + x) * 4 + c] - tmp[(yOut * w + x) * 4 + c];
      }
    }
  }
  return out;
}
