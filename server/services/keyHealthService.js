/**
 * Yapılandırılmış her sağlayıcıya birer minimal canlı istek atıp anahtarın
 * gerçekten çalışıp çalışmadığını raporlar.
 *
 * config/envValidation.js biçim kontrolü yapar — değer şablon metni mi, ön eki
 * doğru mu. Burası farklı bir soruyu yanıtlar: sağlayıcı bu anahtarı kabul
 * ediyor mu? Biçimi kusursuz ama iptal edilmiş bir anahtar yalnızca burada
 * yakalanır.
 *
 * KURAL: Anahtar değerleri döndürülen nesneye hiçbir koşulda girmez.
 * Yalnızca servis adı, durum ve HTTP sonucu.
 */
import dns from 'node:dns/promises';
import { getGroqModel, getGeminiModel, getDeepseekModel, getProviderOrder, DEEPSEEK_BASE_URL } from '../config/aiModels.js';
import net from 'node:net';

const DEFAULT_TIMEOUT_MS = 12000;

async function request(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
    return {
      status: response.status,
      ok: response.ok,
      body: (await response.text()).slice(0, 200),
      ms: Date.now() - startedAt,
    };
  } catch (error) {
    const code = error.name === 'TimeoutError'
      ? `TIMEOUT>${timeoutMs}ms`
      : (error.cause && error.cause.code) || error.message;
    return { status: 0, ok: false, err: code, ms: Date.now() - startedAt };
  }
}

/**
 * HTTP sonucunu tek bir duruma indirger.
 * @returns {'ok'|'invalid_key'|'quota'|'unreachable'|'error'}
 */
function classify(result) {
  if (result.status === 0) return { state: 'unreachable', detail: result.err };
  if (result.status === 401 || result.status === 403) {
    return { state: 'invalid_key', detail: `HTTP ${result.status}` };
  }
  if (result.status === 429 || result.status === 406) {
    return { state: 'quota', detail: `HTTP ${result.status} — anahtar geçerli, kota dolu` };
  }
  if (result.ok) return { state: 'ok', detail: `HTTP ${result.status}` };
  return { state: 'error', detail: `HTTP ${result.status}` };
}

const row = (service, required, state, detail, ms = null) => ({
  service, required, state, detail, ms,
});

async function probeMongo(uri) {
  if (!uri) return row('MongoDB', true, 'missing', '.env içinde tanımlı değil');

  try {
    const isSrv = uri.startsWith('mongodb+srv://');
    const parsed = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'https://'));

    const targets = isSrv
      ? (await dns.resolveSrv(`_mongodb._tcp.${parsed.hostname}`))
          .map((record) => ({ host: record.name, port: record.port }))
      : [{ host: parsed.hostname, port: Number(parsed.port) || 27017 }];

    const startedAt = Date.now();
    const reachable = await new Promise((resolve) => {
      const socket = net.createConnection({ host: targets[0].host, port: targets[0].port, timeout: 6000 });
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
    });

    return reachable
      ? row('MongoDB', true, 'ok', `${targets.length} node — kimlik doğrulama test edilmedi`, Date.now() - startedAt)
      : row('MongoDB', true, 'unreachable', `TCP ${targets[0].port} kapalı`, Date.now() - startedAt);
  } catch (error) {
    const isDns = error.code === 'ENOTFOUND' || error.code === 'ENODATA';
    return row(
      'MongoDB',
      true,
      'unreachable',
      isDns
        ? `${error.code} — host adı çözülemiyor. Bu bir IP izin listesi hatası değil; URI yanlış veya küme silinmiş.`
        : error.code || error.message
    );
  }
}

/**
 * Tüm servisleri sırayla yoklar.
 *
 * @param {object} env - okunacak ortam (varsayılan process.env)
 * @returns {Promise<{checkedAt: string, rows: Array, summary: object}>}
 */
