import test from 'node:test';
import assert from 'node:assert/strict';

import { MIN_EXPECTED } from '../services/sourceCanary.js';
import { findDeadEnvVars } from '../services/keyHealthService.js';

// Bu testler AG ISTEGI ATMAZ. Amac sozlesmeyi korumak:
// eski sagl1k kontrolu HTTP 200'u kosulsuz 'ok' sayiyordu ve hem OpenCitations'in
// 400'unu hem DOAJ'in sifirini kacirdi. Regresyon korumasi buraya yazildi.

test('her akademik kaynak icin bir asgari sonuc esigi tanimli', () => {
  const beklenen = ['OpenAlex', 'Crossref', 'DOAJ', 'arXiv', 'Semantic Scholar', 'CORE', 'OpenCitations',
    'OpenAlex (AI sorgusu)', 'DOAJ (AI sorgusu)'];
  for (const service of beklenen) {
    assert.ok(
      Number.isInteger(MIN_EXPECTED[service]) && MIN_EXPECTED[service] >= 1,
      `${service} icin esik tanimli ve >= 1 olmali — esik yoksa 0 sonuc 'ok' sayilir`
    );
  }
});

test('esikler olculen degerlerin cok altinda tutulmus', () => {
  // arXiv tirnakli ifadeyle 9 havuz donduruyor; esik 9'a yakin olursa kaynak
  // saglikli oldugu halde alarm ureten kirilgan bir test olur.
  assert.ok(MIN_EXPECTED.arXiv <= 3, 'arXiv esigi dar havuza gore toleransli olmali');
  assert.ok(MIN_EXPECTED.DOAJ <= 5, 'DOAJ havuzu 68; esik bunun cok altinda olmali');
});

test('sourceCanary elle URL kurmuyor, uretim fonksiyonlarini iceri aliyor', async () => {
  const fs = await import('node:fs');
  const url = new URL('../services/sourceCanary.js', import.meta.url);
  const src = fs.readFileSync(url, 'utf8');

  // Asil regresyon: panel ile uretim ayni kodu paylasmazsa panel hicbir sey
  // kanitlamaz. Yorumlar disinda http URL'si olmamali.
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
    .join('\n');
  assert.ok(!/https?:\/\//.test(codeOnly), 'canary modulu elle URL kurmamali');

  for (const fn of ['searchOpenAlex', 'searchDOAJ', 'searchArXiv', 'enrichWithCitations']) {
    assert.ok(src.includes(fn), `${fn} uretim fonksiyonu cagrilmali`);
  }
});

test('OPENALEX_API_KEY artik olu degisken sayilmaz (istege ekleniyor)', async () => {
  // Onceki surumde okunup gonderilmiyordu; simdi gonderiliyor ve gecerliligi
  // canary yoklamasinda (401 -> invalid_key) olculuyor.
  assert.deepEqual(findDeadEnvVars({ OPENALEX_API_KEY: 'herhangi-bir-deger' }), []);

  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../services/openalex.js', import.meta.url), 'utf8');
  assert.match(src, /urlParams\.set\('api_key', apiKey\)/, 'anahtar istege eklenmeli');
});

test('uyarilar anahtar degerini sizdirmaz', () => {
  const warnings = findDeadEnvVars({ SCOPUS_ENABLED: 'true', OPENALEX_API_KEY: 'gizli-deger-123' });
  assert.ok(!JSON.stringify(warnings).includes('gizli-deger-123'));
});

test('anahtarsiz SCOPUS_ENABLED=true uyari uretir', () => {
  const warnings = findDeadEnvVars({ SCOPUS_ENABLED: 'true' });
  assert.ok(warnings.some((w) => w.name === 'SCOPUS_ENABLED'));
});

test('temiz ortamda uyari yok', () => {
  assert.deepEqual(findDeadEnvVars({ SCOPUS_ENABLED: 'false', OPENALEX_MAIL: 'a@b.com' }), []);
});
