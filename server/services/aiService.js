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

export async function generateAcademicText(safePapers, prompt, outputType, tone, length, language, res, req, bibliographyFormat = 'APA 7') {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const isRequestAborted = () => Boolean(req?.aborted || req?.destroyed);

  // Response Cache Kontrolü
  const requestFingerprint = {
    prompt: prompt.trim(),
    papers: safePapers.map(p => p.id || p.ref).sort(),
    outputType, tone, length, language, bibliographyFormat,
    promptVersion: "academic-writing-v5"
  };
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(requestFingerprint)).digest('hex');

  try {
    const cachedResponse = await WriterCache.findOne({ requestHash });
    if (cachedResponse) {
      console.log(`[CACHE] Writer Cache Hit: ${requestHash}`);
      const text = cachedResponse.generatedText;
      res.write(`data: ${JSON.stringify({ meta: { provider: 'cache' } })}\n\n`);
      // Cached metni parça parça stream et (doğal görünmesi için)
      const words = text.split(' ');
      for (let i = 0; i < words.length; i += 10) {
        if (isRequestAborted()) break;
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
    'kisa': 'Kısa uzunlukta yaz. En fazla 1-2 paragraf üret. Sadece paragraf planındaki en kritik ilk 1-2 paragraf hedefine odaklan.',
    'orta': 'Orta uzunlukta yaz. Tam 3-4 paragraf üret. Paragraf planındaki tüm temel hedefleri (3 veya 4 paragraf) eksiksiz kapsa.',
    'uzun': 'Uzun uzunlukta yaz. En az 5 veya daha fazla paragraf üret. Paragraf planındaki tüm hedefleri derinlemesine analiz, detaylı kanıtlar ve alt paragraflarla genişleterek işle.'
  }[length] || 'Orta uzunlukta yaz.';

  let bibliographyInstruction = '';
  if (bibliographyFormat === 'IEEE') {
    bibliographyInstruction = `8. KAYNAKÇA: Metnin en sonuna '## Kullanılan Kaynaklar' başlığı açarak sadece kullandığın makaleleri IEEE stiline uygun şekilde listele.
    - IEEE biçimi: [Sıra No] Yazarlar, "Makale Başlığı," Dergi/Yayın, Yıl. Varsa URL veya DOI.
    - Yazar bilgisi yoksa veya "Bilinmiyor" ise fallback olarak şu şablonu kullan: [Sıra No] Makale Başlığı, Yıl.
    - Yazar ismi biçimi: Adının ilk harfi ve soyadı (Örn: J. Smith, R. Doe).
    - Atıf sırasına göre [1], [2] şeklinde numara kullan.
    - Kaynakça bölümünde yalnızca verilen makale metadatasını kullan. Eksik DOI, yazar veya dergi bilgisi uydurma.`;
  } else if (bibliographyFormat === 'MLA') {
    bibliographyInstruction = `8. KAYNAKÇA: Metnin en sonuna '## Kullanılan Kaynaklar' başlığı açarak sadece kullandığın makaleleri MLA stiline uygun şekilde listele.
    - MLA biçimi: Yazarlar. "Makale Başlığı." Dergi/Yayın, Yıl, Varsa URL veya DOI.
    - Yazar bilgisi yoksa veya "Bilinmiyor" ise fallback olarak şu şablonla başla: "Makale Başlığı." Dergi/Yayın, Yıl, Varsa URL veya DOI.
    - Yazar ismi biçimi: Soyadı, Adı (Örn: Smith, John, and Richard Doe).
    - Kaynakça bölümünde yalnızca verilen makale metadatasını kullan. Eksik DOI, yazar veya dergi bilgisi uydurma.`;
  } else if (bibliographyFormat === 'Chicago') {
    bibliographyInstruction = `8. KAYNAKÇA: Metnin en sonuna '## Kullanılan Kaynaklar' başlığı açarak sadece kullandığın makaleleri Chicago stiline uygun şekilde listele.
    - Chicago biçimi: Yazarlar. "Makale Başlığı." Dergi/Yayın Yıl. Varsa URL veya DOI.
    - Yazar bilgisi yoksa veya "Bilinmiyor" ise fallback olarak şu şablonla başla: "Makale Başlığı." Dergi/Yayın Yıl. Varsa URL veya DOI.
    - Yazar ismi biçimi: Soyadı, Adı (Örn: Smith, John, and Richard Doe).
    - Kaynakça bölümünde yalnızca verilen makale metadatasını kullan. Eksik DOI, yazar veya dergi bilgisi uydurma.`;
  } else {
    // Varsayılan APA 7 olsun
    bibliographyInstruction = `8. KAYNAKÇA: Metnin en sonuna '## Kullanılan Kaynaklar' başlığı açarak sadece kullandığın makaleleri APA 7 stiline uygun şekilde listele.
    - APA 7 biçimi: Yazarlar. (Yıl). Makale Başlığı. Dergi/Yayın. Varsa URL veya DOI.
    - Yazar bilgisi yoksa veya "Bilinmiyor" ise fallback olarak şu şablonla başla: Makale Başlığı. (Yıl). Dergi/Yayın. Varsa URL veya DOI.
    - Yazar ismi biçimi: Soyadı, Adının baş harfi (Örn: Smith, J., & Doe, R.).
    - Kaynakça bölümünde yalnızca verilen makale metadatasını kullan. Eksik DOI, yazar veya dergi bilgisi uydurma.`;
  }

  let inTextCitationInstruction = '';
  let citationExampleText = '';
  if (bibliographyFormat === 'IEEE') {
    inTextCitationInstruction = `İç atıfları IEEE formatında yap. Cümle sonunda kaynak numarasını köşeli parantez içinde belirt (Örn: [1], [2] veya birden çok kaynak için [1, 2] gibi). Cümle sonlarında sadece atıf gereken yerlerde kullan.`;
    citationExampleText = `...veri güvenliği ve etik riskler önemli tartışma alanları oluşturmaktadır [1, 2].`;
  } else if (bibliographyFormat === 'MLA') {
    inTextCitationInstruction = `İç atıfları MLA formatında yap. Cümle sonunda yazar soyadı belirt (Örn: (Smith) veya (Smith and Jones) veya ikiden fazla yazar için (Alice et al.) gibi). Birden fazla atıfı noktalı virgülle ayır.`;
    citationExampleText = `...veri güvenliği ve etik riskler önemli tartışma alanları oluşturmaktadır (Brown; Li).`;
  } else if (bibliographyFormat === 'Chicago') {
    inTextCitationInstruction = `İç atıfları Chicago formatında yap. Cümle sonunda yazar soyadı ve yıl belirt (Örn: (Smith 2023), (Doe and Jane 2024) veya ikiden fazla yazar için (Alice et al. 2022) gibi). Birden fazla atıfı noktalı virgülle ayır.`;
    citationExampleText = `...veri güvenliği ve etik riskler önemli tartışma alanları oluşturmaktadır (Brown 2023; Li 2024).`;
  } else {
    // APA 7
    inTextCitationInstruction = `İç atıfları APA 7 formatında yap. Cümle sonunda yazar soyadı ve yıl belirt (Örn: (Smith, 2023), (Doe & Jane, 2024) veya ikiden fazla yazar için (Alice et al., 2022) gibi). Birden fazla atıfı noktalı virgülle ayır.`;
    citationExampleText = `...veri güvenliği ve etik riskler önemli tartışma alanları oluşturmaktadır (Brown, 2023; Li, 2024).`;
  }

  let sectionInstruction = '';
  if (outputType === 'introduction') {
    sectionInstruction = `### ${outputLabel} (GİRİŞ BÖLÜMÜ) ÖZEL DAVRANIŞ KURALLARI VE PARAGRAF AKIŞI:
- Yazım Tarzı (Giriş Retoriği): Daha akıcı, bağlamsal, genelden özele doğru ilerleyen bir yapı kur.
- Atıf Yoğunluğu: DÜŞÜK/ORTA citation yoğunluğu kullan. Bu bölüm bir atıf yığınağı olmamalı, daha çok genel bağlam ve problem akışı ön planda olmalıdır.
- Sektörel/Semantik Görev: Temel problem alanlarını, ana temaları ve kavramları aç (SEMANTIC MEMORY kur).
- Paragraf Planı (Paragraph Intent Plan) - Bu görevleri sırayla takip et:
  * Paragraf 1 (Context Paragraph): Konuyu genel akademik bağlama yerleştir. Alanın önemini ve arka planını anlat. (Düşük citation)
  * Paragraf 2 (Problem Paragraph): Problemi açıkla. Riskleri, zorlukları ve sınırlılıkları belirt. "Ancak", "Bununla birlikte" gibi doğal geçişler kullan.
  * Paragraf 3 (Research Gap Paragraph): Literatürdeki eksikliği (gap) göster. Hangi alanların yeterince çalışılmadığını veya nerede tartışmalar olduğunu vurgula.
  * Paragraf 4 (Objective Paragraph): Bu çalışmanın amacını ve getireceği katkıyı açıkla. Girişi akademik şekilde kapat.`;
  } else if (outputType === 'literature-review') {
    sectionInstruction = `### ${outputLabel} (LİTERATÜR İNCELEMESİ BÖLÜMÜ) ÖZEL DAVRANIŞ KURALLARI VE PARAGRAF AKIŞI:
- Yazım Tarzı (Literatür Retoriği): Sentez odaklı, karşılaştırmalı, akademik tartışmalı ve diyalektik bir yapı benimse.
- HATA ÖNLEME: Çalışmaları tek tek, arka arkaya özetlemekten ("X çalışmasında bunu buldu. Y çalışmasında şunu yaptı.") KESİNLİKLE kaçın.
- Doğru Yaklaşım: Ortak araştırma bulgularını analiz et, benzer/farklı görüşleri karşılaştırıp tek bir potada erit.
- Sektörel/Semantik Görev: Girişte açılan problem alanlarını ve ana kavramları sentezleyerek derinlemesine akademik tartışmaya dönüştür (SEMANTIC CONSISTENCY koru).
- Örnek: "Literatürde çalışmaların büyük kısmı veri güvenliği problemlerine odaklanırken, bazı araştırmalar etik karar mekanizmalarını ön plana çıkarmaktadır (Brown, 2023; Li, 2024)."
- Atıf Yoğunluğu: ORTA/YÜKSEK citation yoğunluğu kullan. Karşılaştırmalı ve sentezli bir atıf yapısı oluştur.
- Paragraf Planı (Paragraph Intent Plan) - Bu görevleri sırayla takip et:
  * Paragraf 1 (Theme Synthesis Paragraph): Seçilen çalışmaların ortak temasını açıkla. Genel akademik eğilimleri göster.
  * Paragraf 2 (Comparison Paragraph): Çalışmalar arasındaki benzerlik ve farkları karşılaştır. Yöntemsel veya bulgusal ayrımları belirt.
  * Paragraf 3 (Limitation/Gap Paragraph): Literatürdeki mevcut eksiklikleri, metodolojik sınırlılıkları veya çelişkili noktaları açıkla.
  * Paragraf 4 (Transition Paragraph): Konuyu bir sonraki bölüme bağlayacak doğal bir akademik geçiş hazırlığı yap.`;
  } else if (outputType === 'methodology') {
    sectionInstruction = `### ${outputLabel} (YÖNTEM BÖLÜMÜ) ÖZEL DAVRANIŞ KURALLARI VE PARAGRAF AKIŞI:
- Yazım Tarzı (Yöntem Retoriği): Son derece net, teknik, şeffaf, objektif ve düşük retorik yoğunluğa sahip bir dil kullan.
- Atıf Yoğunluğu: DÜŞÜK citation yoğunluğu kullan. Yalnızca spesifik bir yöntem referansı veya kullanılan algoritma/kütüphane referans edilecekse citation kullan.
- Sektörel/Semantik Görev: Yöntem ve tasarım tercihlerini, girişte açılan problem alanları, kısıtlar ve araştırma hedefleri ile ilişkilendir.
- Paragraf Planı (Paragraph Intent Plan) - Bu görevleri sırayla takip et:
  * Paragraf 1 (Research Design): Araştırma yaklaşımını, modelini ve metodolojik çatıyı açıkla.
  * Paragraf 2 (Data / Source): Kullanılan veri kümesini, kaynakları, örneklemi veya veri yapısını açıkla.
  * Paragraf 3 (Analysis Process): Verilerin nasıl işlendiğini, kullanılan algoritmaları, araçları ve analiz süreçlerini açıkla.
  * Paragraf 4 (Validity / Limitation): Yöntemin varsayımlarını, geçerlilik kriterlerini ve sınırlarını belirt.`;
  } else if (outputType === 'results') {
    sectionInstruction = `### ${outputLabel} (BULGULAR BÖLÜMÜ) ÖZEL DAVRANIŞ KURALLARI VE PARAGRAF AKIŞI:
- Yazım Tarzı (Bulgu Retoriği): Tamamen yorumdan uzak, nesnel, veri odaklı ve doğrudan ol.
- Atıf Yoğunluğu: DÜŞÜK citation yoğunluğu kullan. Sadece objektif bulgu anlatımına odaklan (asgari dış kaynak atıfı).
- Sektörel/Semantik Görev: Elde edilen objektif sonuçların, girişte ve literatürde açılan hangi problem alanlarıyla ilişkili olduğunu netleştir.
- Paragraf Planı (Paragraph Intent Plan) - Bu görevleri sırayla takip et:
  * Paragraf 1 (Main Findings): Elde edilen en temel ve en kritik bulguyu/sonucu açıkla.
  * Paragraf 2 (Supporting Findings): Temel bulguyu destekleyen ikincil verileri, parametreleri veya alt sonuçları açıkla.
  * Paragraf 3 (Pattern Paragraph): Sonuçlarda ortaya çıkan örüntüleri, trendleri veya korelasyonları belirt.
  * Paragraf 4 (Neutral Summary): Bulguları öznel yorum yapmadan, tamamen objektif bir şekilde özetle.`;
  } else if (outputType === 'discussion') {
    sectionInstruction = `### ${outputLabel} (TARTIŞMA BÖLÜMÜ) ÖZEL DAVRANIŞ KURALLARI VE PARAGRAF AKIŞI:
- Yazım Tarzı (Tartışma Retoriği): Derinlemesine yorumlayıcı, analitik, literatür bağlantılı ve sorgulayıcı bir dil kullan.
- Atıf Yoğunluğu: ORTA citation yoğunluğu kullan. Özellikle bulguların literatürdeki diğer çalışmalarla karşılaştırıldığı yerlerde atıf yap.
- Sektörel/Semantik Görev: Elde edilen bulguları, girişte tanıtılan temel problemler, literatürdeki tartışmalar ve semantic memory öğeleriyle doğrudan bağla (SEMANTIC CALLBACK yap).
- Paragraf Planı (Paragraph Intent Plan) - Bu görevleri sırayla takip et:
  * Paragraf 1 (Interpretation): Bulguların ne anlama geldiğini, önemini ve derinlemesine yorumunu açıkla.
  * Paragraf 2 (Literature Comparison): Kendi bulgularını literatürdeki diğer çalışmalarla karşılaştır, benzerlikleri ve zıtlıkları tartış.
  * Paragraf 3 (Implications): Elde edilen sonuçların teorik (bilimsel) ve pratik (uygulama) etkilerini/çıkarımlarını açıkla.
  * Paragraf 4 (Limitations & Future Work): Çalışmanın kısıtlarını belirt ve gelecek araştırmalar için öneriler sun.`;
  } else if (outputType === 'conclusion') {
    sectionInstruction = `### ${outputLabel} (SONUÇ BÖLÜMÜ) ÖZEL DAVRANIŞ KURALLARI VE PARAGRAF AKIŞI:
- Yazım Tarzı (Sonuç Retoriği): Kısa, net, vurucu ve katkı odaklı yaz.
- Atıf Yoğunluğu: DÜŞÜK citation yoğunluğu kullan. Katkı ve gelecek çalışma önerisi odaklı yaz, atıfları minimumda tut.
- Sektörel/Semantik Görev: Girişte açılan temel probleme ve araştırma amaçlarına geri dön. Bütünlüğü sağlamak için daireyi kapat ve semantik olarak tüm makaleyi birbirine bağla.
- Paragraf Planı (Paragraph Intent Plan) - Bu görevleri sırayla takip et:
  * Paragraf 1 (Summary Paragraph): Çalışmada ulaşılan ana sonucu ve temel çıkarımı net bir şekilde özetle.
  * Paragraf 2 (Contribution Paragraph): Çalışmanın literatüre getirdiği özgün akademik katkıyı açıkla.
  * Paragraf 3 (Recommendation Paragraph): Gelecek araştırmacılar veya sektör profesyonelleri için uygulama önerileri sun.`;
  }

  const systemPrompt = `Sen profesyonel, son derece titiz ve gerçek bir akademik araştırmacısın. Görevin, sana sağlanan bilimsel makalelerin başlık, yazar, yıl ve özet (abstract) bilgilerini sentezleyerek, sadece bu verilere dayanan, ${writingLang} dilinde bir ${outputLabel} metni üretmektir.

TEMEL YAZIM FELSEFESİ VE KURALLAR:
1. GERÇEK AKADEMİK AKIŞ: Robotik veya şablon tarzda yazma. Bir "citation generator" gibi her cümlenin sonuna mekanik olarak atıf ekleme. Amaç; fikirleri birbirine bağlayan, sentez yapan, akademik anlatı kurgulayan ve insan elinden çıkmış gibi doğal akan bir akademik metin üretmektir.
   - METİN, KAYNAKLARIN TEK TEK SIRALANDIĞI BİR ÖZET DEĞİLDİR. METİN, KAYNAKLARDAN HAREKETLE OLUŞTURULAN DOĞAL AKADEMİK BİR ANLATIDIR.
   - AI olarak analiz yap, fikirleri birbirine bağla, paragraflar arası doğal geçiş kur, akademik ritim oluştur.
2. PARAGRAF AMAÇ MOTORU (PARAGRAPH INTENT ENGINE):
   - Yazıya başlamadan önce, yazacağın bölümün türü ve uzunluk seçeneğine göre gizli bir "zihinsel paragraf planı" (paragraph intent plan) oluştur.
   - AI olarak önce zihninde "Bu paragrafın amacı ne?" sorusunu cevapla ve her paragrafı o role göre yaz.
   - ÖNEMLİ HATA ÖNLEME: Paragraf rollerini/başlıklarını (örn: "Paragraf 1: Context Paragraph" veya "### Context Paragraph" gibi) çıktı olarak KESİNLİKLE yazma! Bunlar sadece senin yazım planın olmalıdır. Sadece doğrudan paragraf metinlerini oluştur.
   - Paragraflar arasında kopukluk olmamalı, her paragraf bir öncekinin devamı gibi akmalı, genelden özele mantığı korunmalıdır.
3. RETORİK AKIŞ VE İNSANSI AKADEMİK TON (RHETORICAL FLOW & HUMAN ACADEMIC TONE):
   - YASAK: Her paragrafı aynı kalıpla veya ritimle başlatmak. "Bu çalışma...", "Bu bağlamda...", "Sonuç olarak...", "Literatürde..." gibi ifadeleri paragraf girişlerinde sürekli tekrar etmek KESİNLİKLE YASAKTIR.
   - YASAK: "X bunu yaptı. Y bunu yaptı. Z bunu yaptı." şeklinde ardışık yazar özet listesi yapmak.
   - Cümle Uzunluğu Dengesi: Sürekli aynı uzunlukta cümle kurmaktan kaçın. Kısa ve vurucu cümleler ile uzun, açıklayıcı cümleleri dengeli bir ritimde kullan.
   - Doğal Geçişler ve Bağlayıcı Havuzu: Paragrafları birbirine bağlarken ve fikirleri tartışırken şu akademik geçiş ifadelerini mekanik olmadan, akıcı bir şekilde kullan:
     * "Bu durum...", "Bununla birlikte...", "Buna karşılık...", "Öte yandan...", "Bu noktada...", "Dolayısıyla...", "Bu çerçevede...", "Bu yaklaşım...", "Bu bulgu...", "Bu nedenle...", "Benzer şekilde...", "Literatürde...", "Buna rağmen...".
     * Ancak bunları aşırı tekrar etme, her cümlenin veya paragrafın başına mekanik geçişler yerleştirme.
   - Atıf Ritmi: Her paragrafın sonunda aynı atıf modelini (citation spam) tekrar etme. Atıf dağılımları doğal görünmeli, cümlelerin arasına veya başlarına da yedirilebilmelidir (Örn: "Smith et al. (2023) tarafından yapılan araştırmada...").
   - Akademik ciddiyet ve resmi tonu koru, aşırı steril ve mekanik dilden kaçınırken aşırı samimi ifadelere de yer verme.
4. ANLAMSAL BÖLÜM HAFIZA MOTORU VE BÖLÜMLER ARASI BÜTÜNLÜK (SEMANTIC SECTION MEMORY ENGINE):
   - AI olarak yazmaya başlamadan önce, sana sağlanan makalelerden hareketle zihninde görünmeyen bir "SEMANTIC MEMORY OBJECT" oluştur. Bu nesne şu alanları barındırmalıdır:
     * Ana Temalar (örn: etik riskler, klinik validasyon, veri gizliliği, vb.)
     * Tekrar Eden Problemler (örn: düşük klinik test sayısı, veri seti bias problemi, explainability eksikliği, vb.)
     * Kritik Kavramlar & Terimler (örn: "klinik validasyon", "derin öğrenme modelleri", vb.)
     * Metodolojik Kısıtlar & Boşluklar (örn: gerçek dünya validasyon eksikliği, vb.)
   - KESİNLİKLE YAPILMAMALIDIR: Bu "SEMANTIC MEMORY OBJECT" nesnesini, başlıklarını veya listelerini çıktı olarak KESİNLİKLE yazma! Bunlar senin içsel zihinsel rehberindir. Sadece doğrudan paragraf metinlerini oluştur.
   - SEMANTIC CALLBACK VE ANLAMSAL KÖPRÜLER: Makalenin her bölümünde tamamen yeni ve bağımsız bir konu açmak YASAKTIR. Önceki bölümlerde açılan önemli temalar ve problemler, ilerleyen bölümlerde doğal şekilde tekrar referans alınmalıdır (Semantic Callback).
     * Örneğin; Giriş bölümünde "klinik validasyon eksikliği" tanıtıldıysa; Tartışma bölümünde "Bu bulgular, literatürde belirtilen klinik validasyon eksiklikleriyle uyumludur..." şeklinde callback yapılmalı; Sonuç bölümünde ise "Bu nedenle gelecekteki çalışmaların özellikle klinik validasyon süreçlerine odaklanması..." şeklinde sonuca bağlanmalıdır.
   - SEMANTIC TRANSITION RULES (Bölümler Arası Yumuşak Geçiş): Paragraflar kadar bölümler arasında da anlamsal geçiş köprüleri kur:
     * Literatür -> Yöntem geçişinde: "Literatürdeki bu sınırlılıklar doğrultusunda..."
     * Bulgular -> Tartışma geçişinde: "Elde edilen bulgular, önceki çalışmaların bazı yönleriyle örtüşmektedir..."
     * Tartışma -> Sonuç geçişinde: "Bu değerlendirmeler ışığında..."
   - TEMATIC CONSISTENCY (Kavramsal Tutarlılık): Belge boyunca aynı anahtar kavramlar, aynı akademik terminoloji ve aynı problem alanları kontrollü biçimde korunmalıdır. Aynı kavramı her bölümde farklı isimlerle dağıtma (Örn: Bir yerde "klinik validasyon" deyip, diğer bölümlerde "medikal test süreci", "tıbbi doğrulama sistemi" gibi anlamsal sapmalar yapma; "klinik validasyon" terimini tutarlı şekilde koru).
   - YASAK DAVRANIŞLAR: Her bölümün birbirinden tamamen bağımsız görünmesi, sonuç bölümünün girişten kopuk olması, literatürde konuşulan problemlerin tartışmada unutulması veya makalenin ortasında yeni ana tema açılması KESİNLİKLE YASAKTIR.
5. ATIF YOĞUNLUĞU VE ZAMANLAMASI (CITATION PLACEMENT INTELLIGENCE): 
   - Her cümlenin sonunda citation OLMAMALIDIR. Ortalama her 2-4 cümlede bir citation kullanılması yeterlidir.
   - Atıf yoğunluğu yazılan bölüm türüne göre yukarıda belirtilen kurallara tam olarak uygun olmalıdır.
   - Geçiş cümleleri, akademik bağlayıcı anlatımlar, genel akış cümleleri ve analitik yorum/değerlendirme cümleleri ATIFSIZ OLABİLİR.
   - Ancak spesifik bilgi, sayısal veri, çalışma sonucu, tanım ve doğrudan literatür iddiası barındıran cümlelerde KESİNLİKLE atıf kullanılmalıdır.
   - Aynı paragraf içerisinde aynı kaynağı sürekli tekrar etmekten kaçın.
   - Benzer fikirleri destekleyen farklı kaynakları tek bir birleşik citation grubunda topla.
6. İÇ ATIF BİÇİMİ:
   - ${inTextCitationInstruction}
   - Atıflarda yazar soyadlarını ve yıllarını (veya IEEE ise sıra numaralarını) sana sağlanan makale listesinden doğruca al. Kesinlikle uydurma kaynak numarası veya yazar adı üretme.
7. HALÜSİNASYON KORUMASI: 
   - Sadece sana gönderilen makale özetlerindeki gerçek verileri kullan. Makalelerde bulunmayan hiçbir istatistiksel veriyi, DOI'yi, yazar adını, yılı veya sonucu KESİNLİKLE uydurma.
   - Eğer makale bilgisinde eksik metadata varsa (örn: DOI veya dergi yoksa), tahmin yapma, boş bırak veya fallback formatını kullan.
8. YAZIM DİLİ: ${toneInstruction} Çok iddialı ifadelerden kaçın ("kanıtlamaktadır" yerine "göstermektedir", "kesin olarak" yerine "bulgulara göre" gibi).
9. UZUNLUK: ${lengthInstruction}
10. FORMAT: İstenen bölüm formatına (${outputLabel}) sadık kalarak, uygun paragraflara böl. Markdown başlıkları kullan (Örn: ## ${outputLabel}).
11. YETERSİZ VERİ DURUMU: Eğer gönderilen kaynaklar, istenilen konuyu açıklamak için çok yetersizse, bunu açıkça belirt: "Bu bölüm için seçilen makalelerde yeterli veri bulunmadığından sınırlı bir değerlendirme yapılmıştır."

${sectionInstruction}

${bibliographyInstruction}`;

  const paperMetadataText = safePapers.map(p => 
    `[Kaynak ${p.ref}]
- Başlık: ${p.title}
- Yazarlar: ${p.authors}
- Yıl: ${p.year}
- Dergi/Yayın: ${p.journal || 'Bilinmiyor'}
- DOI: ${p.doi || 'Mevcut değil'}
- URL: ${p.url || 'Mevcut değil'}`
  ).join('\n\n');

  const userPrompt = `Aşağıdaki ${safePapers.length} makalenin bilgilerini ve özetlerini dikkatlice analiz et.

YÖNLENDIRME / KONU: ${prompt.trim()}

KAYNAKLARIN ÖZETLERİ (LİTERATÜR):
${paperListText}

BİBLİYOGRAFİK METADATALAR (KAYNAKÇA BİLGİLERİ):
${paperMetadataText}

Lütfen kurallara SIKI SIKIYA bağlı kalarak, uydurma bilgi içermeyen ve kaynakçayı belirtilen "${bibliographyFormat}" stiline göre düzenleyen akademik bir metin üret:`;

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
      res.write(`data: ${JSON.stringify({ meta: { provider: 'gemini', model: 'gemini-1.5-flash' } })}\n\n`);

      for await (const chunk of streamResult.stream) {
        if (isRequestAborted()) break;
        const text = chunk.text();
        if (text) {
          fullGeneratedText += text;
          res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
        }
      }

      if (!isRequestAborted()) {
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
    res.write(`data: ${JSON.stringify({ meta: { provider: 'groq', model: 'llama-3.3-70b-versatile' } })}\n\n`);

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
