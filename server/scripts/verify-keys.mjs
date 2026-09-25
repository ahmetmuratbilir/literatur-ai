#!/usr/bin/env node
/**
 * Yapılandırılmış her sağlayıcıya birer minimal canlı istek atar ve anahtarın
 * gerçekten çalışıp çalışmadığını raporlar.
 *
 * config/envValidation.js biçim kontrolü yapar; bu script ise sağlayıcıya
 * sorar. Bir anahtar biçim olarak kusursuz görünüp iptal edilmiş olabilir.
 *
 * KURAL: anahtar değerleri hiçbir zaman yazdırılmaz; yalnızca HTTP durum kodu.
 *
 * Kullanım:  node scripts/verify-keys.mjs
 * Bağımlılık gerektirmez (yerleşik fetch kullanır).
 */
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

import { validateEnvironment, formatEnvReport } from '../config/envValidation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = process.argv[2] || path.join(__dirname, '..', '.env');
const TIMEOUT_MS = 20000;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`[HATA] .env bulunamadı: ${filePath}`);
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

async function request(url, options = {}) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return {
      status: response.status,
      ok: response.ok,
      body: (await response.text()).slice(0, 300),
      ms: Date.now() - startedAt,
    };
  } catch (error) {
    const code = error.name === 'TimeoutError'
      ? `TIMEOUT>${TIMEOUT_MS}ms`
      : (error.cause && error.cause.code) || error.message;
    return { status: 0, ok: false, err: code, ms: Date.now() - startedAt };
  }
}

function verdict(result) {
  if (result.status === 0) return ['AĞ/TIMEOUT', result.err];
  if (result.status === 401 || result.status === 403) {
    return ['ANAHTAR GEÇERSİZ', `HTTP ${result.status}`];
  }
  if (result.status === 429) return ['KOTA DOLU', 'HTTP 429 (anahtar geçerli)'];
  if (result.ok) return ['OK', `HTTP ${result.status} · ${result.ms}ms`];
  return ['HATA', `HTTP ${result.status} · ${result.body.replace(/\s+/g, ' ').slice(0, 90)}`];
}

async function checkMongo(uri) {
  if (!uri) return ['TANIMSIZ', '.env içinde yok'];
  try {
    const isSrv = uri.startsWith('mongodb+srv://');
    const parsed = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'https://'));
    const targets = isSrv
      ? (await dns.resolveSrv(`_mongodb._tcp.${parsed.hostname}`))
          .map((record) => ({ host: record.name, port: record.port }))
      : [{ host: parsed.hostname, port: Number(parsed.port) || 27017 }];

    const reachable = await new Promise((resolve) => {
      const socket = net.createConnection({ host: targets[0].host, port: targets[0].port, timeout: 8000 });
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
    });

    return reachable
      ? ['ERİŞİLEBİLİR', `${targets.length} node · kimlik doğrulama test edilmedi`]
      : ['ERİŞİLEMİYOR', `TCP ${targets[0].port} kapalı`];
  } catch (error) {
    return ['HATA', `${error.code || error.message} (DNS/URI çözülemedi)`];
  }
}

const env = loadEnvFile(ENV_PATH);

// 1. Biçim doğrulaması (ağ gerektirmez)
const validation = validateEnvironment(env);
console.log(formatEnvReport(validation));
console.log('');

// 2. Canlı doğrulama
const rows = [];
const add = (service, state, detail) => rows.push({ service, state, detail });

