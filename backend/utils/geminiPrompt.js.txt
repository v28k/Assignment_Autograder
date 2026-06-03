function generateGeminiPrompt({ code, language, question, isCorrect }) {
    if (!language) language = "an unknown language";

    if (isCorrect) {
        return `You are an expert programming assistant.

The following is a coding problem:
"${question}"

Here is my solution written in ${language}, which passes all test cases:

${code}

Please review the code and suggest improvements in:
- Readability
- Code structure
- Performance
- Best practices

Respond in markdown format with headings.`;
    } else {
        return `You are an expert programming assistant.

The following is a coding problem:
"${question}"

Here is my attempted solution written in ${language}, which is failing on some test cases:

${code}

Please:
- Identify any mistakes in the logic or syntax
- Explain the issues clearly
- Suggest specific corrections

Respond in markdown format.`;
    }
}

module.exports = { generateGeminiPrompt };
