require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
let geminiModel = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
} else {
  console.warn("GEMINI_API_KEY is not defined in .env. AI Chatbot will fall back to mockup replies.");
}

module.exports = { genAI, geminiModel };
