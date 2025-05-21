const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { uploadProductImages } = require("../middlewares/upload");
const { auth, authRole } = require("../middlewares/auth");

// Public routes (no authentication needed)
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.patch("/:id", uploadProductImages, productController.updateProduct);



// Protected routes for normal users only
router.use(auth);

router.post(
  "/",
  uploadProductImages,
  productController.createProduct
);

router.put(
  "/:id",
  uploadProductImages,
  productController.updateProduct
);

router.delete(
  "/:id",
  productController.deleteProduct
);

module.exports = router;
