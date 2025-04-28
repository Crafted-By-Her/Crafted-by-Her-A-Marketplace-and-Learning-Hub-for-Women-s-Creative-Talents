const { User, Admin, Product } = require("../models");

const bcrypt = require("bcrypt");

// Admin: Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("userId", "firstName lastName email warnings")
      .sort({ createdAt: -1 });

    res.json({
      message: "All products retrieved successfully",
      count: products.length,
      products,
    });
  } catch (error) {
    console.error(
      "🔥 ERROR:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    res.status(500).json({ error: error?.message});
  }


};

// Admin: Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const deletedProduct = await Product.findByIdAndDelete(productId);
    if (!deletedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      message: "Product deleted successfully",
      deletedProductId: productId,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin: Increment user warning
exports.incrementUserWarning = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { warnings: 1 } },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Auto-deactivate if warnings reach 3
    if (user.warnings >= 3) {
      user.isActive = false;
      await user.save();
      return res.json({
        message: "User warning incremented and account deactivated",
        userId: user._id,
        warnings: user.warnings,
        isActive: user.isActive,
      });
    }

    res.json({
      message: "User warning incremented successfully",
      userId: user._id,
      warnings: user.warnings,
      isActive: user.isActive,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
