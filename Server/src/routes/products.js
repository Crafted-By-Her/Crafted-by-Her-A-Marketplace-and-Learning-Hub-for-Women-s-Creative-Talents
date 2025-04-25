const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const uploadProductImages = require("../middlewares/upload");

// Modified routes
router.post("/", uploadProductImages, productController.createProduct);
router.put("/:id", uploadProductImages, productController.updateProduct);

// Unchanged routes
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.delete("/:id", productController.deleteProduct);

module.exports = router;
