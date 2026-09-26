import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGroqModel, getGeminiModel, getDeepseekModel, getActiveProviders } from '../config/aiModels.js';
import { streamWithDeepseek } from './deepseek.js';
import { fetch } from 'undici';
import { createChunksFromArticles, scoreChunksByKeywords, buildContextFromChunks } from './ragService.js';
import { getEmbedding, getEmbeddingsForChunks, searchSimilarChunksWithAtlas, cosineSimilarity } from './embeddingService.js';
import crypto from 'crypto';
import { WriterCache } from '../models/WriterCache.js';
import { buildWriterSystemPrompt } from './writerPrompt.js';
import { logAiUsage } from '../utils/aiUsage.js';

const REFERENCE_HEADING_RE = /^#{1,3}\s*(kullan(?:ilan|[ıi]lan|\?lan) kaynaklar|kaynak(?:ca|[çc]a|\?a)|references|bibliography)\s*$/im;

function cleanBibliographyValue(value, fallback = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || text.toLowerCase() === 'undefined' || text.toLowerCase() === 'null') return fallback;
  return text;
}

/**
 * APA, MLA ve Chicago yazar adindan sonra nokta koyuyor. Yazar dizesi zaten
 * bir bas harfiyle bittiginde ("Smith, J.") bu "Smith, J.." uretiyordu.
 * Kaynakca artik her belgede kodun urettigi tek liste oldugu icin bu kusur
 * her satirda gorunur hale gelirdi.
 */
function withoutTrailingPeriod(value) {
  return String(value || '').replace(/\.+$/, '');
}

function getPaperLocator(paper) {
  const doi = cleanBibliographyValue(paper.doi);
  if (doi && doi !== 'Mevcut degil') {
    return doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
  }
  return cleanBibliographyValue(paper.url);
}

