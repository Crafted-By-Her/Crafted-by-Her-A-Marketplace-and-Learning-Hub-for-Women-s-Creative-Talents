const { Product, User, Rating } = require("../models");

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
    const { userId, title, price, description, category } = req.body;
    
    // Validate required fields
    if (!title || !price || !category || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.gender !== "female") {
      return res.status(403).json({ error: "Only female users can create products" });
    }

    // Process uploaded files
    const imagePaths = req.files?.map(file => `/uploads/${file.filename}`) || [];

    // Create product
    const product = new Product({
      title,
      price,
      description,
      category,
      userId,
      images: imagePaths,
      contactInfo: user.email,
      averageRating: 0,
      ratingCount: 0
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Process uploaded files if any
    if (req.files && req.files.length > 0) {
      updates.images = req.files.map(file => `/uploads/${file.filename}`);
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updates, { 
      new: true,
      runValidators: true 
    });
    
    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    res.json(updatedProduct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


// GET all products (with ratings summary)
exports.getAllProducts = async (req, res) => {
  try {
    const { category } = req.query; // Get category from query params
    const page = parseInt(req.query.page) || 1; // Pagination support
    const limit = parseInt(req.query.limit) || 10; // Default limit

    let query = {};
    let sortOption = {};

    // If category is provided in query params
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

      // Validate category
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid category. Valid options: Clothes, Shoes, Jewelries, Beauties, Bags, Arts, All, New Release",
        });
      }

      // Handle different category cases
      if (category === "New Release") {
        sortOption = { createdAt: -1 };
        query = {}; // Show all products but sorted by newest
      } else if (category !== "All") {
        query.category = category;
      }
    }

    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Product.countDocuments(query);

    // Find products with filtering, sorting and pagination
    let productsQuery = Product.find(query)
      .populate("userId", "name email")
      .sort(sortOption)
      .skip(startIndex)
      .limit(category === "New Release" ? 8 : limit); // Special limit for New Release

    const products = await productsQuery;

    // Fetch and include ratings for each product
    const productsWithRatings = await Promise.all(
      products.map(async (product) => {
        const ratings = await Rating.find({ productId: product._id })
          .populate("userId", "name email")
          .sort({ createdAt: -1 });

        return {
          ...product.toObject(),
          ratings: ratings.map((rating) => ({
            userId: rating.userId._id,
            userName: rating.userId.name,
            userEmail: rating.userId.email,
            score: rating.score,
            comment: rating.comment,
            createdAt: rating.createdAt,
          })),
        };
      })
    );

    // Pagination result
    const pagination = {};
    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit: limit,
      };
    }
    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit: limit,
      };
    }

    res.json({
      success: true,
      count: productsWithRatings.length,
      pagination,
      data: productsWithRatings,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};
// GET one product (with detailed ratings)
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "userId",
      "name email"
    );
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Fetch ratings for the product
    const ratings = await Rating.find({ productId: product._id })
      .populate("userId", "name email")
      .sort({ createdAt: -1 }); // Sort ratings by most recent

    const productWithRatings = {
      ...product.toObject(), // Convert to plain object
      ratings: ratings.map((rating) => ({
        userId: rating.userId._id,
        userName: rating.userId.name,
        userEmail: rating.userId.email,
        score: rating.score,
        comment: rating.comment,
        createdAt: rating.createdAt,
      })),
    };

    res.json(productWithRatings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE product (disallow rating updates here)
exports.updateProduct = async (req, res) => {
  try {
    // Prevent manual rating updates
    if (req.body.averageRating || req.body.ratingCount) {
      return res.status(403).json({
        error: "Ratings can only be updated via the rating system.",
      });
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE product (cascade delete ratings)
exports.deleteProduct = async (req, res) => {
  try {
    // Delete associated ratings first
    await Rating.deleteMany({ productId: req.params.id });

    // Then delete the product
    await Product.findByIdAndDelete(req.params.id);

    res.json({ message: "Product and its ratings deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
