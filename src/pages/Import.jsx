import { useState, useRef, useCallback, useId } from 'react';
import { renderPDFToImages } from '../utils/pdfImport.js';

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Import({ onNavigate, initialPages = [], initialName = '' }) {
  const [pages, setPages] = useState(initialPages);
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const inputId = useId();

  const processFiles = useCallback(async (files) => {
    setLoading(true);
    const newPages = [];
    for (const file of files) {
      if (file.type === 'application/pdf') {
        const images = await renderPDFToImages(file);
        images.forEach((imageData) => newPages.push({ imageData }));
      } else if (file.type.startsWith('image/')) {
        const imageData = await readFileAsDataURL(file);
        newPages.push({ imageData });
      }
    }
    setPages((prev) => [...prev, ...newPages]);
    if (!name && files[0]) setName(files[0].name.replace(/\.[^.]+$/, ''));
    setLoading(false);
  }, [name]);

  const handleFileChange = useCallback((e) => {
    const files = [...e.target.files];
    if (files.length) processFiles(files);
    e.target.value = '';
  }, [processFiles]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = [...e.dataTransfer.files];
    if (files.length) processFiles(files);
  }, [processFiles]);

  // Navigate to Crop — session creation happens there after correction
  const handleConfirm = useCallback(() => {
    if (!pages.length) return;
    onNavigate('crop', { name: name || '名前なし', rawPages: pages });
  }, [pages, name, onNavigate]);

  const hiddenInput = (
    <input
      id={inputId}
      ref={inputRef}
      type="file"
      accept="image/*,application/pdf"
      multiple
      style={{ display: 'none' }}
      onChange={handleFileChange}
    />
  );

  return (
    <div className="import-page">
      <div className="import-header">
        <button className="btn-ghost" onClick={() => onNavigate('home')}>
          ← もどる
        </button>
        <h1>とりこむ</h1>
      </div>

      <div className="import-body">
        {loading && (
          <div className="loading" style={{ flex: 1 }}>
            <div className="spinner" />
            <span>よみこんでいます...</span>
          </div>
        )}

        {!loading && pages.length === 0 && (
          <label
            htmlFor={inputId}
            className={`dropzone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="dropzone-icon">📷</div>
            <div className="dropzone-label">ここをタップして えらぶ</div>
            <div className="dropzone-hint">画像 (JPEG / PNG) または PDF</div>
            {hiddenInput}
          </label>
        )}

        {!loading && pages.length > 0 && (
          <>
            <label htmlFor={inputId} className="add-more-btn">
              ＋ もっとついかする
              {hiddenInput}
            </label>

            <div className="preview-grid">
              {pages.map((p, i) => (
                <div key={i} className="preview-thumb">
                  <img src={p.imageData} alt={`ページ ${i + 1}`} loading="lazy" />
                  <div className="preview-thumb-num">{i + 1}</div>
                </div>
              ))}
            </div>

            <div className="import-name-row">
              <label htmlFor="session-name">なまえ（にゅうりょく）</label>
              <input
                id="session-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="れい：すうがく5ページ"
              />
            </div>
          </>
        )}
      </div>

      <div className="import-footer">
        <button className="btn-secondary" onClick={() => onNavigate('home')}>
          やめる
        </button>
        <button
          className="btn-primary"
          onClick={handleConfirm}
          disabled={pages.length === 0 || loading}
        >
          つぎへ（台形補正） →
        </button>
      </div>
    </div>
  );
}