export async function probeAllServices(env = process.env) {
  const rows = [];

  const providerOrder = getProviderOrder();
  const isPrimary = (name) => providerOrder[0] === name;

  // --- DeepSeek ---
  if (env.DEEPSEEK_API_KEY) {
    const model = getDeepseekModel('quality');
    const result = await request(`${DEEPSEEK_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
    });
    let { state, detail } = classify(result);

    // DeepSeek 24 Tem 2026'da deepseek-chat/deepseek-reasoner adlarini
    // emekliye ayirdi. Anahtar gecerli olsa bile eski ad 404 doner.
    if (state === 'ok') {
      let available = [];
      try {
        available = (JSON.parse(result.body).data || []).map((m) => m.id);
      } catch {
        // Govde kirpilmis olabilir.
      }
      if (available.length > 0 && !available.includes(model)) {
        state = 'model_missing';
        detail = `anahtar gecerli ama "${model}" modeli yok — DEEPSEEK_MODEL_QUALITY ayarlanmali`;
      } else {
        detail += ` — model: ${model}`;
      }
    }
    rows.push(row('DeepSeek', isPrimary('deepseek'), state, detail, result.ms));
  } else if (providerOrder.includes('deepseek')) {
    rows.push(row('DeepSeek', isPrimary('deepseek'), 'missing',
      'AI_PROVIDERS listesinde ama DEEPSEEK_API_KEY yok'));
  }

  // --- Gemini ---
  if (env.GEMINI_API_KEY) {
    const key = encodeURIComponent(env.GEMINI_API_KEY);
    const model = getGeminiModel();
    const result = await request(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    let { state, detail } = classify(result);

    // Gecerli anahtar + kaldirilmis model = 404. Sadece anahtari dogrulamak
    // bunu kacirir; model adini da sormak zorundayiz.
    if (state === 'ok') {
      const probe = await request(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${key}`
      );
      if (!probe.ok) {
        state = 'model_missing';
        detail = `anahtar gecerli ama "${model}" modeli hesapta yok (HTTP ${probe.status})`;
      } else {
        detail += ` — model: ${model}`;
      }
    }
    rows.push(row('Gemini', false, state, detail, result.ms));
  } else {
    rows.push(row('Gemini', false, 'missing', 'GEMINI_API_KEY yok — metin üretimi çalışmaz'));
  }

  // --- Groq ---
  if (env.GROQ_API_KEY) {
    const model = getGroqModel();
    const result = await request('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    });
    let { state, detail } = classify(result);

    // Groq katalogdan model kaldirabiliyor (Llama boyle gitti). Anahtar
    // gecerli kalir, cagri 404 doner ve ceviri sessizce calismaz.
    if (state === 'ok') {
      let available = [];
      try {
        available = (JSON.parse(result.body).data || []).map((m) => m.id);
      } catch {
        // Govde kirpilmis olabilir; ayri bir istekle modeli dogrudan sor.
      }
      const known = available.length > 0
        ? available.includes(model)
        : (await request(`https://api.groq.com/openai/v1/models/${model}`, {
            headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
          })).ok;

      if (!known) {
        state = 'model_missing';
        detail = `anahtar gecerli ama "${model}" modeli hesapta yok — GROQ_MODEL ayarlanmali`;
      } else {
        detail += ` — model: ${model}`;
      }
    }
    rows.push(row('Groq', false, state, detail, result.ms));
  } else {
    rows.push(row('Groq', false, 'missing', 'GROQ_API_KEY yok — yedek LLM ve Türkçe çeviri kapalı'));
  }

  // --- Clerk ---
  if (env.CLERK_SECRET_KEY) {
    const result = await request('https://api.clerk.com/v1/users?limit=1', {
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
    });
    const { state, detail } = classify(result);
    const mode = env.CLERK_SECRET_KEY.startsWith('sk_live') ? 'LIVE'
      : env.CLERK_SECRET_KEY.startsWith('sk_test') ? 'TEST' : 'bilinmiyor';
    rows.push(row('Clerk', true, state, `${detail} — ortam: ${mode}`, result.ms));
  } else {
    rows.push(row('Clerk', true, 'missing', 'CLERK_SECRET_KEY yok — korumalı uçlar 401 döner'));
  }

  // --- MongoDB ---
  rows.push(await probeMongo(env.MONGODB_URI));

  // --- Scopus ---
  const scopusKey = env.SCOPUS_API_KEY || env.ELSEVIER_API_KEY;
  if (scopusKey) {
    const headers = { Accept: 'application/json', 'X-ELS-APIKey': scopusKey };
    const instToken = env.SCOPUS_INSTTOKEN || env.ELSEVIER_INSTTOKEN;
    if (instToken) headers['X-ELS-Insttoken'] = instToken;
    const result = await request(
      'https://api.elsevier.com/content/search/scopus?query=TITLE(nuclear)&count=1',
      { headers }
    );
    const { state, detail } = classify(result);
    rows.push(row('Scopus', false, state, `${detail} — insttoken: ${instToken ? 'var' : 'yok'}`, result.ms));
  } else {
    rows.push(row('Scopus', false, 'missing', 'SCOPUS_API_KEY yok'));
  }

  // --- CORE ---
  if (env.CORE_API_KEY) {
    const result = await request('https://api.core.ac.uk/v3/search/works/?q=nuclear&limit=1', {
      headers: { Authorization: `Bearer ${env.CORE_API_KEY}` },
    });
    const { state, detail } = classify(result);
    rows.push(row('CORE', false, state, detail, result.ms));
  } else {
    rows.push(row('CORE', false, 'missing', 'CORE_API_KEY yok'));
  }

  // --- Semantic Scholar (anahtarsız da çalışır) ---
  {
    const headers = env.SEMANTIC_SCHOLAR_API_KEY
      ? { 'x-api-key': env.SEMANTIC_SCHOLAR_API_KEY }
      : {};
    const result = await request(
      'https://api.semanticscholar.org/graph/v1/paper/search?query=nuclear&limit=1&fields=title',
      { headers }
    );
    const { state, detail } = classify(result);
    const mode = env.SEMANTIC_SCHOLAR_API_KEY ? 'anahtarlı' : 'anahtarsız (ortak havuz)';
    rows.push(row('Semantic Scholar', false, state, `${mode} — ${detail}`, result.ms));
  }

  // --- OpenAlex ---
  {
    const mail = env.OPENALEX_MAIL || env.CONTACT_EMAIL;
    const params = new URLSearchParams({ 'per-page': '1', search: 'nuclear' });
    if (mail) params.set('mailto', mail);
    const result = await request(`https://api.openalex.org/works?${params}`, {
      headers: { 'User-Agent': `LiteratureAI/1.0 (mailto:${mail || 'n-a'})` },
    });
    const { state, detail } = classify(result);
    rows.push(row('OpenAlex', false, state, `${detail} — polite-pool: ${mail ? 'aktif' : 'pasif'}`, result.ms));
  }

  // --- Anahtar gerektirmeyenler ---
  const keyless = [
    ['Crossref', 'https://api.crossref.org/works?query=nuclear&rows=1'],
    ['arXiv', 'http://export.arxiv.org/api/query?search_query=all:nuclear&max_results=1'],
    ['DOAJ', 'https://doaj.org/api/search/articles/nuclear?pageSize=1'],
    ['OpenCitations', 'https://opencitations.net/index/coci/api/v1/citation-count/10.1038/nature12373'],
  ];
  for (const [service, url] of keyless) {
    const result = await request(url, { headers: { 'User-Agent': 'LiteratureAI/1.0' } });
    const { state, detail } = classify(result);
    rows.push(row(service, false, state, detail, result.ms));
  }

  const summary = {
    total: rows.length,
    ok: rows.filter((r) => r.state === 'ok').length,
    failing: rows.filter((r) => r.state !== 'ok').length,
    requiredFailing: rows.filter((r) => r.required && r.state !== 'ok').length,
  };

  return { checkedAt: new Date().toISOString(), rows, summary };
}
