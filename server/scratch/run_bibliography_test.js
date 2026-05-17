import { generateAcademicText } from '../services/aiService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const mockPapersWithMissingMetadata = [
  { ref: 1, authors: '', year: '', title: 'Title of Anonymous Paper', journal: '', doi: '', url: '', citedBy: 10, abstract: 'This is a test abstract for a paper that completely lacks author and year metadata.' },
  { ref: 2, authors: 'Jane Doe', year: 2025, title: 'Standard Research Paper', journal: 'Famous Science', doi: '10.1000/xyz123', url: 'https://example.com/paper', citedBy: 25, abstract: 'This is a standard paper with complete metadata including DOI and URL.' }
];

const req = { closed: false, on: () => {} };

function createMockRes(resolve) {
  let output = '';
  return {
    write: (data) => {
      try {
        const text = data.toString().replace('data: ', '').trim();
        if (text) {
          const json = JSON.parse(text);
          if (json.token) output += json.token;
          if (json.error) output += '\n[ERROR]: ' + json.error;
        }
      } catch (e) {}
    },
    end: () => resolve(output)
  };
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      console.log('Connected to MongoDB Atlas successfully.');
    } catch (e) {
      console.warn('DB connect failed:', e.message);
    }
  }
  const formats = ['APA 7', 'IEEE', 'MLA', 'Chicago'];

  for (const format of formats) {
    console.log(`\n=========================================\n`);
    console.log(`--- TESTING BIBLIOGRAPHY STYLE: ${format} ---`);
    const result = await new Promise(resolve => 
      generateAcademicText(
        mockPapersWithMissingMetadata, 
        'Yapay zeka etiği ve gelecekteki klinik etkileri', 
        'literature-review', 
        'akademik', 
        'orta', 
        'tr', 
        createMockRes(resolve), 
        req, 
        format
      )
    );
    console.log(result);
    await delay(12000);
  }
  console.log(`\n=========================================\n`);
  console.log('All tests completed.');
  process.exit(0);
}

runTests();
