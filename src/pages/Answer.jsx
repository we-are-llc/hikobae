import { useState, useRef, useCallback, useEffect } from 'react';
import ModeBar from '../components/ModeBar.jsx';
import AnswerBox from '../components/AnswerBox.jsx';
import VoiceModal from '../components/VoiceModal.jsx';
import { saveSession } from '../utils/db.js';
import { usePinchZoom } from '../hooks/usePinchZoom.js';
import { useAutoHide } from '../hooks/useAutoHide.js';
import { strokeToPath } from '../utils/stroke.js';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const DEFAULT_BOX_W = 0.24;
const DEFAULT_BOX_H = 0.065;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;

// フリーハンド：色は1色、太さは3段階（画像幅の1/1000を1単位）
const DRAW_COLOR = '#2563EB';
const DRAW_WIDTHS = [
  { id: 'thin', w: 6, dot: 8 },
  { id: 'medium', w: 10, dot: 12 },
  { id: 'thick', w: 16, dot: 17 },
];
// SVG ビューボックスの横幅（線幅の単位＝ビューボックス幅の1/1000 に一致させる）
const VBW = 1000;
// 描画中に点を間引く最小移動量（割合）
const MIN_POINT_DIST = 0.0025;

export default function Answer({ session, onNavigate, onUpdate }) {
  const [mode, setMode] = useState('place');
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [voiceBoxId, setVoiceBoxId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [history, setHistory] = useState([]);
  const [drawWidth, setDrawWidth] = useState(10);
  const [imgAspect, setImgAspect] = useState(1.414); // 高さ/幅。画像読み込み時に更新
  const overlayRef = useRef(null);
  const scrollRef = useRef(null);
  const saveTimerRef = useRef(null);
  const sessionRef = useRef(session);
  const prevAnsweredRef = useRef(0);
  const historyTimerRef = useRef(null);
  const pendingHistoryRef = useRef(null);
  const drawingRef = useRef(null);       // { points: [[x,y]…], pointerId }
  const liveRef = useRef(null);          // 描画中のライブ <path> 要素
  const activeTouchesRef = useRef(new Set());
  const pinchingRef = useRef(false);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const currentPage = session.pages[pageIndex];
  const boxes = currentPage?.boxes ?? [];
  const strokes = currentPage?.strokes ?? [];
  const VBH = VBW * imgAspect;

  // Functional update avoids stale-closure overwrites when answers are confirmed in quick succession
  const updateSession = useCallback(
    (updater) => {
      // Capture pre-update boxes+strokes for undo; debounced so rapid drags produce one history entry
      if (!historyTimerRef.current) {
        const pg = sessionRef.current.pages[pageIndex];
        pendingHistoryRef.current = { boxes: pg?.boxes ?? [], strokes: pg?.strokes ?? [] };
      }
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = setTimeout(() => {
        const snapshot = pendingHistoryRef.current;
        if (snapshot !== null) {
          setHistory((prev) => [...prev.slice(-19), snapshot]);
        }
        historyTimerRef.current = null;
        pendingHistoryRef.current = null;
      }, 400);

      onUpdate((prev) => ({
        ...prev,
        pages: prev.pages.map((p, i) =>
          i === pageIndex ? { ...p, ...updater(p) } : p
        ),
        updatedAt: Date.now(),
      }));

      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        await saveSession(sessionRef.current).catch(console.error);
        setSaving(false);
      }, 800);
    },
    [pageIndex, onUpdate]
  );

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  useEffect(() => {
    setHistory([]);
    setZoom(1);
    clearTimeout(historyTimerRef.current);
    historyTimerRef.current = null;
    pendingHistoryRef.current = null;
  }, [pageIndex]);

  const { visible: zoomVisible, show: showZoom } = useAutoHide(3000);

  const zoomIn = useCallback(() => {
    showZoom();
    setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
  }, [showZoom]);
  const zoomOut = useCallback(() => {
    showZoom();
    setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
  }, [showZoom]);

  usePinchZoom(scrollRef, zoom, setZoom, { min: ZOOM_MIN, max: ZOOM_MAX });

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (!prev.length) return prev;
      const snap = prev[prev.length - 1];
      setSelectedBoxId(null);
      onUpdate((s) => ({
        ...s,
        pages: s.pages.map((p, i) =>
          i === pageIndex ? { ...p, boxes: snap.boxes, strokes: snap.strokes } : p
        ),
        updatedAt: Date.now(),
      }));
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        await saveSession(sessionRef.current).catch(console.error);
        setSaving(false);
      }, 800);
      return prev.slice(0, -1);
    });
  }, [pageIndex, onUpdate]);

  const handleOverlayClick = useCallback(
    (e) => {
      // Ignore clicks that bubbled from child elements (buttons, boxes).
      // Child elements call e.stopPropagation() but as a safety net check
      // that the click actually originated on the overlay itself.
      if (e.target !== overlayRef.current) return;

      if (mode !== 'place') {
        setSelectedBoxId(null);
        return;
      }

      // 選択中のボックスがあれば選択解除のみ（新規作成しない）
      if (selectedBoxId) {
        setSelectedBoxId(null);
        return;
      }

      const rect = overlayRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const newBox = {
        id: generateId(),
        x: Math.max(0, Math.min(1 - DEFAULT_BOX_W, x)),
        y: Math.max(0, Math.min(1 - DEFAULT_BOX_H, y)),
        width: DEFAULT_BOX_W,
        height: DEFAULT_BOX_H,
        text: '',
        fontSize: 14,
        color: 'green',
      };

      setSelectedBoxId(newBox.id);
      updateSession((p) => ({ boxes: [...p.boxes, newBox] }));
    },
    [mode, selectedBoxId, updateSession]
  );

  const handleBoxUpdate = useCallback(
    (updated) => {
      updateSession((p) => ({
        boxes: p.boxes.map((b) => (b.id === updated.id ? updated : b)),
      }));
    },
    [updateSession]
  );

  const handleBoxDelete = useCallback(
    (id) => {
      setSelectedBoxId(null);
      updateSession((p) => ({ boxes: p.boxes.filter((b) => b.id !== id) }));
    },
    [updateSession]
  );

  const handleVoiceConfirm = useCallback(
    (text) => {
      updateSession((p) => ({
        boxes: p.boxes.map((b) => (b.id === voiceBoxId ? { ...b, text } : b)),
      }));
      setVoiceBoxId(null);
    },
    [voiceBoxId, updateSession]
  );

  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    setSelectedBoxId(null);
  }, []);

  // ---- フリーハンド描画 ----
  const toFrac = useCallback((clientX, clientY) => {
    const rect = overlayRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  const setLivePath = useCallback((points) => {
    if (liveRef.current) {
      liveRef.current.setAttribute('d', strokeToPath(points, VBW, VBW * imgAspect));
    }
  }, [imgAspect]);

  const handleDrawPointerDown = useCallback((e) => {
    if (mode !== 'draw') return;
    if (e.pointerType === 'touch') {
      activeTouchesRef.current.add(e.pointerId);
      // 2本指目が触れたらピンチ（ズーム/パン）とみなし、描きかけは破棄
      if (activeTouchesRef.current.size >= 2) {
        pinchingRef.current = true;
        drawingRef.current = null;
        setLivePath([]);
        return;
      }
    }
    pinchingRef.current = false;
    const { x, y } = toFrac(e.clientX, e.clientY);
    drawingRef.current = { points: [[x, y]], pointerId: e.pointerId };
    try { overlayRef.current.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    setLivePath(drawingRef.current.points);
  }, [mode, toFrac, setLivePath]);

  const handleDrawPointerMove = useCallback((e) => {
    const d = drawingRef.current;
    if (!d || pinchingRef.current || e.pointerId !== d.pointerId) return;
    const { x, y } = toFrac(e.clientX, e.clientY);
    const last = d.points[d.points.length - 1];
    if (Math.hypot(x - last[0], y - last[1]) < MIN_POINT_DIST) return;
    d.points.push([x, y]);
    setLivePath(d.points);
  }, [toFrac, setLivePath]);

  const handleDrawPointerUp = useCallback((e) => {
    if (e.pointerType === 'touch') {
      activeTouchesRef.current.delete(e.pointerId);
      if (activeTouchesRef.current.size < 2) pinchingRef.current = false;
    }
    const d = drawingRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drawingRef.current = null;
    setLivePath([]); // ライブ表示をクリア
    if (d.points.length >= 1) {
      const stroke = { id: generateId(), color: DRAW_COLOR, width: drawWidth, points: d.points };
      updateSession((p) => ({ strokes: [...(p.strokes ?? []), stroke] }));
    }
  }, [drawWidth, updateSession, setLivePath]);

  const handleClearStrokes = useCallback(() => {
    updateSession(() => ({ strokes: [] }));
  }, [updateSession]);

  const voiceBox = voiceBoxId ? boxes.find((b) => b.id === voiceBoxId) : null;

  const totalAnswered = session.pages.reduce(
    (acc, p) => acc + p.boxes.filter((b) => b.text).length,
    0
  );
  const totalBoxes = session.pages.reduce((acc, p) => acc + p.boxes.length, 0);
  const totalStrokes = session.pages.reduce((acc, p) => acc + (p.strokes?.length ?? 0), 0);

  useEffect(() => {
    if (totalBoxes > 0 && totalAnswered === totalBoxes && prevAnsweredRef.current < totalBoxes) {
      setShowCelebration(true);
      const t = setTimeout(() => setShowCelebration(false), 2500);
      return () => clearTimeout(t);
    }
    prevAnsweredRef.current = totalAnswered;
  }, [totalAnswered, totalBoxes]);

  return (
    <div className="answer-page">
      {/* Header: 2行構成で小画面でも操作しやすく */}
      <div className="answer-header">
        <div className="answer-header-row1">
          <button
            className="btn-ghost"
            onClick={() => onNavigate('home')}
            style={{ flexShrink: 0 }}
          >
            ← ホーム
          </button>
          <div className="answer-header-title">{session.name}</div>
          {session.pages.length > 1 && (
            <div className="page-nav">
              <button
                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                disabled={pageIndex === 0}
                aria-label="前のページ"
              >
                ‹
              </button>
              <span>{pageIndex + 1} / {session.pages.length}</span>
              <button
                onClick={() => setPageIndex((i) => Math.min(session.pages.length - 1, i + 1))}
                disabled={pageIndex === session.pages.length - 1}
                aria-label="次のページ"
              >
                ›
              </button>
            </div>
          )}
          {saving && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
              保存中…
            </span>
          )}
        </div>
        <div className="answer-header-row2">
          <ModeBar mode={mode} onChange={handleModeChange} />
        </div>
      </div>

      {/* Scrollable image area */}
      <div className="answer-scroll" ref={scrollRef} onPointerDownCapture={showZoom}>
        <div className="answer-image-container" style={{ width: `${zoom * 100}%` }}>
          <img
            src={currentPage?.imageData}
            alt={`ページ ${pageIndex + 1}`}
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.target;
              if (w && h) setImgAspect(h / w);
            }}
          />

          {/* フリーハンドの描画レイヤー（確定済み＋描画中） */}
          <svg
            className="stroke-layer"
            viewBox={`0 0 ${VBW} ${VBH}`}
            preserveAspectRatio="none"
          >
            {strokes.map((s) => (
              <path
                key={s.id}
                d={strokeToPath(s.points, VBW, VBH)}
                stroke={s.color}
                strokeWidth={s.width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {/* 描画中のライブパス（d は ref で命令的に更新し、再描画で消えないようにする） */}
            <path
              ref={liveRef}
              stroke={DRAW_COLOR}
              strokeWidth={drawWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div
            ref={overlayRef}
            className={`answer-overlay${mode === 'draw' ? ' mode-draw' : ''}`}
            onClick={handleOverlayClick}
            onPointerDown={handleDrawPointerDown}
            onPointerMove={handleDrawPointerMove}
            onPointerUp={handleDrawPointerUp}
            onPointerCancel={handleDrawPointerUp}
            style={{
              cursor:
                mode === 'draw'
                  ? 'crosshair'
                  : mode === 'place' && !selectedBoxId
                  ? 'crosshair'
                  : 'default',
              touchAction: mode === 'draw' ? 'none' : 'manipulation',
            }}
          >
            {boxes.map((box, i) => (
              <AnswerBox
                key={box.id}
                box={box}
                mode={mode}
                index={i}
                isSelected={selectedBoxId === box.id}
                overlayRef={overlayRef}
                onSelect={setSelectedBoxId}
                onUpdate={handleBoxUpdate}
                onDelete={handleBoxDelete}
                onAnswer={setVoiceBoxId}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Zoom controls（普段は非表示。画面をさわると表示し、数秒で自動的に隠れる） */}
      <div className={`zoom-controls${zoomVisible ? '' : ' is-hidden'}`}>
        <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label="拡大">
          ＋
        </button>
        <span className="zoom-controls-label">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label="縮小">
          －
        </button>
      </div>

      {/* Draw tools（描くモードのみ表示） */}
      {mode === 'draw' && (
        <div className="draw-tools">
          {DRAW_WIDTHS.map((w) => (
            <button
              key={w.id}
              className={`draw-w${drawWidth === w.w ? ' active' : ''}`}
              onClick={() => setDrawWidth(w.w)}
              aria-label={`太さ ${w.id}`}
            >
              <span style={{ width: w.dot, height: w.dot }} />
            </button>
          ))}
          <button
            className="draw-clear"
            onClick={handleClearStrokes}
            disabled={strokes.length === 0}
            aria-label="かいたものを全部けす"
          >
            けす
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="answer-footer">
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {totalAnswered} / {totalBoxes} こたえた
        </div>
        {(mode === 'place' || mode === 'draw') && (
          <button
            className="btn-secondary answer-undo-btn"
            onClick={handleUndo}
            disabled={history.length === 0}
            aria-label="もどす"
          >
            ↩ もどす
          </button>
        )}
        <div className="answer-footer-spacer" />
        <button
          className="btn-green"
          onClick={() => onNavigate('confirm', sessionRef.current)}
          disabled={totalBoxes === 0 && totalStrokes === 0}
        >
          だす →
        </button>
      </div>

      {/* Voice modal */}
      {voiceBox && (
        <VoiceModal
          box={voiceBox}
          onConfirm={handleVoiceConfirm}
          onClose={() => setVoiceBoxId(null)}
        />
      )}

      {/* Celebration overlay */}
      {showCelebration && (
        <div className="celebration-overlay" onClick={() => setShowCelebration(false)}>
          <div className="celebration-mark">◎</div>
          <div className="celebration-text">ぜんぶ こたえた！</div>
        </div>
      )}
    </div>
  );
}
