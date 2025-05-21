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
        url: {
          type: String,
          required: true,
          validate: {
            validator: function (value) {
              // Validate that the URL is a valid Cloudinary URL
              return /^https:\/\/res\.cloudinary\.com\/[^\s/$.?#].[^\s]*$/i.test(
                value
              );
            },
            message: (props) => `${props.value} is not a valid Cloudinary URL`,
          },
        },
        public_id: {
          type: String,
          required: true,
          validate: {
            validator: function (value) {
              // Validate that the public_id follows Cloudinary's format (e.g., "products/abc123")
              return /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(value);
            },
            message: (props) =>
              `${props.value} is not a valid Cloudinary public_id`,
          },
        },
      },
    ], // Updated to store Cloudinary URL and public_id
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
