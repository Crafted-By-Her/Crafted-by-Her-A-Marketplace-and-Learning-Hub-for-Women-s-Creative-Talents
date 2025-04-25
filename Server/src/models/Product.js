const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ["Clothes", "Shoes", "Jewelries", "Beauties", "Bags", "Arts"],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    images: [
      {
        type: String,
        validate: {
          validator: function (url) {
            // Allow both URLs and local paths
            return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$|^\/uploads\/[^\s]+$/i.test(
              url
            );
          },
          message: (props) => `${props.value} is not a valid image URL or path`,
        },
      },
    ],
    contactInfo: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      set: (val) => parseFloat(val.toFixed(1)), // Store as 4.5 instead of 4.5123
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }, // Include virtuals when converted to JSON
    toObject: { virtuals: true },
  }
);

// Virtual populate ratings (avoid storing ratings array in Product)
productSchema.virtual("ratings", {
  ref: "Rating",
  localField: "_id",
  foreignField: "productId",
  justOne: false,
});

module.exports = mongoose.model("Product", productSchema);
