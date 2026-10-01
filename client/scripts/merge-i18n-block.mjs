#!/usr/bin/env node
/**
 * Geliştirme yardımcısı: src/i18n/_<dil>_<ad>.txt bloklarını en.js / tr.js
 * sonuna ekler ve blok dosyalarını siler. Bash heredoc'u sözlükteki tırnakları
 * bozduğu için bu yol kullanılıyor.
 *   node scripts/merge-i18n-block.mjs card
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const name = process.argv[2];
if (!name) { console.error('Kullanım: merge-i18n-block.mjs <ad>'); process.exit(1); }
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n');
for (const lang of ['en', 'tr']) {
  const blockPath = path.join(dir, `_${lang}_${name}.txt`);
  const dictPath = path.join(dir, `${lang}.js`);
  const dict = fs.readFileSync(dictPath, 'utf8').trimEnd();
  if (!dict.endsWith('};')) throw new Error(`${dictPath} beklenen biçimde bitmiyor`);
  fs.writeFileSync(dictPath, `${dict.slice(0, -2).trimEnd()}\n${fs.readFileSync(blockPath, 'utf8')}};\n`);
  fs.unlinkSync(blockPath);
}
console.log(`"${name}" blokları eklendi`);
