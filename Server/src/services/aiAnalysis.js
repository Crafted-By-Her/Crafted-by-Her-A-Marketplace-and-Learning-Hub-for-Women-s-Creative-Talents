const { GoogleGenerativeAI } = require("@google/generative-ai");

async function analyzeProduct(productData) {
  try {
    console.log("Using GEMINI_API_KEY in aiAnalysis:", {
      isSet: !!process.env.GEMINI_API_KEY,
      length: process.env.GEMINI_API_KEY
        ? process.env.GEMINI_API_KEY.length
        : "Not set",
      snippet: process.env.GEMINI_API_KEY
        ? process.env.GEMINI_API_KEY.slice(0, 5) + "..."
        : "Not set",
    });

    console.log("Product data sent to Gemini:", {
      title: productData.title,
      description: productData.description,
      averageRating: productData.averageRating,
      ratings: productData.ratings,
    });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze the following product and provide a detailed report:
    Title: ${productData.title}
    Description: ${productData.description}
    Average Rating: ${productData.averageRating || "N/A"}
    Ratings: ${JSON.stringify(productData.ratings) || "No ratings available"}

    Return a valid JSON object with the following fields:
    - score: A numerical score out of 100 based on quality, appeal, and ratings
    - summary: A brief summary of the product's strengths and weaknesses
    - strengths: An array of positive aspects
    - weaknesses: An array of areas for improvement
    - suggestions: An array of suggestions for improvement
    - sentiment: Overall sentiment ("positive", "neutral", "negative")
    - sentimentAnalysis: Object with counts of positive, neutral, and negative sentiments

    Ensure the response is raw JSON without Markdown code fences or other formatting.`;

    console.log(`Sending prompt to Gemini for product ${productData._id}`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
    console.log(
      `Raw response from Gemini for product ${productData._id}:`,
      rawText
    );

    // Clean the response to remove Markdown code fences
    let cleanedText = rawText.replace(/^```json\n|```$/g, "").trim();
    const analysis = JSON.parse(cleanedText);

    console.log(`Parsed analysis for product ${productData._id}:`, analysis);
    return analysis;
  } catch (error) {
    console.error(`AI analysis failed for product ${productData._id}:`, {
      message: error.message,
      stack: error.stack,
    });
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

module.exports = { analyzeProduct };
