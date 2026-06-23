import { useState, useRef, useCallback, useEffect } from 'react';
import ModeBar, { MODE_HINTS } from '../components/ModeBar.jsx';
import AnswerBox from '../components/AnswerBox.jsx';
import VoiceModal from '../components/VoiceModal.jsx';
import { saveSession } from '../utils/db.js';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const DEFAULT_BOX_W = 0.24;
const DEFAULT_BOX_H = 0.065;

export default function Answer({ session, onNavigate, onUpdate }) {
  const [mode, setMode] = useState('place');
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [voiceBoxId, setVoiceBoxId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const overlayRef = useRef(null);
  const saveTimerRef = useRef(null);
  const sessionRef = useRef(session);
  const prevAnsweredRef = useRef(0);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const currentPage = session.pages[pageIndex];
  const boxes = currentPage?.boxes ?? [];

  // Functional update avoids stale-closure overwrites when answers are confirmed in quick succession
  const updateSession = useCallback(
    (updater) => {
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

  const handleOverlayClick = useCallback(
    (e) => {
      if (mode !== 'place') {
        setSelectedBoxId(null);
        return;
      }

      const rect = overlayRef.current.getBoundingClientRect();
      // click events from touch always have valid clientX/Y — no need for touches[]
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const newBox = {
        id: generateId(),
        x: Math.max(0, Math.min(1 - DEFAULT_BOX_W, x - DEFAULT_BOX_W / 2)),
        y: Math.max(0, Math.min(1 - DEFAULT_BOX_H, y - DEFAULT_BOX_H / 2)),
        width: DEFAULT_BOX_W,
        height: DEFAULT_BOX_H,
        text: '',
        fontSize: 14,
        color: 'green',
      };

      updateSession((p) => ({ boxes: [...p.boxes, newBox] }));
    },
    [mode, updateSession]
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

      {/* Mode hint */}
      <div className="mode-hint" data-mode={mode}>
        {MODE_HINTS[mode]}
      </div>

      {/* Scrollable image area */}
      <div className="answer-scroll">
        <div className="answer-image-container">
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
              cursor: mode === 'place' ? 'crosshair' : 'default',
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

      {/* Footer */}
      <div className="answer-footer">
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {totalAnswered} / {totalBoxes} こたえた
        </div>
        <div className="answer-footer-spacer" />
        <button
          className="btn-green"
          onClick={() => onNavigate('confirm', sessionRef.current)}
          disabled={totalBoxes === 0}
        >
          かくにん・しゅつりょく →
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
