# ひこばえ β — 技術仕様書

> 作成日：2026-06-24　開発：ウィアー合同会社

---

## 目次

1. [プロダクト概要](#1-プロダクト概要)
2. [開発思想・設計原則](#2-開発思想設計原則)
3. [技術スタック](#3-技術スタック)
4. [アーキテクチャ](#4-アーキテクチャ)
5. [画面仕様・ユーザーフロー](#5-画面仕様ユーザーフロー)
6. [データモデル](#6-データモデル)
7. [主要アルゴリズム](#7-主要アルゴリズム)
8. [デザインシステム](#8-デザインシステム)
9. [ファイル構成](#9-ファイル構成)
10. [非機能要件](#10-非機能要件)

---

## 1. プロダクト概要

### アプリ名
**ひこばえ**（英字：hikobae）

「ひこばえ」は、切り株の根元から新たに芽吹く若芽のこと。書くことが困難な状況にある子どもが、それでも自分の力で答えられる環境をつくるという意味を込めた名前。

### ターゲットユーザー
- **主対象：** 書字困難（ディスグラフィア、発達障害など）を抱える小中学生
- **利用者：** 保護者・支援者・教師（代わりに操作することもある）
- **動作環境：** スマートフォン・タブレット（iOS/Android Chrome/Edge/Safari）、デスクトップ

### 解決する課題
テストや宿題で「わかっているのに書けない」子どもが、問題用紙をスマートフォンで撮影し、音声で答えを入力してPDF提出できるようにする。

### 現在のフェーズ
**β版**（公開中）。不具合報告は [GitHub Issues](https://github.com/we-are-llc/hikobae/issues/new) へ。

---

## 2. 開発思想・設計原則

### オフラインファースト
- **サーバーへの通信はゼロ。** 画像・回答データはすべて端末内のIndexedDBにのみ保存される。
- ネットワーク接続なしで全機能が動作する。
- 外部CDNも使用しない（フォントもシステムフォント優先）。

### プライバシーバイデザイン
- 子どもの解答・問題用紙の画像が外部に送出されることは設計上ありえない。
- アプリのアンインストール（ブラウザのデータ消去）で全データが完全に削除される。
- 解析・トラッキングツールの類いは一切導入しない。

### 子ども・支援者が使えるUI
- ひらがな中心の表現（「きりとる」「こたえる」「もどす」）。
- ボタンは最小48pxのタッチターゲット。
- 操作の確認ダイアログはOS標準の`alert`/`confirm`ではなくアプリ内UIで実現（子ども向けに目立つデザイン）。
- エラーは出さず、できるだけフォールバックで動かし続ける。

### シンプルなステート管理
- Reduxやグローバルストアを使わず、ReactフックとコールバックのみでSPA内ナビゲーション。
- 複雑さより可読性。コンポーネント数を最小限に抑える。

### PWA互換（段階的）
- `100dvh`レイアウトでブラウザのUI（アドレスバー等）を避ける。
- Safe area insets対応（iOSノッチ・ホームインジケーター）。
- 将来的なService Worker追加を想定した構造（現時点では未実装）。

---

## 3. 技術スタック

### コアフレームワーク

| ライブラリ | バージョン | 用途 |
|---|---|---|
| React | 18.3.1 | UIフレームワーク |
| Vite | 5.4.0 | ビルドツール・開発サーバー |
| @vitejs/plugin-react | 4.3.1 | ReactのJSX変換・HMR |

### PDF処理

| ライブラリ | バージョン | 用途 |
|---|---|---|
| pdfjs-dist | 4.4.168 | PDFをCanvas画像に変換（取り込み時） |
| jsPDF | 2.5.1 | 回答オーバーレイ付きPDFを生成（書き出し時） |
| html2canvas | 1.4.1 | 回答欄のHTML→Canvas変換（PDF生成の中間処理） |

### ブラウザAPI（ライブラリなし）

| API | 用途 |
|---|---|
| IndexedDB | セッション・画像の永続化 |
| Canvas 2D API | 画像処理・エッジ検出・回転 |
| WebGL | 透視変換（ホモグラフィ変換） |
| Web Speech API | 音声認識（SpeechRecognition）・音声合成（SpeechSynthesis） |
| Pointer Events API | マルチデバイス対応のドラッグ・リサイズ |
| File API / Drag & Drop | ファイル取り込み |

### 言語・標準

- **JavaScript（ES2022+）**、JSX
- **CSS3**（カスタムプロパティ、`dvh`、`env(safe-area-inset-*)` ）
- TypeScript 非使用（シンプルさ優先）

### 開発環境

```
Node.js + npm
ビルド: npm run build → /dist/
開発:   npm run dev   → localhost:5173
```

---

## 4. アーキテクチャ

### SPA構成

```
App.jsx
├─ ページ状態: useState('home' | 'import' | 'crop' | 'answer' | 'confirm')
├─ セッション状態: useState(session | null)
└─ cropData状態: useState({ name, rawPages } | null)
```

ルーターライブラリは使用しない。`page`ステートを切り替えるだけのシンプルな条件レンダリング。ブラウザの戻るボタンは無効（アプリ内の「← もどる」ボタンで代替）。

### コンポーネント構成

```
src/
├── App.jsx                  # ルーター兼セッション管理
├── pages/
│   ├── Home.jsx             # ホーム（セッション一覧・新規）
│   ├── Import.jsx           # ファイル取り込み
│   ├── Crop.jsx             # 台形補正
│   ├── Answer.jsx           # 回答作業（メイン画面）
│   ├── Confirm.jsx          # 確認・PDF書き出し
│   └── About.jsx            # アプリ説明（ホーム内モーダル相当）
├── components/
│   ├── ModeBar.jsx          # 配置/解答モード切り替えバー
│   ├── AnswerBox.jsx        # 回答欄（ドラッグ・リサイズ・コントロール）
│   └── VoiceModal.jsx       # 音声入力モーダル
├── hooks/
│   └── useSpeech.js         # Web Speech APIラッパー
├── utils/
│   ├── db.js                # IndexedDB CRUD
│   ├── perspective.js       # 透視変換（WebGL + ソフトウェアフォールバック）
│   ├── detectEdges.js       # 用紙コーナー自動検出
│   ├── pdfImport.js         # PDF→画像変換
│   └── pdfExport.js         # 回答付きPDF生成
└── styles/
    └── app.css              # 全スタイル（CSSカスタムプロパティ）
```

### データフロー

```
ファイル（JPEG/PNG/PDF）
  ↓  Import.jsx: processFiles()
rawPages = [{ imageData: DataURL }, ...]
  ↓  Crop.jsx: warpPerspective()
session.pages[i].imageData = 補正済み PNG DataURL
  ↓  saveSession(session) → IndexedDB
  ↓  Answer.jsx: box 配置・音声入力
session.pages[i].boxes = [{ id, x, y, width, height, text, fontSize, color }]
  ↓  saveSession() 都度オートセーブ（800msデバウンス）
  ↓  Confirm.jsx: exportToPdf()
PDF ダウンロード（ブラウザの保存ダイアログ）
```

---

## 5. 画面仕様・ユーザーフロー

### 5-1. Home（ホーム）

**機能：**
- 🌱 ロゴ・タイトル表示
- 「あたらしく とりこむ」→ Import へ遷移
- 「つづきから」→ IndexedDB から読み込んだセッション一覧モーダル
  - セッション数をバッジ表示
  - セッションなしの場合はボタン無効化
- セッション削除（ゴミ箱ボタン + `window.confirm` ダイアログ）
- 「このアプリについて」リンク（/lp.html 別タブ）
- 「不具合を報告する」リンク（GitHub Issues 別タブ）

### 5-2. Import（取り込み）

**機能：**
- ドラッグ&ドロップまたはタップでファイル選択
- 対応形式：JPEG・PNG・PDF（複数選択・複数ファイル可）
- PDFは各ページを2×スケールでCanvas→JPEG(92%)に変換
- プレビューグリッド表示・ページ並べ替え（未実装、予定）
- 名前入力フィールド（デフォルト：ファイル名）
- 「つぎへ（台形補正）→」ボタン

### 5-3. Crop（台形補正）

**機能：**
- 4つのカラーハンドル（左上：青、右上：緑、右下：オレンジ、左下：赤）
- 画像読み込み時に `detectDocumentCorners()` を自動実行 → コーナー自動配置
- ハンドルをドラッグして調整（Pointer Events + setPointerCapture）
- 半透明マスクで切り取り範囲を強調表示（SVG `path fillRule="evenodd"`）
- 「↻ まわす」: 90°時計回り回転（Canvas で実行、回転後は再検出）
- 「そのまま」: 台形補正スキップで次へ
- 「きりとる →」/ 「はじめる →」: 透視変換を適用して次ページまたはAnswer へ
- 複数ページ対応（n / total バッジ表示）

**透視変換出力：** PNG（ロスレス。JPEG二重圧縮によるテキストのボケを防ぐ）

### 5-4. Answer（回答作業）

**2モード構成：**

#### 配置モード（ばしょをつくる）
- 画像上をタップ → デフォルトサイズ（幅24%・高さ6.5%）の回答欄を生成
- ドラッグで移動（Pointer Events、window レベルでキャプチャ）
- 8方向リサイズハンドル（角4点＋辺中点4点）
- 選択中の回答欄に表示されるコントロール：
  - 🎙 マイクボタン → VoiceModal を開く
  - 🗑 削除ボタン → 「けしますか？」確認オーバーレイ
  - 「⚙ もっと」→ 文字サイズ（ぁ小/あ大）・カラーパレット展開
- 「↩ もどす」（Undo）: 最大20段階、ページ切り替えでリセット（400msデバウンスでスナップショット）

#### 解答モード（こたえをいれる）
- 回答欄タップ → VoiceModal 表示
- 未入力の欄には「タップ」プレースホルダー
- 入力済みは文字を直接表示

**ヘッダー：**
- ← ホーム / セッション名 / ページナビ（複数ページ時）/ 保存中…インジケーター

**フッター：**
- 「n / m こたえた」進捗カウンター
- 「↩ もどす」（配置モード時のみ）
- 「だす →」→ Confirm へ

**お祝い演出：** 全回答欄に入力完了時に「◎ ぜんぶ こたえた！」オーバーレイが2.5秒表示

**オートセーブ：** 変更から800ms後に IndexedDB へ非同期保存

### 5-5. VoiceModal（音声入力）

**機能：**
- Web Speech API（`lang='ja-JP'`、`continuous=true`、`interimResults=true`）
- 音声認識中のテキスト：確定部分（黒）＋認識中部分（グレー斜体）をリアルタイム表示
- 📋 コピー / 🔊 読み上げ（SpeechSynthesis、速度0.85×） / ✏ 手入力モード切り替え
- 手入力モード：textarea に直接タイプ
- 音声コマンド変換（例：「まる」→「。」、「かいぎょう」→改行）
- 「けってい」で確定 → AnswerBox に反映
- ドラッグ移動対応（デスクトップ）、モバイルでは画面下部のボトムシート

### 5-6. Confirm（確認・書き出し）

**機能：**
- ページごとにカード形式で回答一覧表示（番号・テキスト・未回答フラグ）
- 「よみあげる」: 全回答をSpeechSynthesisで読み上げ（速度0.85×）
- 「PDFにしてほぞん」: `pdfExport()` を呼び出しブラウザのダウンロードとして保存
  - ファイル名：`{name}_{YYYY-MM-DD}.pdf`
- 「← もどる」: Answer へ戻る

---

## 6. データモデル

### IndexedDB

```
DB名:    hikobae-db（バージョン1）
ストア:   sessions（keyPath: 'id'）
```

### Session オブジェクト

```javascript
{
  id:        string,   // genId() = Date.now().toString(36) + random5chars
  name:      string,   // ユーザー入力名またはファイル名
  createdAt: number,   // Unix タイムスタンプ (ms)
  updatedAt: number,   // 更新のたびに上書き
  pages: [
    {
      imageData: string,  // DataURL（image/png または image/jpeg）
      boxes: [Box]
    }
  ]
}
```

### Box オブジェクト

```javascript
{
  id:       string,   // generateId()
  x:        number,   // 0.0〜1.0（ページ幅に対する割合）
  y:        number,   // 0.0〜1.0（ページ高さに対する割合）
  width:    number,   // 0.0〜1.0（ページ幅に対する割合）、デフォルト 0.24
  height:   number,   // 0.0〜1.0（ページ高さに対する割合）、デフォルト 0.065
  text:     string,   // 回答テキスト（音声認識結果または手入力）
  fontSize: number,   // 8〜36px、デフォルト 14
  color:    string,   // 'green' | 'blue' | 'pink' | 'yellow'
}
```

### カラーパレット

```javascript
const COLOR_PALETTE = {
  green:  { main: '#10B981', bg: 'rgba(16,185,129,0.09)' },
  blue:   { main: '#3B82F6', bg: 'rgba(59,130,246,0.09)' },
  pink:   { main: '#EC4899', bg: 'rgba(236,72,153,0.09)' },
  yellow: { main: '#EAB308', bg: 'rgba(234,179,8,0.09)' },
};
```

### 台形補正コーナー（Crop内一時データ）

```javascript
// corners 配列（IndexedDBには保存しない）
[
  { id: 'tl', x: number, y: number },  // 左上
  { id: 'tr', x: number, y: number },  // 右上
  { id: 'br', x: number, y: number },  // 右下
  { id: 'bl', x: number, y: number },  // 左下
]
// x, y はいずれも 0.0〜1.0（画像サイズに対する割合）
```

---

## 7. 主要アルゴリズム

### 7-1. 透視変換 (`utils/perspective.js`)

**目的：** 斜めから撮影した用紙を、正面から見たような正射影に変換する。

**数学的背景：**  
4点の対応 src → dst からホモグラフィ行列 H（3×3）を求め、ピクセル単位で変換する。

```
src (カメラ座標) ─── H ───▶ dst (正規化座標 [0,1]²)
```

Hの算出：8元連立一次方程式をガウス消去法で解く（線形ホモグラフィ推定）。

**実装：**

1. **WebGL（優先）**  
   - フルスクリーンクワッドに fragment shader を使用  
   - fragment shader 内で `gl_FragCoord` → 正規化座標 → H の逆行列で src 座標を計算 → テクスチャサンプリング  
   - GPU処理のため高速（大画像でも数十ms以内）

2. **ソフトウェアフォールバック**  
   - WebGL コンテキスト取得失敗時に自動切り替え  
   - 出力ピクセルごとに逆写像でバイリニア補間  
   - CPU処理のため大画像では数秒かかる場合がある

**出力制限：** 長辺最大 2400px（iOS Safari のメモリ制限を考慮）

**出力フォーマット：** `image/png`（ロスレス。再圧縮によるテキストのボケを防ぐため）

---

### 7-2. 用紙コーナー自動検出 (`utils/detectEdges.js`)

**目的：** 撮影画像から用紙（明るい矩形領域）の4頂点を自動検出し、ユーザーの手動調整を省く。

**アルゴリズム：**

```
入力画像
  ↓ 400px にダウンスケール（処理速度のため）
  ↓ グレースケール変換（0.299R + 0.587G + 0.114B）
  ↓ Otsu の二値化（背景の暗さと用紙の明るさを自動分離）
  ↓ 膨張処理（半径5px、O(n)スライディングウィンドウ分離2Dフィルタ）
    → 文字・罫線などの暗いピクセルを塗りつぶし、用紙領域を塗りつぶす
  ↓ 対角スコアによる4頂点抽出
    左上 = min(x + y)
    右上 = max(x - y)
    右下 = max(x + y)
    左下 = min(x - y)
  ↓ 妥当性チェック
    - 各コーナーが対応する象限内にある
    - 検出領域が画像の25%〜97%の範囲
  ↓ 分数座標（0〜1）に変換して返す
```

**Otsu の二値化：**  
ヒストグラムから2クラス間の分散を最大化する閾値を自動決定。閾値が30未満または225超の場合は検出断念（コントラスト不足）。

**失敗時の動作：** `null` を返し、デフォルトのコーナー位置（端から3%内側）を維持する。

---

### 7-3. PDF 取り込み (`utils/pdfImport.js`)

```
PDF ファイル
  ↓ pdfjs-dist: pdfjsLib.getDocument()
  ↓ ページごとに getPage(n)
  ↓ getViewport({ scale: 2.0 })   // 2倍スケールで高解像度
  ↓ Canvas に render
  ↓ canvas.toDataURL('image/jpeg', 0.92)
  ↓ rawPages 配列に追加
```

PDFJSのワーカーはVite の `?url` インポートで動的ロード。

---

### 7-4. PDF 書き出し (`utils/pdfExport.js`)

```
session.pages[i]
  ↓ オフスクリーンDOMを構築:
    <div style="position:relative; width:800px">
      <img src={imageData} />
      {boxes.map(box => 
        <div style="position:absolute; left:x%; top:y%; width:w%; height:h%">
          {box.text}
        </div>
      )}
    </div>
  ↓ html2canvas（scale:2）でCanvasにレンダリング
  ↓ canvas.toDataURL('image/jpeg', 0.92)
  ↓ jsPDF（A4縦向き、compress）に追加
  ↓ pdf.save('{name}_{YYYY-MM-DD}.pdf')
```

回答欄のスタイル：半透明の色付き背景、細い枠線、`word-break: break-all`。

---

### 7-5. 音声認識 (`hooks/useSpeech.js`)

**API：** Web Speech API（`SpeechRecognition` / `webkitSpeechRecognition`）  
**対応環境：** Chrome・Edge（Chromiumエンジン）。Safariは暫定対応。

```javascript
設定:
  lang = 'ja-JP'
  continuous = true       // 一度マイクを開いたら話し続けられる
  interimResults = true   // 認識中のテキストをリアルタイム表示
```

**音声コマンド変換（抜粋）：**

| 発話 | 変換後 |
|---|---|
| まる | 。 |
| てん | 、 |
| かいぎょう | \n（改行） |
| びっくりまーく | ！ |
| はてなまーく | ？ |

---

## 8. デザインシステム

### CSSカスタムプロパティ（デザイントークン）

```css
/* 背景・サーフェス */
--bg:          #F8F7F4    /* ページ背景（暖かいオフホワイト） */
--surface:     #FFFFFF    /* カード・ヘッダー・フッター */
--border:      #E2E0DC    /* 境界線 */

/* テキスト */
--text:        #1A1A1A    /* 本文（ほぼ黒） */
--text-muted:  #6B7280    /* 補足テキスト */

/* モードカラー */
--place:       #3B82F6    /* 配置モード（青） */
--place-bg:    rgba(59,130,246,0.08)
--answer:      #10B981    /* 解答モード（緑） */
--answer-bg:   rgba(16,185,129,0.08)
--edit:        #F59E0B    /* （予備・編集系）オレンジ */
--edit-bg:     rgba(245,158,11,0.08)
--danger:      #EF4444    /* 削除・警告（赤） */

/* 形状 */
--radius:      12px       /* 標準角丸 */
--radius-sm:   8px        /* 小サイズ角丸 */

/* タッチ */
--touch:       48px       /* タッチターゲット最小サイズ */

/* シャドウ */
--shadow:      0 2px 8px rgba(0,0,0,0.08)
--shadow-lg:   0 8px 24px rgba(0,0,0,0.12)

/* iOS Safe Area */
--safe-bottom: env(safe-area-inset-bottom)
--safe-top:    env(safe-area-inset-top)
```

### タイポグラフィ

```css
/* フォントスタック（日本語優先） */
font-family: -apple-system, 'Hiragino Kaku Gothic ProN',
             'Noto Sans JP', 'Hiragino Sans',
             'Yu Gothic', sans-serif;

/* 基本 */
font-size:   16px
line-height: 1.6（本文）、1.35（回答欄テキスト）

/* ウェイト */
font-weight: 600  /* ボタン */
font-weight: 700  /* 見出し */
```

### レイアウト

- **高さ：** `100dvh`（Dynamic Viewport Height）でアドレスバーを除いた全画面を確保
- **フレックスレイアウト：** 縦方向（ヘッダー固定 → スクロール可能コンテンツ → フッター固定）
- **Safe Area：** フッターに `max(Xpx, calc(Xpx + var(--safe-bottom)))` を適用

### ボタン種別

| クラス | 色・用途 |
|---|---|
| `.btn-green` | 緑 / 主アクション（次へ・確定） |
| `.btn-secondary` | グレー / 副アクション（もどる・そのまま） |
| `.btn-ghost` | 透明 / テキストリンク系ボタン |

### モーダル

- **セッション一覧：** 中央配置、最大高70vh、スクロール可
- **VoiceModal：** デスクトップ中央固定、モバイル下部ボトムシート（上部角丸20px）
- **削除確認：** 回答欄の上にインラインオーバーレイ（OS alertを使わない）

### アニメーション

- スピナー：CSSキーフレーム回転（ボタン内のローディング表示）
- お祝い演出：`◎ ぜんぶ こたえた！` オーバーレイ、2.5秒表示後自動消去
- VoiceModal：ドラッグ・ドロップ（デスクトップ）

---

## 9. ファイル構成

```
hikobae/
├── index.html               # アプリエントリーポイント（#root マウント）
├── vite.config.js           # Vite設定（pdfjs-distの最適化除外など）
├── package.json             # 依存関係・スクリプト
├── public/
│   └── lp.html              # 静的ランディングページ（マーケティング用）
├── src/
│   ├── main.jsx             # React エントリー（StrictMode + CSS インポート）
│   ├── App.jsx              # SPAルーター・セッション状態
│   ├── pages/
│   │   ├── Home.jsx         # ホーム画面
│   │   ├── Import.jsx       # ファイル取り込み
│   │   ├── Crop.jsx         # 台形補正
│   │   ├── Answer.jsx       # 回答作業
│   │   ├── Confirm.jsx      # 確認・PDF書き出し
│   │   └── About.jsx        # アプリ説明
│   ├── components/
│   │   ├── ModeBar.jsx      # 配置/解答モード切り替え
│   │   ├── AnswerBox.jsx    # 回答欄コンポーネント
│   │   └── VoiceModal.jsx   # 音声入力モーダル
│   ├── hooks/
│   │   └── useSpeech.js     # Web Speech API カスタムフック
│   ├── utils/
│   │   ├── db.js            # IndexedDB 操作
│   │   ├── perspective.js   # 透視変換（WebGL/ソフトウェア）
│   │   ├── detectEdges.js   # 用紙コーナー自動検出
│   │   ├── pdfImport.js     # PDF→画像変換
│   │   └── pdfExport.js     # 回答付きPDF生成
│   └── styles/
│       └── app.css          # 全スタイル定義
└── docs/
    └── specification.md     # 本ドキュメント
```

---

## 10. 非機能要件

### パフォーマンス

| 処理 | 目標 | 手段 |
|---|---|---|
| エッジ検出 | < 50ms | 400pxダウンスケール、O(n)膨張処理 |
| 透視変換 | < 200ms | WebGL GPU処理 |
| PDF取り込み（1ページ） | < 3s | 2× スケールで canvas 変換 |
| PDF書き出し（1ページ） | < 5s | html2canvas 2× スケール |
| IndexedDB 保存 | 非同期 | 800ms デバウンス、UIをブロックしない |

### ストレージ

- IndexedDB に画像を DataURL で保存するため、1セッションあたり数MB〜数十MB
- ブラウザの割り当て上限（通常50MB〜数GB）に依存
- 画像の圧縮は JPEG 92% / PNG（透視変換後のみ）

### ブラウザ対応

| 機能 | 対応ブラウザ |
|---|---|
| 基本動作 | Chrome, Edge, Safari, Firefox（最新版） |
| 音声認識 | Chrome, Edge（Chromiumベース） |
| WebGL透視変換 | Chrome, Edge, Safari, Firefox |
| ソフトウェアフォールバック | 全モダンブラウザ |

### メモリ制限への対応

- **iOS Safari の Canvas メモリ制限：** 透視変換の出力を最大2400×2400pxに制限
- 大きなPDFを取り込む場合、ページ分割処理で一度に大量の DataURL をメモリに持たないよう配慮

### セキュリティ

- **DOMPurify** は VoiceModal での HTML レンダリングに使用
- XSS 対策：`innerHTML` を使う箇所では DOMPurify でサニタイズ
- 外部URLへのリンクはすべて `target="_blank" rel="noopener noreferrer"`

---

## 付記：今後の検討事項

- **Service Worker / PWA化：** オフラインキャッシュ、ホーム画面追加
- **ページ並べ替え：** Import 画面でのドラッグ並べ替え
- **複数デバイス同期：** Firebase 等（プライバシー方針の見直しが必要）
- **Canny エッジ検出：** 傾いた用紙への対応強化（現状は Otsu + 対角スコア）
- **回答テンプレート：** よく使う回答欄配置を保存・再利用
- **アクセシビリティ監査：** WCAG 2.1 AA 準拠の確認

---

*開発：ウィアー合同会社 / [we-re.net](https://www.we-re.net/) / info@we-re.net*  
*不具合報告：[GitHub Issues](https://github.com/we-are-llc/hikobae/issues/new)*
