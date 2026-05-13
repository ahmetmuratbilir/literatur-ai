import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI('AIzaSyDu_rOfLJ5tbb9bjDV-iKg4PeTq4TG5U0I');

async function test() {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  try {
    const result = await model.generateContent("Hello world");
    console.log("Success! Length:", result.response.text());
  } catch (e) {
    console.error("Error with text-embedding-004:", e.message);
  }
}

test();
