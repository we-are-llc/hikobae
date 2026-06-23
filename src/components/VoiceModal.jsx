import { useEffect, useCallback, useState, useRef } from 'react';

function useDragPos() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const onPointerDown = useCallback((e) => {
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    const sx = e.clientX - pos.x;
    const sy = e.clientY - pos.y;
    const onMove = (ev) => setPos({ x: ev.clientX - sx, y: ev.clientY - sy });
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [pos.x, pos.y]);
  return { pos, onPointerDown };
}
import { useSpeech, applyVoiceCommands } from '../hooks/useSpeech.js';

export default function VoiceModal({ box, onConfirm, onClose }) {
  const { pos: dragPos, onPointerDown: onDragDown } = useDragPos();
  const { isListening, transcript, setTranscript, interimTranscript, error, start, stop, reset } =
    useSpeech();
  const [editText, setEditText] = useState(box.text || '');
  const [phase, setPhase] = useState('voice'); // 'voice' | 'edit'
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    start();
    return () => stop();
  }, []);

  useEffect(() => {
    // 手入力モードに切り替わった後は音声認識の結果で上書きしない
    if (transcript && phaseRef.current === 'voice') {
      setEditText(applyVoiceCommands(transcript));
    }
  }, [transcript]);

  const handleMicToggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      reset();
      setEditText('');
      start();
    }
  }, [isListening, start, stop, reset]);

  const handleConfirm = useCallback(() => {
    stop();
    onConfirm(editText);
  }, [editText, onConfirm, stop]);

  const handleRedo = useCallback(() => {
    reset();
    setEditText('');
    start();
  }, [reset, start]);

  const handleEdit = useCallback(() => {
    stop();
    // stop() は非同期なので、マイクが止まる前に phase を切り替えて
    // 以降の transcript 更新がUIに反映されないようにする
    setPhase('edit');
  }, [stop]);

  const handleReadAloud = useCallback(() => {
    if (!editText || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(editText);
    utter.lang = 'ja-JP';
    window.speechSynthesis.speak(utter);
  }, [editText]);

  return (
    <div className="voice-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="voice-modal"
        style={{ transform: `translate(${dragPos.x}px, ${dragPos.y}px)` }}
      >
        <div className="voice-modal-header" onPointerDown={onDragDown}>
          <h2>こたえをいってください</h2>
          <button className="voice-close-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        {error && (
          <div className="voice-error" style={{ whiteSpace: 'pre-line' }}>
            {error}
          </div>
        )}

        {phase === 'voice' ? (
          <>
            <div className="voice-transcript-wrap">
              <div
                className="voice-transcript editable"
                onClick={handleEdit}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                style={{ touchAction: 'manipulation' }}
              >
                {editText || interimTranscript ? (
                  <>
                    {editText && <span>{editText}</span>}
                    {interimTranscript && (
                      <span className="voice-interim"> {interimTranscript}</span>
                    )}
                  </>
                ) : (
                  <span className="voice-transcript-placeholder">
                    {isListening ? 'はなしています...' : 'ここをタップして手入力 / マイクで音声入力'}
                  </span>
                )}
              </div>
              {editText && (
                <button className="voice-read-btn" onClick={handleReadAloud} aria-label="読み上げ">
                  🔊
                </button>
              )}
            </div>

            <div className="voice-mic-area">
              <button
                className={`voice-mic-btn ${isListening ? 'recording' : ''}`}
                onClick={handleMicToggle}
                aria-label={isListening ? '録音停止' : '録音開始'}
              >
                {isListening ? '⏹' : '🎙'}
              </button>
              <div className={`voice-mic-label ${isListening ? 'recording' : ''}`}>
                {isListening ? 'はなしています' : 'マイクスタート'}
              </div>
            </div>

            <div className="voice-actions">
              <button className="btn-secondary" onClick={handleRedo}>
                やり直し
              </button>
              <button className="btn-green" onClick={handleConfirm} disabled={!editText}>
                かくてい
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="voice-edit-row">
              <div className="voice-edit-label-row">
                <span className="voice-edit-label">てで なおせます</span>
                <button className="voice-read-btn" onClick={handleReadAloud} disabled={!editText} aria-label="読み上げ">
                  🔊
                </button>
              </div>
              <textarea
                className="voice-edit-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                autoFocus
                rows={2}
              />
            </div>
            <div className="voice-actions">
              <button className="btn-secondary" onClick={() => setPhase('voice')}>
                もどる
              </button>
              <button className="btn-green" onClick={handleConfirm} disabled={!editText}>
                かくてい
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
