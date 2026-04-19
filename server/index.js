import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { searchLiterature } from './services/elsevier.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

import translate from 'google-translate-api-x';

// Main search endpoint
app.get('/api/search', async (req, res) => {
    try {
        const { mainTopic, authorName, keywords, language, count } = req.query;
        
        let kwList = [];
        try {
            if (keywords) kwList = JSON.parse(keywords);
        } catch(e){}

        const queryParts = [];
        
        // Translate and build query
        if (mainTopic) {
            let topicQuery = `title(${mainTopic}) OR key(${mainTopic})`;
            try {
                const tr = await translate(mainTopic, { to: 'en' });
                if (tr && tr.text && tr.text.toLowerCase() !== mainTopic.toLowerCase()) {
                    topicQuery += ` OR title(${tr.text}) OR key(${tr.text})`;
                }
            } catch(e) { console.error("Translate error:", e); }
            queryParts.push(`(${topicQuery})`);
        }

        if (authorName) {
            queryParts.push(`aut(${authorName})`);
        }

        if (kwList.length > 0) {
            let kwQueries = [];
            for (let k of kwList) {
                let kQuery = `key(${k})`;
                try {
                    const tr = await translate(k, { to: 'en' });
                    if (tr && tr.text && tr.text.toLowerCase() !== k.toLowerCase()) {
                        kQuery += ` OR key(${tr.text})`;
                    }
                } catch(e) { console.error("Translate error:", e); }
                kwQueries.push(`(${kQuery})`);
            }
            queryParts.push(kwQueries.join(' AND '));
        }

        if (language) {
            queryParts.push(`language(${language})`);
        }

        const finalQuery = queryParts.join(' AND ');

        if (!finalQuery) {
            return res.status(400).json({ error: 'At least one search parameter is required' });
        }

        const limit = count ? parseInt(count) : 100;
        
        console.log(`Received search request. Final Query: ${finalQuery}, limit: ${limit}`);
        
        const results = await searchLiterature(finalQuery, limit, null);
        res.json(results);
        
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
