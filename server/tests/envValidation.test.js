import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inspectEnvValue,
  isPlaceholderValue,
  validateEnvironment,
  formatEnvReport,
} from '../config/envValidation.js';

test('.env.example sablon metinleri yer tutucu olarak taninir', () => {
  // Bunlarin hepsi projenin kendi .env.example dosyasindan birebir alindi.
  const placeholders = [
    'your_groq_api_key_here',
    'your_core_api_key_here',
    'your_elsevier_scopus_api_key_here',
    'your_semantic_scholar_key_here',
    'your_gemini_api_key_here',
    'mongodb+srv://username:password@cluster.mongodb.net/literature-ai',
    'research-contact@example.com',
    '<your-key>',
    'changeme',
  ];

  for (const value of placeholders) {
    assert.equal(isPlaceholderValue(value), true, `"${value}" yer tutucu sayilmali`);
  }
});

test('gercek gorunumlu degerler yer tutucu sayilmaz', () => {
  const realistic = [
    'sk_test_a1b2c3d4e5f6a7b8c9d0',
    'gsk_QWERTYuiop1234567890',
    'mongodb+srv://appuser:s3cret@prod-shard.ab12c.mongodb.net/literature-ai',
    'arastirma@universite.edu.tr',
  ];

  for (const value of realistic) {
    assert.equal(isPlaceholderValue(value), false, `"${value}" gecerli sayilmali`);
  }
});

test('inspectEnvValue dort durumu ayirt eder', () => {
  assert.equal(inspectEnvValue('CORE_API_KEY', '').state, 'missing');
  assert.equal(inspectEnvValue('CORE_API_KEY', '   ').state, 'missing');
  assert.equal(inspectEnvValue('CORE_API_KEY', undefined).state, 'missing');

  assert.equal(inspectEnvValue('CORE_API_KEY', 'your_core_api_key_here').state, 'placeholder');

  // Bicim kontrolu: Groq anahtarlari gsk_ ile baslar.
  assert.equal(inspectEnvValue('GROQ_API_KEY', 'abcdef123456').state, 'malformed');
  assert.equal(inspectEnvValue('GROQ_API_KEY', 'gsk_abcdef123456').state, 'configured');

  assert.equal(inspectEnvValue('CLERK_SECRET_KEY', 'sk_test_abc').state, 'configured');
  assert.equal(inspectEnvValue('CLERK_SECRET_KEY', 'pk_test_abc').state, 'malformed');
});

test('durum raporu hicbir kosulda degeri sizdirmaz', () => {
  const secret = 'sk_live_COKGIZLIDEGER1234567890';
  const inspection = inspectEnvValue('CLERK_SECRET_KEY', secret);

  assert.equal(JSON.stringify(inspection).includes(secret), false);

  const result = validateEnvironment({ CLERK_SECRET_KEY: secret, GROQ_API_KEY: 'gsk_GIZLI999' });
  const serialized = JSON.stringify(result) + formatEnvReport(result);

  assert.equal(serialized.includes(secret), false, 'rapor gizli degeri icermemeli');
  assert.equal(serialized.includes('gsk_GIZLI999'), false);
});

test('yer tutucuyla dolu .env hata uretir, bos .env ile ayni sonucu vermez', () => {
  // Projenin gercek .env durumu: sablon kopyalanmis, yalnizca Gemini gercek.
  const placeholderEnv = validateEnvironment({
    MONGODB_URI: 'mongodb+srv://username:password@cluster.mongodb.net/literature-ai',
    GEMINI_API_KEY: 'AIzaGercekGorunumluDeger123456',
    GROQ_API_KEY: 'your_groq_api_key_here',
    CORE_API_KEY: 'your_core_api_key_here',
    SCOPUS_API_KEY: 'your_elsevier_scopus_api_key_here',
  });

  assert.equal(placeholderEnv.report.MONGODB_URI.state, 'placeholder');
  assert.equal(placeholderEnv.report.GROQ_API_KEY.state, 'placeholder');
  assert.equal(placeholderEnv.report.CORE_API_KEY.state, 'placeholder');
  assert.equal(placeholderEnv.report.GEMINI_API_KEY.state, 'configured');

  // MONGODB_URI ve CLERK_SECRET_KEY zorunlu.
  assert.ok(placeholderEnv.errors.length >= 2, 'zorunlu degiskenler hata uretmeli');
  assert.ok(placeholderEnv.errors.some((e) => e.startsWith('MONGODB_URI')));
  assert.ok(placeholderEnv.errors.some((e) => e.startsWith('CLERK_SECRET_KEY')));
});

test('alternatif degisken adi kabul edilir', () => {
  const withAlias = validateEnvironment({ ELSEVIER_API_KEY: 'gercek-elsevier-anahtari-123' });
  assert.equal(withAlias.report.SCOPUS_API_KEY.state, 'configured');

  const withPrimary = validateEnvironment({ SCOPUS_API_KEY: 'gercek-scopus-anahtari-123' });
  assert.equal(withPrimary.report.SCOPUS_API_KEY.state, 'configured');
});

test('tam gecerli ortam hata uretmez', () => {
  const result = validateEnvironment({
    MONGODB_URI: 'mongodb+srv://appuser:pass@prod-shard.ab12c.mongodb.net/db',
    CLERK_SECRET_KEY: 'sk_test_abcdef',
    GEMINI_API_KEY: 'AIzaGercekDeger',
    GROQ_API_KEY: 'gsk_gercekdeger',
    SCOPUS_API_KEY: 'gercek-scopus',
    CORE_API_KEY: 'gercek-core',
    SEMANTIC_SCHOLAR_API_KEY: 'gercek-s2',
    OPENALEX_MAIL: 'arastirma@universite.edu.tr',
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.match(formatEnvReport(result), /geçerli görünüyor/);
});
