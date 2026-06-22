const MODES = [
  { id: 'place', label: '配置', icon: '✏️', hint: '画像をタップして回答欄をつくる' },
  { id: 'answer', label: '解答', icon: '🎙', hint: '回答欄をタップして音声入力する' },
  { id: 'edit', label: '編集', icon: '✦', hint: '回答欄を動かす・リサイズ・削除する' },
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
  place: '画面をタップして回答欄をつくる',
  answer: '回答欄をタップして音声で入力する',
  edit: '回答欄をドラッグして動かす・削除する',
};
