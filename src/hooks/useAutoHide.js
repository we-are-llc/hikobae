import { useCallback, useEffect, useRef, useState } from 'react';

// 初期は非表示。show() を呼ぶと表示し、一定時間操作がなければ自動的に隠す。
// 背景（問題用紙）に集中できるよう、ズームボタン等を普段は隠しておく用途。
export function useAutoHide(timeout = 3000) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const show = useCallback(() => {
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), timeout);
  }, [timeout]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { visible, show };
}
