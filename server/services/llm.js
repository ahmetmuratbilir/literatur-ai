import { fetch } from 'undici';
import { resolveChatProvider, chatProvidersInOrder } from '../config/aiModels.js';
import { logAiUsage } from '../utils/aiUsage.js';
import { tokenizeBoolean, isWellFormed } from './sourceQuery.js';

/**
 * "AI ile geliştir": niyet + anahtar kavramlar + arama yaklaşımları.
 *
 * Sağlayıcı sırası bu çağrı için sabit: Groq (hızlı, ücretsiz katman) ->
 * DeepSeek -> Gemini. Anahtarı olan her biri sırayla denenir; kota, zaman
 * aşımı, geçersiz JSON ya da parantezi bozuk sorgu sıradakine geçirir.
 * Kullanıcı hangi modelin yanıt verdiğini fark etmez: çıktı her zaman
 * normalizeQueryAnalysis'ten aynı biçimde çıkar.
 *
 * Görünen metinler (niyet, kavram etiketleri, yaklaşım başlıkları) arayüz
 * dilinde; arama sorguları her zaman İngilizce Boolean. Boolean sorgu
 * kullanıcıya gösterilmez, arama arka planda onunla yapılır.
 */
const QUERY_ANALYSIS_PROVIDER_ORDER = ['groq', 'deepseek', 'gemini'];
const PROVIDER_TIMEOUT_MS = 15000;

const DISPLAY_LANGUAGE = { tr: 'Turkish', en: 'English' };

export function buildQueryAnalysisPrompt(lang = 'tr') {
  const display = DISPLAY_LANGUAGE[lang] || DISPLAY_LANGUAGE.tr;
  return `You are an expert academic search strategist. Analyze the user's research topic and plan a literature search.
Return ONLY a JSON object with exactly this structure:
{
  "intent": "one sentence: what the user wants to find (${display})",
  "keywords": [
    { "label": "concept as the user would say it (${display})", "term": "academic search term in English", "weight": 3 }
  ],
  "queries": [
    {
      "label": "2-6 word title of this search approach (${display})",
      "focus": "one sentence: what this search emphasizes (${display})",
      "text": "Boolean search query in English",
      "keywords": ["2-4 concepts this approach covers (${display})"],
      "relevanceScore": 92
    }
  ],
  "explanation": "one or two sentences on how the approaches differ (${display})"
}

RULES:
1. intent, keywords[].label, queries[].label, queries[].focus, queries[].keywords and explanation MUST be in ${display}, whatever language the topic itself is written in. Translate every concept into ${display}; keep only abbreviations (e.g. SMR, CFD) and proper names as they are. keywords[].term and queries[].text are in English.
2. keywords: 6 to 12 concepts. weight 3 = core concept of the topic, 2 = important aspect, 1 = related or broader term. Include established synonyms and abbreviations as separate keywords.
3. queries: exactly 5, each a different angle: broad overview, specific/narrow, methods, applications or outcomes, reviews and recent work.
4. Boolean syntax: put multi-word phrases in double quotes, join synonyms of one concept with OR inside parentheses, join different concepts with AND, at most 3 AND groups. Never mix OR and AND without parentheses. Do not use wildcards (*) or field tags such as TITLE( or abs:. Keep proper names untranslated.
5. relevanceScore: integer 70-99, how closely the approach matches the topic.
6. No markdown, no backticks, only raw JSON.`;
}

const clip = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const clampInt = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/**
 * Modelin bazen ürettiği iki biçim hatasını düzeltir (ölçüldü: Groq gpt-oss):
 *  - parantezsiz karışık sorgu: `"a b" OR c AND d` -> `("a b" OR c) AND d`.
 *    Parantez yokken kaynaklar bunu `c AND d` gibi okuyup sonucu daraltabilir.
 *  - joker: `review*` -> `review`. OpenAlex ve DOAJ yıldızı desteklemiyor.
 * Parantezli sorgulara dokunulmaz.
 */
export function tidyBooleanQuery(text) {
  const noWildcards = String(text || '').replace(/(\p{L})\*/gu, '$1');
  if (/[()]/.test(noWildcards) || !/\sOR\s/.test(noWildcards) || !/\sAND\s/.test(noWildcards)) return noWildcards;
  return noWildcards
    .split(/\s+AND\s+/)
    .map((part) => (/\sOR\s/.test(part) ? `(${part.trim()})` : part.trim()))
    .join(' AND ');
}

