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

const OPENALEX_KEY = getEnvValue('OPENALEX_API_KEY');

async function testOpenAlexNewMethod() {
    console.log('--- OPENALEX YENİ YÖNTEM TESTİ ---');
    
    // Dokümana göre: API key URL parametresi olarak eklenmeli
    const oaUrl = `https://api.openalex.org/works?search=artificial+intelligence&per-page=1&api_key=${OPENALEX_KEY}`;
    const oaHeaders = { 'User-Agent': 'LiteratureAI/1.0 (mailto:ahmet@literatureai.com)' };
    
    try {
        console.log(`İstek yapılıyor (Key parametre olarak eklendi)...`);
        const oaRes = await fetch(oaUrl, { headers: oaHeaders });
        console.log(`Yanıt Kodu: ${oaRes.status}`);
        
        if (oaRes.status === 200) {
            console.log('BİLGİ: Yeni yöntemle BAĞLANTI BAŞARILI! ✅');
            const data = await oaRes.json();
            console.log(`Sonuç Sayısı: ${data.meta.count}`);
        } else {
            console.log(`HATA: Hala 401/Hata alınıyor. Yanıt: ${oaRes.status}`);
        }
    } catch (e) {
        console.error('Hata:', e.message);
    }
}

testOpenAlexNewMethod();
