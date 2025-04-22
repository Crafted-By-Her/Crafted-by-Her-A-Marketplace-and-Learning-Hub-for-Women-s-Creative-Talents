const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    category: String,
    price: Number,
    images: [String],
    contactInfo: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: { type: Boolean, default: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    deletedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
