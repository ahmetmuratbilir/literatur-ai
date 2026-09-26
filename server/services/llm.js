import { fetch } from 'undici';
import { resolveChatProvider } from '../config/aiModels.js';

export async function analyzeAndExpandQuery(topic) {
  const provider = resolveChatProvider({ profile: 'fast' });
  if (!provider) {
    throw new Error('Yapilandirilmis bir sohbet saglayicisi yok (AI_PROVIDERS).');
  }

  const systemPrompt = `You are an expert academic research assistant. 
Your task is to analyze research topics and provide optimized Boolean search queries in English.
You MUST ALWAYS return a valid JSON object with the following structure:
{
  "intent": "Turkish summary of the research intent",
  "queries": [
    {
      "text": "(Boolean search query in ENGLISH)",
      "relevanceScore": 95
    }
  ],
  "explanation": "Turkish explanation of the queries"
}

RULES:
1. 'intent' and 'explanation' MUST be in Turkish.
2. 'queries' MUST contain exactly 5 variations.
3. 'text' fields MUST be in English only and properly quoted as JSON strings.
4. Relevance scores should range from 70 to 99.
5. NO markdown, NO backticks, ONLY raw JSON.`;

  const userPrompt = `Topic: "${topic}"`;

  const startTime = Date.now();
  console.log(`\n--- Groq AI Analizi Başlatıldı: "${topic}" ---`);

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
      temperature: 0.1, // Lower temperature for more consistent JSON
      max_tokens: 1024,
      response_format: { type: "json_object" },
      // Dusunme acik kalirsa akil yurutme max_tokens butcesini tuketiyor ve
      // content bos donuyor; bu cagri kisa ve kesin bir JSON istiyor.
      ...(provider.body || {}),
    })
  });

  const duration = (Date.now() - startTime) / 1000;
  console.log(`${provider.name} yanit suresi: ${duration.toFixed(2)} sn`);

  if (!response.ok) {
    const status = response.status;
    const errorText = await response.text();
    console.error(`${provider.name} API hatasi (HTTP ${status}):`, errorText);
    throw new Error(`${provider.name} API failed with status ${status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  try {
    const result = JSON.parse(content);
    return result;
  } catch (error) {
    console.error(`${provider.name} gecerli JSON dondurmedi:`, JSON.stringify(content).slice(0, 200));
    throw new Error('AI returned invalid JSON format');
  }
}
