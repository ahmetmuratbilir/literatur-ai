import { generateAcademicText } from '../services/aiService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// MOCK FETCH globally for this test
import { setGlobalDispatcher, MockAgent } from 'undici';

const mockAgent = new MockAgent();
setGlobalDispatcher(mockAgent);

const mockPool = mockAgent.get('https://api.groq.com');

// Simulate 429 Rate Limit
mockPool.intercept({
  path: '/openai/v1/chat/completions',
  method: 'POST',
}).reply(429, {
  error: { message: "Rate limit reached" }
}, {
  headers: { 'retry-after': '15' }
});

const samplePapers = [{ ref: '1', title: 'Test', abstract: 'Test context', year: '2025' }];

const mockRes = {
  write: (data) => console.log('STREAM DATA:', data),
  end: () => console.log('STREAM ENDED')
};
const mockReq = { on: () => {} };

import mongoose from 'mongoose';

async function runTest() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB Bağlandı.\n');
  console.log('Simüle edilmiş 429 testi başlıyor...');
  try {
    await generateAcademicText(samplePapers, 'kanser', 'literature-review', 'akademik', 'kisa', 'tr', mockRes, mockReq);
  } catch (e) {
    console.log('Test Hatası (Beklenen):', e.message);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
