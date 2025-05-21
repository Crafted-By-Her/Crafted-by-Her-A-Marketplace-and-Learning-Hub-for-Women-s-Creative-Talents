const mongoose = require("mongoose");
const { Product, User, Rating } = require("../models");
const { deleteFile } = require("../middlewares/upload");

// Helper: Update product's average rating and rating count
exports.updateProductRatingStats = async (productId) => {
  const ratings = await Rating.find({ productId });

  if (ratings.length > 0) {
    const totalScore = ratings.reduce((sum, rating) => sum + rating.score, 0);
    const averageRating = parseFloat((totalScore / ratings.length).toFixed(1));

    await Product.findByIdAndUpdate(productId, {
      averageRating,
      ratingCount: ratings.length,
    });
  } else {
    // Reset if no ratings exist
    await Product.findByIdAndUpdate(productId, {
      averageRating: 0,
      ratingCount: 0,
    });
  }
};

// CREATE product (with initial rating fields)
exports.createProduct = async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("Uploaded files:", req.files);

    const { userId, title, price, description, category } = req.body;

    // Validate required fields
    if (!title || !price || !category || !userId) {
      console.log("Missing required fields:", {
        title,
        price,
        category,
        userId,
      });
      if (req.files) {
        req.files.forEach((file) => {
          console.log("Cleaning up file:", file.filename);
          deleteFile(file.filename); // Use Cloudinary public_id
        });
      }
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("Invalid userId format:", userId);
      if (req.files) {
        req.files.forEach((file) => {
          console.log("Cleaning up file:", file.filename);
          deleteFile(file.filename);
        });
      }
      return res.status(400).json({ error: "Invalid userId format" });
    }

    // Validate user
    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found for userId:", userId);
      if (req.files) {
        req.files.forEach((file) => {
          console.log("Cleaning up file:", file.filename);
          deleteFile(file.filename);
        });
      }
      return res.status(404).json({ error: "User not found" });
    }

    if (user.gender !== "female") {
      console.log("User is not female:", user.gender);
      if (req.files) {
        req.files.forEach((file) => {
          console.log("Cleaning up file:", file.filename);
          deleteFile(file.filename);
        });
      }
      return res
        .status(403)
        .json({ error: "Only female users can create products" });
    }

    // Process uploaded files (Cloudinary provides secure_url and public_id)
    const imageData =
      req.files?.map((file) => {
        console.log("Processing file:", file);
        return {
          url: file.path, // Cloudinary's secure_url
          public_id: file.filename, // Cloudinary's public_id
        };
      }) || [];
    console.log("Image data:", imageData);

    // Create product
    const productData = {
      title,
      price: parseFloat(price), // Ensure price is a number
      description,
      category,
      userId,
      images: imageData,
      contactInfo: user.email,
      averageRating: 0,
      ratingCount: 0,
    };
    console.log("Product data:", productData);

    const product = new Product(productData);
    const savedProduct = await product.save();
    console.log("Product saved successfully:", savedProduct);

    res.status(201).json(savedProduct);
  } catch (err) {
    console.error("Product creation error:", {
      message: err.message,
      stack: err.stack,
      requestBody: req.body,
      uploadedFiles: req.files,
    });

    // Clean up files if error occurs
    if (req.files) {
      req.files.forEach((file) => {
        console.log("Cleaning up file on error:", file.filename);
        deleteFile(file.filename);
      });
    }

    res.status(400).json({
      error: "Product creation failed",
      details: err.message, // Always include details for debugging
    });
  }
};
// UPDATE product
exports.updateProduct = async (req, res) => {
  try {
    console.log("Update request received:", {
      params: req.params,
      body: req.body,
      files: req.files,
    });

    const { id } = req.params;
    const updates = req.body;

    // Add ID validation
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid product ID format" });
    }

    const product = await Product.findById(id);
    console.log("Found product:", product); // Debug logging

    if (!product) {
      if (req.files) {
        console.log("Cleaning up files for non-existent product");
        await Promise.all(req.files.map((file) => deleteFile(file.filename)));
      }
      return res.status(404).json({ error: "Product not found" });
    }

    // Prevent manual rating updates
    if (updates.averageRating || updates.ratingCount) {
      if (req.files) {
        req.files.forEach((file) => {
          deleteFile(file.filename); // Use Cloudinary public_id
        });
      }
      return res.status(403).json({
        error: "Ratings can only be updated via the rating system",
      });
    }

    // Handle image updates
    if (req.files && req.files.length > 0) {
      // Delete old images from Cloudinary
      if (product.images && product.images.length > 0) {
        product.images.forEach((image) => {
          if (image.public_id) {
            deleteFile(image.public_id); // Use Cloudinary public_id
          }
        });
      }
      // Update with new images
      updates.images = req.files.map((file) => ({
        url: file.path, // Cloudinary's secure_url
        public_id: file.filename, // Cloudinary's public_id
      }));
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    res.json(updatedProduct);
  } catch (err) {
    console.error("Update error:", err); // Detailed error logging
    if (req.files) {
      await Promise.all(req.files.map((file) => deleteFile(file.filename)));
    }
    res.status(500).json({
      error: "Product update failed",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// GET all products (with ratings summary)
exports.getAllProducts = async (req, res) => {
  try {
    const { category } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Validate page and limit
    if (page < 1 || limit < 1) {
      return res
        .status(400)
        .json({ error: "Page and limit must be positive integers" });
    }

    let query = {};
    let sortOption = {};

    // Validate category
    if (category) {
      const validCategories = [
        "Clothes",
        "Shoes",
        "Jewelries",
        "Beauties",
        "Bags",
        "Arts",
        "All",
        "New Release",
      ];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: "Invalid category",
          validCategories,
        });
      }
      if (category === "New Release") {
        sortOption = { createdAt: -1 };
      } else if (category !== "All") {
        query.category = category;
      }
    }

    const startIndex = (page - 1) * limit;
    const total = await Product.countDocuments(query);

    // Log query details for debugging
    console.log(
      "Query:",
      query,
      "Sort:",
      sortOption,
      "Page:",
      page,
      "Limit:",
      limit
    );

    // Get products with user details
    const products = await Product.find(query)
      .populate({
        path: "userId",
        select: "_id email firstName lastName profilePhoto",
        options: { strictPopulate: false },
      })
      .sort(sortOption)
      .skip(startIndex)
      .limit(category === "New Release" ? 8 : limit);

    if (!products.length) {
      return res.json({
        success: true,
        total,
        page,
        pages: 0,
        data: [],
      });
    }

    // Get ratings for each product
    const productsWithRatings = await Promise.all(
      products.map(async (product) => {
        try {
          const ratings = await Rating.find({ productId: product._id })
            .populate("userId", "_id email firstName lastName profilePhoto")
            .sort({ createdAt: -1 });

          const productObj = product.toObject();
          // Images are already Cloudinary URLs
          productObj.images = productObj.images.map((image) => ({
            url: image.url,
            public_id: image.public_id,
          }));

          // Handle profile photo for user (updated for new structure)
          productObj.userId.profilePhoto =
            productObj.userId?.profilePhoto?.url || null;

          return {
            ...productObj,
            ratings: ratings.map((rating) => {
              // Handle cases where userId might be null (e.g., user deleted)
              const userId = rating.userId || {};
              const fullName =
                [userId.firstName, userId.lastName]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || "Anonymous";

              // Updated to use profilePhoto.url
              let profilePhoto = userId.profilePhoto?.url || null;

              return {
                userId: userId._id || null,
                userEmail: userId.email || "N/A",
                fullName,
                profilePhoto,
                score: rating.score,
                comment: rating.comment,
                createdAt: rating.createdAt,
              };
            }),
            averageRating: product.averageRating,
            ratingCount: product.ratingCount,
            id: product._id.toString(),
          };
        } catch (err) {
          console.error(`Error processing product ${product._id}:`, err);
          return null;
        }
      })
    ).then((results) => results.filter((result) => result !== null));

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: productsWithRatings,
    });
  } catch (err) {
    console.error("Error in getAllProducts:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch products",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Get user's products with optional category filter
exports.getUserProducts = async (req, res) => {
  try {
    console.log("Fetching products for user:", req.user._id); // Fixed the typo
    const { category } = req.query;
    const userId = req.user._id;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // Build query
    const query = { userId };
    if (category) {
      query.category = category;
      console.log("Filtering by category:", category);
    }

    // Fetch products with error handling
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .populate("userId", "firstName lastName profilePhoto")
      .lean(); // Convert to plain JS object

    if (!products) {
      console.error("Products query returned null");
      return res.status(500).json({ error: "Database query failed" });
    }

    console.log(`Found ${products.length} products`);

    // Transform products to include Cloudinary image data
    const transformedProducts = products.map((product) => {
      // Images are already in Cloudinary format
      const images = product.images.map((image) => ({
        url: image.url,
        public_id: image.public_id,
      }));

      // Handle userId.profilePhoto for Cloudinary format
      let profilePhoto = product.userId?.profilePhoto?.url || null;

      return {
        ...product,
        images,
        userId: {
          ...product.userId,
          profilePhoto, // Use transformed profilePhoto
        },
      };
    });

    // Successful response
    return res.json({
      success: true,
      count: transformedProducts.length,
      products: transformedProducts,
    });
  } catch (err) {
    console.error("Error in getUserProducts:", {
      error: err.message,
      stack: err.stack,
      userId: req.user?._id,
      query: req.query,
    });

    return res.status(500).json({
      error: "Failed to fetch products",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// GET one product (with detailed ratings)
exports.getProductById = async (req, res) => {
  try {
    const mongoose = require("mongoose");

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid product ID format" });
    }

    const product = await Product.findById(req.params.id).populate({
      path: "userId",
      select: "firstName lastName email profilePhoto",
      options: { lean: true },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    let ratings = [];
    try {
      ratings = await Rating.find({ productId: product._id })
        .populate("userId", "firstName lastName profilePhoto")
        .sort({ createdAt: -1 });
    } catch (ratingErr) {
      console.error("Error fetching ratings:", ratingErr);
    }

    const productObj = product.toObject();

    // Safely transform images
    productObj.images = (productObj.images || []).map((image) => ({
      url: image?.url,
      public_id: image?.public_id,
    }));

    // Safely handle profile photo with proper type checking
    if (productObj.userId && productObj.userId.profilePhoto) {
      const profilePhoto = String(productObj.userId.profilePhoto);
      if (!profilePhoto.startsWith("http") && profilePhoto.trim() !== "") {
        productObj.userId.profilePhoto = `${
          process.env.BASE_URL || "http://localhost:8080"
        }${profilePhoto.startsWith("/") ? profilePhoto : `/${profilePhoto}`}`;
      }
    }

    res.json({
      ...productObj,
      ratings,
    });
  } catch (err) {
    console.error("Error in getProductById:", err);
    res.status(500).json({
      error: "Failed to fetch product",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// DELETE product (cascade delete ratings)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Delete associated images from Cloudinary
    if (product.images && product.images.length > 0) {
      product.images.forEach((image) => {
        if (image.public_id) {
          deleteFile(image.public_id); // Use Cloudinary public_id
        }
      });
    }

    // Delete associated ratings
    await Rating.deleteMany({ productId: req.params.id });

    // Delete the product
    await Product.findByIdAndDelete(req.params.id);

    res.json({
      message: "Product and its associated data deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to delete product",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
