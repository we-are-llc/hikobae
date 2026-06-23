import { useCallback, useRef, useState, useEffect } from 'react';

const MIN_SIZE = 0.02;

const COLOR_PALETTE = {
  green:  { main: '#10B981', bg: 'rgba(16,185,129,0.09)' },
  blue:   { main: '#3B82F6', bg: 'rgba(59,130,246,0.09)' },
  pink:   { main: '#EC4899', bg: 'rgba(236,72,153,0.09)' },
  yellow: { main: '#EAB308', bg: 'rgba(234,179,8,0.09)' },
};
const COLOR_KEYS = ['green', 'blue', 'pink', 'yellow'];

const HANDLES = [
  { id: 'nw', style: { top: -6, left: -6 }, cursor: 'nw-resize' },
  { id: 'n',  style: { top: -6, left: 'calc(50% - 6px)' }, cursor: 'n-resize' },
  { id: 'ne', style: { top: -6, right: -6 }, cursor: 'ne-resize' },
  { id: 'e',  style: { top: 'calc(50% - 6px)', right: -6 }, cursor: 'e-resize' },
  { id: 'se', style: { bottom: -6, right: -6 }, cursor: 'se-resize' },
  { id: 's',  style: { bottom: -6, left: 'calc(50% - 6px)' }, cursor: 's-resize' },
  { id: 'sw', style: { bottom: -6, left: -6 }, cursor: 'sw-resize' },
  { id: 'w',  style: { top: 'calc(50% - 6px)', left: -6 }, cursor: 'w-resize' },
];

