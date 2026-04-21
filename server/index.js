import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import translate from 'google-translate-api-x';
import { searchLiterature } from './services/elsevier.js';

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

    if (mainTopic) {
      let topicQuery = `title(${mainTopic}) OR key(${mainTopic})`;

      try {
        const translated = await translate(mainTopic, { to: 'en' });

        if (
          translated?.text &&
          translated.text.toLowerCase() !== String(mainTopic).toLowerCase()
        ) {
          topicQuery += ` OR title(${translated.text}) OR key(${translated.text})`;
        }
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
        let keywordQuery = `key(${keyword})`;

        try {
          const translated = await translate(keyword, { to: 'en' });

          if (
            translated?.text &&
            translated.text.toLowerCase() !== String(keyword).toLowerCase()
          ) {
            keywordQuery += ` OR key(${translated.text})`;
          }
        } catch (error) {
          console.error('Translate error:', error);
        }

        keywordQueries.push(`(${keywordQuery})`);
      }

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

    console.log(`Received search request. Final Query: ${finalQuery}, limit: ${limit}`);

    const results = await searchLiterature(finalQuery, limit, null);
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
