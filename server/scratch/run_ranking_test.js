import { enrichPaperRanking } from '../services/journalRankingService.js';
import { calculateAHP } from '../services/ahp.js';

// Setup mock papers simulating various scenarios
const mockPapers = [
  {
    title: "Quantum Entanglement and AI Diagnostics",
    publicationName: "Nature", // Q1 Journal
    year: 2024,
    citedBy: 120,
    doi: "10.1038/nature12345",
    openAccess: true,
    keyCount: 15,
    expandedSimilarity: 0.85
  },
  {
    title: "Sensing Pathologies in Oncology",
    publicationName: "Sensors", // Q2 Journal
    year: 2023,
    citedBy: 45,
    doi: "10.3390/s12345",
    openAccess: true,
    keyCount: 12,
    expandedSimilarity: 0.70
  },
  {
    title: "Applied Turizm and Artificial Intelligence Models",
    publicationName: "Türk Turizm Araştırmaları Dergisi", // Q3 Journal
    year: 2022,
    citedBy: 15,
    doi: "10.3220/turizm.12345",
    openAccess: false,
    keyCount: 10,
    expandedSimilarity: 0.60
  },
  {
    title: "Emerging Trends in Neural Architectures",
    publicationName: "arXiv preprint arXiv:2401.12345", // Preprint
    year: 2025,
    citedBy: 0,
    doi: null,
    openAccess: true,
    keyCount: 8,
    expandedSimilarity: 0.50
  },
  {
    title: "Proceedings of the Joint Conference on AI Ethics",
    publicationName: "ACM Conference on Human Factors in Computing", // Conference
    year: 2023,
    citedBy: 30,
    doi: "10.1145/chi12345",
    openAccess: false,
    keyCount: 14,
    expandedSimilarity: 0.80
  },
  {
    title: "An Unknown Academic Discovery",
    publicationName: "Journal of Mysterious Findings", // Unknown Journal (Not in DB)
    year: 2020,
    citedBy: 2,
    doi: "10.9999/mysterious",
    openAccess: false,
    keyCount: 5,
    expandedSimilarity: 0.40
  }
];

async function runTest() {
  console.log("=== [TEST] JOURNAL RANKING & METADATA ENRICHMENT ===");
  
  // 1. Map and Enrich Metadata
  const enriched = mockPapers.map(enrichPaperRanking);
  
  console.log("\nEnriched Metadata Results:");
  console.table(enriched.map(p => ({
    Title: p.title.substring(0, 30) + "...",
    Journal: p.publicationName.substring(0, 20),
    Type: p.sourceType,
    Quartile: p.quartile || "None",
    SJR: p.sjr || "N/A"
  })));

  // 2. Calculate AHP Scores with Quality Boosts
  console.log("\n=== [TEST] AHP SCORING & QUALITY BOOSTS ===");
  const ranked = await calculateAHP(enriched, null);
  
  console.table(ranked.map(p => ({
    Title: p.title.substring(0, 25) + "...",
    Type: p.sourceType,
    Q: p.quartile || "N/A",
    Boost: p.scores.qBoost,
    BaseTotal: parseFloat((p.scores.total - p.scores.qBoost).toFixed(4)),
    FinalTotal: p.scores.total,
    Confidence: p.confidence,
    Explanations: p.explanation.join(" | ")
  })));

  // 3. Confirmations
  console.log("\nVerification Checks:");
  
  // Check Nature Q1 Mapping
  const nature = ranked.find(p => p.publicationName === "Nature");
  if (nature && nature.quartile === "Q1" && nature.scores.qBoost === 0.08) {
    console.log("✅ [Nature] mapped to Q1 with +0.08 AHP boost.");
  } else {
    console.error("❌ Failed Nature check", nature);
  }

  // Check Conference Mapping & Boost
  const conf = ranked.find(p => p.publicationName.includes("ACM Conference"));
  if (conf && conf.sourceType === "Conference" && conf.scores.qBoost === 0.02) {
    console.log("✅ [Conference] mapped to Conference with +0.02 AHP boost.");
  } else {
    console.error("❌ Failed Conference check", conf);
  }

  // Check Preprint Mapping & Boost
  const preprint = ranked.find(p => p.publicationName.includes("arXiv"));
  if (preprint && preprint.sourceType === "Preprint" && preprint.scores.qBoost === 0.0) {
    console.log("✅ [Preprint] mapped to Preprint with +0.00 AHP boost.");
  } else {
    console.error("❌ Failed Preprint check", preprint);
  }

  // Check Unknown Journal Mapping & Boost
  const unknown = ranked.find(p => p.publicationName.includes("Mysterious"));
  if (unknown && unknown.sourceType === "Journal" && unknown.quartile === null && unknown.scores.qBoost === 0.0) {
    console.log("✅ [Unknown Journal] mapped gracefully to Journal with no quartile and no boost.");
  } else {
    console.error("❌ Failed Unknown Journal check", unknown);
  }

  // Check AHP Scores are capped at 1.0
  const exceedsMax = ranked.some(p => p.scores.total > 1.0);
  if (!exceedsMax) {
    console.log("✅ No AHP score exceeded the 1.0 ceiling limit.");
  } else {
    console.error("❌ Failed score ceiling check. Found score > 1.0!");
  }
}

runTest().catch(console.error);
