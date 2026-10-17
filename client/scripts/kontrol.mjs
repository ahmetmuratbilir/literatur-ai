#!/usr/bin/env node
// Uygulama kontrolü: canlıya çıkmadan önce her şeyi tek komutla çalıştırır ve
// okunabilir bir rapor yazar.  Çalıştırma:  npm run kontrol  (client klasöründe)
//
// Aşamalar: git durumu (main'e düz ileri alınabilir mi) → istemci birim testleri
// → lint → build → sunucu testleri → bütün e2e (kabul yolculuğu dahil).
// Bir aşama kalsa da diğerleri çalışır; çıkış kodu, kalan varsa 1.
// Rapor: client/kontrol-raporu/index.html (+ ekran/ altında kabul yolculuğunun
// ekran görüntüleri ve indirilen DOCX). Sonuç uydurulmaz: her sayı komut
// çıktısından okunur; okunamazsa "okunamadı" yazılır.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(CLIENT, '..');
const SERVER = path.join(ROOT, 'server');
const OUT = path.join(CLIENT, 'kontrol-raporu');
const SHOTS = path.join(OUT, 'ekran');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

const run = (cmd, cwd, env = {}) => {
  const t0 = Date.now();
  const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0', ...env }, maxBuffer: 256 * 1024 * 1024 });
  // Renk kodları ayıklanır: araçlar FORCE_COLOR=0'a rağmen bazen boyar (vite build).
  const out = `${r.stdout || ''}${r.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, '');
  return { code: r.status ?? 1, out, ms: Date.now() - t0 };
};
const num = (re, s) => { const m = s.match(re); return m ? Number(m[1]) : null; };
const tail = (s, n = 25) => s.trim().split('\n').slice(-n).join('\n');
const stages = [];
const stage = (name, fn) => {
  process.stdout.write(`… ${name}\n`);
  const s = { name, ...fn() };
  stages.push(s);
  process.stdout.write(`${s.ok ? '✓' : '✗'} ${name} — ${s.summary} (${Math.round(s.ms / 1000)} sn)\n`);
};

// 1. Git
stage('Git: dal ve main durumu', () => {
  const t0 = Date.now();
  const g = (c) => run(`git ${c}`, ROOT).out.trim();
  run('git fetch -q origin', ROOT);
  const branch = g('branch --show-current'), head = g('rev-parse --short HEAD'), main = g('rev-parse --short origin/main');
  const ff = run('git merge-base --is-ancestor origin/main HEAD', ROOT).code === 0;
  const ahead = g('rev-list --count origin/main..HEAD'), behind = g('rev-list --count HEAD..origin/main');
  const dirty = g('status --porcelain').split('\n').filter(Boolean).length;
  return {
    ok: ff,
    summary: `${branch} @ ${head}; main ${main}; ${ahead} commit önde, ${behind} geride; ${ff ? 'main düz ileri alınabilir' : 'main ayrışmış — birleştirme gerekir'}${dirty ? `; ${dirty} commit edilmemiş dosya` : ''}`,
    ms: Date.now() - t0,
    detail: { branch, head, main, ahead, behind, dirty, ff },
  };
});

// 2. İstemci birim testleri
stage('İstemci birim testleri', () => {
  const r = run('npm test', CLIENT);
  const pass = num(/ℹ pass (\d+)/, r.out), fail = num(/ℹ fail (\d+)/, r.out);
  return { ok: r.code === 0, summary: pass === null ? 'sayı okunamadı' : `${pass} geçti, ${fail} kaldı`, ms: r.ms, log: r.code ? tail(r.out) : '' };
});

// 3. Lint
stage('Lint (eslint)', () => {
  const r = run('npm run lint', CLIENT);
  const problems = num(/(\d+) problems?/, r.out);
  return { ok: r.code === 0, summary: r.code === 0 ? 'temiz' : `${problems ?? '?'} sorun`, ms: r.ms, log: r.code ? tail(r.out) : '' };
});

// 4. Build
stage('Build (vite)', () => {
  const r = run('npm run build', CLIENT);
  const main = r.out.match(/assets\/index-[\w-]+\.js\s+([\d.,]+ kB)/);
  return { ok: r.code === 0, summary: r.code === 0 ? `geçti; ana paket ${main ? main[1] : 'boyutu okunamadı'}` : 'kaldı', ms: r.ms, log: r.code ? tail(r.out) : '' };
});

// 5. Sunucu testleri
stage('Sunucu testleri', () => {
  const r = run('npm test', SERVER);
  const pass = num(/ℹ pass (\d+)/, r.out), fail = num(/ℹ fail (\d+)/, r.out);
  return { ok: r.code === 0, summary: pass === null ? 'sayı okunamadı' : `${pass} geçti, ${fail} kaldı`, ms: r.ms, log: r.code ? tail(r.out) : '' };
});

// 6. E2E (kabul yolculuğu dahil)
let journey = [];
stage('Uçtan uca testler (Playwright, kabul yolculuğu dahil)', () => {
  const json = path.join(OUT, 'e2e.json');
  const r = run('npx playwright test --reporter=json', CLIENT, { PLAYWRIGHT_JSON_OUTPUT_NAME: json, KONTROL_OUT: SHOTS });
  let rep = null;
  try { rep = JSON.parse(fs.readFileSync(json, 'utf8')); } catch { /* aşağıda okunamadı */ }
  if (!rep) return { ok: false, summary: 'rapor okunamadı', ms: r.ms, log: tail(r.out) };
  const fails = [];
  const walk = (suite, file) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const res = t.results?.[t.results.length - 1];
        if (t.status === 'unexpected' || t.status === 'flaky') fails.push(`${t.status === 'flaky' ? '[kararsız] ' : ''}${file} › ${spec.title}: ${(res?.error?.message || '').split('\n')[0].slice(0, 200)}`);
        if (spec.file?.endsWith('kabul.spec.js') || file.endsWith('kabul.spec.js')) {
          journey = (res?.steps || []).filter((s) => /^(\d|Genel)/.test(s.title)).map((s) => ({ title: s.title, ok: !s.error, error: s.error?.message?.split('\n')[0] }));
        }
      }
    }
    for (const sub of suite.suites || []) walk(sub, sub.file || file);
  };
  for (const s of rep.suites || []) walk(s, s.file || '');
  const st = rep.stats || {};
  return {
    ok: (st.unexpected || 0) === 0,
    summary: `${st.expected ?? '?'} geçti, ${st.unexpected ?? '?'} kaldı, ${st.skipped ?? 0} atlandı${st.flaky ? `, ${st.flaky} kararsız` : ''}`,
    ms: r.ms,
    log: fails.join('\n'),
  };
});

// Rapor
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const allOk = stages.every((s) => s.ok);
const shots = fs.readdirSync(SHOTS).filter((f) => f.endsWith('.png')).sort();
const when = new Date().toLocaleString('tr-TR');
const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kontrol raporu</title><style>
:root{--ink:#1a1d2e;--muted:#5f6478;--line:#e6e8f2;--ok:#166534;--okbg:#e8f5ec;--bad:#b91c1c;--badbg:#fcebeb;--bg:#f5f6fb}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,'Segoe UI',sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 60px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px}
.big{display:inline-block;font-weight:700;border-radius:10px;padding:8px 14px;margin:10px 0}.big.ok{background:var(--okbg);color:var(--ok)}.big.bad{background:var(--badbg);color:var(--bad)}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
td,th{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#fafafd;font-size:13px;color:var(--muted)}
.ok{color:var(--ok);font-weight:700}.bad{color:var(--bad);font-weight:700}pre{white-space:pre-wrap;font-size:12px;background:#1f2340;color:#e6e4ff;border-radius:8px;padding:10px;margin:8px 0 0}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:14px}figure{margin:0;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px}
figure img{width:100%;display:block;border-radius:6px}figcaption{font-size:13px;color:var(--muted);padding-top:6px}.muted{color:var(--muted);font-size:13px}
</style></head><body><main>
<h1>Kontrol raporu</h1><div class="muted">${esc(when)} · ${esc(stages[0]?.detail?.branch)} @ ${esc(stages[0]?.detail?.head)}</div>
<div class="big ${allOk ? 'ok' : 'bad'}">${allOk ? '✓ Bütün kontroller geçti' : '✗ Kalan kontrol var — aşağıda'}</div>
<h2>Aşamalar</h2><table><tr><th>Aşama</th><th>Sonuç</th><th>Süre</th></tr>
${stages.map((s) => `<tr><td>${esc(s.name)}</td><td><span class="${s.ok ? 'ok' : 'bad'}">${s.ok ? '✓' : '✗'}</span> ${esc(s.summary)}${s.log ? `<pre>${esc(s.log)}</pre>` : ''}</td><td>${Math.round(s.ms / 1000)} sn</td></tr>`).join('')}
</table>
<h2>Kabul yolculuğu (elle kontrol listesinin otomatik hali)</h2>
${journey.length ? `<table><tr><th>Adım</th><th>Sonuç</th></tr>${journey.map((j) => `<tr><td>${esc(j.title)}</td><td><span class="${j.ok ? 'ok' : 'bad'}">${j.ok ? '✓ geçti' : '✗ kaldı'}</span>${j.error ? `<pre>${esc(j.error)}</pre>` : ''}</td></tr>`).join('')}</table>` : '<p class="bad">Kabul yolculuğu sonucu okunamadı.</p>'}
<h2>Ekran görüntüleri</h2><div class="shots">${shots.map((f) => `<figure><a href="ekran/${encodeURI(f)}"><img src="ekran/${encodeURI(f)}" alt="${esc(f)}"></a><figcaption>${esc(f.replace(/\.png$/, ''))}</figcaption></figure>`).join('') || '<p class="muted">Ekran görüntüsü yok.</p>'}</div>
${fs.existsSync(path.join(SHOTS, 'kabul.docx')) ? '<p class="muted">Yolculukta indirilen Word dosyası: <a href="ekran/kabul.docx">ekran/kabul.docx</a> — Word ya da LibreOffice ile açıp bak.</p>' : ''}
<h2>Bu rapor neyi kanıtlamaz</h2><p class="muted">E2E testleri sahte sunucuyla çalışır (gerçek kaynak API'leri çağrılmaz); görsel kalite ve "kullanınca nasıl hissettiriyor" otomatik ölçülmez.
Bu yüzden son kontrol insanın: ekran görüntülerine ve uygulamaya bak.</p>
</main></body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
process.stdout.write(`\n${allOk ? '✓ Bütün kontroller geçti' : '✗ Kalan kontrol var'} — rapor: ${path.join(OUT, 'index.html')}\n`);
process.exit(allOk ? 0 : 1);
