import { fetch } from 'undici';

export async function analyzeAndExpandQuery(topic) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not defined in .env');
  }

  const prompt = `You are an expert academic research assistant.
User query:
"${topic}"

Your task is to analyze this query and return a raw JSON object with the following structure exactly (no markdown, no backticks, just the JSON string):
{
  "intent": "A short summary inferring the true research intent behind the query. (MUST BE IN TURKISH)",
  "queries": [
    {
      "text": "Highly optimized academic search query in Boolean format (e.g., (\"transport optimization\" OR \"transportation models\") AND (algorithm OR model)). MUST BE IN ENGLISH ONLY. DO NOT USE TURKISH CHARACTERS OR WORDS HERE.",
      "relevanceScore": 95
    }
  ],
  "explanation": "A brief explanation of what the user is actually looking for and why these queries are effective. (MUST BE IN TURKISH)"
}

Do not include any other text outside the JSON object. You MUST provide exactly 5 objects in the queries array, with relevanceScore ranging from 70 to 99.
IMPORTANT: The 'text' field in 'queries' array MUST ALWAYS be in English regardless of the input language. For example, if the input is 'yapay zeka', the query should be about 'artificial intelligence'.`;

  const startTime = Date.now();
  console.log(`\n--- Groq AI Analizi Ba\u015flat\u0131ld\u0131: "${topic}" ---`);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    })
  });

  const duration = (Date.now() - startTime) / 1000;
  console.log(`Groq AI Yan\u0131t S\u00fcresi: ${duration.toFixed(2)} sn`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Groq API Error:', errorText);
    throw new Error('Failed to fetch from Groq API');
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  try {
    const result = JSON.parse(content);
    return result;
  } catch (error) {
    console.error('Failed to parse Groq JSON response:', content);
    throw new Error('AI returned invalid JSON format');
  }
}
