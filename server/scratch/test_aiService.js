import { generateAcademicText } from '../services/aiService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const mockPapers2 = [
  { ref: 1, authors: 'Smith et al.', year: 2023, title: 'AI in Medical Diagnosis', journal: 'Nature', citedBy: 100, abstract: 'We evaluated AI for diagnosis.' },
  { ref: 2, authors: 'Doe & Jane', year: 2024, title: 'Limits of AI in Healthcare', journal: 'Lancet', citedBy: 50, abstract: 'AI systems remain limited.' }
];

const mockPapers5 = [
  ...mockPapers2,
  { ref: 3, authors: 'Alice B.', year: 2022, title: 'Deep Learning in Oncology', journal: 'Oncology Journal', citedBy: 20, abstract: 'Deep learning models show promise in oncology.' },
  { ref: 4, authors: 'Bob C.', year: 2023, title: 'Ethics of AI', journal: 'Bioethics', citedBy: 5, abstract: 'Ethical considerations are paramount when deploying AI.' },
  { ref: 5, authors: 'Charlie D.', year: 2024, title: 'Future of Health AI', journal: 'HealthTech', citedBy: 2, abstract: 'The future depends on robust clinical validation.' }
];

const mockPapersEmpty = [
  { ref: 1, authors: 'Unknown', year: 2020, title: 'A title with no abstract', journal: 'Journal X', citedBy: 0, abstract: '' },
  { ref: 2, authors: 'Unknown2', year: 2021, title: 'Another title with short abstract', journal: 'Journal Y', citedBy: 1, abstract: 'This is a paper.' }
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
  console.log('--- TEST 1: 2 Makaleyle Giriş Bölümü ---');
  let result1 = await new Promise(resolve => generateAcademicText(mockPapers2, 'Yapay zekanın tıbbi tanıdaki rolü', 'introduction', 'akademik', 'orta', 'tr', createMockRes(resolve), req));
  console.log(result1);
  console.log('\n=========================================\n');

  console.log('--- TEST 2: 5 Makaleyle Literatür İncelemesi ---');
  let result2 = await new Promise(resolve => generateAcademicText(mockPapers5, 'Yapay zekanın tıbbi tanıdaki rolü', 'literature-review', 'akademik', 'orta', 'tr', createMockRes(resolve), req));
  console.log(result2);
  console.log('\n=========================================\n');

  console.log('--- TEST 3: Yetersiz abstract içeren makaleyle sonuç bölümü ---');
  let result3 = await new Promise(resolve => generateAcademicText(mockPapersEmpty, 'Yapay zekanın tıbbi tanıdaki rolü', 'conclusion', 'akademik', 'orta', 'tr', createMockRes(resolve), req));
  console.log(result3);
  console.log('\n=========================================\n');
}

runTests();
