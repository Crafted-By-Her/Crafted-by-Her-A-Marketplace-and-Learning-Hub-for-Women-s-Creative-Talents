const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: { type: String, required: true },
    status: { type: String, default: "pending" },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    actionTaken: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
