import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetch } from 'undici';
import { createChunksFromArticles, scoreChunksByKeywords, buildContextFromChunks } from './ragService.js';
import { getEmbedding, getEmbeddingsForChunks, searchSimilarChunksWithAtlas, cosineSimilarity } from './embeddingService.js';
import crypto from 'crypto';
import { WriterCache } from '../models/WriterCache.js';

/**
 * Ücretsiz / Yüksek Limitli Model Seçici (Fallback Mantığı)
 * Öncelik Sırası:
 * 1. Gemini (Eğer key varsa ve hata vermezse)
 * 2. Groq (Gemini yoksa veya hata verirse)
 */

export async function generateAcademicText(safePapers, prompt, outputType, tone, length, language, res, req) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // Response Cache Kontrolü
  const requestFingerprint = {
    prompt: prompt.trim(),
    papers: safePapers.map(p => p.id || p.ref).sort(),
    outputType, tone, length, language
  };
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(requestFingerprint)).digest('hex');

  try {
    const cachedResponse = await WriterCache.findOne({ requestHash });
    if (cachedResponse) {
      console.log(`[CACHE] Writer Cache Hit: ${requestHash}`);
      const text = cachedResponse.generatedText;
      // Cached metni parça parça stream et (doğal görünmesi için)
      const words = text.split(' ');
      for (let i = 0; i < words.length; i += 10) {
        if (req.closed) break;
        const chunk = words.slice(i, i + 10).join(' ') + ' ';
        res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
        await new Promise(r => setTimeout(r, 20)); // Hafif gecikme
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }
  } catch (cacheErr) {
    console.warn('[CACHE] Writer Cache hatası:', cacheErr.message);
  }

  let fullGeneratedText = '';
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
    
    try {
      const atlasResults = await searchSimilarChunksWithAtlas(queryEmbedding, 12);
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

  console.log(`\n[AI] RETRIEVAL MODU: ${retrievalMode}`);
  console.log(`[AI] Seçilen en iyi chunklar hazır.`);

  const paperListText = buildContextFromChunks(relevantChunks, 12);

  const outputTypeLabels = {
    'literature-review': 'Literatür İncelemesi',
    'introduction': 'Giriş Bölümü',
    'methodology': 'Yöntem Bölümü',
    'results': 'Bulgular Bölümü',
    'discussion': 'Tartışma Bölümü',
    'conclusion': 'Sonuç Bölümü',
  };
  const outputLabel = outputTypeLabels[outputType] || 'Akademik Metin';
  const writingLang = language === 'en' ? 'English' : 'Türkçe';

  const toneInstruction = {
    'akademik': 'Tamamen objektif, resmi ve üst düzey akademik bir dil kullan.',
    'sade': 'Gereksiz jargonlardan kaçınarak, herkesin anlayabileceği daha sade ama profesyonel bir dil kullan.',
    'tez': 'Bir doktora tezinin standartlarına uygun, literatür atıflarını sentezleyen çok ağırbaşlı bir dil kullan.',
    'makale': 'Uluslararası hakemli bir bilimsel makaleye (journal article) uygun, akıcı ve doğrudan bir dil kullan.'
  }[tone] || 'Akademik ve resmi bir dil kullan.';

  const lengthInstruction = {
    'kisa': 'Çok özet ve net yaz. En fazla 1-2 kısa paragraf.',
    'orta': 'Standart uzunlukta yaz. Yaklaşık 2-3 doyurucu paragraf.',
    'uzun': 'Son derece kapsamlı ve detaylı yaz. Seçilen makale sayısına göre en az 4-5 uzun paragraf ve derin analiz.'
  }[length] || 'Standart uzunlukta yaz.';

  const systemPrompt = `Sen profesyonel ve son derece titiz bir akademik araştırmacı ve yazarsın. Görevin, sana sağlanan bilimsel makalelerin başlık ve özet (abstract) bilgilerini sentezleyerek, sadece bu verilere dayanan, ${writingLang} dilinde bir ${outputLabel} metni üretmektir.

ÇOK SIKI KURALLAR:
1. HALÜSİNASYON YASAK: Sadece sana gönderilen makale özetlerindeki verileri kullan. Verilmeyen istatistik, oran, DOI, yazar adı, yıl veya sonuç KESİNLİKLE uydurma.
2. SAYISAL VERİLER: Eğer abstract içinde açıkça geçmiyorsa, metin içinde hiçbir sayısal ifade (örn: "%40 başarı", "200 hasta") kullanma.
3. ATIFLAR: Her iddia, bulgu veya cümle sonuna [1], [2], [3] şeklinde verilen makale sırasına göre kaynak numarası ekle. Kaynaksız cümle kurmaktan kaçın.
4. YAZIM DİLİ: ${toneInstruction} Çok iddialı ifadelerden kaçın ("kanıtlamaktadır" yerine "göstermektedir", "kesin olarak" yerine "bulgulara göre" gibi).
5. UZUNLUK: ${lengthInstruction}
6. FORMAT: İstenen bölüm formatına (${outputLabel}) sadık kalarak, uygun paragraflara böl. Markdown başlıkları kullan (Örn: ## ${outputLabel}).
7. YETERSİZ VERİ DURUMU: Eğer gönderilen kaynaklar, istenilen konuyu açıklamak için çok yetersizse, bunu açıkça belirt: "Bu bölüm için seçilen makalelerde yeterli veri bulunmadığından sınırlı bir değerlendirme yapılmıştır."
8. KAYNAKÇA: Metnin en sonuna '## Kullanılan Kaynaklar' başlığı açarak sadece kullandığın makaleleri kısa formatta listele:
   [1] Makale Başlığı - Yıl`;

  const userPrompt = `Aşağıdaki ${safePapers.length} makalenin bilgilerini ve özetlerini dikkatlice analiz et.

YÖNLENDIRME / KONU: ${prompt.trim()}

KAYNAKLAR:
${paperListText}

Lütfen kurallara SIKI SIKIYA bağlı kalarak, uydurma bilgi içermeyen akademik bir metin üret:`;

  // 1. GEMINI İLE DENE
  if (geminiKey) {
    try {
      console.log('[AI] Model: GEMINI (1.5 Flash)');
      const genAI = new GoogleGenerativeAI(geminiKey);
      // Gemini'de system prompt'u model oluştururken verebiliriz veya user prompt içine yedirebiliriz.
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: systemPrompt
      });

      const streamResult = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 3000,
        }
      });

      for await (const chunk of streamResult.stream) {
        if (req.closed) break;
        const text = chunk.text();
        if (text) {
          fullGeneratedText += text;
          res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
        }
      }

      if (!req.closed) {
        // Arka planda cache'e kaydet
        WriterCache.create({
          requestHash,
          generatedText: fullGeneratedText,
          prompt: prompt.trim(),
          papersCount: safePapers.length
        }).catch(err => console.warn('[CACHE] Kaydetme hatası:', err.message));

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
      return; // Başarılıysa çık
    } catch (err) {
      console.error('[ERROR] Gemini hatası, Groq Fallback devrede:', err.message);
      // Hata olursa Groq'a düşmesi için aşağı devam eder.
    }
  } else {
    console.log('[AI] GEMINI_API_KEY bulunamadı. Groq Fallback kullanılıyor.');
  }

  // 2. GROQ İLE DENE (Fallback veya ana yöntem)
  if (!groqKey) {
    throw new Error("Ne GEMINI_API_KEY ne de GROQ_API_KEY mevcut. Metin üretilemez.");
  }

  try {
    console.log('[AI] Model: GROQ (Llama 3.3 70B)');
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
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
        console.error(`- Model: llama-3.3-70b-versatile`);
        console.error(`- Hata Kodu: 429 Rate Limit Exceeded`);
        console.error(`- Bekleme Süresi (Retry-After): ${retryAfter || 'Bilinmiyor'} saniye\n`);
        
        res.write(`data: ${JSON.stringify({ error: "AI servisinde geçici yoğunluk var. Lütfen birkaç dakika sonra tekrar deneyin." })}\n\n`);
        res.end();
        return;
      }
      
      const errText = await groqRes.text();
      throw new Error(`Groq Status: ${groqRes.status} - ${errText}`);
    }

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
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullGeneratedText += delta;
              res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
            }
          } catch {}
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    
    // Arka planda cache'e kaydet
    WriterCache.create({
      requestHash,
      generatedText: fullGeneratedText,
      prompt: prompt.trim(),
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
