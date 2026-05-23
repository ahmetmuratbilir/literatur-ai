import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

import { searchAll } from '../services/search.js';
import { translateToEnglish } from '../utils/translation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const TOPICS = [
  { mainTopic: 'Yapay zekanin saglik alanindaki etik etkileri', label: 'AI in healthcare ethics' },
  { mainTopic: 'Yenilenebilir enerji depolama sistemleri', label: 'Renewable energy storage' },
  { mainTopic: 'Surdurulebilir sehirler ve akilli ulasim', label: 'Sustainable cities and mobility' },
  { mainTopic: 'Tedarik zinciri optimizasyonunda makine ogrenmesi', label: 'Supply chain ML optimization' },
  { mainTopic: 'Endustri 4.0 icin yapay zeka uygulamalari', label: 'Industry 4.0 AI applications' },
  { mainTopic: 'Egitimde ogrenme analitigi ve akademik performans', label: 'Learning analytics in education' },
  { mainTopic: 'Iklim degisikligine uyum politikalari', label: 'Climate adaptation policy' },
  { mainTopic: 'Hassas tarim ve sensor tabanli izleme', label: 'Precision agriculture' },
  { mainTopic: 'Siber guvenlikte anomali tespiti icin derin ogrenme', label: 'Cybersecurity anomaly detection' },
  { mainTopic: 'Biyomedikal goruntulemede derin ogrenme', label: 'Biomedical imaging DL' },
];

const SEARCH_LIMIT = 12;
const TOP_TITLES = 3;
const INTER_TOPIC_DELAY_MS = 1200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildQueryInputs({ mainTopic, authorName = '', keywords = [], language = '' }) {
  const keywordList = Array.isArray(keywords) ? keywords : [];
  const queryParts = [];
  const booleanQueryParts = [];
  const queryContextWords = [];

  if (mainTopic) {
    const cleanTopic = mainTopic.trim().replace(/'/g, '"');
    queryContextWords.push(cleanTopic);
    let topicQuery = `title("${cleanTopic}") OR key("${cleanTopic}") OR abs("${cleanTopic}")`;

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
      }

      booleanQueryParts.push(`(${topicBoolean})`);
    } catch (error) {
      console.warn(`[Translate] mainTopic failed: ${error.message}`);
    }

    queryParts.push(`(${topicQuery})`);
  }

  if (authorName) {
    queryParts.push(`aut(${authorName})`);
  }

  if (keywordList.length > 0) {
    const keywordQueries = [];

    for (const keyword of keywordList) {
      queryContextWords.push(keyword);
      let keywordQuery = `key(${keyword}) OR abs(${keyword})`;
      let keywordBoolean = `"${keyword}"`;

      try {
        const translated = await translateToEnglish(keyword);
        if (
          translated?.text &&
          translated.text.toLowerCase() !== String(keyword).toLowerCase()
        ) {
          keywordQuery += ` OR key(${translated.text}) OR abs(${translated.text})`;
          keywordBoolean += ` OR "${translated.text}"`;
          queryContextWords.push(translated.text);
        }
      } catch (error) {
        console.warn(`[Translate] keyword failed: ${error.message}`);
      }

      keywordQueries.push(`(${keywordQuery})`);
      booleanQueryParts.push(`(${keywordBoolean})`);
    }

    queryParts.push(keywordQueries.join(' AND '));
  }

  if (language) {
    queryParts.push(`language(${language})`);
  }

  return {
    scopusQuery: queryParts.join(' AND '),
    booleanQuery: booleanQueryParts.join(' AND '),
    queryContext: queryContextWords.join(' '),
  };
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function summarizeResults(topic, response, durationMs) {
  const results = Array.isArray(response?.results) ? response.results : [];
  const returnedSourceBreakdown = results.reduce((acc, item) => {
    const source = item?.source || 'Unknown';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});

  const scoreValues = results
    .map((item) => numberOrNull(item?.scores?.total ?? item?.totalPoint ?? item?.ahpScore))
    .filter((value) => value !== null);

  const avgScore = scoreValues.length > 0
    ? scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length
    : null;

  return {
    label: topic.label,
    mainTopic: topic.mainTopic,
    durationMs: Math.round(durationMs),
    demoMode: Boolean(response?.demoMode),
    totalFound: numberOrNull(response?.totalFound),
    analyzedCount: numberOrNull(response?.analyzedCount),
    returnedCount: results.length,
    failedSourceCount: Array.isArray(response?.failedSources) ? response.failedSources.length : 0,
    failedSources: Array.isArray(response?.failedSources)
      ? response.failedSources.map((item) => ({
          name: item.name,
          type: item.type,
          message: item.message,
        }))
      : [],
    returnedSourceBreakdown,
    apiSourceBreakdown: response?.sourceBreakdown || {},
    apiTotalFound: response?.totalFromAPIs || {},
    scoreMin: scoreValues.length > 0 ? Math.min(...scoreValues) : null,
    scoreMax: scoreValues.length > 0 ? Math.max(...scoreValues) : null,
    scoreAvg: avgScore !== null ? Number(avgScore.toFixed(4)) : null,
    topTitles: results.slice(0, TOP_TITLES).map((item) => item.title || item.titleTR || 'Untitled'),
  };
}

