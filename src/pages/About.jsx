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
