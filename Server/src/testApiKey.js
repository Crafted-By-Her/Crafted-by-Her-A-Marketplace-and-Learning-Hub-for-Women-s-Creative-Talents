require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testApiKey() {
  try {
    console.log(
      "Testing GEMINI_API_KEY:",
      process.env.GEMINI_API_KEY ? "Set" : "Not set"
    );
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Test prompt: Hello, Gemini!");
    const response = await result.response;
    console.log("API test successful:", response.text());
  } catch (error) {
    console.error("API test failed:", {
      message: error.message,
      stack: error.stack,
    });
  }
}

testApiKey();