async function runSingleTopic(topic) {
  const params = {
    mainTopic: topic.mainTopic,
    authorName: '',
    keywords: [],
    count: SEARCH_LIMIT,
  };

  const queryInputs = await buildQueryInputs(params);

  console.log('\n==================================================');
  console.log(`TOPIC: ${topic.label}`);
  console.log(`QUERY: ${topic.mainTopic}`);
  console.log('==================================================');

  const startedAt = performance.now();
  const response = await searchAll(
    params,
    queryInputs.queryContext,
    queryInputs.scopusQuery,
    queryInputs.booleanQuery
  );
  const durationMs = performance.now() - startedAt;

  const summary = summarizeResults(topic, response, durationMs);
  console.log(
    JSON.stringify(
      {
        topic: summary.label,
        returnedCount: summary.returnedCount,
        totalFound: summary.totalFound,
        demoMode: summary.demoMode,
        failedSourceCount: summary.failedSourceCount,
        durationMs: summary.durationMs,
      },
      null,
      2
    )
  );

  return summary;
}

async function writeReports(results) {
  const outputDir = path.join(__dirname, 'reports');
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outputDir, `search-smoke-10-topics-${timestamp}.json`);
  const mdPath = path.join(outputDir, `search-smoke-10-topics-${timestamp}.md`);

  const aggregate = {
    generatedAt: new Date().toISOString(),
    topicCount: results.length,
    demoModeCount: results.filter((item) => item.demoMode).length,
    zeroResultCount: results.filter((item) => item.returnedCount === 0).length,
    avgDurationMs: Math.round(
      results.reduce((sum, item) => sum + item.durationMs, 0) / Math.max(results.length, 1)
    ),
    topics: results,
  };

  const mdLines = [
    '# Search Smoke Report',
    '',
    `Generated: ${aggregate.generatedAt}`,
    `Topics: ${aggregate.topicCount}`,
    `Demo mode runs: ${aggregate.demoModeCount}`,
    `Zero-result runs: ${aggregate.zeroResultCount}`,
    `Average duration (ms): ${aggregate.avgDurationMs}`,
    '',
    '| Topic | Returned | Total Found | Demo | Failed Sources | Duration ms |',
    '|---|---:|---:|---|---:|---:|',
    ...results.map((item) => (
      `| ${item.label} | ${item.returnedCount} | ${item.totalFound ?? '-'} | ${item.demoMode ? 'yes' : 'no'} | ${item.failedSourceCount} | ${item.durationMs} |`
    )),
    '',
  ];

  await fs.writeFile(jsonPath, JSON.stringify(aggregate, null, 2), 'utf8');
  await fs.writeFile(mdPath, mdLines.join('\n'), 'utf8');

  return { jsonPath, mdPath, aggregate };
}

async function main() {
  const results = [];

  for (const topic of TOPICS) {
    try {
      const summary = await runSingleTopic(topic);
      results.push(summary);
    } catch (error) {
      results.push({
        label: topic.label,
        mainTopic: topic.mainTopic,
        durationMs: null,
        demoMode: false,
        totalFound: null,
        analyzedCount: null,
        returnedCount: 0,
        failedSourceCount: 1,
        failedSources: [{ name: 'runner', type: 'ERROR', message: error.message }],
        returnedSourceBreakdown: {},
        apiSourceBreakdown: {},
        apiTotalFound: {},
        scoreMin: null,
        scoreMax: null,
        scoreAvg: null,
        topTitles: [],
      });
      console.error(`[Smoke] Topic failed: ${topic.label}`, error.message);
    }

    await sleep(INTER_TOPIC_DELAY_MS);
  }

  const { jsonPath, mdPath, aggregate } = await writeReports(results);

  console.log('\n================ FINAL SUMMARY ================');
  console.table(
    results.map((item) => ({
      topic: item.label,
      returned: item.returnedCount,
      totalFound: item.totalFound ?? '-',
      demoMode: item.demoMode,
      failedSources: item.failedSourceCount,
      durationMs: item.durationMs ?? '-',
    }))
  );
  console.log(`Average duration (ms): ${aggregate.avgDurationMs}`);
  console.log(`Report JSON: ${jsonPath}`);
  console.log(`Report MD: ${mdPath}`);
}

main().catch((error) => {
  console.error('[Smoke] Fatal error:', error);
  process.exitCode = 1;
});
