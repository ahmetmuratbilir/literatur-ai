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
      "text": "Highly optimized academic search query in Boolean format (e.g., (\"transport optimization\" OR \"transportation models\") AND (algorithm OR model)). (MUST BE IN ENGLISH)",
      "relevanceScore": 95
    }
  ],
  "relatedTopics": [
    "3 to 5 related academic topics or keywords as an array of strings. (MUST BE IN TURKISH)"
  ],
  "explanation": "A brief explanation of what the user is actually looking for and why these queries are effective. (MUST BE IN TURKISH)"
}

Do not include any other text outside the JSON object. You MUST provide exactly 5 objects in the queries array, with relevanceScore ranging from 70 to 99.`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
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
