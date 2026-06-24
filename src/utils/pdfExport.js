// PDF export — direct Canvas 2D rendering (no html2canvas).
// Avoids viewport-height clipping that caused bottom cut-off with html2canvas.

export async function exportToPDF(session) {
  const { default: jsPDF } = await import('jspdf');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', compress: true });
  let firstPage = true;

  for (const page of session.pages) {
    if (!firstPage) pdf.addPage();
    firstPage = false;

    const canvas = await renderPageToCanvas(page);
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height / canvas.width) * pdfW;
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
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
  const color    = COLOR_MAP[box.color] || COLOR_MAP.green;
  const fontSize = box.fontSize || 14;
  const PAD_X    = 5;
  const PAD_Y    = 3;
  const lineH    = fontSize * 1.35;

  // 背景（角丸）
  roundedRect(ctx, x, y, bw, bh, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();

  // 枠線
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1;
  roundedRect(ctx, x, y, bw, bh, 3);
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
