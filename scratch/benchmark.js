import { normalizeAndClean } from '../server/utils/dataUtils.js';
import { calculateAHP } from '../server/services/ahp.js';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runBenchmark() {
  console.log('--- LiteratureAI Hız Testi Başlatılıyor ---\n');

  try {
    const dataPath = path.join(__dirname, '../exdata.json');
    const rawData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
    console.log(`Test Verisi: ${rawData.length} kayıt yüklendi.`);

    // 1. Normalizasyon Testi
    const normStart = performance.now();
    const cleanData = normalizeAndClean(rawData);
    const normEnd = performance.now();
    const normTime = (normEnd - normStart).toFixed(3);
    console.log(`1. Veri Normalizasyon: ${normTime} ms`);

    // 2. AHP Skorlama Testi
    const ahpStart = performance.now();
    const rankedData = await calculateAHP(cleanData, null);
    const ahpEnd = performance.now();
    const ahpTime = (ahpEnd - ahpStart).toFixed(3);
    console.log(`2. AHP Skorlama: ${ahpTime} ms`);

    // 3. Toplam İşlem Süresi (CPU bazlı)
    const totalTime = (parseFloat(normTime) + parseFloat(ahpTime)).toFixed(3);
    console.log(`\nToplam İşlem Süresi (Yerel): ${totalTime} ms`);
    console.log(`Kayıt Başına Ortalama: ${(totalTime / rawData.length).toFixed(4)} ms`);

    if (totalTime < 50) {
      console.log('\nSonuç: MÜKEMMEL (Ultra Hızlı)');
    } else if (totalTime < 200) {
      console.log('\nSonuç: ÇOK İYİ (Hızlı)');
    } else {
      console.log('\nSonuç: İYİ (Optimize edilebilir)');
    }

  } catch (err) {
    console.error('Test sırasında hata oluştu:', err.message);
  }
}

runBenchmark();
