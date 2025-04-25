const express = require("express");
const {
  addRating,
  addBulkRatings,
  getProductRatings,
} = require("../controllers/ratingController");

const router = express.Router();

// Route for adding a single rating
router.post("/add", addRating);

// Route for adding multiple ratings (bulk)
router.post("/bulk", addBulkRatings);

// Route for retrieving all ratings for a product
router.get("/:productId", getProductRatings);

module.exports = router;
