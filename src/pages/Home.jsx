import { useState, useEffect, useCallback } from 'react';
import { loadSessions, deleteSession } from '../utils/db.js';

export default function Home({ onNavigate }) {
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);

  useEffect(() => {
    loadSessions().then(setSessions).catch(console.error);
  }, []);

  const handleDelete = useCallback(
    async (e, id) => {
      e.stopPropagation();
      if (!window.confirm('このデータを削除しますか？')) return;
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    },
    []
  );

  const handleContinue = useCallback(
    (session) => {
      setShowSessions(false);
      onNavigate('answer', session);
    },
    [onNavigate]
  );

  const formatDate = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="home">
      <div className="home-logo">🌱</div>
      <div style={{ textAlign: 'center' }}>
        <div className="home-title">ひこばえ</div>        
      </div>

      <div className="home-buttons">
        <button className="home-btn-new" onClick={() => onNavigate('import')}>
          あたらしく とりこむ
        </button>
        <button
          className="home-btn-continue"
          onClick={() => setShowSessions(true)}
          disabled={sessions.length === 0}
        >
          つづきから
          {sessions.length > 0 && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 13,
                background: '#3B82F6',
                color: '#fff',
                borderRadius: 10,
                padding: '2px 7px',
              }}
            >
              {sessions.length}
            </span>
          )}
        </button>
      </div>

      {sessions.length === 0 && (
        <div className="home-subtitle" style={{ fontSize: 13 }}>
          まず「あたらしく とりこむ」をおしてください
        </div>
      )}

      <button className="home-about-link" onClick={() => onNavigate('about')}>
        このアプリについて
      </button>

      {showSessions && (
        <div className="sessions-modal-overlay" onClick={() => setShowSessions(false)}>
          <div
            className="sessions-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>つづきを えらぶ</h2>
            <div className="sessions-modal-body">
              {sessions.length === 0 ? (
                <div className="sessions-empty">データがありません</div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className="session-item"
                    onClick={() => handleContinue(s)}
                  >
                    <div style={{ flex: 1 }}>
                      <div className="session-item-name">{s.name || '名前なし'}</div>
                      <div className="session-item-meta">
                        {s.pages?.length ?? 1} ページ・
                        {formatDate(s.updatedAt)}
                      </div>
                    </div>
                    <button
                      className="session-item-del"
                      onClick={(e) => handleDelete(e, s.id)}
                      aria-label="削除"
                    >
                      🗑
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              className="btn-secondary"
              style={{ width: '100%' }}
              onClick={() => setShowSessions(false)}
            >
              とじる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
