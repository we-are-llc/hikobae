const MODES = [
  { id: 'place', label: 'ばしょをつくる', icon: '✏️', hint: '画像をタップして回答欄をつくる・動かす・削除する' },
  { id: 'answer', label: 'こたえをいれる', icon: '🎙', hint: '回答欄をタップして音声入力する' },
  { id: 'draw', label: 'かく', icon: '🖊', hint: 'ゆびやペンで書く・かく（2本指でズーム/移動）' },
];

export default function ModeBar({ mode, onChange }) {
  return (
    <div className="mode-bar" role="tablist" aria-label="操作モード">
      {MODES.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={mode === m.id}
          data-mode={m.id}
          className={`mode-btn ${mode === m.id ? 'active' : ''}`}
          onClick={() => onChange(m.id)}
          title={m.hint}
        >
          <span>{m.icon}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
}

export const MODE_HINTS = {
  place: '空いているところをタップして回答欄をつくる・選んで動かす',
  answer: '回答欄をタップして音声で入力する',
  draw: 'ゆびやペンで書く・かく（2本指でズーム・移動）',
};
