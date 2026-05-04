import { calculateAHP } from '../services/ahp.js';

const mockData = [
  {
    title: "Artificial Intelligence in Modern Healthcare",
    description: "A comprehensive study of AI applications in medicine and patient care.",
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

  if (results.length === 2 && results[0].title === "Artificial Intelligence in Modern Healthcare") {
    console.log("\nSUCCESS: AHP correctly prioritized modern high-quality paper and filtered spam.");
  } else {
    console.log("\nFAILED: Unexpected AHP results.");
  }
}

runTest();
