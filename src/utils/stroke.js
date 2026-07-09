// フリーハンドのストローク描画ユーティリティ。
// 点列は画像に対する割合座標 [x, y]（0〜1）で保持する。
// 線幅は「画像幅の1/1000」を1単位とする値（例: 10 → 画像幅の1%）。

// 点列（任意の座標系）を二次ベジェで平滑化したSVGパス文字列にする。
// scaleX / scaleY を掛けて座標系を変換する。
export function strokeToPath(points, scaleX = 1, scaleY = 1) {
  if (!points || points.length === 0) return '';
  const P = (p) => [p[0] * scaleX, p[1] * scaleY];

  if (points.length === 1) {
    const [x, y] = P(points[0]);
    // 1点だけのときは小さな点として描く（round cap で丸くなる）
    return `M${x},${y} L${x + 0.01},${y}`;
  }

  const p0 = P(points[0]);
  let d = `M${p0[0]},${p0[1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const c = P(points[i]);
    const n = P(points[i + 1]);
    const mx = (c[0] + n[0]) / 2;
    const my = (c[1] + n[1]) / 2;
    d += ` Q${c[0]},${c[1]} ${mx},${my}`;
  }
  const last = P(points[points.length - 1]);
  d += ` L${last[0]},${last[1]}`;
  return d;
}
