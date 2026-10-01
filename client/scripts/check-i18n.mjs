#!/usr/bin/env node
/**
 * Arayüz sözlüklerini doğrular:
 *  1. en.js ve tr.js sözdizimsel olarak geçerli mi (yüklenebiliyor mu)
 *  2. İki dilde anahtar kümeleri birebir aynı mı
 *  3. Aynı anahtarın yer tutucuları ({n}, {label}...) iki dilde aynı mı
 *  4. src/ içinde t('...') ile çağrılan her anahtar sözlükte var mı
 *
 * Eksik bir çeviri İngilizceye sessizce düşer; bu betik onu görünür kılar.
 * Kullanım:  npm run check-i18n
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async (lang) => (await import(pathToFileURL(path.join(root, 'src/i18n', `${lang}.js`)).href)).default;

const flatten = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
  v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]);
const placeholders = (v) => (typeof v === 'string' ? [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',') : '');

let problems = 0;
const report = (msg) => { problems++; console.log('  ✗', msg); };

const en = new Map(flatten(await load('en')));
const tr = new Map(flatten(await load('tr')));

for (const key of en.keys()) if (!tr.has(key)) report(`tr.js eksik: ${key}`);
for (const key of tr.keys()) if (!en.has(key)) report(`en.js eksik: ${key}`);
for (const [key, v] of en) {
  if (!tr.has(key)) continue;
  if (Array.isArray(v) !== Array.isArray(tr.get(key))) report(`tür farklı: ${key}`);
  else if (Array.isArray(v) && v.length !== tr.get(key).length) report(`dizi uzunluğu farklı: ${key}`);
  // Türkçe metin bir yer tutucuyu farklı adla kullanabilir ({b} yerine {bLower}); yalnız sayıyı değil kümeyi karşılaştır.
  else if (placeholders(v) !== placeholders(tr.get(key))) report(`yer tutucular farklı: ${key} (en: {${placeholders(v)}} tr: {${placeholders(tr.get(key))}})`);
}

// Kaynakta kullanılan anahtarlar
const used = new Set();
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'i18n') walk(full); continue; }
    if (!/\.(jsx?|mjs)$/.test(entry.name)) continue;
    for (const m of fs.readFileSync(full, 'utf8').matchAll(/\bt\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g)) used.add(m[1]);
  }
};
walk(path.join(root, 'src'));
const enObj = await load('en');
const exists = (key) => key.split('.').reduce((n, p) => (n && n[p] !== undefined ? n[p] : undefined), enObj) !== undefined;
for (const key of used) if (!exists(key)) report(`kodda kullanılıyor ama sözlükte yok: ${key}`);

console.log(`${en.size} anahtar · kodda ${used.size} doğrudan kullanım · ${problems ? `${problems} sorun` : 'sorun yok'}`);
process.exit(problems ? 1 : 0);
