const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    score: { type: Number, required: true },
  },
  { timestamps: true }
);

ratingSchema.index({ productId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Rating", ratingSchema);
