export default function About({ onNavigate }) {
  return (
    <div className="about-page">
      <div className="about-header">
        <button className="btn-ghost" onClick={() => onNavigate('home')}>
          ← もどる
        </button>
        <h1>このアプリについて</h1>
      </div>

      <div className="about-body">

        <section className="about-section">
          <h2>ひこばえ とは</h2>
          <p>
            書くことが難しいお子さんが、テストや宿題の問題を<strong>音声で答えられる</strong>ようにするアプリです。
          </p>
          <p>
            スマートフォンやタブレットで問題用紙を撮影し、回答欄を指でなぞって作成するだけで使えます。
            答えは音声入力（マイク）で行い、PDF として書き出すことができます。
          </p>
        </section>

        <section className="about-section">
          <h2>つかいかた</h2>
          <ol className="about-steps">
            <li>
              <span className="about-step-num">1</span>
              <div>
                <strong>とりこむ</strong>
                <p>問題用紙の写真（JPEG・PNG）またはPDFを選ぶ</p>
              </div>
            </li>
            <li>
              <span className="about-step-num">2</span>
              <div>
                <strong>台形補正</strong>
                <p>4つの●を用紙の角に合わせて「きりとる」を押す</p>
              </div>
            </li>
            <li>
              <span className="about-step-num">3</span>
              <div>
                <strong>回答欄をつくる</strong>
                <p>「配置」モードで画面をタップして回答欄を置く</p>
              </div>
            </li>
            <li>
              <span className="about-step-num">4</span>
              <div>
                <strong>音声で答える</strong>
                <p>「解答」モードで回答欄をタップしてマイクに話しかける</p>
              </div>
            </li>
            <li>
              <span className="about-step-num">5</span>
              <div>
                <strong>PDF で書き出す</strong>
                <p>完了したら「かくにんする」→「PDFをつくる」で保存</p>
              </div>
            </li>
          </ol>
          <p style={{ marginTop: 16 }}>
            <a
              href="https://hikobae.we-re.net/manual.html"
              target="_blank"
              rel="noopener noreferrer"
              className="about-link"
            >
              くわしいマニュアルを見る →
            </a>
          </p>
        </section>

        <section className="about-section">
          <h2>プライバシーについて</h2>
          <p>
            このアプリは<strong>完全にオフラインで動作</strong>します。
            取り込んだ画像・回答データはすべてこの端末の中（ブラウザのデータベース）にのみ保存され、
            外部のサーバーへ送信されることは一切ありません。
          </p>
          <p>
            アプリをアンインストールするか、ブラウザのデータを消去すると、保存したデータもすべて削除されます。
          </p>
        </section>

        <section className="about-section">
          <h2>更新履歴</h2>
          <div className="about-changelog">
            <div className="about-changelog-entry">
              <div className="about-changelog-date">2026-07-10</div>
              <ul className="about-changelog-list">
                <li>写真を使わず白紙（ホワイトボード・A4縦）から手書きを始められるモードを追加</li>
              </ul>
            </div>
            <div className="about-changelog-entry">
              <div className="about-changelog-date">2026-07-09</div>
              <ul className="about-changelog-list">
                <li>フリーハンドで手書き・作図ができる「かく」モードを追加（指・スタイラス対応、太さ3段階、PDFにも反映）</li>
                <li>手書きに色パレット（5色）と消しゴム（線ごとに消せる）を追加</li>
                <li>回答欄がある状態で「かく」に切り替えると画面が真っ白になる不具合を修正</li>
                <li>PDF保存時に回答欄の文字が大きすぎて見切れる不具合を修正（画面表示とPDFの文字サイズを一致）</li>
                <li>「ぜんぶこたえた」の演出を「こたえる」モードのときだけ出すように変更</li>
                <li>きりとり画面・かいとう画面のズームを2本指ピンチ操作に対応</li>
                <li>入力欄の作成時に、入力欄の背景と番号を透明化して背景の問題用紙を読みやすく改善</li>
                <li>ズームボタンを普段は非表示にし、画面をさわると表示・数秒で自動的に隠れるように改善（背景に集中しやすく）</li>
              </ul>
            </div>
            <div className="about-changelog-entry">
              <div className="about-changelog-date">2026-07-07</div>
              <ul className="about-changelog-list">
                <li>ホーム画面に追加してオフラインでも起動・利用できるように対応（PWA化）</li>
              </ul>
            </div>
            <div className="about-changelog-entry">
              <div className="about-changelog-date">2026-07-02</div>
              <ul className="about-changelog-list">
                <li>よみとり範囲の切り取りハンドルを手動で左端・右端まで動かせるように改善</li>
                <li>きりとり画面・かいとう画面に拡大／縮小（ズーム）ボタンを追加</li>
                <li>取込後に「しあげ調整」を追加：文字くっきり・オート・しろくろのプリセットと、あかるさ／コントラスト／くっきり（アンシャープ）の微調整で読みやすさを改善</li>
              </ul>
            </div>
            <div className="about-changelog-entry">
              <div className="about-changelog-date">2026-07-01</div>
              <ul className="about-changelog-list">
                <li>確認画面（かくにん・しゅつりょく）のスクロールが効かなかった不具合を修正</li>
                <li>読み上げ中の回答欄をハイライト表示・自動スクロールする機能を追加</li>
                <li>未回答欄がある場合に読み上げ番号が画面表示とズレていた不具合を修正</li>
                <li>音声入力でゆっくり話すと文字が重複入力される不具合を修正</li>
              </ul>
            </div>
            <div className="about-changelog-entry">
              <div className="about-changelog-date">2026-06-24</div>
              <ul className="about-changelog-list">
                <li>複数ページの読み上げで、ページをまたぐと番号がリセットされなかった不具合を修正</li>
                <li>PDF保存で画像の下部が切れていた不具合を修正</li>
              </ul>
            </div>
            <div className="about-changelog-entry">
              <div className="about-changelog-date">2026-06-23</div>
              <ul className="about-changelog-list">
                <li>台形補正で用紙のかどを自動検出する機能を追加</li>
                <li>台形補正画面に画像回転ボタンを追加</li>
                <li>回答欄の操作を元に戻す「もどす」機能を追加</li>
                <li>削除確認をアプリ内ダイアログに変更（OS標準のアラートを廃止）</li>
                <li>音声入力画面を半透明化・デスクトップでのドラッグ移動に対応</li>
                <li>回答欄の色・文字サイズ変更機能を追加</li>
                <li>確認画面に全回答の読み上げ機能を追加</li>
                <li>ホーム画面に不具合報告リンクを追加</li>
              </ul>
            </div>
            <div className="about-changelog-entry">
              <div className="about-changelog-date">2026-06-22</div>
              <ul className="about-changelog-list">
                <li>β版公開</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="about-section">
          <h2>お問い合わせ</h2>
          <p>開発：ウィアー合同会社 <a href="https://www.we-re.net/" target="_blank" rel="noopener noreferrer">we-re.net</a></p>
          <p>
            お問い合わせ：
            <a href="mailto:info@we-re.net" className="about-link">
              info@we-re.net
            </a>
          </p>
          <p className="about-muted">
            ご意見・バグ報告・改善提案など、お気軽にどうぞ。
          </p>
        </section>

      </div>
    </div>
  );
}
