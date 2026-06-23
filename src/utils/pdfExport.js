export async function exportToPDF(session) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', compress: true });
  let firstPage = true;

  for (const page of session.pages) {
    if (!firstPage) pdf.addPage();
    firstPage = false;

    const wrapper = buildRenderWrapper(page);
    document.body.appendChild(wrapper);

    await waitForImages(wrapper);

    const canvas = await html2canvas(wrapper.firstChild, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    document.body.removeChild(wrapper);

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height / canvas.width) * pdfW;
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
  }

  const date = new Date().toISOString().slice(0, 10);
  pdf.save(`${session.name || 'こたえ'}_${date}.pdf`);
}

const PDF_COLOR_MAP = {
  green:  'rgba(16,185,129,0.5)',
  blue:   'rgba(59,130,246,0.5)',
  pink:   'rgba(236,72,153,0.5)',
  yellow: 'rgba(234,179,8,0.5)',
};

function buildRenderWrapper(page) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:fixed;left:-99999px;top:0;background:white;z-index:-1;';

  const inner = document.createElement('div');
  inner.style.cssText = 'position:relative;display:inline-block;width:800px;';

  const img = document.createElement('img');
  img.src = page.imageData;
  img.style.cssText = 'display:block;width:100%;height:auto;';
  img.crossOrigin = 'anonymous';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';

  for (const box of page.boxes) {
    if (!box.text) continue;
    const el = document.createElement('div');
    el.style.cssText = [
      `position:absolute`,
      `left:${box.x * 100}%`,
      `top:${box.y * 100}%`,
      `width:${box.width * 100}%`,
      `height:${box.height * 100}%`,
      `padding:2px 5px`,
      `font-size:${box.fontSize || 13}px`,
      `font-family:-apple-system,'Hiragino Kaku Gothic ProN',sans-serif`,
      `word-break:break-all`,
      `overflow:hidden`,
      `line-height:1.35`,
      `background:rgba(255,255,255,0.92)`,
      `border:1px solid ${PDF_COLOR_MAP[box.color] || PDF_COLOR_MAP.green}`,
      `border-radius:3px`,
      `box-sizing:border-box`,
    ].join(';');
    el.textContent = box.text;
    overlay.appendChild(el);
  }

  inner.appendChild(img);
  inner.appendChild(overlay);
  wrapper.appendChild(inner);
  return wrapper;
}

function waitForImages(el) {
  const imgs = el.querySelectorAll('img');
  return Promise.all(
    [...imgs].map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = resolve;
            img.onerror = resolve;
          }
        })
    )
  );
}
