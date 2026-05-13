import { createChunksFromArticles, scoreChunksByKeywords } from '../services/ragService.js';

function generateTestArticles() {
  return [
    {
      ref: 1,
      title: 'Yapay Zekanın Kanser Tanısındaki Önemi',
      authors: 'A. Yılmaz',
      year: 2023,
      abstract: 'Bu çalışma kanser tanısında yapay zeka algoritmalarının başarısını incelemektedir. Yapay zeka %90 oranında doğru tanı koymuştur.'
    },
    {
      ref: 2,
      title: 'Sağlıkta Veri Gizliliği ve Etik',
      authors: 'B. Kaya',
      year: 2022,
      abstract: 'Makine öğrenimi modellerinin kullanımı etik riskler barındırmaktadır. Veri gizliliği ihlalleri hastalar için büyük bir tehdittir.'
    },
    {
      ref: 3,
      title: 'Üniversite Kampüslerinde Ulaşım',
      authors: 'C. Demir',
      year: 2024,
      abstract: 'Öğrencilerin kampüs aidiyeti ile ulaşım kolaylığı arasında doğrudan bir ilişki vardır. Ulaşım sorunları öğrencileri olumsuz etkiler.'
    },
    {
      ref: 4,
      title: 'Onkolojik Teşhis ve Gelişmiş Algoritmalar',
      authors: 'D. Çelik',
      year: 2021,
      abstract: 'Onkolojik teşhis sistemleri son on yılda büyük ilerleme kaydetti. Ancak doğruluk payları hala sorgulanmaktadır.'
    }
  ];
}

const articles = generateTestArticles();
const chunks = createChunksFromArticles(articles);

function runTest(prompt) {
  console.log(`\n--- Test Prompt: "${prompt}" ---`);
  const scored = scoreChunksByKeywords(chunks, prompt, 3, {
    maxChunksPerArticle: 3,
    titleWeight: 3,
    phraseWeight: 4,
    textWeight: 1
  });
  
  scored.forEach((c) => {
    let text = c.chunkText.replace(/\n/g, ' ');
    if (text.length > 80) text = text.substring(0, 80) + '...';
    // [Skor: 9] [Makale 2] [2023] Başlık - ilk 80 karakter...
    const scoreVal = c.score !== undefined ? Number(c.score).toFixed(1) : 'N/A';
    console.log(`[Skor: ${scoreVal}] [Makale ${c.sourceIndex}] [${c.year}] ${c.title} - ${text}`);
  });
}

runTest('yapay zeka ve kanser tanısı');
runTest('etik riskler ve veri gizliliği');
runTest('ulaşım ve kampüs aidiyeti');
runTest('onkolojik teşhis sistemleri');
