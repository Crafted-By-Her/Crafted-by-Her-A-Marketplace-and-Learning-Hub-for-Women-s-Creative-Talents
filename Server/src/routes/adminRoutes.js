const express = require("express");
const router = express.Router();
const { auth, authRole } = require("../middlewares/auth");
const adminController = require("../controllers/adminController");
const superAdminController = require("../controllers/superAdminController");
const userController = require("../controllers/userController");
const reportController = require("../controllers/reportController");

// Apply authentication to all routes
router.use(auth);

// Common Admin and Super Admin Routes
router.use(authRole(["admin", "superAdmin"]));
router.put("/change-password", adminController.changePassword);
router.get("/users", userController.getUsers);
router.get("/products", adminController.getAllProducts);
router.delete("/products/:productId", adminController.deleteProduct);
router.patch("/users/:userId/warnings", adminController.incrementUserWarning);
router.put("/users/:userId/activate", adminController.activateUser);
router.put("/profile", userController.updateProfile);
router.delete("/users/:id/delete", userController.deleteUser);
router.post(
  "/products/:productId/report",
  reportController.generateProductReport
);

// Super Admin Only Routes
router.use(authRole("superAdmin"));
router.get("/dashboard", superAdminController.getDashboard);
router.get("/allAdmins", superAdminController.getAdmins);
router.post("/create-admin", superAdminController.createAdmin);
router.delete("/delete-admin/:adminId", superAdminController.deleteAdmin);

module.exports = router;
