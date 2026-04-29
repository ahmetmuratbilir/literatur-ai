import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import translate from 'google-translate-api-x';
import { searchAll } from './services/search.js';
import { analyzeAndExpandQuery } from './services/llm.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/search', async (req, res) => {
  try {
    const { mainTopic, authorName, keywords, language, count } = req.query;

    let keywordList = [];

    try {
      if (keywords) {
        keywordList = JSON.parse(keywords);
      }
    } catch {
      keywordList = [];
    }

    const queryParts = [];
    const booleanQueryParts = [];
    let queryContextWords = []; // AHP kelime sayacı için saf kelimeler

    if (req.query.aiQuery) {
      const aiQuery = req.query.aiQuery;
      // Extract words for context (remove punctuation, OR, AND)
      const words = aiQuery.replace(/[()"]/g, ' ').split(/\s+/).filter(w => w.length > 2 && w !== 'OR' && w !== 'AND');
      queryContextWords.push(...words);
      
      queryParts.push(`TITLE-ABS-KEY(${aiQuery})`);
      booleanQueryParts.push(`(${aiQuery})`);
    } else if (mainTopic) {
      queryContextWords.push(mainTopic);
      // abs() abstract'ı da tarıyor → çok daha fazla makale bulunur
      let topicQuery = `title(${mainTopic}) OR key(${mainTopic}) OR abs(${mainTopic})`;

      try {
        const translated = await translate(mainTopic, { to: 'en' });

        let topicBoolean = `"${mainTopic}"`;

        if (
          translated?.text &&
          translated.text.toLowerCase() !== String(mainTopic).toLowerCase()
        ) {
          topicQuery += ` OR title(${translated.text}) OR key(${translated.text}) OR abs(${translated.text})`;
          topicBoolean += ` OR "${translated.text}"`;
          queryContextWords.push(translated.text);
        }
        booleanQueryParts.push(`(${topicBoolean})`);
      } catch (error) {
        console.error('Translate error:', error);
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
        // abs() ile abstract da aranıyor; key() ile resmi keyword alanı
        let keywordQuery = `key(${keyword}) OR abs(${keyword})`;
        let keywordBoolean = `"${keyword}"`;

        try {
          const translated = await translate(keyword, { to: 'en' });

          if (
            translated?.text &&
            translated.text.toLowerCase() !== String(keyword).toLowerCase()
          ) {
            keywordQuery += ` OR key(${translated.text}) OR abs(${translated.text})`;
            keywordBoolean += ` OR "${translated.text}"`;
            queryContextWords.push(translated.text);
          }
        } catch (error) {
          console.error('Translate error:', error);
        }

        keywordQueries.push(`(${keywordQuery})`);
        booleanQueryParts.push(`(${keywordBoolean})`);
      }

      // AND: tüm keywordler eşleşmeli → hassas arama
      queryParts.push(keywordQueries.join(' AND '));
    }

    if (language) {
      queryParts.push(`language(${language})`);
    }

    const finalQuery = queryParts.join(' AND ');

    if (!finalQuery) {
      return res.status(400).json({ error: 'At least one search parameter is required.' });
    }

    const limit = Number.isFinite(Number.parseInt(count, 10)) ? Number.parseInt(count, 10) : 10;
    const queryContext = queryContextWords.join(' ');
    const booleanQuery = booleanQueryParts.join(' AND ');

    console.log(`Received search request. Final Scopus Query: ${finalQuery}, limit: ${limit}`);
    console.log(`Boolean Query for CORE/OpenAlex: ${booleanQuery}`);

    // Yeni yapıya parametreleri gönderiyoruz
    const params = { mainTopic, authorName, keywords: keywordList, count: limit };
    const results = await searchAll(params, queryContext, finalQuery, booleanQuery);
    
    return res.json(results);
  } catch (error) {
    console.error('Search error:', error);

    const message = error instanceof Error ? error.message : 'Dahili Sunucu Hatası';
    const isQuotaError = message.includes('429') || message.includes('Kotanız');

    return res.status(isQuotaError ? 429 : 500).json({
      error: message,
      quota: error?.quota || null,
    });
  }
});

app.post('/api/analyze-query', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    const analysis = await analyzeAndExpandQuery(topic);
    return res.json(analysis);
  } catch (error) {
    console.error('AI analyze error:', error);
    return res.status(500).json({ error: error.message || 'AI analysis failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