export default function AnswerBox({
  box,
  mode,
  isSelected,
  index,
  overlayRef,
  onSelect,
  onUpdate,
  onDelete,
  onAnswer,
}) {
  const pointerRef = useRef(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isSelected) {
      setExpanded(false);
      setShowConfirm(false);
    }
  }, [isSelected]);

  const toFrac = useCallback(
    (clientX, clientY) => {
      const rect = overlayRef.current.getBoundingClientRect();
      return {
        fx: (clientX - rect.left) / rect.width,
        fy: (clientY - rect.top) / rect.height,
      };
    },
    [overlayRef]
  );

  // answer mode: use onClick so the modal opens only after a complete tap,
  // preventing the residual click from immediately closing the modal overlay.
  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (mode === 'answer') onAnswer(box.id);
    },
    [mode, box.id, onAnswer]
  );

  const handlePointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      if (mode !== 'place') return;
      // Don't initiate drag when clicking a control button inside the box
      if (e.target.closest('button')) return;

      onSelect(box.id);
      const { fx: sx, fy: sy } = toFrac(e.clientX, e.clientY);
      const startBox = { ...box };

      const onMove = (ev) => {
        const { fx, fy } = toFrac(ev.clientX, ev.clientY);
        const dx = fx - sx;
        const dy = fy - sy;
        onUpdate({
          ...startBox,
          x: Math.max(0, Math.min(1 - startBox.width, startBox.x + dx)),
          y: Math.max(0, Math.min(1 - startBox.height, startBox.y + dy)),
        });
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [mode, box, onSelect, onUpdate, toFrac]
  );

  const handleResizeDown = useCallback(
    (e, handleId) => {
      e.stopPropagation();
      if (mode !== 'place') return;

      const { fx: sx, fy: sy } = toFrac(e.clientX, e.clientY);
      const startBox = { ...box };

      const onMove = (ev) => {
        const { fx, fy } = toFrac(ev.clientX, ev.clientY);
        const dx = fx - sx;
        const dy = fy - sy;
        let { x, y, width, height } = startBox;

        if (handleId.includes('e')) width = Math.max(MIN_SIZE, width + dx);
        if (handleId.includes('w')) {
          const nx = Math.min(x + width - MIN_SIZE, Math.max(0, x + dx));
          width = Math.max(MIN_SIZE, width - (nx - x));
          x = nx;
        }
        if (handleId.includes('s')) height = Math.max(MIN_SIZE, height + dy);
        if (handleId.includes('n')) {
          const ny = Math.min(y + height - MIN_SIZE, Math.max(0, y + dy));
          height = Math.max(MIN_SIZE, height - (ny - y));
          y = ny;
        }

        onUpdate({ ...box, x, y, width, height });
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [mode, box, onUpdate, toFrac]
  );

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    setShowConfirm(true);
  }, []);

  const palette = COLOR_PALETTE[box.color] || COLOR_PALETTE.green;

  const colors = {
    place: {
      border: isSelected ? `2px solid ${palette.main}` : `2px dashed ${palette.main}`,
      background: palette.bg,
      cursor: 'move',
      labelBg: palette.main,
    },
    answer: {
      border: `2px solid ${box.text ? palette.main : '#94A3B8'}`,
      background: box.text ? palette.bg : 'rgba(255,255,255,0.75)',
      cursor: 'pointer',
      labelBg: palette.main,
    },
  };

  const c = colors[mode];

  return (
    <div
      className="answer-box"
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.width * 100}%`,
        height: `${box.height * 100}%`,
        border: c.border,
        background: c.background,
        cursor: c.cursor || 'default',
      }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
    >
      {/* Label */}
      <div
        className="answer-box-label"
        style={{ background: c.labelBg, color: '#fff' }}
      >
        {index + 1}
      </div>

      {/* Content */}
      {box.text ? (
        <span className="answer-box-text" style={{ fontSize: box.fontSize || 14 }}>{box.text}</span>
      ) : (
        mode === 'answer' && (
          <span className="answer-box-placeholder">タップ</span>
        )
      )}

      {/* Edit controls (place mode, selected) */}
      {mode === 'place' && isSelected && (
        <>
          {/* Delete confirmation overlay */}
          {showConfirm && (
            <div
              className="box-delete-confirm"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="box-delete-confirm-msg">けしますか？</span>
              <div className="box-delete-confirm-btns">
                <button
                  className="box-confirm-btn box-confirm-yes"
                  onClick={(e) => { e.stopPropagation(); onDelete(box.id); }}
                >
                  けす
                </button>
                <button
                  className="box-confirm-btn box-confirm-no"
                  onClick={(e) => { e.stopPropagation(); setShowConfirm(false); }}
                >
                  やめる
                </button>
              </div>
            </div>
          )}

          <button
            className="box-mic-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onAnswer(box.id); }}
            aria-label="音声入力"
          >
            🎙
          </button>
          <button
            className="box-delete-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleDelete}
            aria-label="削除"
          >
            🗑
          </button>

          {expanded ? (
            <>
              <div className="box-fontsize-controls">
                <button
                  className="box-fontsize-btn"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ ...box, fontSize: Math.max(8, (box.fontSize || 14) - 2) });
                  }}
                  aria-label="文字を小さく"
                >
                  ぁ
                </button>
                <button
                  className="box-fontsize-btn"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ ...box, fontSize: Math.min(36, (box.fontSize || 14) + 2) });
                  }}
                  aria-label="文字を大きく"
                >
                  あ
                </button>
              </div>
              <div className="box-color-controls">
                {COLOR_KEYS.map((key) => (
                  <button
                    key={key}
                    className={`box-color-btn${(box.color || 'green') === key ? ' active' : ''}`}
                    style={{ background: COLOR_PALETTE[key].main }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate({ ...box, color: key });
                    }}
                    aria-label={key}
                  />
                ))}
              </div>
              <button
                className="box-expand-btn box-expand-close"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
              >
                ▲ とじる
              </button>
            </>
          ) : (
            <button
              className="box-expand-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            >
              ⚙ もっと
            </button>
          )}

          {HANDLES.map((h) => (
            <div
              key={h.id}
              className="resize-handle"
              style={{ ...h.style, cursor: h.cursor }}
              onPointerDown={(e) => handleResizeDown(e, h.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}
