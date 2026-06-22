import { useCallback, useRef } from 'react';

const MIN_SIZE = 0.02;

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

  const handlePointerDown = useCallback(
    (e) => {
      e.stopPropagation();

      if (mode === 'answer') {
        onAnswer(box.id);
        return;
      }

      if (mode === 'edit') {
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
      }
    },
    [mode, box, onAnswer, onSelect, onUpdate, toFrac]
  );

  const handleResizeDown = useCallback(
    (e, handleId) => {
      e.stopPropagation();
      if (mode !== 'edit') return;

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

  const handleDelete = useCallback(
    (e) => {
      e.stopPropagation();
      if (window.confirm('この回答欄を削除しますか？')) {
        onDelete(box.id);
      }
    },
    [box.id, onDelete]
  );

  const colors = {
    place: {
      border: '2px dashed #3B82F6',
      background: 'rgba(59,130,246,0.06)',
      labelBg: '#3B82F6',
    },
    answer: {
      border: `2px solid ${box.text ? '#10B981' : '#94A3B8'}`,
      background: box.text ? 'rgba(16,185,129,0.09)' : 'rgba(255,255,255,0.75)',
      cursor: 'pointer',
      labelBg: '#10B981',
    },
    edit: {
      border: isSelected ? '2px solid #F59E0B' : '2px dashed #CBD5E1',
      background: isSelected ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.55)',
      cursor: 'move',
      labelBg: '#F59E0B',
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
        <span className="answer-box-text">{box.text}</span>
      ) : (
        mode === 'answer' && (
          <span className="answer-box-placeholder">タップ</span>
        )
      )}

      {/* Edit mode controls */}
      {mode === 'edit' && isSelected && (
        <>
          <button
            className="box-delete-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleDelete}
            aria-label="削除"
          >
            ×
          </button>
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
