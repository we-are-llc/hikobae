// ビルド後に dist/sw.js へ、ハッシュ付きアセット一覧（precache リスト）と
// ビルドIDを注入する。これにより、初回オンライン閲覧の直後から
// オフライン起動できる（Service Worker が制御権を取る前に読み込まれる
// エントリJS/CSS も確実にキャッシュされる）。
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DIST = path.resolve('dist');
const SW = path.join(DIST, 'sw.js');

if (!fs.existsSync(SW)) {
  console.error('[inject-sw] dist/sw.js が見つかりません。先に vite build を実行してください。');
  process.exit(1);
}

// dist 配下を走査し、precache 対象のURLを集める。
// 対象：JS / CSS / mjs / wasm（アプリ動作に必要なアセット）。
// HTML・画像・manifest は sw.js の CORE 側で扱うため除外。
const exts = new Set(['.js', '.mjs', '.css', '.wasm']);
const urls = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (exts.has(path.extname(entry.name))) {
      // sw.js 自身は除外
      if (path.relative(DIST, full) === 'sw.js') continue;
      const url = '/' + path.relative(DIST, full).split(path.sep).join('/');
      urls.push(url);
    }
  }
}
walk(DIST);
urls.sort();

// ビルドID＝全アセットのパス（内容ハッシュを含む）から生成。内容が変われば変化する。
const buildId = crypto.createHash('sha1').update(urls.join('|')).digest('hex').slice(0, 12);

let sw = fs.readFileSync(SW, 'utf8');
sw = sw.replace(/const BUILD_ID = '[^']*';/, `const BUILD_ID = '${buildId}';`);
sw = sw.replace(/const PRECACHE = \[\];/, `const PRECACHE = ${JSON.stringify(urls)};`);
fs.writeFileSync(SW, sw);

console.log(`[inject-sw] BUILD_ID=${buildId}, precache ${urls.length} 件を注入しました。`);
