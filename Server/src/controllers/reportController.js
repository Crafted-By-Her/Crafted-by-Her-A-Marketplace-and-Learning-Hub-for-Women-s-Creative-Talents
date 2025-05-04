const Product = require("../models/Product");
const Report = require("../models/Report");
const { analyzeProduct } = require("../services/aiAnalysis");

exports.generateProductReport = async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`Generating report for product ${productId}`);

    // Fetch product with ratings
    const product = await Product.findById(productId).populate("ratings");
    if (!product) {
      console.log(`Product ${productId} not found`);
      return res.status(404).json({ message: "Product not found" });
    }

    // Generate AI analysis
    console.log(`Calling AI analysis for product ${productId}`);
    const aiAnalysisResult = await analyzeProduct(product);
    console.log(
      `AI analysis result for product ${productId}:`,
      aiAnalysisResult
    );

    // Update or create report
    const report = await Report.findOneAndUpdate(
      { productId },
      {
        productId,
        overallScore: aiAnalysisResult.score || 0,
        aiAnalysis: {
          summary: aiAnalysisResult.summary || "No summary available",
          strengths: aiAnalysisResult.strengths || [],
          weaknesses: aiAnalysisResult.weaknesses || [],
          suggestions: aiAnalysisResult.suggestions || [],
          sentiment: aiAnalysisResult.sentiment || "neutral",
        },
        ratingDistribution: product.ratingDistribution || {},
        sentimentAnalysis: aiAnalysisResult.sentimentAnalysis || {
          positive: 0,
          neutral: 0,
          negative: 0,
        },
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`Report created/updated for product ${productId}:`, {
      overallScore: report.overallScore,
      updatedAt: report.updatedAt,
    });

    res.status(200).json({ message: "Report generated successfully", report });
  } catch (error) {
    console.error(
      `Error generating report for product ${req.params.productId}:`,
      {
        message: error.message,
        stack: error.stack,
      }
    );
    res.error(error);
  }
};

exports.retryProductReports = async (req, res) => {
  const { productIds } = req.body;
  try {
    const results = [];
    for (const productId of productIds) {
      const req = { params: { productId } };
      const res = {
        status: (code) => ({
          json: (data) => {
            console.log(`Retry result for product ${productId}:`, data);
            results.push({
              productId,
              status: "success",
              message: data.message,
            });
          },
        }),
        error: (error) => {
          console.error(
            `Retry failed for product ${productId}:`,
            error.message
          );
          results.push({ productId, status: "failed", reason: error.message });
        },
      };
      await exports.generateProductReport(req, res);
    }
    res.status(200).json({ message: "Retry completed", results });
  } catch (error) {
    console.error(`Retry endpoint error:`, {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Retry failed", error: error.message });
  }
};
