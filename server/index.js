import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import translate from 'google-translate-api-x';
import mongoose from 'mongoose';
import { searchAll } from './services/search.js';
import { analyzeAndExpandQuery } from './services/llm.js';
import { withTimeout } from './utils/http.js';
import SearchHistory from './models/SearchHistory.js';
import Collection from './models/Collection.js';
import Analysis from './models/Analysis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));
} else {
  console.warn('MONGODB_URI is not defined in .env. Search history will not be saved.');
}

const app = express();
const PORT = process.env.PORT || 3000;
const TRANSLATE_TIMEOUT_MS = 2500;
const MAX_SEARCH_COUNT = 100;

app.use(cors());
app.use(express.json());

async function translateToEnglish(text) {
  return withTimeout(
    translate(text, { to: 'en' }),
    TRANSLATE_TIMEOUT_MS,
    `Translate timeout after ${TRANSLATE_TIMEOUT_MS}ms`
  );
}

app.get('/api/health', (req, res) => {
  // Never return raw secrets. Only surface whether a key exists.
  const has = (v) => typeof v === 'string' && v.trim().length > 0;
  return res.json({
    ok: true,
    port: Number(PORT),
    services: {
      scopus: has(process.env.ELSEVIER_API_KEY),
      openalex: has(process.env.OPENALEX_API_KEY),
      core: has(process.env.CORE_API_KEY),
      groq: has(process.env.GROQ_API_KEY),
    },
    demoFallback: true,
  });
});

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
      // Convert single quotes to double quotes for Scopus/Academic engines
      let aiQuery = req.query.aiQuery.replace(/'/g, '"');

      // AI prompt İngilizce sorgu üretmesi için zorlanıyor ama her zaman doğrulayalım:
      // ASCII-Türkçe (yapay zeka, elektrikli arac vb.) veya tam Türkçe karakterler olabilir.
      // Operatörler ("OR", "AND", parantezler, tırnaklar) Google Translate'i çoğunlukla bozmaz;
      // yine de çevirinin orijinalden anlamlı şekilde farklı olduğu durumda çeviriyi kullanırız.
      try {
        const translatedAi = await translateToEnglish(aiQuery);
        const original = aiQuery.trim().toLowerCase();
        const translated = translatedAi?.text?.trim();
        if (translated && translated.toLowerCase() !== original) {
          console.log(`AI sorgusu İngilizce'ye çevrildi: "${aiQuery}" → "${translated}"`);
          aiQuery = translated;
        }
      } catch (transErr) {
        console.warn('AI Query translation failed', transErr?.message || transErr);
      }

      const words = aiQuery.replace(/[()"]/g, ' ').split(/\s+/).filter(w => w.length > 2 && w !== 'OR' && w !== 'AND');
      queryContextWords.push(...words);

      queryParts.push(`TITLE-ABS-KEY(${aiQuery})`);
      booleanQueryParts.push(`(${aiQuery})`);
    } else if (mainTopic) {
      // Clean and sanitize main topic
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

    const requestedLimit = Number.isFinite(Number.parseInt(count, 10)) ? Number.parseInt(count, 10) : 25;
    const limit = Math.min(MAX_SEARCH_COUNT, Math.max(10, requestedLimit));
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
    if (!process.env.GROQ_API_KEY?.trim()) {
      return res.status(400).json({ error: 'GROQ_API_KEY is not defined on the server' });
    }
    const analysis = await analyzeAndExpandQuery(topic);
    return res.json(analysis);
  } catch (error) {
    console.error('AI analyze error:', error);
    return res.status(500).json({ error: error.message || 'AI analysis failed' });
  }
});

// --- History API ---

