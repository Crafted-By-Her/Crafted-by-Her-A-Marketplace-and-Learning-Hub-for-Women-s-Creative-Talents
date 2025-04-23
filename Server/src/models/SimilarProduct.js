const mongoose = require("mongoose");

const similarProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    similarTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    isSponsored: { type: Boolean, default: false },
  },
  { timestamps: true }
);

similarProductSchema.index({ productId: 1, similarTo: 1 }, { unique: true });

module.exports = mongoose.model("SimilarProduct", similarProductSchema);
