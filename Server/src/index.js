const express = require("express");
const swaggerUi = require("swagger-ui-express");
const yaml = require("yamljs");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const initializeSuperAdmin = require("./config/initializeSuperAdmin");
const { updateAllProductReports } = require("./config/reportInitializer");

const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const productRoutes = require("./routes/products");
const ratingRoutes = require("./routes/ratingRoutes");
const reportRoutes = require("./routes/reportRoutes");
const swaggerDocument = yaml.load("./swagger.yaml");

const cors = require("cors");

// Load environment variables
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
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? "Set" : "Not set",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? "Set" : "Not set",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? "Set" : "Not set",
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
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      throw new Error("CLOUDINARY_CLOUD_NAME is not set. Check .env file.");
    }
    if (!process.env.CLOUDINARY_API_KEY) {
      throw new Error("CLOUDINARY_API_KEY is not set. Check .env file.");
    }
    if (!process.env.CLOUDINARY_API_SECRET) {
      throw new Error("CLOUDINARY_API_SECRET is not set. Check .env file.");
    }

    // Connect to MongoDB
    await connectDB();

    // Initialize super admin
    if (typeof initializeSuperAdmin !== "function") {
      throw new Error(
        "initializeSuperAdmin is not a function. Check the export in ./config/initializeSuperAdmin.js"
      );
    }
    await initializeSuperAdmin();

    // Define routes
    app.get("/", (req, res) => {
      res.send("Crafted by Her API is running...");
    });

    // Removed /uploads route as images are now served from Cloudinary
    app.use("/api/auth", authRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/products", productRoutes);
    app.use("/api/ratings", ratingRoutes);
    app.use("/api/report", reportRoutes);
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    // Start server
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      // Run report updates in the background
      setTimeout(async () => {
        console.log("Starting background report updates...");
        console.log("Swagger UI available at http://localhost:8080/api-docs");

        try {
          await updateAllProductReports();
          console.log("Background report updates completed");
        } catch (error) {
          console.error("Background report updates failed:", {
            message: error.message,
            stack: error.stack,
          });
        }
      }, 1000);
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