function getBibliographyPapers(safePapers) {
  const seen = new Set();
  return safePapers.filter((paper) => {
    const key = cleanBibliographyValue(paper.id || paper.doi || paper.url || paper.title || paper.ref);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Kaynakca satiri.
 *
 * IEEE numarasi `paper.ref` ile geliyor, listedeki konumla degil: model metin
 * icinde chunk baglaminda gordugu `[Kaynak N]` numarasini kullaniyor ve o
 * numara ref. Mukerrer bir kaynak elendiginde konum numarasi kayar, metin ici
 * [3] ile kaynakcadaki [3] farkli makaleyi gosterirdi. Numarada bosluk olmasi
 * yanlis esleme yapmaktan iyidir.
 */
function formatBibliographyEntry(paper, index, bibliographyFormat) {
  const title = cleanBibliographyValue(paper.title, 'Başlıksız kaynak');
  const authors = cleanBibliographyValue(paper.authors, 'Bilinmeyen Yazar');
  const year = cleanBibliographyValue(paper.year, 'n.d.');
  const journal = cleanBibliographyValue(paper.journal, 'Bilinmeyen yayın');
  const locator = getPaperLocator(paper);
  const suffix = locator ? ` ${locator}` : '';

  if (bibliographyFormat === 'IEEE') {
    const number = paper.ref ?? index;
    return `[${number}] ${authors}, "${title}," ${journal}, ${year}.${suffix}`;
  }
  const authorsNoPeriod = withoutTrailingPeriod(authors);

  if (bibliographyFormat === 'MLA') {
    return `${authorsNoPeriod}. "${title}." ${journal}, ${year}.${suffix}`;
  }
  if (bibliographyFormat === 'Chicago') {
    return `${authorsNoPeriod}. "${title}." ${journal} ${year}.${suffix}`;
  }
  return `${authorsNoPeriod}. (${year}). ${title}. ${journal}.${suffix}`;
}

/**
 * Kaynakca bolumu. Artik modelin degil kodun urettigi tek kaynak oldugu icin
 * dogrudan test ediliyor (bibliography.test.js).
 */
export function buildBibliographySection(safePapers, bibliographyFormat) {
  const papers = getBibliographyPapers(safePapers);
  if (papers.length === 0) return '';
  const entries = papers.map((paper, index) =>
    formatBibliographyEntry(paper, index + 1, bibliographyFormat)
  );
  return `## Kaynakça\n\n${entries.join('\n')}`;
}

function getMissingBibliographyAppendix(text, safePapers, bibliographyFormat) {
  if (REFERENCE_HEADING_RE.test(String(text || ''))) return '';
  const section = buildBibliographySection(safePapers, bibliographyFormat);
  return section ? `\n\n${section}` : '';
}

function ensureBibliography(text, safePapers, bibliographyFormat) {
  const appendix = getMissingBibliographyAppendix(text, safePapers, bibliographyFormat);
  return appendix ? `${String(text || '').trimEnd()}${appendix}` : text;
}

/**
 * Ücretsiz / Yüksek Limitli Model Seçici (Fallback Mantığı)
 * Öncelik Sırası:
 * 1. Gemini (Eğer key varsa ve hata vermezse)
 * 2. Groq (Gemini yoksa veya hata verirse)
 */

/**
 * Gemini basarisiz oldugunda Groq'a dusulup dusulemeyecegini belirler.
 *
 * Istemciye token gonderilmisse dusulemez: Groq ikinci bir meta olayi yazar ve
 * kendi metnini akitir, istemci ikisini birlestirir. Sonuc, yarim bir Gemini
 * metni ile tam bir Groq metninin yapistirilmis hali olur; fullGeneratedText
 * hic sifirlanmadigi icin bu karisim WriterCache'e de yazilir ve sonraki ayni
 * isteklere servis edilir.
 */
export function resolveGeminiFallback({ tokensSent }) {
  if (tokensSent > 0) {
    return { canFallback: false, reason: 'stream_already_started' };
  }
  return { canFallback: true, reason: 'no_output_yet' };
}

export async function generateAcademicText(safePapers, prompt, outputType, tone, length, language, res, req, bibliographyFormat = 'APA 7') {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const isRequestAborted = () => Boolean(req?.aborted || res?.writableEnded || res?.destroyed);
  const buildRequestHash = (fingerprint) =>
    crypto.createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex');
  const promptText = prompt.trim();

  // Response Cache Kontrolü
  const stablePaperIds = safePapers
    .map((p) => String(p.id || p.doi || p.url || p.title || p.ref))
    .sort();
  const legacyPaperRefs = safePapers.map((p) => p.ref).sort();
  const requestFingerprint = {
    prompt: promptText,
    papers: stablePaperIds,
    outputType, tone, length, language, bibliographyFormat,
    promptVersion: "academic-writing-v6-bibliography-guard"
  };
  const legacyRequestFingerprint = {
    ...requestFingerprint,
    papers: legacyPaperRefs,
  };
  const requestHash = buildRequestHash(requestFingerprint);
  const legacyRequestHash = buildRequestHash(legacyRequestFingerprint);
  console.log('[CACHE] Calculated Request Hash:', requestHash);

  try {
    const cacheLookups = requestHash === legacyRequestHash
      ? [{ hash: requestHash, label: 'primary' }]
      : [
          { hash: requestHash, label: 'primary' },
          { hash: legacyRequestHash, label: 'legacy' },
        ];

    for (const lookup of cacheLookups) {
      const cachedResponse = await WriterCache.findOne({ requestHash: lookup.hash });
      if (!cachedResponse) continue;

      const cachedText = typeof cachedResponse.generatedText === 'string' ? cachedResponse.generatedText : '';
      if (!cachedText.trim()) {
        console.warn(`[CACHE] Empty Writer Cache ignored: ${lookup.hash}`);
        continue;
      }

      const text = ensureBibliography(cachedText, safePapers, bibliographyFormat);
      console.log(`[CACHE] Writer Cache Hit (${lookup.label}): ${lookup.hash}`);
      res.write(`data: ${JSON.stringify({ meta: { provider: 'cache' } })}\n\n`);
      // Cached metni parca parca stream et (dogal gorunmesi icin)
      const words = text.split(' ');
      for (let i = 0; i < words.length; i += 10) {
        if (isRequestAborted()) break;
        const chunk = words.slice(i, i + 10).join(' ') + ' ';
        res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
        await new Promise(r => setTimeout(r, 20));
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }
  } catch (cacheErr) {
    console.warn('[CACHE] Writer Cache hatası:', cacheErr.message);
  }

  let fullGeneratedText = '';
  let geminiTokensSent = 0;
  const chunks = createChunksFromArticles(safePapers);
  
  let relevantChunks = scoreChunksByKeywords(chunks, prompt, 20);
  console.log(`\n[RETRIEVAL] Faz 3B: Hybrid Keyword Scoring`);
  console.log(`[RETRIEVAL] Prompt: "${prompt}"`);
  console.log(`[RETRIEVAL] Seçilen Chunk Sayısı: ${relevantChunks.length}`);

  let retrievalMode = 'KEYWORD_FALLBACK';
  
  try {
    // 1. Cache embedding kontrolü (local cosine fallback için hazırlık)
    let chunksWithEmbeddings = [];
    try {
      chunksWithEmbeddings = await getEmbeddingsForChunks(relevantChunks);
    } catch (e) {
      console.warn('[EMBEDDING] Cache/Embedding üretimi başarısız:', e.message);
    }

    // 2. Atlas Vector Search mümkünse kullan
    const queryEmbedding = await getEmbedding(prompt);

    // ChunkEmbedding koleksiyonu tüm kullanıcılar için ortak bir cache olduğundan,
    // aramayı YALNIZCA bu isteğin makalelerinden üretilen chunk'larla sınırlıyoruz.
    // Filtre olmadan başka kullanıcıların içerikleri bağlama sızar ve üretilen
    // metin, kullanıcının seçmediği kaynaklara atıf yapar.
    const allowedContentHashes = chunksWithEmbeddings
      .map((chunk) => chunk.contentHash)
      .filter(Boolean);

    try {
      const atlasResults = await searchSimilarChunksWithAtlas(
        queryEmbedding,
        12,
        allowedContentHashes
      );
      if (atlasResults && atlasResults.length > 0) {
        relevantChunks = atlasResults;
        retrievalMode = 'ATLAS_VECTOR_SEARCH';
        console.log(`\n[RETRIEVAL] Faz 3D: Atlas Vector Search`);
      } else {
        throw new Error('Atlas sonuç boş döndü.');
      }
    } catch (atlasErr) {
      console.warn('[RETRIEVAL] Atlas Vector Search başarısız, Local Cosine deneniyor.', atlasErr.message);
      
      // 3. Başarısız olursa local cosine similarity
      if (chunksWithEmbeddings.length > 0) {
        const scored = chunksWithEmbeddings.map(chunk => {
          const score = cosineSimilarity(queryEmbedding, chunk.embedding);
          return { ...chunk, semanticScore: score };
        });
        scored.sort((a, b) => b.semanticScore - a.semanticScore);
        relevantChunks = scored.slice(0, 12);
        retrievalMode = 'LOCAL_COSINE';
        console.log(`\n[RETRIEVAL] Faz 3C: Local Cosine Similarity`);
      } else {
        throw new Error('Local cosine için embedding bulunamadı.');
      }
    }
  } catch (err) {
    // 4. O da başarısız olursa keyword fallback
    console.warn('\n[ERROR] Semantik arama başarısız, Keyword Fallback kullanılıyor.', err.message);
    relevantChunks = relevantChunks.slice(0, 12);
    retrievalMode = 'KEYWORD_FALLBACK';
  }

  // Savunma katmani: hangi retrieval modu calismis olursa olsun, baglama yalnizca
  // bu istekte secilen makalelerden gelen chunk'lar girebilir. Govdede uretilen
  // [Kaynak N] atiflari kaynakca ile ayni kume uzerinden numaralanmak zorunda.
  const allowedRefs = new Set(safePapers.map((paper) => String(paper.ref)));
  const scopedChunks = relevantChunks.filter((chunk) =>
    allowedRefs.has(String(chunk.sourceIndex))
  );

  if (scopedChunks.length !== relevantChunks.length) {
    console.warn(
      `[RETRIEVAL] Kapsam disi ${relevantChunks.length - scopedChunks.length} chunk elendi ` +
      `(mod: ${retrievalMode}).`
    );
  }

  // Tum chunk'lar elendiyse metni kaynaksiz uretmektense keyword secimine geri don.
  if (scopedChunks.length === 0) {
    console.warn('[RETRIEVAL] Kapsamli chunk kalmadi, keyword secimine donuluyor.');
    relevantChunks = scoreChunksByKeywords(chunks, prompt, 12);
    retrievalMode = 'KEYWORD_FALLBACK';
  } else {
    relevantChunks = scopedChunks;
  }

  console.log(`\n[AI] RETRIEVAL MODU: ${retrievalMode}`);
  console.log(`[AI] Seçilen en iyi chunklar hazır (${relevantChunks.length} chunk).`);

  const paperListText = buildContextFromChunks(relevantChunks, 12);

  // Sistem prompt'u writerPrompt.js'te iki parça: hiç değişmeyen sabit ön ek ve
  // isteğe özel kuyruk. Bu ayrım sağlayıcı ön-ek önbelleğinin (prefix cache)
  // çalışması için şart — gerekçesi ve kuyruk sırası o dosyanın başında.
  const systemPrompt = buildWriterSystemPrompt({
    language,
    outputType,
    tone,
    length,
    bibliographyFormat,
  });

  const userPrompt = `Aşağıdaki ${safePapers.length} makalenin bilgilerini ve özetlerini dikkatlice analiz et.

YÖNLENDIRME / KONU: ${promptText}

KAYNAKLARIN ÖZETLERİ (LİTERATÜR):
${paperListText}

Lütfen kurallara SIKI SIKIYA bağlı kalarak, uydurma bilgi içermeyen akademik bir metin üret. Kaynakça listesini sen yazma; sisteme bırak:`;

  const activeProviders = getActiveProviders();

  // 0. DEEPSEEK ILE DENE (birincil)
  //
  // Gemini dalindaki dersi burada da uyguluyoruz: meta olayi ilk gercek
  // token'a kadar bekletiliyor, boylece akis baslamadan olusan bir hata
  // istemciye hicbir sey gondermemis olur ve yedege temiz gecilebilir.
  if (activeProviders.includes('deepseek')) {
    const deepseekModel = getDeepseekModel('quality');
    let deepseekTokensSent = 0;

    try {
      console.log(`[AI] Model: DEEPSEEK (${deepseekModel})`);

      fullGeneratedText = await streamWithDeepseek({
        system: systemPrompt,
        user: userPrompt,
        profile: 'quality',
        temperature: 0.4,
        maxTokens: 3000,
        shouldStop: isRequestAborted,
        onReasoningStart: () => {
          // Dusunme modunda ilk token gelene kadar uzun bir sessizlik olur.
          // Arayuz bos ekran gostermesin diye durumu bildiriyoruz.
          res.write(`data: ${JSON.stringify({ meta: { provider: 'deepseek', model: deepseekModel, thinking: true } })}

`);
        },
        onToken: (token) => {
          if (deepseekTokensSent === 0) {
            res.write(`data: ${JSON.stringify({ meta: { provider: 'deepseek', model: deepseekModel } })}

`);
          }
          deepseekTokensSent++;
          res.write(`data: ${JSON.stringify({ token })}

`);
        },
      });

      if (!isRequestAborted()) {
        const bibliographyAppendix = getMissingBibliographyAppendix(fullGeneratedText, safePapers, bibliographyFormat);
        if (bibliographyAppendix) {
          fullGeneratedText = `${fullGeneratedText.trimEnd()}${bibliographyAppendix}`;
          res.write(`data: ${JSON.stringify({ token: bibliographyAppendix })}

`);
        }

        WriterCache.create({
          requestHash,
          generatedText: fullGeneratedText,
          prompt: promptText,
          papersCount: safePapers.length
        }).catch(err => console.warn('[CACHE] Kaydetme hatası:', err.message));

        res.write(`data: ${JSON.stringify({ done: true })}

`);
        res.end();
      }
      return;
    } catch (err) {
      const { canFallback } = resolveGeminiFallback({ tokensSent: deepseekTokensSent });

      if (!canFallback) {
        console.error('[ERROR] DeepSeek akis ortasinda kesildi, yedege gecilmedi:', err.message);
        if (!isRequestAborted()) {
          res.write(`data: ${JSON.stringify({ meta: { provider: 'deepseek', truncated: true, reason: 'stream_interrupted' } })}

`);
          res.write(`data: ${JSON.stringify({ warning: 'Metin uretimi yarida kesildi. Gosterilen icerik eksik olabilir.' })}

`);
          res.write(`data: ${JSON.stringify({ done: true })}

`);
          res.end();
        }
        return;
      }

      console.error('[ERROR] DeepSeek hatasi, yedege geciliyor:', err.message);
      fullGeneratedText = '';
    }
  }

  // 1. GEMINI İLE DENE
  if (geminiKey && activeProviders.includes('gemini')) {
    try {
      const geminiModel = getGeminiModel();
      console.log(`[AI] Model: GEMINI (${geminiModel})`);
      const genAI = new GoogleGenerativeAI(geminiKey);
      // Gemini'de system prompt'u model oluştururken verebiliriz veya user prompt içine yedirebiliriz.
      const model = genAI.getGenerativeModel({
        model: geminiModel,
        systemInstruction: systemPrompt
      });

      const streamResult = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 3000,
        }
      });
      // meta olayi ilk gercek token'a kadar bekletiliyor: Gemini akis
      // baslamadan hata verirse istemciye hicbir sey gonderilmemis olur
      // ve Groq'a temiz bicimde dusulebilir.

      let geminiUsage = null;

      for await (const chunk of streamResult.stream) {
        if (isRequestAborted()) break;
        if (chunk.usageMetadata) geminiUsage = chunk.usageMetadata;
        const text = chunk.text();
        if (text) {
          if (geminiTokensSent === 0) {
            res.write(`data: ${JSON.stringify({ meta: { provider: 'gemini', model: geminiModel } })}\n\n`);
          }
          geminiTokensSent++;
          fullGeneratedText += text;
          res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
        }
      }

      logAiUsage('writer/gemini', geminiUsage);

      if (!fullGeneratedText.trim()) {
        throw new Error('Gemini returned an empty response.');
      }

      if (!isRequestAborted()) {
        const bibliographyAppendix = getMissingBibliographyAppendix(fullGeneratedText, safePapers, bibliographyFormat);
        if (bibliographyAppendix) {
          fullGeneratedText = `${fullGeneratedText.trimEnd()}${bibliographyAppendix}`;
          res.write(`data: ${JSON.stringify({ token: bibliographyAppendix })}\n\n`);
        }

        // Arka planda cache'e kaydet
        WriterCache.create({
          requestHash,
          generatedText: fullGeneratedText,
          prompt: promptText,
          papersCount: safePapers.length
        }).catch(err => console.warn('[CACHE] Kaydetme hatası:', err.message));

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
      return; // Başarılıysa çık
    } catch (err) {
      const { canFallback } = resolveGeminiFallback({ tokensSent: geminiTokensSent });

      if (!canFallback) {
        // Istemci zaten kismi metin aldi. Groq'a dusmek iki saglayicinin
        // ciktisini birlestirip bozuk bir metin uretir; bunun yerine elimizdeki
        // kismi metni duzgun kapatiyoruz.
        console.error('[ERROR] Gemini akis ortasinda kesildi, Groq fallback atlandi:', err.message);

        if (!isRequestAborted()) {
          res.write(`data: ${JSON.stringify({
            meta: { provider: 'gemini', truncated: true, reason: 'stream_interrupted' },
          })}

`);
          res.write(`data: ${JSON.stringify({
            warning: 'Metin uretimi yarida kesildi. Gosterilen icerik eksik olabilir.',
          })}

`);
          res.write(`data: ${JSON.stringify({ done: true })}

`);
          res.end();
        }
        // Yarim metin cache'lenmez: sonraki ayni istekler de eksik alirdi.
        return;
      }

      console.error('[ERROR] Gemini hatası, Groq Fallback devrede:', err.message);
      // Hicbir token gonderilmedi; birikmis kismi metni temizleyip Groq'a gec.
      fullGeneratedText = '';
    }
  } else {
    console.log('[AI] GEMINI_API_KEY bulunamadı. Groq Fallback kullanılıyor.');
  }

  // 2. GROQ İLE DENE (Fallback veya ana yöntem)
  if (!groqKey || !activeProviders.includes('groq')) {
    throw new Error(
      `Yapilandirilmis hicbir saglayici metin uretemedi (aktif: ${activeProviders.join(', ') || 'yok'}).`
    );
  }

  const groqModel = getGroqModel();

  try {
    console.log(`[AI] Model: GROQ (${groqModel})`);
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: groqModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 3000,
        stream: true,
      })
    });

    if (!groqRes.ok) {
      if (groqRes.status === 429) {
        const retryAfter = groqRes.headers.get('retry-after');
        console.error(`\n[ERROR] GROQ RATE LIMIT (429)`);
        console.error(`- Model: ${groqModel}`);
        console.error(`- Hata Kodu: 429 Rate Limit Exceeded`);
        console.error(`- Bekleme Süresi (Retry-After): ${retryAfter || 'Bilinmiyor'} saniye\n`);
        
        res.write(`data: ${JSON.stringify({ error: "AI servisinde geçici yoğunluk var. Lütfen birkaç dakika sonra tekrar deneyin." })}\n\n`);
        res.end();
        return;
      }
      
      const errText = await groqRes.text();
      throw new Error(`Groq Status: ${groqRes.status} - ${errText}`);
    }
    res.write(`data: ${JSON.stringify({ meta: { provider: 'groq', model: groqModel } })}\n\n`);

    let reader = null;
    let useAsyncIterator = false;

    if (groqRes.body && typeof groqRes.body.getReader === 'function') {
      reader = groqRes.body.getReader();
    } else if (groqRes.body && typeof groqRes.body[Symbol.asyncIterator] === 'function') {
      useAsyncIterator = true;
    } else {
      throw new Error('Groq response body is not readable.');
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    // Groq son SSE parcasinda usage'i kendiliginden gonderiyor; ayrica bir
    // bayrak istenmiyor (yedek dali bir istek parametresi yuzunden kirilmasin).
    let groqUsage = null;

    if (useAsyncIterator) {
      req.on('close', () => { try { groqRes.body.destroy(); } catch {} });
      for await (const chunk of groqRes.body) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep last incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const chunkUsage = json.x_groq?.usage || json.usage;
            if (chunkUsage) groqUsage = chunkUsage;
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullGeneratedText += delta;
              res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
            }
          } catch {}
        }
      }
    } else {
      req.on('close', () => { try { reader.cancel(); } catch {} });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep last incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const chunkUsage = json.x_groq?.usage || json.usage;
            if (chunkUsage) groqUsage = chunkUsage;
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullGeneratedText += delta;
              res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
            }
          } catch {}
        }
      }
    }

    logAiUsage(`writer/groq`, groqUsage);

    if (!fullGeneratedText.trim()) {
      throw new Error('Groq returned an empty response.');
    }

    const bibliographyAppendix = getMissingBibliographyAppendix(fullGeneratedText, safePapers, bibliographyFormat);
    if (bibliographyAppendix) {
      fullGeneratedText = `${fullGeneratedText.trimEnd()}${bibliographyAppendix}`;
      res.write(`data: ${JSON.stringify({ token: bibliographyAppendix })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    
    // Arka planda cache'e kaydet
    WriterCache.create({
      requestHash,
      generatedText: fullGeneratedText,
      prompt: promptText,
      papersCount: safePapers.length
    }).catch(err => console.warn('[CACHE] Kaydetme hatası:', err.message));

    res.end();
  } catch (err) {
    console.error('[ERROR] Groq üretimi başarısız:', err);
    res.write(`data: ${JSON.stringify({ error: "AI servisinde geçici yoğunluk var. Lütfen birkaç dakika sonra tekrar deneyin." })}\n\n`);
    res.end();
    return;
  }
}