if (env.GEMINI_API_KEY) {
  const key = encodeURIComponent(env.GEMINI_API_KEY);
  const result = await request(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  let [state, detail] = verdict(result);
  if (result.ok) {
    const wanted = env.GEMINI_MODEL || 'gemini-2.5-flash';
    const chat = await request(`https://generativelanguage.googleapis.com/v1beta/models/${wanted}?key=${key}`);
    const embed = await request(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001?key=${key}`);
    detail += ` · ${wanted}: ${chat.ok ? 'VAR' : 'YOK'} · embedding: ${embed.ok ? 'VAR' : 'YOK'}`;
    if (!chat.ok || !embed.ok) state = 'KISMİ';
  }
  add('Gemini', state, detail);
} else {
  add('Gemini', 'TANIMSIZ', 'GEMINI_API_KEY yok');
}

if (env.GROQ_API_KEY) {
  const result = await request('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
  });
  add('Groq', ...verdict(result));
} else {
  add('Groq', 'TANIMSIZ', 'GROQ_API_KEY yok');
}

const scopusKey = env.SCOPUS_API_KEY || env.ELSEVIER_API_KEY;
if (scopusKey) {
  const headers = { Accept: 'application/json', 'X-ELS-APIKey': scopusKey };
  const instToken = env.SCOPUS_INSTTOKEN || env.ELSEVIER_INSTTOKEN;
  if (instToken) headers['X-ELS-Insttoken'] = instToken;
  const result = await request(
    'https://api.elsevier.com/content/search/scopus?query=TITLE(nuclear)&count=1',
    { headers }
  );
  const [state, detail] = verdict(result);
  add('Scopus', state, `${detail} · insttoken: ${instToken ? 'var' : 'yok'}`);
} else {
  add('Scopus', 'TANIMSIZ', 'SCOPUS_API_KEY / ELSEVIER_API_KEY yok');
}

if (env.CORE_API_KEY) {
  const result = await request('https://api.core.ac.uk/v3/search/works/?q=nuclear&limit=1', {
    headers: { Authorization: `Bearer ${env.CORE_API_KEY}` },
  });
  add('CORE', ...verdict(result));
} else {
  add('CORE', 'TANIMSIZ', 'CORE_API_KEY yok (anahtarsız kota çok düşük)');
}

{
  const headers = env.SEMANTIC_SCHOLAR_API_KEY ? { 'x-api-key': env.SEMANTIC_SCHOLAR_API_KEY } : {};
  const result = await request(
    'https://api.semanticscholar.org/graph/v1/paper/search?query=nuclear&limit=1&fields=title',
    { headers }
  );
  const [state, detail] = verdict(result);
  add('Semantic Scholar', state, `${env.SEMANTIC_SCHOLAR_API_KEY ? 'anahtarlı' : 'ANAHTARSIZ'} · ${detail}`);
}

{
  const mail = env.OPENALEX_MAIL || env.CONTACT_EMAIL;
  const params = new URLSearchParams({ 'per-page': '1', search: 'nuclear' });
  if (mail) params.set('mailto', mail);
  const result = await request(`https://api.openalex.org/works?${params}`, {
    headers: { 'User-Agent': `LiteratureAI/1.0 (mailto:${mail || 'n-a'})` },
  });
  const [state, detail] = verdict(result);
  add('OpenAlex', state, `${detail} · polite-pool: ${mail ? 'aktif' : 'PASİF'}`);
}

if (env.CLERK_SECRET_KEY) {
  const result = await request('https://api.clerk.com/v1/users?limit=1', {
    headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
  });
  const [state, detail] = verdict(result);
  const mode = env.CLERK_SECRET_KEY.startsWith('sk_live') ? 'LIVE'
    : env.CLERK_SECRET_KEY.startsWith('sk_test') ? 'TEST' : 'bilinmiyor';
  add('Clerk', state, `${detail} · ortam: ${mode}`);
} else {
  add('Clerk', 'TANIMSIZ', 'CLERK_SECRET_KEY yok — tüm korumalı uçlar 401 döner');
}

add('MongoDB', ...(await checkMongo(env.MONGODB_URI)));

for (const [service, url] of [
  ['Crossref', 'https://api.crossref.org/works?query=nuclear&rows=1'],
  ['arXiv', 'http://export.arxiv.org/api/query?search_query=all:nuclear&max_results=1'],
  ['DOAJ', 'https://doaj.org/api/search/articles/nuclear?pageSize=1'],
  ['OpenCitations', 'https://opencitations.net/index/coci/api/v1/citation-count/10.1038/nature12373'],
]) {
  const result = await request(url, { headers: { 'User-Agent': 'LiteratureAI/1.0' } });
  add(`${service} (anahtarsız)`, ...verdict(result));
}

const pad = (value, width) => String(value).padEnd(width);
console.log('='.repeat(100));
console.log(pad('SERVİS', 26) + pad('SONUÇ', 20) + 'DETAY');
console.log('='.repeat(100));
for (const row of rows) console.log(pad(row.service, 26) + pad(row.state, 20) + row.detail);
console.log('='.repeat(100));

const healthy = rows.filter((row) => ['OK', 'ERİŞİLEBİLİR'].includes(row.state));
console.log(`\n${rows.length} kontrol · ${healthy.length} sağlıklı · ${rows.length - healthy.length} sorunlu`);

process.exit(validation.errors.length > 0 ? 1 : 0);
