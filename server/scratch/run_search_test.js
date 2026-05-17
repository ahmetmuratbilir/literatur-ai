import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchAll } from '../services/search.js';
import { translateToEnglish } from '../utils/translation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const testQueries = [
  'kanser tanısı yapay zeka',
  'ai endüstri',
  'ulaşım kampüs aidiyeti'
];

async function runSingleSearch(mainTopic) {
  console.log(`\n==================================================`);
  console.log(`RUNNING SEARCH FOR: "${mainTopic}"`);
  console.log(`==================================================`);

  const count = 25;
  const cleanTopic = mainTopic.trim().replace(/'/g, '"');
  const queryContextWords = [cleanTopic];
  let topicQuery = `title("${cleanTopic}") OR key("${cleanTopic}") OR abs("${cleanTopic}")`;
  const booleanQueryParts = [];

  try {
    const translated = await translateToEnglish(cleanTopic);
    let topicBoolean = `"${cleanTopic}"`;

    if (
      translated?.text &&
      translated.text.toLowerCase() !== String(cleanTopic).toLowerCase()
    ) {
      const transText = translated.text.replace(/'/g, '"');
      topicQuery += ` OR title("${transText}") OR key("${transText}") OR abs("${transText}")`;
      topicBoolean += ` OR "${transText}"`;
      queryContextWords.push(transText);
      console.log(`[Translate] "${cleanTopic}" translated to "${transText}"`);
    } else {
      console.log(`[Translate] No translation needed or same as original.`);
    }
    booleanQueryParts.push(`(${topicBoolean})`);
  } catch (error) {
    console.error('[Translate Error] Failed to translate query:', error.message);
  }

  const finalQuery = `(${topicQuery})`;
  const queryContext = queryContextWords.join(' ');
  const booleanQuery = booleanQueryParts.join(' AND ');

  const params = { mainTopic, count };

  console.log(`Final Scopus Query: ${finalQuery}`);
  console.log(`Query Context for AHP: ${queryContext}`);
  console.log(`Boolean Query: ${booleanQuery}`);

  const start = Date.now();
  const searchResults = await searchAll(params, queryContext, finalQuery, booleanQuery);
  const duration = ((Date.now() - start) / 1000).toFixed(2);

  const results = searchResults.results || [];
  console.log(`Search completed in ${duration} seconds. Found ${results.length} papers.`);

  if (results.length === 0) {
    console.log(`[WARNING] No results found for query: ${mainTopic}`);
    return;
  }

  let totalScoreSum = 0;
  let minScore = Infinity;
  let maxScore = -Infinity;
  let englishPapersScoredCount = 0;
  let validScoresCount = 0;

  console.log(`\nSample Results (First 5):`);
  results.slice(0, 5).forEach((item, idx) => {
    const title = item.title || item.titleTR || 'Untitled';
    const scoreVal = item.scores?.total ?? item.totalPoint ?? item.ahpScore;
    const lang = item.language || 'unknown';
    const hasEnglishLetters = /[a-zA-Z]/.test(title); // basic check for English content
    const source = item.source || 'unknown';

    console.log(`${idx + 1}. [${source}] ${title.slice(0, 75)}...`);
    console.log(`   - Language: ${lang} | Score: ${scoreVal} | Scores Object:`, item.scores);
  });

  results.forEach(item => {
    const scoreVal = item.scores?.total ?? item.totalPoint ?? item.ahpScore;
    if (scoreVal !== undefined && scoreVal !== null) {
      validScoresCount++;
      totalScoreSum += scoreVal;
      if (scoreVal < minScore) minScore = scoreVal;
      if (scoreVal > maxScore) maxScore = scoreVal;
    }

    // Identify if English paper got a score
    const title = item.title || '';
    const desc = item.description || item.teaser || '';
    const isEnglishPaper = item.language === 'english' || item.language === 'en' || (!/[ıİğĞüÜşŞöÖçÇ]/.test(title) && /[a-zA-Z]/.test(title));
    if (isEnglishPaper && scoreVal > 0) {
      englishPapersScoredCount++;
    }
  });

  const avgScore = validScoresCount > 0 ? (totalScoreSum / validScoresCount) : 0;

  console.log(`\n--- STATS FOR "${mainTopic}" ---`);
  console.log(`AHP Skorları Hesaplanıyor mu?: ${validScoresCount > 0 ? 'EVET' : 'HAYIR'}`);
  console.log(`Tüm Skorlar %0 (AHP = 0) mı?: ${maxScore === 0 ? 'EVET (Hata var)' : 'HAYIR'}`);
  console.log(`Türkçe sorguda İngilizce makale skor aldı mı?: ${englishPapersScoredCount > 0 ? `EVET (${englishPapersScoredCount} adet)` : 'HAYIR'}`);
  console.log(`AHP Skor Aralığı: minScore: ${minScore.toFixed(5)} / maxScore: ${maxScore.toFixed(5)} / averageScore: ${avgScore.toFixed(5)}`);
}

async function main() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  for (const query of testQueries) {
    try {
      await runSingleSearch(query);
    } catch (e) {
      console.error(`Error searching for query "${query}":`, e);
    }
  }

  await mongoose.disconnect();
  console.log('\nDatabase disconnected.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
