// .env.example ile kodun varsayilanlari ayni mi?
//
// CLAUDE.md 3.12: bayragin kod varsayilani ile ornek dosyadaki deger
// celisirse, ornek dosyaya guvenen kisi yanlis yapilandirmayla canliya cikar.
// Bu test iki yonlu kilit: (a) her WRITER_* anahtari ornek dosyada var,
// (b) ornek dosyadaki deger kodun varsayilaniyla ayni.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = join(HERE, '..', '.env.example');

const ENV_KEYS = [
  'WRITER_POSTCHECK_ENABLED',
  'WRITER_CITATION_CHECK_ENABLED',
  'WRITER_QUALITY_CHECK_ENABLED',
  'WRITER_REVISION_COACH_ENABLED',
  'WRITER_GATE_MODE',
];

/** .env.example icindeki ANAHTAR=deger satirlarini sozluge cevirir. */
function readExample(text) {
  const values = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at <= 0) continue;
    values.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
  }
  return values;
}

/** ORTAM DEGISKENLERINI silerek kodun gercek varsayilanlarini okur. */
async function codeDefaults() {
  const saved = new Map(ENV_KEYS.map(key => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  try {
    const { getWriterFlags } = await import('../config/writerFlags.js');
    return getWriterFlags();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('.env.example her WRITER_* anahtarini listeler', async () => {
  const example = readExample(readFileSync(EXAMPLE, 'utf8'));
  for (const key of ENV_KEYS) {
    assert.ok(example.has(key), `.env.example icinde ${key} yok`);
  }
});

test('.env.example degerleri kodun varsayilanlariyla ayni', async () => {
  const example = readExample(readFileSync(EXAMPLE, 'utf8'));
  const defaults = await codeDefaults();

  const expected = {
    WRITER_POSTCHECK_ENABLED: String(defaults.postcheckEnabled),
    WRITER_CITATION_CHECK_ENABLED: String(defaults.citationCheckEnabled),
    WRITER_QUALITY_CHECK_ENABLED: String(defaults.qualityCheckEnabled),
    WRITER_REVISION_COACH_ENABLED: String(defaults.revisionCoachEnabled),
    WRITER_GATE_MODE: defaults.gateMode,
  };

  for (const [key, want] of Object.entries(expected)) {
    assert.equal(example.get(key), want, `${key}: .env.example "${example.get(key)}", kod varsayilani "${want}"`);
  }
});

test('ornek dosya gizli anahtar tasimaz', () => {
  const text = readFileSync(EXAMPLE, 'utf8');
  const example = readExample(text);
  for (const key of ['KEY_ENCRYPTION_KEY', 'SEMANTIC_SCHOLAR_API_KEY', 'DEEPSEEK_API_KEY']) {
    const value = example.get(key);
    if (value === undefined) continue;
    assert.equal(value, '', `${key} ornek dosyada bos olmali`);
  }
});