app.get('/api/history', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // DB connection check
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }

    const history = await SearchHistory.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);
    
    return res.json(history);
  } catch (error) {
    console.error('History fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.post('/api/history', async (req, res) => {
  try {
    const { userId, mainTopic, authorName, keywords, aiQuery } = req.body;
    
    if (!userId || (!mainTopic && !authorName && !aiQuery)) {
      return res.status(400).json({ error: 'Missing history data' });
    }

    // DB connection check
    if (mongoose.connection.readyState !== 1) {
      return res.json({ message: 'DB not connected, history not saved' });
    }

    // Duplicate check: Find the most recent search by this user
    const lastSearch = await SearchHistory.findOne({ userId }).sort({ createdAt: -1 });
    
    if (lastSearch) {
      const isDuplicate = 
        lastSearch.mainTopic === mainTopic && 
        lastSearch.authorName === authorName && 
        JSON.stringify(lastSearch.keywords) === JSON.stringify(keywords) &&
        lastSearch.aiQuery === aiQuery;
      
      if (isDuplicate) {
        // Update the timestamp of the existing record instead of creating a new one
        lastSearch.createdAt = new Date();
        await lastSearch.save();
        return res.json(lastSearch);
      }
    }

    // Data Minimization: Truncate long strings and clean up
    const cleanHistory = {
      userId,
      mainTopic: mainTopic?.trim().slice(0, 200),
      authorName: authorName?.trim().slice(0, 100),
      keywords: Array.isArray(keywords) ? keywords.map(k => k.trim().slice(0, 50)).filter(Boolean) : [],
      aiQuery: aiQuery?.trim().slice(0, 500)
    };

    const newHistory = new SearchHistory(cleanHistory);

    await newHistory.save();

    // Auto-Cleanup: Keep only the last 10 searches for this user
    try {
      const historyCount = await SearchHistory.countDocuments({ userId });
      if (historyCount > 10) {
        // Find and delete the oldest items exceeding the limit
        const oldestItems = await SearchHistory.find({ userId })
          .sort({ createdAt: 1 })
          .limit(historyCount - 10);
        
        const idsToDelete = oldestItems.map(item => item._id);
        await SearchHistory.deleteMany({ _id: { $in: idsToDelete } });
      }
    } catch (cleanupErr) {
      console.warn('Auto-cleanup failed', cleanupErr);
    }

    return res.status(201).json(newHistory);
  } catch (error) {
    console.error('History save error:', error);
    return res.status(500).json({ error: 'Failed to save history' });
  }
});

const requireDb = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: 'DB not connected' });
    return false;
  }
  return true;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

app.delete('/api/history/entry/:id', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Geçersiz id' });
    const result = await SearchHistory.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ error: 'Entry not found' });
    return res.json({ message: 'Entry deleted' });
  } catch (error) {
    console.error('Entry delete error:', error);
    return res.status(500).json({ error: 'Failed to delete entry' });
  }
});

app.delete('/api/history/:userId', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    const { userId } = req.params;
    await SearchHistory.deleteMany({ userId });
    return res.json({ message: 'History cleared' });
  } catch (error) {
    console.error('History delete error:', error);
    return res.status(500).json({ error: 'Failed to clear history' });
  }
});

// --- Collections API ---

app.get('/api/collections', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // DB connection check
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }

    const collections = await Collection.find({ userId }).sort({ createdAt: -1 });
    return res.json(collections);
  } catch (error) {
    console.error('Collections fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

const MAX_COLLECTIONS_PER_USER = 10;

app.post('/api/collections', async (req, res) => {
  try {
    const { userId, name } = req.body || {};
    if (!userId || !name) return res.status(400).json({ error: 'Missing data' });

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'DB not connected' });
    }

    const total = await Collection.countDocuments({ userId });
    if (total >= MAX_COLLECTIONS_PER_USER) {
      return res.status(400).json({ error: `En fazla ${MAX_COLLECTIONS_PER_USER} koleksiyon oluşturulabilir.` });
    }

    const newCollection = new Collection({
      userId,
      name: String(name).trim().slice(0, 60),
      papers: []
    });
    await newCollection.save();
    return res.status(201).json(newCollection);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Bu isimde bir koleksiyon zaten var' });
    }
    console.error('Collection save error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to create collection' });
  }
});

const MAX_PAPERS_PER_COLLECTION = 10;

const truncate = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');

