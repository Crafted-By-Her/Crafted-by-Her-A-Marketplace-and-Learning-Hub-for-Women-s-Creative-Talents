const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const productController = require("../controllers/productController");
const ratingController = require("../controllers/ratingController")
const { auth } = require("../middlewares/auth");
const { uploadProfilePhoto } = require("../middlewares/upload");

// Protected routes
router.use(auth);

// Profile updates with photo upload
router.put("/profile", uploadProfilePhoto, userController.updateProfile);

router.put("/password", userController.changePassword);

router.get(
  "/my-products",
  productController.getUserProducts
);

router.get("/product-ratings", ratingController.getUserProductRatings);

module.exports = router;
