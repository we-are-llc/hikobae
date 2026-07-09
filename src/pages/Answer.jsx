import { useState, useRef, useCallback, useEffect } from 'react';
import ModeBar from '../components/ModeBar.jsx';
import AnswerBox from '../components/AnswerBox.jsx';
import VoiceModal from '../components/VoiceModal.jsx';
import { saveSession } from '../utils/db.js';
import { usePinchZoom } from '../hooks/usePinchZoom.js';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const DEFAULT_BOX_W = 0.24;
const DEFAULT_BOX_H = 0.065;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;

export default function Answer({ session, onNavigate, onUpdate }) {
  const [mode, setMode] = useState('place');
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [voiceBoxId, setVoiceBoxId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [history, setHistory] = useState([]);
  const overlayRef = useRef(null);
  const scrollRef = useRef(null);
  const saveTimerRef = useRef(null);
  const sessionRef = useRef(session);
  const prevAnsweredRef = useRef(0);
  const historyTimerRef = useRef(null);
  const pendingHistoryRef = useRef(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const currentPage = session.pages[pageIndex];
  const boxes = currentPage?.boxes ?? [];

  // Functional update avoids stale-closure overwrites when answers are confirmed in quick succession
  const updateSession = useCallback(
    (updater) => {
      // Capture pre-update boxes for undo; debounced so rapid drags produce one history entry
      if (!historyTimerRef.current) {
        pendingHistoryRef.current = sessionRef.current.pages[pageIndex]?.boxes ?? [];
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

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
  }, []);
  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
  }, []);

  usePinchZoom(scrollRef, zoom, setZoom, { min: ZOOM_MIN, max: ZOOM_MAX });

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (!prev.length) return prev;
      const boxes = prev[prev.length - 1];
      setSelectedBoxId(null);
      onUpdate((s) => ({
        ...s,
        pages: s.pages.map((p, i) => (i === pageIndex ? { ...p, boxes } : p)),
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

  const voiceBox = voiceBoxId ? boxes.find((b) => b.id === voiceBoxId) : null;

  const totalAnswered = session.pages.reduce(
    (acc, p) => acc + p.boxes.filter((b) => b.text).length,
    0
  );
  const totalBoxes = session.pages.reduce((acc, p) => acc + p.boxes.length, 0);

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
      <div className="answer-scroll" ref={scrollRef}>
        <div className="answer-image-container" style={{ width: `${zoom * 100}%` }}>
          <img
            src={currentPage?.imageData}
            alt={`ページ ${pageIndex + 1}`}
            draggable={false}
          />
          <div
            ref={overlayRef}
            className="answer-overlay"
            onClick={handleOverlayClick}
            style={{
              cursor: mode === 'place' && !selectedBoxId ? 'crosshair' : 'default',
              touchAction: 'manipulation',
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

      {/* Zoom controls（2本指ピンチでもズーム可。ボタンはデスクトップ等の補助） */}
      <div className="zoom-controls">
        <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX} aria-label="拡大">
          ＋
        </button>
        <span className="zoom-controls-label">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN} aria-label="縮小">
          －
        </button>
      </div>

      {/* Footer */}
      <div className="answer-footer">
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {totalAnswered} / {totalBoxes} こたえた
        </div>
        {mode === 'place' && (
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
          disabled={totalBoxes === 0}
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
