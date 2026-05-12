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
const CONTACT_EMAIL = getEnvValue('CONTACT_EMAIL') || 'ahmet@literatureai.com';

async function testFinalConfig() {
    console.log('--- FINAL API & POLITE POOL TESTİ ---');

    // 1. OpenAlex Polite Pool Testi
    console.log(`\n[OpenAlex] Polite Pool (mailto) deneniyor...`);
    console.log(`E-posta: ${CONTACT_EMAIL}`);
    
    try {
        const oaUrl = `https://api.openalex.org/works?search=artificial+intelligence&per-page=1&mailto=${CONTACT_EMAIL}`;
        const oaHeaders = { 'User-Agent': `LiteratureAI/1.0 (mailto:${CONTACT_EMAIL})` };
        
        const oaRes = await fetch(oaUrl, { headers: oaHeaders });
        console.log(`Yanıt Kodu: ${oaRes.status}`);
        
        const oaRemaining = oaRes.headers.get('x-ratelimit-remaining');
        console.log(`Kalan Kota (Polite Pool): ${oaRemaining || 'Bilgi Alınamadı'}`);
        
        if (oaRes.status === 200) {
            console.log('OpenAlex: BAĞLANTI MÜKEMMEL! ✅');
        } else {
            console.log('OpenAlex: HATA! ❌');
        }
    } catch (e) {
        console.error('OpenAlex Hatası:', e.message);
    }

    // 2. Scopus Testi
    console.log(`\n[Scopus] Kontrol ediliyor...`);
    try {
        const scopusUrl = `https://api.elsevier.com/content/search/scopus?query=TITLE-ABS-KEY(AI)&count=1`;
        const scopusRes = await fetch(scopusUrl, {
            headers: { 'X-ELS-APIKey': SCOPUS_KEY, 'Accept': 'application/json' }
        });
        console.log(`Yanıt Kodu: ${scopusRes.status}`);
        if (scopusRes.status === 200) {
            console.log('Scopus: BAĞLANTI MÜKEMMEL! ✅');
        } else {
            console.log(`Scopus: HATA (${scopusRes.status})! ❌`);
        }
    } catch (e) {
        console.error('Scopus Hatası:', e.message);
    }
}

testFinalConfig();
