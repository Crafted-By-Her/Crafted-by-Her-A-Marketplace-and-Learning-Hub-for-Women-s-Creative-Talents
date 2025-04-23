const mongoose = require("mongoose");

const adminActionSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    actionType: { type: String, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetType: { type: String, required: true },
    reason: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminAction", adminActionSchema);
