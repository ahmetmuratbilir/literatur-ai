import { fetch } from 'undici';
import { withTimeout } from './http.js';

const TRANSLATE_TIMEOUT_MS = 10000;

export async function translateToEnglish(text) {
  const sourceText = typeof text === 'string' ? text.trim() : '';
  if (!sourceText) return { text: '' };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { text: sourceText };

  const prompt = `Translate the following academic search text into concise, natural English.
Preserve boolean operators and search punctuation when present.
Return ONLY a raw JSON object:
{ "text": "..." }

Input:
${sourceText}`;

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
          temperature: 0,
          response_format: { type: 'json_object' }
        })
      }),
      TRANSLATE_TIMEOUT_MS,
      'Groq query translation timeout'
    );

    if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content);
    const translated = typeof parsed?.text === 'string' ? parsed.text.trim() : '';

    return { text: translated || sourceText };
  } catch (error) {
    console.warn('Query translation failed:', error.message);
    return { text: sourceText };
  }
}

export async function batchTranslateAcademic(items) {
  if (!items || !items.length) return items;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('GROQ_API_KEY missing, batch translation skipped.');
    return items;
  }

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
          response_format: { type: 'json_object' }
        })
      }),
      TRANSLATE_TIMEOUT_MS,
      'Groq translation timeout'
    );

    if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let translatedList = [];
    try {
      const parsed = JSON.parse(content);
      translatedList = Array.isArray(parsed) ? parsed : (parsed.results || Object.values(parsed)[0]);
    } catch {
      const match = content.match(/\[\s*\{.*\}\s*\]/s);
      if (match) translatedList = JSON.parse(match[0]);
    }

    if (Array.isArray(translatedList)) {
      translatedList.forEach((t) => {
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
