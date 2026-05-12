import dotenv from 'dotenv';
import { analyzeAndExpandQuery } from '../services/llm.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config({ path: './.env' });

async function testGroq() {
    console.log('--- Testing Groq AI (Llama 3.3 70B) ---');
    try {
        const result = await analyzeAndExpandQuery('yapay zeka');
        console.log('SUCCESS: Groq is responding correctly.');
        console.log('Sample English Query:', result.queries[0].text);
    } catch (error) {
        console.error('FAILED: Groq Error:', error.message);
    }
}

async function testGemini() {
    console.log('\n--- Testing Gemini AI (Gemini 1.5 Flash) ---');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('FAILED: GEMINI_API_KEY is missing in .env');
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent('Translate to English: yapay zeka');
        console.log('SUCCESS: Gemini is responding correctly.');
        console.log('Response:', result.response.text().trim());
    } catch (error) {
        console.error('FAILED: Gemini Error:', error.message);
    }
}

async function runTests() {
    await testGroq();
    await testGemini();
}

runTests();
