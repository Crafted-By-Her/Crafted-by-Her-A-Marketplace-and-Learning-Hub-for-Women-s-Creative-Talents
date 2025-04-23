const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/products");

const cors = require("cors");

// Load env variables
dotenv.config();
// Connect to MongoDB
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// Health route
app.get("/", (req, res) => {
  res.send("Crafted by Her API is running...");
});

app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);


// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
