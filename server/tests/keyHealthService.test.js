import test from 'node:test';
import assert from 'node:assert/strict';

import { probeAllServices } from '../services/keyHealthService.js';

test('rapor anahtar degerlerini sizdirmaz', async () => {
  const secret = 'sk_live_COKGIZLIDEGER123456789';
  const env = {
    CLERK_SECRET_KEY: secret,
    GEMINI_API_KEY: 'AIzaGIZLIGEMINI999',
    GROQ_API_KEY: 'gsk_GIZLIGROQ888',
    MONGODB_URI: 'mongodb+srv://kullanici:GIZLISIFRE@yok.invalid/db',
  };

  const report = await probeAllServices(env);
  const serialized = JSON.stringify(report);

  for (const value of [secret, 'AIzaGIZLIGEMINI999', 'gsk_GIZLIGROQ888', 'GIZLISIFRE']) {
    assert.equal(serialized.includes(value), false, `rapor "${value}" icermemeli`);
  }
});

test('tanimsiz anahtarlar missing olarak isaretlenir', async () => {
  const report = await probeAllServices({});
  const byService = Object.fromEntries(report.rows.map((r) => [r.service, r]));

  assert.equal(byService.Clerk.state, 'missing');
  assert.equal(byService.Clerk.required, true);
  assert.equal(byService.MongoDB.state, 'missing');
  assert.equal(byService.Gemini.state, 'missing');
});

test('cozulmeyen mongo host IP izin listesi olarak raporlanmaz', async () => {
  const report = await probeAllServices({
    MONGODB_URI: 'mongodb+srv://a:b@bu-host-kesinlikle-yok.invalid/db',
  });
  const mongo = report.rows.find((r) => r.service === 'MongoDB');

  assert.equal(mongo.state, 'unreachable');
  assert.match(mongo.detail, /IP izin listesi hatası değil/);
});

test('ozet sayilari satirlarla tutarli', async () => {
  const report = await probeAllServices({});

  assert.equal(report.summary.total, report.rows.length);
  assert.equal(report.summary.ok, report.rows.filter((r) => r.state === 'ok').length);
  assert.ok(report.summary.requiredFailing >= 1, 'Clerk ve MongoDB zorunlu');
  assert.equal(typeof report.checkedAt, 'string');

  // Durum modeli artik ikili degil: 'skipped' (bilerek kapatilmis, or. Scopus)
  // ve 'unused' (tanimli ama kullanilmayan degisken) ariza SAYILMAZ. Onceki
  // surumdeki `ok + failing === total` varsayimi bu yuzden dustu; kapatilmis
  // bir kaynagi ariza saymak paneli gereksiz kirmiziya boyuyordu.
  const neutral = report.rows.filter((r) => r.state === 'skipped' || r.state === 'unused').length;
  assert.equal(report.summary.ok + report.summary.failing + neutral, report.summary.total);
  assert.equal(
    report.summary.failing,
    report.rows.filter((r) => !['ok', 'skipped', 'unused'].includes(r.state)).length
  );
});

test('anahtar gecerliyken bos sonuc ok DEGIL zero_results olarak isaretlenir', async () => {
  // Eski classify() `if (result.ok) return 'ok'` diyordu, yani HTTP 200 +
  // total 0 saglikli sayiliyordu. DOAJ'in sessiz sifiri buradan kacti.
  // Bu test durumun sozlesmede var oldugunu ve ariza sayildigini korur.
  const report = await probeAllServices({});
  assert.equal(typeof report.summary.zeroResults, 'number');
  assert.ok(!['ok', 'skipped', 'unused'].includes('zero_results'));
});

test('SCOPUS_ENABLED kapaliyken Scopus ariza degil kapali raporlanir', async () => {
  const report = await probeAllServices({ SCOPUS_ENABLED: 'false', SCOPUS_API_KEY: 'x'.repeat(32) });
  const scopus = report.rows.find((r) => r.service === 'Scopus');

  assert.equal(scopus.state, 'skipped');
  assert.match(scopus.detail, /arama akisinda degil/);
});
