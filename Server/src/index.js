const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const initializeSuperAdmin = require("./config/initializeSuperAdmin");

const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const superAdminRoutes = require("./routes/superAdminRoutes");

const adminRoutes = require("./routes/adminRoutes");
const productRoutes = require("./routes/products");
const ratingRoutes = require("./routes/ratingRoutes")

const cors = require("cors");

// Load env variables
dotenv.config();
// Connect to MongoDB
connectDB();
initializeSuperAdmin();

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// Health route
app.get("/", (req, res) => {
  res.send("Crafted by Her API is running...");
});

app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));


app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admins", adminRoutes); 
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/ratings", ratingRoutes);


// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
