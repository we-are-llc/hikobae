import { useEffect, useCallback, useState } from 'react';
import { useSpeech, applyVoiceCommands } from '../hooks/useSpeech.js';

export default function VoiceModal({ box, onConfirm, onClose }) {
  const { isListening, transcript, setTranscript, interimTranscript, error, start, stop, reset } =
    useSpeech();
  const [editText, setEditText] = useState(box.text || '');
  const [phase, setPhase] = useState('voice'); // 'voice' | 'edit'

  useEffect(() => {
    start();
    return () => stop();
  }, []);

  useEffect(() => {
    if (transcript) {
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
    setPhase('edit');
  }, [stop]);

  return (
    <div className="voice-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="voice-modal">
        <div className="voice-modal-header">
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
            <div className={`voice-transcript ${isListening ? 'listening' : ''}`}>
              {editText || interimTranscript ? (
                <>
                  {editText && <span>{editText}</span>}
                  {interimTranscript && (
                    <span className="voice-interim"> {interimTranscript}</span>
                  )}
                </>
              ) : (
                <span className="voice-transcript-placeholder">
                  {isListening
                    ? 'はなしています...'
                    : 'マイクボタンをおしてはなしてください'}
                </span>
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
                {isListening ? 'はなしています（もう一度おすとていし）' : 'マイクスタート'}
              </div>
            </div>

            <div className="voice-actions">
              <button className="btn-secondary" onClick={handleRedo}>
                やり直し
              </button>
              <button className="btn-ghost" onClick={handleEdit}>
                てで なおす
              </button>
              <button
                className="btn-green"
                onClick={handleConfirm}
                disabled={!editText}
              >
                かくてい
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="voice-edit-row">
              <div className="voice-edit-label">てで なおせます</div>
              <textarea
                className="voice-edit-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                autoFocus
                rows={3}
              />
            </div>
            <div className="voice-actions">
              <button className="btn-secondary" onClick={() => setPhase('voice')}>
                もどる
              </button>
              <button
                className="btn-green"
                onClick={handleConfirm}
                disabled={!editText}
              >
                かくてい
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
