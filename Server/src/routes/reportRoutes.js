// routes/reportRoutes.js
const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");

router.post(
  "/products/:productId/report",
  reportController.generateProductReport
);

module.exports = router;
