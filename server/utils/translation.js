import { fetch } from 'undici';
import { withTimeout } from './http.js';

const TRANSLATE_TIMEOUT_MS = 10000;
const GROQ_TRANSLATION_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TRANSLATION_MODEL = 'llama-3.1-8b-instant';
const GROQ_MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseRetryAfterMs(response, attempt) {
  const retryAfterHeader = response.headers.get('retry-after');
  const retryAfterSeconds = Number.parseInt(retryAfterHeader || '', 10);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  return Math.min(1500 * attempt, 5000);
}

async function requestGroqJson({ apiKey, prompt, temperature, timeoutMessage, taskLabel }) {
  let lastError = null;

  for (let attempt = 1; attempt <= GROQ_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await withTimeout(
        fetch(GROQ_TRANSLATION_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: GROQ_TRANSLATION_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature,
            response_format: { type: 'json_object' },
          }),
        }),
        TRANSLATE_TIMEOUT_MS,
        timeoutMessage
      );

      if (response.ok) {
        return response.json();
      }

      if (response.status === 429 && attempt < GROQ_MAX_ATTEMPTS) {
        const delayMs = parseRetryAfterMs(response, attempt);
        console.warn(`[Groq] ${taskLabel} rate limited (attempt ${attempt}/${GROQ_MAX_ATTEMPTS}). Retrying in ${delayMs}ms.`);
        await sleep(delayMs);
        continue;
      }

      lastError = new Error(`Groq API Error: ${response.status}`);
      break;
    } catch (error) {
      lastError = error;
      if (attempt >= GROQ_MAX_ATTEMPTS) break;
      const delayMs = Math.min(1000 * attempt, 3000);
      console.warn(`[Groq] ${taskLabel} temporary failure (attempt ${attempt}/${GROQ_MAX_ATTEMPTS}): ${error.message}. Retrying in ${delayMs}ms.`);
      await sleep(delayMs);
    }
  }

  throw lastError || new Error(`Groq ${taskLabel} failed`);
}

function extractTranslationArray(content) {
  let translatedList = [];
  try {
    const parsed = JSON.parse(content);
    translatedList = Array.isArray(parsed) ? parsed : (parsed.results || Object.values(parsed)[0]);
  } catch {
    const match = content.match(/\[\s*\{.*\}\s*\]/s);
    if (match) translatedList = JSON.parse(match[0]);
  }
  return Array.isArray(translatedList) ? translatedList : [];
}

function buildBatchPayload(items, includeTeasers) {
  return items.slice(0, 25).map((item, index) => ({
    id: index,
    title: item.title,
    teaser: includeTeasers && index < 10
      ? (item.teaser || item.description || '').slice(0, 300)
      : null,
  }));
}

function buildBatchPrompt(payload, includeTeasers) {
  return `You are an academic translation assistant. Translate the following list of academic papers into Turkish.
For each item:
1. Translate the 'title' to formal Turkish.
2. ${includeTeasers ? "If 'teaser' is provided, translate it to academic Turkish. If null, ignore it." : "Ignore 'teaser' and translate titles only."}

IMPORTANT: Return ONLY a raw JSON array of objects with the same IDs. No markdown, no explanation.
Structure:
[
  { "id": 0, "titleTR": "...", "teaserTR": "..." },
  ...
]

Data to translate:
${JSON.stringify(payload, null, 2)}`;
}

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
    const data = await requestGroqJson({
      apiKey,
      prompt,
      temperature: 0,
      timeoutMessage: 'Groq query translation timeout',
      taskLabel: 'query translation',
    });

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

  const attempts = [
    { includeTeasers: true, taskLabel: 'batch translation' },
    { includeTeasers: false, taskLabel: 'title-only translation fallback' },
  ];

  for (const attemptConfig of attempts) {
    const payload = buildBatchPayload(items, attemptConfig.includeTeasers);
    const prompt = buildBatchPrompt(payload, attemptConfig.includeTeasers);

    try {
      const data = await requestGroqJson({
        apiKey,
        prompt,
        temperature: 0.2,
        timeoutMessage: 'Groq translation timeout',
        taskLabel: attemptConfig.taskLabel,
      });

      const content = data.choices?.[0]?.message?.content || '';
      const translatedList = extractTranslationArray(content);

      if (translatedList.length === 0) {
        throw new Error('Groq translation response could not be parsed');
      }

      translatedList.forEach((translatedItem) => {
        if (items[translatedItem.id]) {
          items[translatedItem.id].titleTR = translatedItem.titleTR;
          if (translatedItem.teaserTR) {
            items[translatedItem.id].teaserTR = translatedItem.teaserTR;
          }
        }
      });

      return items;
    } catch (error) {
      console.warn(`[Groq] ${attemptConfig.taskLabel} failed: ${error.message}`);
    }
  }

  return items;
}
