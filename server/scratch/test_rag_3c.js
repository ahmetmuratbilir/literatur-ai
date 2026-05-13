import { rankChunksByEmbedding } from '../services/embeddingService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const testChunks = [
  { sourceIndex: 1, title: 'Yapay Zeka ve Tanı Süreçleri', chunkText: 'AI algoritmaları doktorların teşhislerine yardımcı olur.' },
  { sourceIndex: 2, title: 'Onkolojik Teşhis ve Gelişmiş Algoritmalar', chunkText: 'Kanser teşhisi sırasında veri bilimi çok etkilidir.' },
  { sourceIndex: 3, title: 'Üniversite Kampüslerinde Ulaşım', chunkText: 'Öğrenciler otobüs seferlerinden şikayetçidir.' }
];

async function runTests() {
  const originalKey = process.env.GEMINI_API_KEY;

  console.log('\n--- TEST 1: GEMINI_API_KEY Yokken ---');
  delete process.env.GEMINI_API_KEY;
  try {
    await rankChunksByEmbedding(testChunks, 'kanser tanısı');
    console.log('HATA: API keysiz çalıştı (Çalışmamalıydı)');
  } catch (e) {
    console.log('BAŞARILI: API Key olmadığı tespit edildi ve hata fırlatıldı ->', e.message);
  }

  console.log('\n--- TEST 2: Sahte GEMINI_API_KEY ile ---');
  process.env.GEMINI_API_KEY = 'FAKE_API_KEY_FOR_TESTING';
  try {
    await rankChunksByEmbedding(testChunks, 'kanser tanısı');
    console.log('HATA: Sahte key ile çalıştı (Çalışmamalıydı)');
  } catch (e) {
    console.log('BAŞARILI: Sahte Key tespit edildi ve hata fırlatıldı ->', e.message);
  }

  console.log('\n--- TEST 3: Gerçek GEMINI_API_KEY ile ---');
  process.env.GEMINI_API_KEY = originalKey; // Eğer .env'de gerçek key varsa kullanır
  if (!originalKey) {
    console.log('Gerçek key bulunamadığı için Test 3 atlandı.');
    return;
  }
  
  try {
    const result1 = await rankChunksByEmbedding(testChunks, 'kanser tanısı', 3);
    console.log('\nSorgu: "kanser tanısı"');
    result1.forEach(c => console.log(`[Semantic Skor: ${c.semanticScore?.toFixed(3)}] ${c.title}`));

    const result2 = await rankChunksByEmbedding(testChunks, 'onkolojik teşhis', 3);
    console.log('\nSorgu: "onkolojik teşhis"');
    result2.forEach(c => console.log(`[Semantic Skor: ${c.semanticScore?.toFixed(3)}] ${c.title}`));
  } catch (e) {
    console.log('Embedding Hatası:', e.message);
  }
}

runTests();
