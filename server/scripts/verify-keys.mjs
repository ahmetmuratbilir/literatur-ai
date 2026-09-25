#!/usr/bin/env node
/**
 * Yapılandırmayı iki aşamada doğrular:
 *   1. Biçim   — config/envValidation.js (ağ gerektirmez)
 *   2. Gerçek  — services/keyHealthService.js (her sağlayıcıya bir istek)
 *
 * Aynı yoklama mantığını admin paneli de kullanır (/api/admin/verify-keys),
 * böylece terminal ile panel asla farklı sonuç göstermez.
 *
 * KURAL: anahtar değerleri hiçbir zaman yazdırılmaz.
 *
 * Kullanım:  npm run verify-keys
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateEnvironment, formatEnvReport } from '../config/envValidation.js';
import { probeAllServices } from '../services/keyHealthService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = process.argv[2] || path.join(__dirname, '..', '.env');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`[HATA] .env bulunamadı: ${filePath}`);
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

const LABELS = {
  ok: 'OK',
  invalid_key: 'ANAHTAR GEÇERSİZ',
  quota: 'KOTA DOLU',
  unreachable: 'ERİŞİLEMİYOR',
  missing: 'TANIMSIZ',
  error: 'HATA',
};

const env = loadEnvFile(ENV_PATH);

// 1. Biçim doğrulaması
const validation = validateEnvironment(env);
console.log(formatEnvReport(validation));
console.log('');

// 2. Canlı doğrulama
console.log('Sağlayıcılara istek atılıyor...\n');
const { rows, summary } = await probeAllServices(env);

const pad = (value, width) => String(value).padEnd(width);
console.log('='.repeat(104));
console.log(pad('SERVİS', 20) + pad('SONUÇ', 20) + 'DETAY');
console.log('='.repeat(104));
for (const r of rows) {
  const marker = r.required && r.state !== 'ok' ? '! ' : '  ';
  console.log(marker + pad(r.service, 18) + pad(LABELS[r.state] || r.state, 20) + r.detail);
}
console.log('='.repeat(104));
console.log(`\n${summary.total} kontrol · ${summary.ok} sağlıklı · ${summary.failing} sorunlu`);

if (summary.requiredFailing > 0) {
  console.log(`\n! ${summary.requiredFailing} ZORUNLU servis çalışmıyor. Uygulama bu haliyle eksik çalışır.`);
}

process.exit(validation.errors.length > 0 || summary.requiredFailing > 0 ? 1 : 0);
