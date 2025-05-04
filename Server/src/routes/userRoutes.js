const express = require("express");
const router = express.Router();
const { auth, authRole } = require("../middlewares/auth");
const userController = require("../controllers/userController");

// All routes require authentication
router.use(auth);


router.use(authRole("admin")); 

router.get("/", userController.getUsers);
router.get("/:id", userController.getUserById);
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);

module.exports = router;
