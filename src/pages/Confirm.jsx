import { useState, useCallback } from 'react';
import { exportToPDF } from '../utils/pdfExport.js';

export default function Confirm({ session, onNavigate }) {
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const allBoxes = session.pages.flatMap((p, pi) =>
    p.boxes.map((b, bi) => ({ ...b, pageIndex: pi, boxIndex: bi }))
  );

  const answered = allBoxes.filter((b) => b.text);

  const handleReadAloud = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const text = answered.map((b, i) => `${i + 1}番。${b.text}`).join('。');
    if (!text) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'ja-JP';
    utt.rate = 0.85;
    window.speechSynthesis.speak(utt);
  }, [answered]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportToPDF(session);
      setExportDone(true);
    } catch (err) {
      console.error(err);
      alert('PDFの作成中にエラーが発生しました。');
    } finally {
      setExporting(false);
    }
  }, [session]);

  return (
    <div className="confirm-page">
      <div className="confirm-header">
        <button className="btn-ghost" onClick={() => onNavigate('answer', session)}>
          ← もどる
        </button>
        <h1>かくにん・しゅつりょく</h1>
      </div>

      <div className="confirm-body">
        {session.pages.map((page, pi) => {
          const pageBoxes = page.boxes;
          if (pageBoxes.length === 0) return null;
          return (
            <div key={pi} className="confirm-card">
              {session.pages.length > 1 && (
                <div className="confirm-card-header">
                  ページ {pi + 1}
                </div>
              )}
              <div className="confirm-answer-list">
                {pageBoxes.map((box, bi) => (
                  <div key={box.id} className="confirm-answer-item">
                    <div className="confirm-answer-num">{bi + 1}</div>
                    {box.text ? (
                      <div className="confirm-answer-text">{box.text}</div>
                    ) : (
                      <div className="confirm-answer-empty">（まだこたえていません）</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {allBoxes.length === 0 && (
          <div className="loading" style={{ flex: 'unset', paddingTop: 40 }}>
            <div style={{ fontSize: 32 }}>📝</div>
            <div>回答欄がまだありません</div>
            <button
              className="btn-primary"
              onClick={() => onNavigate('answer', session)}
              style={{ marginTop: 8 }}
            >
              かいとうがめんに もどる
            </button>
          </div>
        )}
      </div>

      <div className="confirm-footer">
        {answered.length > 0 && (
          <button className="btn-secondary" onClick={handleReadAloud}>
            🔊 よみあげる
          </button>
        )}
        <button
          className="btn-green"
          onClick={handleExport}
          disabled={exporting || allBoxes.length === 0}
        >
          {exporting ? (
            <>
              <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              PDFをつくっています…
            </>
          ) : exportDone ? (
            '✓ PDFをほぞんしました'
          ) : (
            'PDFにしてほぞん'
          )}
        </button>
        {exportDone && (
          <div style={{ fontSize: 13, color: 'var(--answer)', textAlign: 'center' }}>
            ダウンロードフォルダを確認してください
          </div>
        )}
      </div>
    </div>
  );
}
