import { fetch } from 'undici';
import { withTimeout } from './http.js';

const TRANSLATE_TIMEOUT_MS = 10000; // LLM için biraz daha uzun süre

/**
 * Groq (Llama 3) kullanarak akademik çeviri yapar.
 * Başlıkları ve ilk 10 özeti toplu olarak çevirir.
 */
export async function batchTranslateAcademic(items) {
  if (!items || !items.length) return items;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('GROQ_API_KEY bulunamadı, çeviri atlanıyor.');
    return items;
  }

  // Çevrilecek veriyi hazırla
  const translationPayload = items.slice(0, 25).map((item, index) => ({
    id: index,
    title: item.title,
    teaser: index < 10 ? (item.teaser || item.description || '').slice(0, 300) : null
  }));

  const prompt = `You are an academic translation assistant. Translate the following list of academic papers into Turkish.
For each item:
1. Translate the 'title' to formal Turkish.
2. If 'teaser' is provided, translate it to academic Turkish. If null, ignore it.

IMPORTANT: Return ONLY a raw JSON array of objects with the same IDs. No markdown, no explanation.
Structure:
[
  { "id": 0, "titleTR": "...", "teaserTR": "..." },
  ...
]

Data to translate:
${JSON.stringify(translationPayload, null, 2)}`;

  try {
    const response = await withTimeout(
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          response_format: { type: "json_object" } // Bazı modellerde array için json_object gerekebilir, ama array bekliyoruz. 
          // Not: Llama-3-8b array dönebilir ama garanti için obje içinde array isteyebiliriz.
        })
      }),
      TRANSLATE_TIMEOUT_MS,
      'Groq translation timeout'
    );

    if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // JSON'ı ayıkla (Bazen model başına/sonuna yazı ekleyebilir)
    let translatedList = [];
    try {
      const parsed = JSON.parse(content);
      // Eğer model objeyi bir key altına koyduysa (örn: { "results": [...] }) onu al
      translatedList = Array.isArray(parsed) ? parsed : (parsed.results || Object.values(parsed)[0]);
    } catch (e) {
      // Regex ile JSON dizisini bulmaya çalış
      const match = content.match(/\[\s*\{.*\}\s*\]/s);
      if (match) translatedList = JSON.parse(match[0]);
    }

    // Çevirileri orijinal listeye eşle
    if (Array.isArray(translatedList)) {
      translatedList.forEach(t => {
        if (items[t.id]) {
          items[t.id].titleTR = t.titleTR;
          if (t.teaserTR) items[t.id].teaserTR = t.teaserTR;
        }
      });
    }

    return items;
  } catch (error) {
    console.warn('Batch translation failed:', error.message);
    return items;
  }
}