/** Sağlayıcıdan gelen ham JSON'u tek bir güvenilir biçime indirger. Saf fonksiyon (test için). */
export function normalizeQueryAnalysis(raw, lang = 'tr') {
  const seen = new Set();
  const keywords = (Array.isArray(raw?.keywords) ? raw.keywords : [])
    .map((k) => (typeof k === 'string' ? { label: k, term: k } : k))
    .map((k) => ({ label: clip(k?.label || k?.term, 60), term: clip(k?.term || k?.label, 80), weight: clampInt(k?.weight, 1, 3, 2) }))
    .filter((k) => k.label && k.term && !seen.has(k.term.toLowerCase()) && seen.add(k.term.toLowerCase()))
    .slice(0, 14);

  const queries = (Array.isArray(raw?.queries) ? raw.queries : [])
    .map((q) => (typeof q === 'string' ? { text: q } : q))
    .map((q) => {
      const text = tidyBooleanQuery(clip(q?.text, 400));
      const terms = (Array.isArray(q?.keywords) ? q.keywords : []).map((t) => clip(t, 60)).filter(Boolean).slice(0, 8);
      return {
        text,
        label: clip(q?.label, 80) || terms.slice(0, 3).join(', ') || clip(text.replace(/[()"]/g, ' ').replace(/\b(AND|OR|NOT)\b/g, ' '), 80),
        focus: clip(q?.focus, 200),
        keywords: terms,
        relevanceScore: clampInt(q?.relevanceScore, 50, 99, 80),
      };
    })
    // Parantezi dengesiz ya da terimsiz sorgu kaynaklarda sıfır sonuç veriyor.
    .filter((q) => q.text && isWellFormed(tokenizeBoolean(q.text)))
    .slice(0, 5);

  return {
    intent: clip(raw?.intent, 300),
    keywords,
    queries,
    explanation: clip(raw?.explanation, 400),
    lang: DISPLAY_LANGUAGE[lang] ? lang : 'tr',
  };
}

function parseJsonContent(content) {
  const text = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(text);
}

async function requestQueryAnalysis(provider, topic, lang) {
  const response = await fetch(provider.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: buildQueryAnalysisPrompt(lang) },
        // Dil kuralı burada da tekrarlanıyor: konu Türkçe, arayüz İngilizce
        // olduğunda model etiketleri konunun diline göre yazıyordu.
        { role: 'user', content: `Research topic: "${topic}"\nWrite intent, labels, focus and explanation in ${DISPLAY_LANGUAGE[lang] || DISPLAY_LANGUAGE.tr}.` },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      // Düşünme açık kalırsa akıl yürütme max_tokens bütçesini tüketiyor ve
      // içerik boş dönüyor; bu çağrı kısa ve kesin bir JSON istiyor.
      ...(provider.body || {}),
    }),
  });
  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 200);
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  const data = await response.json();
  logAiUsage(`${provider.name}/query-analysis`, data?.usage);
  const result = normalizeQueryAnalysis(parseJsonContent(data.choices?.[0]?.message?.content), lang);
  if (result.queries.length === 0) throw new Error('geçerli sorgu yok');
  return result;
}

export async function analyzeAndExpandQuery(topic, { lang = 'tr', providers = chatProvidersInOrder(QUERY_ANALYSIS_PROVIDER_ORDER) } = {}) {
  if (providers.length === 0) {
    throw new Error('Yapılandırılmış bir yapay zekâ sağlayıcısı yok (GROQ / DEEPSEEK / GEMINI anahtarı).');
  }
  const attempts = [];
  for (const provider of providers) {
    const started = Date.now();
    try {
      const result = await requestQueryAnalysis(provider, topic, lang);
      console.log(`[QueryAnalysis] ${provider.name} ${((Date.now() - started) / 1000).toFixed(1)} sn, ${result.queries.length} sorgu, ${result.keywords.length} kavram (${lang})`);
      return { ...result, provider: provider.name };
    } catch (error) {
      const reason = error?.name === 'TimeoutError' ? 'zaman aşımı' : String(error?.message || error).slice(0, 160);
      attempts.push(`${provider.name}: ${reason}`);
      console.warn(`[QueryAnalysis] ${provider.name} başarısız, sıradaki deneniyor: ${reason}`);
    }
  }
  const err = new Error(`Tüm yapay zekâ sağlayıcıları başarısız oldu (${attempts.join(' | ')})`);
  err.code = 'ALL_PROVIDERS_FAILED';
  throw err;
}

export async function generateConsensusSnapshot(topic, papers = []) {
  const provider = resolveChatProvider({ profile: 'fast' });
  if (!provider) {
    throw new Error('Yapilandirilmis bir sohbet saglayicisi yok (AI_PROVIDERS).');
  }

  const paperSummaries = (papers || []).slice(0, 6).map((p, i) => 
    `[${i + 1}] ${p.title} (${p.year || 'N/A'}, Atif: ${p.citedBy || 0}): ${p.abstract || p.description || ''}`
  ).join('\n\n');

  const systemPrompt = `You are an expert academic consensus research engine.
Analyze the provided scientific papers on the research topic and synthesize a clear academic consensus snapshot in TURKISH.
You MUST ALWAYS return a valid JSON object with the following structure:
{
  "consensusScore": 85,
  "consensusSummary": "1-2 sentence core scientific conclusion in Turkish",
  "keyTakeaways": [
    "Takeaway 1 in Turkish",
    "Takeaway 2 in Turkish",
    "Takeaway 3 in Turkish"
  ],
  "researchGap": "1 sentence identifying the current debate or open gap in Turkish"
}
RULES:
1. All text fields MUST be in Turkish.
2. consensusScore is an integer between 60 and 98.
3. keyTakeaways MUST contain exactly 3 concise points.
4. NO markdown, NO code block formatting, ONLY valid raw JSON.`;

  const userPrompt = `Topic: "${topic}"\n\nPapers:\n${paperSummaries}`;

  const response = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: "json_object" },
      ...(provider.body || {})
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Consensus API failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('AI returned invalid consensus JSON format');
  }
}
