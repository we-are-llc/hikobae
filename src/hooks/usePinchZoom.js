import { useEffect, useLayoutEffect, useRef } from 'react';

// 2本指ピンチでスクロール要素の中身を拡大縮小する。
// - 1本指のときは介入しない（既存のドラッグ・ネイティブスクロールを尊重）
// - 2本指のときだけ touchmove を preventDefault してピンチとして扱う
// - ピンチ中心（2指の中点）の下にある内容が動かないようスクロール位置を補正する
//
// scrollRef: overflow:auto なスクロール要素への ref
// zoom / setZoom: 連続値のズーム状態（1.0〜max）
export function usePinchZoom(scrollRef, zoom, setZoom, { min = 1, max = 3 } = {}) {
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const gesture = useRef(null); // { startDist, startZoom }
  const pending = useRef(null); // { fracX, fracY, midX, midY }

  // ズーム変更後、ピンチ中心を保持するようスクロール位置を補正
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const p = pending.current;
    if (!el || !p) return;
    el.scrollLeft = p.fracX * el.scrollWidth - p.midX;
    el.scrollTop = p.fracY * el.scrollHeight - p.midY;
  }, [zoom, scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const distance = (touches) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );

    const onStart = (e) => {
      if (e.touches.length === 2) {
        gesture.current = { startDist: distance(e.touches), startZoom: zoomRef.current };
      }
    };

    const onMove = (e) => {
      if (e.touches.length !== 2 || !gesture.current) return;
      e.preventDefault(); // 2本指のときだけネイティブ挙動を止める

      const rect = el.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      // ズーム適用前の、中点の下にある内容の割合を記録（補正に使う）
      pending.current = {
        fracX: (el.scrollLeft + midX) / el.scrollWidth,
        fracY: (el.scrollTop + midY) / el.scrollHeight,
        midX,
        midY,
      };

      const ratio = distance(e.touches) / gesture.current.startDist;
      const next = Math.max(min, Math.min(max, gesture.current.startZoom * ratio));
      setZoom(Math.round(next * 100) / 100);
    };

    const onEnd = (e) => {
      if (e.touches.length < 2) {
        gesture.current = null;
        pending.current = null;
      }
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [scrollRef, setZoom, min, max]);
}
