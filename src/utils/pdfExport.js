// PDF export — direct Canvas 2D rendering (no html2canvas).
// Avoids viewport-height clipping that caused bottom cut-off with html2canvas.

export async function exportToPDF(session) {
  const { default: jsPDF } = await import('jspdf');

  // 幅を210mm（A4幅）固定にし、高さは画像のアスペクト比に合わせて可変にする。
  // jsPDF のデフォルト A4 固定ページ（297mm）に収まらない縦長画像が下で切れる問題を解消。
  const PAGE_W = 210;
  let pdf = null;

  for (const page of session.pages) {
    const canvas = await renderPageToCanvas(page);
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const PAGE_H = (canvas.height / canvas.width) * PAGE_W;

    if (!pdf) {
      pdf = new jsPDF({
        orientation: PAGE_H >= PAGE_W ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [PAGE_W, PAGE_H],
        compress: true,
      });
    } else {
      pdf.addPage([PAGE_W, PAGE_H]);
    }

    pdf.addImage(imgData, 'JPEG', 0, 0, PAGE_W, PAGE_H);
  }

  const date = new Date().toISOString().slice(0, 10);
  pdf.save(`${session.name || 'こたえ'}_${date}.pdf`);
}

// ---- internal ----

const COLOR_MAP = {
  green:  'rgba(16,185,129,0.5)',
  blue:   'rgba(59,130,246,0.5)',
  pink:   'rgba(236,72,153,0.5)',
  yellow: 'rgba(234,179,8,0.5)',
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderPageToCanvas(page) {
  const img = await loadImage(page.imageData);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const SCALE = 2; // 高解像度出力

  const canvas = document.createElement('canvas');
  canvas.width  = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // ページ画像を描画
  ctx.drawImage(img, 0, 0, W, H);

  // 回答欄を重ねて描画
  for (const box of page.boxes) {
    if (!box.text) continue;
    drawAnswerBox(ctx, box, W, H);
  }

  return canvas;
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y,     x + w, y + rr,  rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x,     y + h, x, y + h - rr, rr);
  ctx.lineTo(x,     y + rr);
  ctx.arcTo(x,     y,     x + rr, y, rr);
  ctx.closePath();
}

function drawAnswerBox(ctx, box, W, H) {
  const x  = box.x      * W;
  const y  = box.y      * H;
  const bw = box.width  * W;
  const bh = box.height * H;
  const color = COLOR_MAP[box.color] || COLOR_MAP.green;

  // box.fontSize はスクリーン上の CSS ピクセル値（14〜36px）。
  // PDF canvas はナチュラル画像サイズ（2000〜3000px 幅）で描画するため、
  // スマホ基準幅（420px）に対する比率でスケールして文字の見た目を合わせる。
  const SCREEN_REF_W = 420;
  const pxScale = W / SCREEN_REF_W;
  const fontSize = (box.fontSize || 14) * pxScale;
  const PAD_X    = 5 * pxScale;
  const PAD_Y    = 3 * pxScale;
  const lineH    = fontSize * 1.35;

  const radius    = 3 * pxScale;

  // 背景（角丸）
  roundedRect(ctx, x, y, bw, bh, radius);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();

  // 枠線
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.5 * pxScale;
  roundedRect(ctx, x, y, bw, bh, radius);
  ctx.stroke();

  // テキスト（クリッピング付き）
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + PAD_X, y + PAD_Y, bw - PAD_X * 2, bh - PAD_Y * 2);
  ctx.clip();

  ctx.fillStyle   = '#1A1A1A';
  ctx.font        = `${fontSize}px -apple-system,'Hiragino Kaku Gothic ProN','Hiragino Sans',sans-serif`;
  ctx.textBaseline = 'top';

  const maxW = bw - PAD_X * 2;
  let ty = y + PAD_Y;

  for (const rawLine of box.text.split('\n')) {
    if (ty + lineH > y + bh) break;
    // 文字単位で折り返し（日本語対応）
    let cur = '';
    for (const ch of rawLine) {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxW && cur) {
        ctx.fillText(cur, x + PAD_X, ty);
        ty += lineH;
        if (ty + lineH > y + bh) { cur = ''; break; }
        cur = ch;
      } else {
        cur = test;
      }
    }
    if (cur) { ctx.fillText(cur, x + PAD_X, ty); ty += lineH; }
  }

  ctx.restore();
}
