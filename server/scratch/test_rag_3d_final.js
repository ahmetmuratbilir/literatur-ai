import { generateAcademicText } from '../services/aiService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const samplePapers = [
  { ref: '1', title: 'Yapay Zeka ve Kanser', abstract: 'Yapay zeka modelleri kanser teşhisinde yüksek başarı göstermektedir.', year: '2025' },
  { ref: '2', title: 'Onkolojik Teşhis ve Gelişmiş Algoritmalar', abstract: 'Kanser teşhisi sırasında veri bilimi çok etkilidir.', year: '2024' },
  { ref: '3', title: 'Yapay Zeka ve Tanı Süreçleri', abstract: 'AI algoritmaları doktorların teşhislerine yardımcı olur.', year: '2023' },
  { ref: '4', title: 'Üniversite Kampüslerinde Ulaşım', abstract: 'Öğrenciler otobüs seferlerinden şikayetçidir.', year: '2022' },
  { ref: '5', title: 'Veri Gizliliği ve Sağlık', abstract: 'Tıbbi verilerin işlenmesi etik riskler barındırır ve gizlilik esastır.', year: '2025' }
];

const mockRes = {
  write: () => {},
  end: () => {}
};
const mockReq = { on: () => {} };

import mongoose from 'mongoose';

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB Bağlandı.\n');

  const prompts = [
    'kanser tanısı',
    'onkolojik teşhis sistemleri',
    'etik riskler ve veri gizliliği',
    'ulaşım ve kampüs aidiyeti'
  ];

  for (const prompt of prompts) {
    console.log(`\n=========================================`);
    console.log(`TEST BAŞLIYOR: "${prompt}"`);
    console.log(`=========================================`);
    
    try {
      await generateAcademicText(samplePapers, prompt, 'literature-review', 'akademik', 'kisa', 'tr', mockRes, mockReq);
      console.log(`✅ TEST BAŞARILI (Frontend'e stream yapıldı)`);
    } catch (e) {
      console.error(`❌ TEST HATASI:`, e.message);
    }
  }
}

runTests();
