const Rating = require("../models/Rating");
const Product = require("../models/Product");
const { updateProductRatingStats } = require("./productController");

// Single rating creation
exports.addRating = async (req, res) => {
  try {
    const { productId, userId, score, comment } = req.body;

    // Validate inputs
    if (!productId || !userId || !score) {
      return res.status(400).json({
        error: "productId, userId, and score are required.",
      });
    }
    if (score < 1 || score > 5) {
      return res.status(400).json({
        error: "Score must be between 1 and 5.",
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        error: `Product not found: ${productId}`,
      });
    }

    // Check for existing rating
    const existingRating = await Rating.findOne({ productId, userId });
    if (existingRating) {
      return res.status(400).json({
        error: "User has already rated this product.",
      });
    }

    // Create and save rating
    const rating = new Rating({
      productId,
      userId,
      score,
      comment,
    });
    await rating.save();

    // Update product rating stats using the shared helper
    await updateProductRatingStats(productId);

    // Get updated product with rating stats
    const updatedProduct = await Product.findById(productId);

    res.status(201).json({
      message: "Rating added successfully.",
      rating: {
        _id: rating._id,
        productId: rating.productId,
        userId: rating.userId,
        score: rating.score,
        comment: rating.comment,
        createdAt: rating.createdAt,
      },
      productStats: {
        averageRating: updatedProduct.averageRating,
        ratingCount: updatedProduct.ratingCount,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: "Server error: " + err.message,
    });
  }
};

// Bulk rating creation
exports.addBulkRatings = async (req, res) => {
  try {
    const bulkData = req.body; // Array of products with ratings

    // Validate input format
    if (!Array.isArray(bulkData) || bulkData.length === 0) {
      return res.status(400).json({
        error: "Request body must be a non-empty array of product ratings.",
      });
    }

    const allResults = [];
    const allErrors = [];

    for (const entry of bulkData) {
      const { productId, ratings } = entry;

      // Validate productId and ratings array
      if (!productId || !Array.isArray(ratings) || ratings.length === 0) {
        allErrors.push({
          productId,
          error: "productId and non-empty ratings array are required.",
        });
        continue;
      }

      // Check if product exists
      const product = await Product.findById(productId);
      if (!product) {
        allErrors.push({
          productId,
          error: `Product not found: ${productId}`,
        });
        continue;
      }

      const results = [];
      const errors = [];

      // Process each rating for the product
      for (const rating of ratings) {
        try {
          const { userId, score, comment } = rating;

          // Validate required fields
          if (!userId || score == null) {
            errors.push({
              error: "Missing userId or score.",
              rating,
            });
            continue;
          }

          // Validate score range
          if (score < 1 || score > 5) {
            errors.push({
              error: "Score must be between 1 and 5.",
              rating,
            });
            continue;
          }

          // Check for duplicate rating
          const existingRating = await Rating.findOne({ productId, userId });
          if (existingRating) {
            errors.push({
              error: "User has already rated this product.",
              rating,
            });
            continue;
          }

          // Create and save the rating
          const newRating = new Rating({
            productId,
            userId,
            score,
            comment,
          });
          await newRating.save();
          results.push(newRating);
        } catch (err) {
          errors.push({
            error: err.message,
            rating,
          });
        }
      }

      // Update product stats if any ratings were added
      if (results.length > 0) {
        await updateProductRatingStats(productId);
      }

      // Get updated product stats
      const updatedProduct = await Product.findById(productId);

      // Add results and errors for this product
      allResults.push({
        productId,
        success: results.length > 0,
        created: results.length,
        failed: errors.length,
        productStats: {
          averageRating: updatedProduct.averageRating,
          ratingCount: updatedProduct.ratingCount,
        },
        results,
        errors,
      });
    }

    res.status(201).json({
      message: "Bulk rating processing completed.",
      processed: allResults.length,
      results: allResults,
      errors: allErrors,
    });
  } catch (err) {
    res.status(500).json({
      error: "Server error: " + err.message,
    });
  }
};

// Get all ratings for a product
exports.getProductRatings = async (req, res) => {
  try {
    const { productId } = req.params;

    const ratings = await Rating.find({ productId })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json({
      count: ratings.length,
      ratings,
    });
  } catch (err) {
    res.status(500).json({
      error: "Server error: " + err.message,
    });
  }
};
