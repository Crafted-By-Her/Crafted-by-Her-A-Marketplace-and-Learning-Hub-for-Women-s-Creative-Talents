const Product = require("../models/Product");
const Report = require("../models/Report");
const reportController = require("../controllers/reportController");

async function updateAllProductReports() {
  try {
    // Validate GEMINI_API_KEY
    console.log("Checking GEMINI_API_KEY in reportInitializer:", {
      isSet: !!process.env.GEMINI_API_KEY,
      length: process.env.GEMINI_API_KEY
        ? process.env.GEMINI_API_KEY.length
        : "Not set",
      snippet: process.env.GEMINI_API_KEY
        ? process.env.GEMINI_API_KEY.slice(0, 5) + "..."
        : "Not set",
    });
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in .env file");
    }

    console.log("Starting report generation for all products...");

    // Fetch all active products with title for better logging
    const products = await Product.find({ isActive: true }).select("_id title");

    if (products.length === 0) {
      console.log("No active products found to generate reports");
      return;
    }

    // Track successful and failed products
    const successfulProducts = [];
    const failedProducts = [];

    // Process products sequentially
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const DELAY_MS = 2000; // 2 seconds between requests
    const MAX_RETRIES = 3; // Retry failed API calls
    const ONE_DAY = 24 * 60 * 60 * 1000; // One day in milliseconds

    for (const product of products) {
      try {
        console.log(`Processing product: ${product._id} (${product.title})`);

        // Check if report exists and is recent
        const existingReport = await Report.findOne({ productId: product._id });
        if (
          existingReport &&
          existingReport.updatedAt > new Date(Date.now() - ONE_DAY)
        ) {
          console.log(
            `Skipping recent report for product ${product._id} (${product.title})`
          );
          successfulProducts.push({
            id: product._id.toString(),
            title: product.title,
          });
          continue;
        }

        // Mock request object
        const req = {
          params: { productId: product._id.toString() },
        };

        // Mock response object
        const res = {
          status: (code) => ({
            json: (data) => {
              console.log(
                `Report generated for product ${product._id} (${
                  product.title
                }): ${data.message || "Success"}`
              );
            },
          }),
          error: (error) => {
            console.error(
              `Report generation failed for product ${product._id} (${product.title}):`,
              error.message
            );
          },
        };

        // Retry logic for API calls
        let retries = 0;
        let success = false;
        while (retries < MAX_RETRIES) {
          try {
            await reportController.generateProductReport(req, res);
            success = true;
            successfulProducts.push({
              id: product._id.toString(),
              title: product.title,
            });
            break;
          } catch (error) {
            retries++;
            console.error(
              `Retry ${retries} for product ${product._id} (${product.title}):`,
              error.message
            );
            if (retries === MAX_RETRIES) {
              console.error(
                `All retries failed for product ${product._id} (${product.title})`
              );
              throw error;
            }
            await delay(2000);
          }
        }

        // Fallback for failed reports
        if (!success) {
          console.log(
            `Creating fallback report for product ${product._id} (${product.title})`
          );
          await Report.findOneAndUpdate(
            { productId: product._id },
            {
              productId: product._id,
              overallScore: 0,
              aiAnalysis: {
                summary: "Failed to generate AI analysis",
                strengths: [],
                weaknesses: [],
                suggestions: [],
                sentiment: "neutral",
              },
              ratingDistribution: {},
              sentimentAnalysis: { positive: 0, neutral: 0, negative: 0 },
              updatedAt: new Date(),
            },
            { upsert: true, new: true }
          );
          failedProducts.push({
            id: product._id.toString(),
            title: product.title,
            reason: "AI analysis failed after retries",
          });
        }
      } catch (error) {
        console.error(
          `Failed to generate report for product ${product._id} (${product.title}):`,
          {
            message: error.message,
            stack: error.stack,
          }
        );
        failedProducts.push({
          id: product._id.toString(),
          title: product.title,
          reason: error.message,
        });
      }
      await delay(DELAY_MS);
    }

    // Log results
    console.log("Successful products:", successfulProducts);
    if (failedProducts.length > 0) {
      console.log("Failed to generate reports for products:", failedProducts);
    } else {
      console.log("All product reports updated successfully");
    }
  } catch (error) {
    console.error("Error updating product reports:", {
      message: error.message,
      stack: error.stack,
    });
  }
}

module.exports = { updateAllProductReports };
