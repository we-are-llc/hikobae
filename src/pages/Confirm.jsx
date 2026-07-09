import { useState, useCallback, useEffect, useRef } from 'react';
import { exportToPDF } from '../utils/pdfExport.js';

export default function Confirm({ session, onNavigate }) {
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [activeBoxId, setActiveBoxId] = useState(null);
  const bodyRef = useRef(null);

  const allBoxes = session.pages.flatMap((p, pi) =>
    p.boxes.map((b, bi) => ({ ...b, pageIndex: pi, boxIndex: bi }))
  );

  const answered = allBoxes.filter((b) => b.text);
  const hasStrokes = session.pages.some((p) => (p.strokes?.length ?? 0) > 0);
  // 回答欄がなくても手書きがあればPDF出力できる
  const canExport = allBoxes.length > 0 || hasStrokes;

  // アクティブ項目が変わったら自動スクロール
  useEffect(() => {
    if (!activeBoxId || !bodyRef.current) return;
    const el = bodyRef.current.querySelector(`[data-box-id="${activeBoxId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeBoxId]);

  const handleReadAloud = useCallback(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setActiveBoxId(null);

    // 回答1件ずつ utterance を作りキューに積む（onstart でハイライト制御）
    const items = [];
    session.pages.forEach((page, pi) => {
      if (!page.boxes.some((b) => b.text)) return;
      if (session.pages.length > 1) {
        items.push({ text: `ページ${pi + 1}`, boxId: null });
      }
      // 元のインデックス（画面表示の番号）を維持したまま未回答をスキップ
      page.boxes.forEach((b, bi) => {
        if (!b.text) return;
        items.push({ text: `${bi + 1}番。${b.text}`, boxId: b.id });
      });
    });

    if (items.length === 0) return;

    items.forEach((item, idx) => {
      const utt = new SpeechSynthesisUtterance(item.text);
      utt.lang = 'ja-JP';
      utt.rate = 0.85;
      utt.onstart = () => setActiveBoxId(item.boxId);
      if (idx === items.length - 1) {
        utt.onend = () => setActiveBoxId(null);
      }
      window.speechSynthesis.speak(utt);
    });
  }, [session]);

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

      <div className="confirm-body" ref={bodyRef}>
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
                  <div
                    key={box.id}
                    data-box-id={box.id}
                    className={`confirm-answer-item${activeBoxId === box.id ? ' confirm-answer-item--active' : ''}`}
                  >
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

        {allBoxes.length === 0 && !hasStrokes && (
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

        {allBoxes.length === 0 && hasStrokes && (
          <div className="loading" style={{ flex: 'unset', paddingTop: 40 }}>
            <div style={{ fontSize: 32 }}>🖊</div>
            <div>手書きで書きこみました</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              このままPDFにして保存できます
            </div>
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
          disabled={exporting || !canExport}
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
