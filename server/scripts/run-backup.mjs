#!/usr/bin/env node
/**
 * Yedeği elle çalıştırır (ana MongoDB → ikinci MongoDB) ve özetini yazar.
 *   node scripts/run-backup.mjs
 * Adresler yazdırılmaz. Sunucu da aynı işi kendisi yapıyor (son yedek 20
 * saatten eskiyse); bu betik ilk deneme ve sorun giderme içindir.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { getSecondaryUri, maskUri, targetOf } from '../services/db/secondary.js';
import { runBackup } from '../services/db/backup.js';

dotenv.config({ quiet: true });

const primaryUri = process.env.MONGODB_URI?.trim();
const secondaryUri = getSecondaryUri();
if (!primaryUri || !secondaryUri) {
  console.error('MONGODB_URI ve MONGODB_URI_2 tanımlı olmalı.');
  process.exit(1);
}
if (targetOf(primaryUri) === targetOf(secondaryUri)) {
  console.error('İki adres aynı veritabanını gösteriyor.');
  process.exit(1);
}

try {
  const primary = await mongoose.createConnection(primaryUri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const secondary = await mongoose.createConnection(secondaryUri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const meta = await runBackup({ primaryDb: primary.db, secondaryDb: secondary.db, trigger: 'cli' });
  console.log(`Durum: ${meta.status}${meta.error ? ` — ${meta.error}` : ''}`);
  for (const [name, c] of Object.entries(meta.collections)) {
    console.log(`  ${name.padEnd(16)} ${String(c.count).padStart(6)} kayıt  ${(c.bytes / 1024).toFixed(1).padStart(9)} KB${c.missing ? '  (ana DB’de yok)' : ''}`);
  }
  console.log(`Toplam ${(meta.bytes / 1048576).toFixed(2)} MB, ${meta.durationMs} ms`);
  const stats = await secondary.db.stats();
  console.log(`İkinci DB: veri ${(stats.dataSize / 1048576).toFixed(1)} MB, depolama ${(stats.storageSize / 1048576).toFixed(1)} MB (sınır 512 MB)`);
  await primary.close();
  await secondary.close();
  process.exitCode = meta.status === 'ok' ? 0 : 1;
} catch (error) {
  console.error('Hata:', maskUri(error?.message || error));
  process.exit(1);
}
