const { User, Admin, Product } = require("../models");
const bcrypt = require("bcrypt");
const { deleteFile } = require("../middlewares/upload");
const sendEmail = require("../services/sendEmail");

// Admin: Change password (after login)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.user.id; // From auth middleware

    // Validate input
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Both current and new password are required" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "New password must be at least 8 characters" });
    }

    // Get admin user
    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({ error: "Admin user not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    admin.password = hashedPassword;
    await admin.save();

    res.json({
      message: "Password updated successfully",
      userId: admin._id,
      email: admin.email,
      updatedAt: admin.updatedAt,
    });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({
      error: "Failed to change password",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Admin: Get all products, sorted by overallScore (ascending)
exports.getAllProducts = async (req, res) => {
  try {
    // Aggregate products with reports to include overallScore
    const products = await Product.aggregate([
      // Match active products
      { $match: { isActive: true } },
      // Left join with Report collection
      {
        $lookup: {
          from: "reports",
          localField: "_id",
          foreignField: "productId",
          as: "report",
        },
      },
      // Unwind report (convert array to object, preserve null for no report)
      {
        $unwind: {
          path: "$report",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Project fields, set default overallScore to 0 if no report
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          averageRating: 1,
          ratingDistribution: 1,
          userId: 1,
          images: 1, // Include images field
          createdAt: 1,
          updatedAt: 1,
          isActive: 1,
          overallScore: { $ifNull: ["$report.overallScore", 0] },
        },
      },
      // Populate userId
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $unwind: {
          path: "$userDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          averageRating: 1,
          ratingDistribution: 1,
          createdAt: 1,
          updatedAt: 1,
          isActive: 1,
          overallScore: 1,
          images: {
            $map: {
              input: "$images",
              as: "image",
              in: {
                url: "$$image.url",
                public_id: "$$image.public_id",
              },
            },
          },
          userId: {
            _id: "$userDetails._id",
            firstName: "$userDetails.firstName",
            lastName: "$userDetails.lastName",
            email: "$userDetails.email",
            warnings: "$userDetails.warnings",
            profilePhoto: "$userDetails.profilePhoto",
          },
        },
      },
      // Sort by overallScore (ascending)
      { $sort: { overallScore: 1 } },
    ]);

    // Transform user profilePhoto for response
    const transformedProducts = products.map((product) => {
      let profilePhoto =
        product.userId?.profilePhoto?.url || product.userId?.profilePhoto;
      if (
        profilePhoto &&
        typeof profilePhoto === "string" &&
        !profilePhoto.startsWith("http")
      ) {
        profilePhoto = `${
          process.env.BASE_URL || "http://localhost:8080"
        }${profilePhoto}`;
      }
      return {
        ...product,
        userId: {
          ...product.userId,
          profilePhoto,
        },
      };
    });

    res.json({
      message: "All products retrieved successfully",
      count: transformedProducts.length,
      products: transformedProducts,
    });
  } catch (error) {
    console.error(
      "🔥 ERROR in getAllProducts:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    res.status(500).json({ error: error.message });
  }
};

// Admin: Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const deletedProduct = await Product.findById(productId);
    if (!deletedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Delete associated images from Cloudinary
    if (deletedProduct.images && deletedProduct.images.length > 0) {
      for (const image of deletedProduct.images) {
        if (image.public_id) {
          await deleteFile(image.public_id);
        }
      }
    }

    // Delete the product
    await Product.findByIdAndDelete(productId);

    res.json({
      message: "Product deleted successfully",
      deletedProductId: productId,
    });
  } catch (error) {
    console.error(
      "🔥 ERROR in deleteProduct:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
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

    // Send email when warnings reach 3
    if (user.warnings === 3) {
      const emailSubject = "Warning: Account Violation Notice";
      const emailText = `Dear ${user.firstName} ${user.lastName},\n\nYour account has received 3 warnings due to policy violations. Further violations may lead to account deactivation. Please review our terms of service.\n\nBest regards,\nThe Support Team`;
      try {
        await sendEmail(user.email, emailSubject, emailText);
      } catch (emailError) {
        console.error("Failed to send warning email:", emailError);
        // Continue execution even if email fails
      }
    }

    // Auto-deactivate if warnings reach 5
    if (user.warnings >= 5) {
      user.isActive = false;
      await user.save();

      // Send deactivation email
      const emailSubject = "Account Deactivated";
      const emailText = `Dear ${user.firstName} ${user.lastName},\n\nYour account has been deactivated due to receiving 5 warnings for policy violations. Contact support for further assistance.\n\nBest regards,\nThe Support Team`;
      try {
        await sendEmail(user.email, emailSubject, emailText);
      } catch (emailError) {
        console.error("Failed to send deactivation email:", emailError);
        // Continue execution even if email fails
      }

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
    console.error(
      "🔥 ERROR in incrementUserWarning:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    res.status(500).json({ error: error.message });
  }
};

// Admin/Super Admin: Activate user and reset warnings
exports.activateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if already active
    if (user.isActive && user.warnings === 0) {
      return res
        .status(400)
        .json({ error: "User is already active with no warnings" });
    }

    // Activate user and reset warnings
    user.isActive = true;
    user.warnings = 0;
    await user.save();

    // Send reactivation email
    const emailSubject = "Account Reactivated";
    const emailText = `Dear ${user.firstName} ${user.lastName},\n\nYour account has been reactivated, and your warnings have been reset to 0. You can now access all features. Please adhere to our terms of service to avoid future issues.\n\nBest regards,\nThe Support Team`;
    try {
      await sendEmail(user.email, emailSubject, emailText);
    } catch (emailError) {
      console.error("Failed to send reactivation email:", emailError);
      // Continue execution even if email fails
    }

    res.json({
      message: "User activated and warnings reset successfully",
      userId: user._id,
      email: user.email,
      isActive: user.isActive,
      warnings: user.warnings,
    });
  } catch (error) {
    console.error(
      "🔥 ERROR in activateUser:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    res.status(500).json({ error: error.message });
  }
};
