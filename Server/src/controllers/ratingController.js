const mongoose = require("mongoose");
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

// Get ratings for products owned by the user
exports.getUserProductRatings = async (req, res) => {
  try {
    const userId = req.user._id;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // Find products owned by the user
    const userProducts = await Product.find({ userId }).select("_id").lean();
    const productIds = userProducts.map((product) => product._id);

    if (!productIds.length) {
      return res.status(200).json({
        success: true,
        ratings: [],
        message: "No products found for this user.",
      });
    }

    // Find ratings for the user's products
    const ratings = await Rating.find({ productId: { $in: productIds } })
      .populate("productId", "title images category price")
      .populate("userId", "firstName lastName profilePhoto email")
      .sort({ createdAt: -1 })
      .lean();

    // Transform ratings to include fullName and handle Cloudinary images
    const transformedRatings = ratings.map((rating) => {
      // Construct fullName
      const fullName =
        [rating.userId?.firstName, rating.userId?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() || "Anonymous";

      // Transform rater's profilePhoto
      let profilePhoto =
        rating.userId?.profilePhoto?.url || rating.userId?.profilePhoto;
      if (
        profilePhoto &&
        typeof profilePhoto === "string" &&
        !profilePhoto.startsWith("http")
      ) {
        profilePhoto = `${
          process.env.BASE_URL || "http://localhost:8080"
        }${profilePhoto}`;
      }

      // Transform product images
      const images =
        rating.productId?.images?.map((image) => ({
          url: image.url,
          public_id: image.public_id,
        })) || [];

      return {
        _id: rating._id,
        product: {
          _id: rating.productId?._id,
          title: rating.productId?.title,
          images,
          category: rating.productId?.category,
          price: rating.productId?.price,
        },
        rater: {
          _id: rating.userId?._id,
          email: rating.userId?.email,
          fullName,
          profilePhoto,
        },
        score: rating.score,
        comment: rating.comment,
        createdAt: rating.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      ratings: transformedRatings,
    });
  } catch (err) {
    console.error("Error in getUserProductRatings:", {
      error: err.message,
      stack: err.stack,
      userId: req.user?._id,
    });
    res.status(500).json({
      error: "Failed to fetch product ratings",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
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
