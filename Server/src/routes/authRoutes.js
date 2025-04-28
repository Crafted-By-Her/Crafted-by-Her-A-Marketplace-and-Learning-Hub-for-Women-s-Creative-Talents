const express = require("express");
const router = express.Router();
const { auth } = require("../middlewares/auth");
const userController = require("../controllers/userController");

// Public routes
router.post("/register", userController.createUser);
router.post("/login", userController.loginUser);

// Protected routes
router.get("/me", auth, userController.getCurrentUser);
router.put("/me", auth, userController.updateCurrentUser);

module.exports = router;
