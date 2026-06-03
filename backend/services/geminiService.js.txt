const axios = require('axios');
const { generateGeminiPrompt } = require('../utils/geminiPrompt');

async function getGeminiFeedback({ code, language, question, isCorrect }) {
    const prompt = generateGeminiPrompt({ code, language, question, isCorrect });

    try {
        const response = await axios.post("http://localhost:8080/generate", {
            prompt
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        return response.data;
    } catch (err) {
        console.error("Gemini AI feedback error:", err.message);
        return "Error getting AI feedback.";
    }
}

module.exports = { getGeminiFeedback };
