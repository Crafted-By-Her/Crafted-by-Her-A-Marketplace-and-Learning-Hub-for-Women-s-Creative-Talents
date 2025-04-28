const express = require("express");
const router = express.Router();
const { superAdminLogin } = require("../controllers/superAdminAuthController");
const { auth, authRole } = require("../middlewares/auth");
const superAdminController = require("../controllers/superAdminController");
const userController = require("../controllers/userController")

// Protected super admin routes
router.use(auth);
router.use(authRole("superAdmin"));

// Super admin dashboard route
router.get("/dashboard", superAdminController.getDashboard);

// Other super admin specific routes
router.post("/create-admin", superAdminController.createAdmin);

router.delete("/delete-admin/:adminId", superAdminController.deleteAdmin)

router.get("/users", userController.getUsers)

module.exports = router;
