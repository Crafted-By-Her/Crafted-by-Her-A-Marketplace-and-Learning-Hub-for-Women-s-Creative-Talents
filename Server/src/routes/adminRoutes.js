const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const userController = require("../controllers/productController");
const verifySuperAdmin = require("../middlewares/verifySuperAdmin");
const {auth} = require("../middlewares/auth");

// Apply auth middleware to all routes
router.use(auth);

// Admin management routes
router.get("/products", userController.getAllProducts);
router.delete("/products/:productId", adminController.deleteProduct);
router.patch("/users/:userId/warnings", adminController.incrementUserWarning);


module.exports = router;
