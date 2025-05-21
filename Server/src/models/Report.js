// models/Report.js
const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    aiAnalysis: {
      summary: String,
      strengths: [String],
      weaknesses: [String],
      suggestions: [String],
    },
    ratingDistribution: {
      type: Map,
      of: Number,
    },
    sentimentAnalysis: {
      positive: Number,
      neutral: Number,
      negative: Number,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
