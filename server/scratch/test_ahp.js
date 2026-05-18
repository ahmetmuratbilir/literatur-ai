import { calculateAHP } from '../services/ahp.js';

const mockData = [
  {
    title: "Artificial Intelligence in Modern Healthcare",
    description: "A comprehensive study of AI applications in medicine and patient care.",
    publicationYear: 2024,
    publicationDate: "2024-01-01",
    yearConfidence: "high",
    year: 2024,
    citedbyCount: 50,
    pubType: 'fla',
    sourceType: 'Journal',
    doi: '10.1234/ai.2024.1',
    source: 'Scopus',
    openAccess: true,
    keyCount: 12,
    expandedSimilarity: 0.85
  },
  {
    title: "Old AI Techniques",
    description: "Discussion of early artificial intelligence methods from the 1990s.",
    publicationYear: 1995,
    publicationDate: "1995-01-01",
    yearConfidence: "high",
    year: 1995,
    citedbyCount: 200,
    pubType: 'fla',
    sourceType: 'Journal',
    doi: '10.1234/old.1995.1',
    source: 'Scopus',
    openAccess: false,
    keyCount: 5,
    expandedSimilarity: 0.30
  },
  {
    title: "Spammy Paper",
    description: "Irrelevant content.",
    publicationYear: 2023,
    publicationDate: "2023-01-01",
    yearConfidence: "high",
    year: 2023,
    citedbyCount: 0,
    pubType: 'pre',
    sourceType: 'Report',
    source: 'ArXiv',
    openAccess: true,
    keyCount: 1,
    expandedSimilarity: 0.05
  }
];

async function runTest() {
  console.log("--- Testing New AHP Logic ---");
  const results = await calculateAHP(mockData);
  
  console.log(`Input size: ${mockData.length}, Output size: ${results.length}`);
  
  results.forEach((r, i) => {
    console.log(`\n[${i+1}] ${r.title}`);
    console.log(`   Score: ${r.totalPoint}, Confidence: ${r.confidence}`);
    console.log(`   Explanation: ${r.explanation.join(', ')}`);
    console.log(`   Detailed Scores:`, r.scores);
  });

  const spam = results.find(r => r.title === "Spammy Paper");
  if (results.length >= 2 && results[0].title === "Artificial Intelligence in Modern Healthcare" && spam.totalPoint < results[0].totalPoint) {
    console.log("\nSUCCESS: AHP correctly prioritized the modern high-quality paper and down-ranked spam.");
  } else {
    console.log("\nFAILED: Unexpected AHP results.");
  }
}

runTest();
