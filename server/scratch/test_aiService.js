import { generateAcademicText } from '../services/aiService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const mockPapers3 = [
  { ref: 1, authors: 'Smith et al.', year: 2023, title: 'AI in Medical Diagnosis', journal: 'Nature', citedBy: 100, abstract: 'AI shows 94% accuracy in diagnostic imaging.' },
  { ref: 2, authors: 'Doe & Jane', year: 2024, title: 'Limits of AI in Healthcare', journal: 'Lancet', citedBy: 50, abstract: 'AI systems remain limited by lack of clinical trial validations.' },
  { ref: 3, authors: 'Alice B.', year: 2022, title: 'Deep Learning in Oncology', journal: 'Oncology Journal', citedBy: 20, abstract: 'Deep learning models show promise in oncology, specifically breast cancer detection.' }
];

const req = { closed: false, on: () => {} };

function createMockRes(resolve) {
  let output = '';
  return {
    write: (data) => {
      try {
        const text = data.toString().replace('data: ', '').trim();
        if(text) {
           const json = JSON.parse(text);
           if (json.token) output += json.token;
        }
      } catch (e) {}
    },
    end: () => resolve(output)
  };
}

async function runTests() {
  console.log('=== FAZ 3 TESTLERI (Sürüm: academic-writing-v4) ===');

  console.log('--- FAZ 3 TEST 1: Giriş Bölümü / Orta Uzunluk (APA 7) ---');
  let result1 = await new Promise(resolve => generateAcademicText(mockPapers3, 'Yapay zekanın tıbbi tanıdaki rolü', 'introduction', 'akademik', 'orta', 'tr', createMockRes(resolve), req, 'APA 7'));
  console.log(result1);
  console.log('\n=========================================\n');

  console.log('--- FAZ 3 TEST 2: Literatür İncelemesi / Uzun Uzunluk (APA 7) ---');
  let result2 = await new Promise(resolve => generateAcademicText(mockPapers3, 'Yapay zekanın tıbbi tanıdaki rolü', 'literature-review', 'akademik', 'uzun', 'tr', createMockRes(resolve), req, 'APA 7'));
  console.log(result2);
  console.log('\n=========================================\n');

  console.log('--- FAZ 3 TEST 3: Tartışma Bölümü / Orta Uzunluk (IEEE) ---');
  let result3 = await new Promise(resolve => generateAcademicText(mockPapers3, 'Yapay zekanın tıbbi tanıdaki rolü', 'discussion', 'akademik', 'orta', 'tr', createMockRes(resolve), req, 'IEEE'));
  console.log(result3);
  console.log('\n=========================================\n');
}

runTests();
