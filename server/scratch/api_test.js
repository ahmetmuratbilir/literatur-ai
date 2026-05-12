import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnvValue(key) {
    const line = envContent.split('\n').find(l => l.startsWith(`${key}=`));
    return line ? line.split('=')[1].trim() : null;
}

const SCOPUS_KEY = getEnvValue('ELSEVIER_API_KEY');
const OPENALEX_KEY = getEnvValue('OPENALEX_API_KEY');

async function testApis() {
    console.log('--- DETAYLI API KONTROLÜ ---');

    // 1. OpenAlex
    console.log(`\n[OpenAlex] Kontrol ediliyor...`);
    console.log(`OpenAlex Key: ${OPENALEX_KEY ? OPENALEX_KEY.substring(0, 8) + '...' : 'YOK'}`);
    
    try {
        const oaUrl = 'https://api.openalex.org/works?search=artificial+intelligence&per-page=1';
        const oaHeaders = { 'User-Agent': 'LiteratureAI/1.0 (mailto:ahmet@literatureai.com)' };
        if (OPENALEX_KEY) oaHeaders['Authorization'] = `Bearer ${OPENALEX_KEY}`;
        
        const oaRes = await fetch(oaUrl, { headers: oaHeaders });
        console.log(`OpenAlex Yanıt Kodu: ${oaRes.status}`);
        
        const oaRemaining = oaRes.headers.get('x-ratelimit-remaining');
        console.log(`OpenAlex Kalan Kota: ${oaRemaining || 'Bilgi Alınamadı'}`);
        
        if (oaRes.status === 200) {
            console.log('OpenAlex Bağlantısı: BAŞARILI ✅');
        } else {
            console.log('OpenAlex Bağlantısı: SORUNLU ❌');
        }
    } catch (e) {
        console.error('OpenAlex Hatası:', e.message);
    }

    // 2. Scopus
    console.log(`\n[Scopus] Kontrol ediliyor...`);
    console.log(`Scopus Key: ${SCOPUS_KEY ? SCOPUS_KEY.substring(0, 8) + '...' : 'YOK'}`);
    
    try {
        const scopusUrl = `https://api.elsevier.com/content/search/scopus?query=TITLE-ABS-KEY(AI)&count=1`;
        const scopusRes = await fetch(scopusUrl, {
            headers: { 'X-ELS-APIKey': SCOPUS_KEY, 'Accept': 'application/json' }
        });
        console.log(`Scopus Yanıt Kodu: ${scopusRes.status}`);
        const scopusRemaining = scopusRes.headers.get('x-ratelimit-remaining');
        console.log(`Scopus Kalan Kota: ${scopusRemaining || '0'}`);
        
        if (scopusRes.status === 200) {
            console.log('Scopus Bağlantısı: BAŞARILI ✅');
        } else {
            console.log('Scopus Bağlantısı: SORUNLU ❌');
        }
    } catch (e) {
        console.error('Scopus Hatası:', e.message);
    }
}

testApis();
