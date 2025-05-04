const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const initializeSuperAdmin = require("./config/initializeSuperAdmin");
const { updateAllProductReports } = require("./config/reportInitializer");

const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
// const adminRoutes = require("./routes/adminRoutes");
const productRoutes = require("./routes/products");
const ratingRoutes = require("./routes/ratingRoutes");
const reportRoutes = require("./routes/reportRoutes");

const cors = require("cors");

// Load environment variables with explicit path for debugging
const dotenvConfig = dotenv.config({ path: path.join(__dirname, ".env") });
if (dotenvConfig.error) {
  console.error("Failed to load .env file:", dotenvConfig.error.message);
}

// Debug environment variables
console.log("Environment variables:", {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "Set" : "Not set",
  GEMINI_API_KEY_LENGTH: process.env.GEMINI_API_KEY
    ? process.env.GEMINI_API_KEY.length
    : "Not set",
  GEMINI_API_KEY_SNIPPET: process.env.GEMINI_API_KEY
    ? process.env.GEMINI_API_KEY.slice(0, 5) + "..."
    : "Not set",
  MONGO_URI: process.env.MONGO_URI ? "Set" : "Not set",
  PORT: process.env.PORT || "Not set",
});

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

const startServer = async () => {
  try {
    // Validate critical environment variables
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set. Check .env file.");
    }

    // Connect to MongoDB
    await connectDB();

    // Initialize super admin
    await initializeSuperAdmin();

    // Update reports for all products
    await updateAllProductReports();

    // Define routes
    app.get("/", (req, res) => {
      res.send("Crafted by Her API is running...");
    });

    app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

    app.use("/api/auth", authRoutes);
    app.use("/api/users", userRoutes);
    // app.use("/api/admins", adminRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/products", productRoutes);
    app.use("/api/ratings", ratingRoutes);
    app.use("/api/report", reportRoutes);

    // Start server
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

startServer();
