import { useState, useRef, useCallback, useEffect } from 'react';
import { warpPerspective } from '../utils/perspective.js';
import { saveSession } from '../utils/db.js';
import { detectDocumentCorners } from '../utils/detectEdges.js';
import { usePinchZoom } from '../hooks/usePinchZoom.js';
import {
  applyAdjustments,
  downscale,
  PRESETS,
  PRESET_ORDER,
  PREVIEW_MAX_SIDE,
} from '../utils/imageAdjust.js';

const COLORS = { tl: '#3B82F6', tr: '#10B981', br: '#F59E0B', bl: '#EF4444' };
const LABELS = { tl: '左上', tr: '右上', br: '右下', bl: '左下' };
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;
const DEFAULT_PRESET = 'text';

function initCorners() {
  return [
    { id: 'tl', x: 0.03, y: 0.03 },
    { id: 'tr', x: 0.88, y: 0.03 },
    { id: 'br', x: 0.88, y: 0.97 },
    { id: 'bl', x: 0.03, y: 0.97 },
  ];
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function Crop({ name, rawPages, onNavigate }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [corners, setCorners] = useState(initCorners);
  const [zoom, setZoom] = useState(1);
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [rotatedImages, setRotatedImages] = useState({});
  // 'crop'（範囲選択）| 'adjust'（しあげ調整）
  const [phase, setPhase] = useState('crop');
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [adjust, setAdjust] = useState({ brightness: 0, contrast: 0, sharpen: 0 });
  const [showFine, setShowFine] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const warpedRef = useRef(null);       // 原寸のワープ結果（調整のたびに再ワープしない）
  const previewBaseRef = useRef(null);  // プレビュー用に縮小したワープ結果
  const previewCanvasRef = useRef(null);

  const total = rawPages.length;
  const currentImage = rotatedImages[pageIdx] ?? rawPages[pageIdx]?.imageData;

  useEffect(() => {
    setCorners(initCorners());
    setImgLoaded(false);
    setZoom(1);
    setPhase('crop');
  }, [pageIdx]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
  }, []);
  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
  }, []);

  usePinchZoom(scrollRef, zoom, setZoom, { min: ZOOM_MIN, max: ZOOM_MAX });

  const toFrac = useCallback((clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    // 手動ドラッグ時は左端〜右端まで全域を許可する。
    // （初期値は initCorners でスワイプ領域を避けており、ドラッグ中は
    //  setPointerCapture でポインタがハンドルに固定されるため端まで動かしても安全）
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const handlePointerDown = useCallback((e, cornerId) => {
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const { x, y } = toFrac(ev.clientX, ev.clientY);
      setCorners((prev) => prev.map((c) => (c.id === cornerId ? { ...c, x, y } : c)));
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }, [toFrac]);

  const handleRotate = useCallback(() => {
    if (!imgRef.current || !imgLoaded) return;
    const img = imgRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    setRotatedImages((prev) => ({ ...prev, [pageIdx]: canvas.toDataURL('image/png') }));
    setCorners(initCorners());
    setImgLoaded(false);
    setZoom(1);
  }, [imgLoaded, pageIdx]);

  // 結果を確定して次ページ or 回答画面へ
  const commitPage = useCallback(async (imageData) => {
    const newResults = [...results, { imageData, boxes: [] }];
    if (pageIdx + 1 < total) {
      setResults(newResults);
      setPageIdx((i) => i + 1);
      setPhase('crop');
      setProcessing(false);
    } else {
      const session = {
        id: genId(),
        name: name || '名前なし',
        pages: newResults,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveSession(session).catch(console.error);
      onNavigate('answer', session);
    }
  }, [results, pageIdx, total, name, onNavigate]);

  // 「そのまま」：ワープも調整もせず原画像を確定
  const skipPage = useCallback(() => {
    setProcessing(true);
    commitPage(currentImage);
  }, [commitPage, currentImage]);

  // 「きりとる」：ワープしてしあげ調整工程へ
  const startAdjust = useCallback(() => {
    if (!imgRef.current || !imgLoaded) return;
    setProcessing(true);
    try {
      const warped = warpPerspective(imgRef.current, corners, { autoContrast: false });
      warpedRef.current = warped;
      previewBaseRef.current = downscale(warped, PREVIEW_MAX_SIDE);
      const def = PRESETS[DEFAULT_PRESET];
      setPreset(DEFAULT_PRESET);
      setAdjust({ brightness: def.brightness, contrast: def.contrast, sharpen: def.sharpen });
      setShowFine(false);
      setPhase('adjust');
      setProcessing(false);
    } catch (err) {
      console.error('warp failed, using original:', err);
      commitPage(currentImage);
    }
  }, [corners, imgLoaded, currentImage, commitPage]);

  const currentOpts = useCallback(() => {
    const def = PRESETS[preset];
    return {
      whiten: def.whiten,
      grayscale: def.grayscale,
      auto: def.auto,
      brightness: adjust.brightness,
      contrast: adjust.contrast,
      sharpen: adjust.sharpen,
    };
  }, [preset, adjust]);

  // しあげプレビューを再描画（縮小版に対して調整を適用）
  useEffect(() => {
    if (phase !== 'adjust') return;
    const base = previewBaseRef.current;
    const pc = previewCanvasRef.current;
    if (!base || !pc) return;
    let cancelled = false;
    // 連続ドラッグ中の負荷を抑えるため次フレームで計算
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const result = applyAdjustments(base, currentOpts());
      pc.width = result.width;
      pc.height = result.height;
      pc.getContext('2d').drawImage(result, 0, 0);
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [phase, currentOpts]);

  const selectPreset = useCallback((id) => {
    const def = PRESETS[id];
    setPreset(id);
    setAdjust({ brightness: def.brightness, contrast: def.contrast, sharpen: def.sharpen });
  }, []);

  // 「けってい」：原寸に調整を適用して確定
  const confirmAdjust = useCallback(async () => {
    setProcessing(true);
    let imageData;
    try {
      const full = applyAdjustments(warpedRef.current, currentOpts());
      imageData = full.toDataURL('image/png');
    } catch (err) {
      console.error('adjust failed, using warped:', err);
      imageData = warpedRef.current.toDataURL('image/png');
    }
    await commitPage(imageData);
  }, [currentOpts, commitPage]);

  // Build SVG paths
  const c = corners;
  const pts = c.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`);
  const polyPath = `M${pts[0]} L${pts[1]} L${pts[2]} L${pts[3]} Z`;
  const dimPath = `M0,0 L100,0 L100,100 L0,100 Z ${polyPath}`;

  const isAuto = PRESETS[preset].auto;

  // ===== しあげ調整フェーズ =====
  if (phase === 'adjust') {
    return (
      <div className="crop-page">
        <div className="crop-header">
          <button className="btn-ghost" onClick={() => setPhase('crop')} disabled={processing}>
            ← もどる
          </button>
          <div className="crop-header-title">
            しあげ調整
            {total > 1 && (
              <span className="crop-page-badge">{pageIdx + 1} / {total}</span>
            )}
          </div>
        </div>

        <div className="crop-scroll adjust-scroll">
          <canvas ref={previewCanvasRef} className="adjust-preview" />
        </div>

        <div className="adjust-controls">
          <div className="preset-row">
            {PRESET_ORDER.map((id) => (
              <button
                key={id}
                className={`preset-btn${preset === id ? ' active' : ''}`}
                onClick={() => selectPreset(id)}
                disabled={processing}
              >
                {PRESETS[id].label}
              </button>
            ))}
          </div>

          <button
            className="fine-toggle"
            onClick={() => setShowFine((v) => !v)}
            disabled={isAuto}
          >
            {isAuto ? 'オートは自動調整です' : (showFine ? '▲ びさいちょうせいを とじる' : '▼ びさいちょうせい')}
          </button>

          {showFine && !isAuto && (
            <div className="fine-controls">
              <label className="fine-row">
                <span>あかるさ</span>
                <input
                  type="range" min="-100" max="100" value={adjust.brightness}
                  onChange={(e) => setAdjust((a) => ({ ...a, brightness: Number(e.target.value) }))}
                />
              </label>
              <label className="fine-row">
                <span>コントラスト</span>
                <input
                  type="range" min="-100" max="100" value={adjust.contrast}
                  onChange={(e) => setAdjust((a) => ({ ...a, contrast: Number(e.target.value) }))}
                />
              </label>
              <label className="fine-row">
                <span>くっきり</span>
                <input
                  type="range" min="0" max="100" value={adjust.sharpen}
                  onChange={(e) => setAdjust((a) => ({ ...a, sharpen: Number(e.target.value) }))}
                />
              </label>
            </div>
          )}
        </div>

        <div className="crop-footer">
          <button className="btn-secondary" onClick={() => setPhase('crop')} disabled={processing}>
            ← もどる
          </button>
          <button className="btn-green" onClick={confirmAdjust} disabled={processing}>
            {processing ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                しょり中…
              </>
            ) : pageIdx + 1 < total ? (
              'けってい →'
            ) : (
              'はじめる →'
            )}
          </button>
        </div>
      </div>
    );
  }

  // ===== きりとり（範囲選択）フェーズ =====
  return (
    <div className="crop-page">
      <div className="crop-header">
        <button className="btn-ghost" onClick={() => onNavigate('import')}>
          ← もどる
        </button>
        <div className="crop-header-title">
          よみとり範囲
          {total > 1 && (
            <span className="crop-page-badge">
              {pageIdx + 1} / {total}
            </span>
          )}
        </div>
      </div>

      <div className="crop-scroll" ref={scrollRef}>
        <div ref={containerRef} className="crop-container" style={{ width: `${zoom * 100}%` }}>
          <img
            ref={imgRef}
            src={currentImage}
            alt={`ページ ${pageIdx + 1}`}
            className="crop-image"
            draggable={false}
            onLoad={() => {
              setImgLoaded(true);
              const detected = detectDocumentCorners(imgRef.current);
              if (detected) setCorners(detected);
            }}
          />

          {imgLoaded && (
            <>
              <svg
                className="crop-svg"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <path fillRule="evenodd" fill="rgba(0,0,0,0.48)" d={dimPath} />
                <polygon
                  points={pts.join(' ')}
                  fill="none"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth="0.5"
                  strokeDasharray="2,1.5"
                />
              </svg>

              {corners.map((corner) => (
                <div
                  key={corner.id}
                  className="crop-handle"
                  style={{
                    left: `${corner.x * 100}%`,
                    top: `${corner.y * 100}%`,
                    background: COLORS[corner.id],
                  }}
                  onPointerDown={(e) => handlePointerDown(e, corner.id)}
                  aria-label={LABELS[corner.id]}
                >
                  <span className="crop-handle-label">{LABELS[corner.id]}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {imgLoaded && (
        <div className="zoom-controls">
          <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label="拡大">
            ＋
          </button>
          <span className="zoom-controls-label">{Math.round(zoom * 100)}%</span>
          <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label="縮小">
            －
          </button>
        </div>
      )}

      <div className="crop-footer">
        <button
          className="btn-secondary"
          onClick={skipPage}
          disabled={processing}
        >
          そのまま
        </button>
        <button
          className="btn-secondary crop-rotate-btn"
          onClick={handleRotate}
          disabled={processing || !imgLoaded}
          aria-label="右に90度回転"
        >
          ↻ まわす
        </button>
        <button
          className="btn-green"
          onClick={startAdjust}
          disabled={processing || !imgLoaded}
        >
          {processing ? (
            <>
              <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              へんかんちゅう…
            </>
          ) : (
            'きりとる →'
          )}
        </button>
      </div>
    </div>
  );
}
