#!/usr/bin/env node
/**
 * İkinci MongoDB'deki yedeği ana veritabanına GERİ YÜKLER. Yıkıcı işlem.
 *
 *   node scripts/restore-backup.mjs                       # yalnızca ne yapılacağını gösterir
 *   node scripts/restore-backup.mjs --yes                 # tüm yedeklenen koleksiyonlar
 *   node scripts/restore-backup.mjs --yes baskets         # yalnızca seçilenler
 *
 * Güvenlik: ana koleksiyonun mevcut hâli önce `<ad>__pre_restore` adıyla
 * saklanır (önceki aynı adlı kopyanın üzerine yazılır). Geri yükleme yanlışsa
 * oradan dönülebilir.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { getSecondaryUri, maskUri, targetOf } from '../services/db/secondary.js';
import { BACKUP_COLLECTIONS, BACKUP_PREFIX, lastBackup } from '../services/db/backup.js';

dotenv.config({ quiet: true });

const args = process.argv.slice(2);
const confirmed = args.includes('--yes');
const wanted = args.filter((a) => !a.startsWith('--'));
const names = wanted.length ? wanted : BACKUP_COLLECTIONS;
const unknown = names.filter((n) => !BACKUP_COLLECTIONS.includes(n));
if (unknown.length) {
  console.error(`Bilinmeyen koleksiyon: ${unknown.join(', ')} (geçerli: ${BACKUP_COLLECTIONS.join(', ')})`);
  process.exit(1);
}

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
  const last = await lastBackup(secondary.db, { onlyOk: true });
  console.log(`Son başarılı yedek: ${last ? new Date(last.at).toISOString() : 'YOK'}`);
  if (!last) process.exit(1);

  for (const name of names) {
    const src = `${BACKUP_PREFIX}${name}`;
    const backupCount = await secondary.db.collection(src).countDocuments();
    const currentCount = await primary.db.collection(name).countDocuments();
    console.log(`${name}: ana ${currentCount} kayıt → yedekten ${backupCount} kayıt`);
    if (!confirmed) continue;

    const exists = (await primary.db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;
    if (exists) await primary.db.collection(name).rename(`${name}__pre_restore`, { dropTarget: true });
    let batch = [];
    for await (const doc of secondary.db.collection(src).find({})) {
      batch.push(doc);
      if (batch.length >= 500) { await primary.db.collection(name).insertMany(batch, { ordered: false }); batch = []; }
    }
    if (batch.length) await primary.db.collection(name).insertMany(batch, { ordered: false });
    console.log(`  geri yüklendi; eski hâli: ${name}__pre_restore`);
  }
  if (!confirmed) console.log('\nHiçbir şey değiştirilmedi. Uygulamak için --yes ekle.');
  console.log('Not: indeksleri uygulama açılışta yeniden oluşturur (mongoose autoIndex).');
  await primary.close();
  await secondary.close();
} catch (error) {
  console.error('Hata:', maskUri(error?.message || error));
  process.exit(1);
}