app.post('/api/collections/:id/add', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Geçersiz id' });
    const { paper } = req.body || {};

    if (!paper || (!paper.title && !paper.doi)) {
      return res.status(400).json({ error: 'Paper data eksik' });
    }

    const collection = await Collection.findById(id);
    if (!collection) return res.status(404).json({ error: 'Collection not found' });

    // KB-minimize: schema maxlength sınırlarına paralel kısaltma
    const minimizedPaper = {
      title: truncate(paper.title, 200),
      year: truncate(String(paper.year ?? ''), 8),
      authors: truncate(paper.authors || paper.creator, 100),
      url: truncate(paper.url, 200),
      doi: truncate(paper.doi, 80),
      publicationName: truncate(paper.publicationName, 100),
      citedBy: Math.max(0, Number(paper.citedBy) || 0),
      description: truncate(paper.description, 150)
    };

    // Mükerrer kontrolü
    const exists = collection.papers.some(p =>
      (minimizedPaper.doi && p.doi === minimizedPaper.doi) ||
      (!minimizedPaper.doi && p.title === minimizedPaper.title)
    );
    if (exists) return res.status(400).json({ error: 'Bu makale zaten koleksiyonda' });

    // 100 kayıt sınırı: en eski paper'ı düşür
    if (collection.papers.length >= MAX_PAPERS_PER_COLLECTION) {
      collection.papers.sort((a, b) => new Date(a.savedAt || 0) - new Date(b.savedAt || 0));
      collection.papers.shift();
    }

    collection.papers.push(minimizedPaper);
    await collection.save();
    return res.json(collection);
  } catch (error) {
    console.error('Add to collection error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to add paper' });
  }
});

// Bir koleksiyondan tek bir paper'ı çıkar
app.delete('/api/collections/:id/papers/:paperId', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    const { id, paperId } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Geçersiz collection id' });
    const collection = await Collection.findById(id);
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    const before = collection.papers.length;
    collection.papers = collection.papers.filter(p => String(p._id) !== String(paperId));
    if (collection.papers.length === before) {
      return res.status(404).json({ error: 'Paper not found in collection' });
    }
    await collection.save();
    return res.json(collection);
  } catch (error) {
    console.error('Remove paper error:', error);
    return res.status(500).json({ error: 'Failed to remove paper' });
  }
});

app.delete('/api/collections/:id', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Geçersiz id' });
    const result = await Collection.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ error: 'Collection not found' });
    return res.json({ message: 'Collection deleted' });
  } catch (error) {
    console.error('Collection delete error:', error);
    return res.status(500).json({ error: 'Failed to delete collection' });
  }
});

// --- Analyses API ---

app.get('/api/analyses', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    if (mongoose.connection.readyState !== 1) return res.json([]);

    const analyses = await Analysis.find({ userId }).sort({ createdAt: -1 });
    return res.json(analyses);
  } catch (error) {
    console.error('Analyses fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch analyses' });
  }
});

const MAX_ANALYSES_PER_USER = 100;

app.post('/api/analyses', async (req, res) => {
  try {
    const { userId, topic, explanation, queries } = req.body || {};
    if (!userId || !topic) return res.status(400).json({ error: 'Missing analysis data' });

    if (mongoose.connection.readyState !== 1) {
      return res.json({ message: 'DB not connected, analysis not saved' });
    }

    const cleanQueries = Array.isArray(queries)
      ? queries.slice(0, 10).map(q => ({
          text: typeof q?.text === 'string' ? q.text.trim().slice(0, 180) : '',
          relevanceScore: Math.max(0, Math.min(100, Number(q?.relevanceScore) || 0))
        }))
      : [];

    const newAnalysis = new Analysis({
      userId,
      topic: String(topic).trim().slice(0, 150),
      explanation: typeof explanation === 'string' ? explanation.trim().slice(0, 500) : '',
      queries: cleanQueries
    });
    await newAnalysis.save();

    // Auto-cleanup: 100 kayıt cap'i, en eskileri sil
    try {
      const total = await Analysis.countDocuments({ userId });
      if (total > MAX_ANALYSES_PER_USER) {
        const overflow = await Analysis.find({ userId })
          .sort({ createdAt: 1 })
          .limit(total - MAX_ANALYSES_PER_USER);
        await Analysis.deleteMany({ _id: { $in: overflow.map(a => a._id) } });
      }
    } catch (cleanupErr) {
      console.warn('Analysis cleanup failed', cleanupErr);
    }

    return res.status(201).json(newAnalysis);
  } catch (error) {
    console.error('Analysis save error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to save analysis' });
  }
});

app.delete('/api/analyses/:id', async (req, res) => {
  try {
    if (!requireDb(res)) return;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Geçersiz id' });
    const result = await Analysis.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ error: 'Analysis not found' });
    return res.json({ message: 'Analysis deleted' });
  } catch (error) {
    console.error('Analysis delete error:', error);
    return res.status(500).json({ error: 'Failed to delete analysis' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
