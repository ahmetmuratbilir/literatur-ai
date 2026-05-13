import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  // @google/generative-ai doesn't explicitly have listModels in the JS SDK? Let's check using fetch
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await response.json();
  const models = data.models || [];
  models.forEach(m => console.log(m.name, m.supportedGenerationMethods));
}

listModels();
