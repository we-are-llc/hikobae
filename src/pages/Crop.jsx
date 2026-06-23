import { useState, useRef, useCallback, useEffect } from 'react';
import { warpPerspective } from '../utils/perspective.js';
import { saveSession } from '../utils/db.js';

const COLORS = { tl: '#3B82F6', tr: '#10B981', br: '#F59E0B', bl: '#EF4444' };
const LABELS = { tl: '左上', tr: '右上', br: '右下', bl: '左下' };

function initCorners() {
  return [
    { id: 'tl', x: 0.03, y: 0.03 },
    { id: 'tr', x: 0.97, y: 0.03 },
    { id: 'br', x: 0.97, y: 0.97 },
    { id: 'bl', x: 0.03, y: 0.97 },
  ];
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function Crop({ name, rawPages, onNavigate }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [corners, setCorners] = useState(initCorners);
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  const total = rawPages.length;
  const currentImage = rawPages[pageIdx]?.imageData;

  useEffect(() => {
    setCorners(initCorners());
    setImgLoaded(false);
  }, [pageIdx]);

  const toFrac = useCallback((clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
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

  const processPage = useCallback(async (skip) => {
    setProcessing(true);
    let imageData = currentImage;

    if (!skip && imgRef.current && imgLoaded) {
      try {
        const canvas = warpPerspective(imgRef.current, corners);
        imageData = canvas.toDataURL('image/jpeg', 0.92);
      } catch (err) {
        console.error('warp failed, using original:', err);
      }
    }

    const newResults = [...results, { imageData, boxes: [] }];

    if (pageIdx + 1 < total) {
      setResults(newResults);
      setPageIdx((i) => i + 1);
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
  }, [currentImage, corners, results, pageIdx, total, name, imgLoaded, onNavigate]);

  // Build SVG paths
  const c = corners;
  const pts = c.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`);
  const polyPath = `M${pts[0]} L${pts[1]} L${pts[2]} L${pts[3]} Z`;
  const dimPath = `M0,0 L100,0 L100,100 L0,100 Z ${polyPath}`;

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

      <div className="crop-hint">
        ● を 用紙の かどに あわせてください
      </div>

      <div className="crop-scroll">
        <div ref={containerRef} className="crop-container">
          <img
            ref={imgRef}
            src={currentImage}
            alt={`ページ ${pageIdx + 1}`}
            className="crop-image"
            draggable={false}
            onLoad={() => setImgLoaded(true)}
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

      <div className="crop-footer">
        <button
          className="btn-secondary"
          onClick={() => processPage(true)}
          disabled={processing}
        >
          そのまま
        </button>
        <button
          className="btn-green"
          onClick={() => processPage(false)}
          disabled={processing || !imgLoaded}
        >
          {processing ? (
            <>
              <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              へんかんちゅう…
            </>
          ) : pageIdx + 1 < total ? (
            'きりとる →'
          ) : (
            'きりとって はじめる →'
          )}
        </button>
      </div>
    </div>
  );
}
