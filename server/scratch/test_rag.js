import { createChunksFromArticles, buildContextFromChunks } from '../services/ragService.js';

// Basit makale oluşturucu
function generateMockArticles(count) {
  const articles = [];
  for (let i = 1; i <= count; i++) {
    articles.push({
      ref: i,
      title: `Test Makalesi ${i}`,
      authors: `Yazar ${i}`,
      year: 2020 + (i % 5),
      journal: `Dergi ${i}`,
      abstract: `Bu birinci cümledir makale ${i} için. Bu ikinci cümledir. Bu üçüncü cümledir. Bu dördüncü cümledir.`
    });
  }
  return articles;
}

const test3 = generateMockArticles(3);
const test10 = generateMockArticles(10);
const test20 = generateMockArticles(20);

console.log('--- TEST 3 MAKALE ---');
const chunks3 = createChunksFromArticles(test3);
const context3 = buildContextFromChunks(chunks3, 40);
console.log(`Üretilen Chunk Sayısı: ${chunks3.length}`);
console.log(`Context Uzunluğu (Karakter): ${context3.length}`);
// console.log(context3.substring(0, 300) + '...\n');

console.log('--- TEST 10 MAKALE ---');
const chunks10 = createChunksFromArticles(test10);
const context10 = buildContextFromChunks(chunks10, 40); // 10 makale * 2 chunk = 20 chunk (40'tan küçük)
console.log(`Üretilen Chunk Sayısı: ${chunks10.length}`);
console.log(`Context Uzunluğu (Karakter): ${context10.length}`);

console.log('--- TEST 20 MAKALE ---');
const chunks20 = createChunksFromArticles(test20);
const context20 = buildContextFromChunks(chunks20, 40); // 20 makale * 2 chunk = 40 chunk (tam 40)
console.log(`Üretilen Chunk Sayısı: ${chunks20.length}`);
console.log(`Context Uzunluğu (Karakter): ${context20.length}`);
