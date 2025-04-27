const { User, Admin } = require("../models");
const bcrypt = require("bcrypt");

const getDashboard = async (req, res) => {
  try {
    // Get all data in parallel for better performance
    const [stats, admins] = await Promise.all([
      // Get statistics
      {
        totalUsers: await User.countDocuments(),
        totalAdmins: await Admin.countDocuments(),
        activeUsers: await User.countDocuments({ isActive: true }),
        inactiveUsers: await User.countDocuments({ isActive: false }),
      },

      // Get full admin list with user details
      Admin.find()
        .populate({
          path: "userId",
          select: "firstName lastName email role isActive createdAt",
        })
        .populate({
          path: "createdBy",
          select: "firstName lastName email",
        })
        .lean(),
    ]);

    res.json({
      message: "Super Admin Dashboard",
      stats,
      admins: admins.map((admin) => ({
        _id: admin._id,
        userInfo: admin.userId,
        createdBy: admin.createdBy,
        createdAt: admin.createdAt,
      })),
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      error: "Failed to load dashboard data",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const createAdmin = async (req, res) => {
  try {
    const {
      email,
      firstName,
      lastName,
      phoneNumber,
      gender,
      password, // Now accepting password directly from superAdmin
    } = req.body;

    // Validation
    if (
      !email ||
      !firstName ||
      !lastName ||
      !phoneNumber ||
      !gender ||
      !password
    ) {
      return res
        .status(400)
        .json({ error: "All fields including password are required" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash the provided password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const newAdmin = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phoneNumber,
      gender,
      role: "admin",
    });

    await newAdmin.save();

    // Create admin record (simplified without permissions)
    const adminRecord = new Admin({
      userId: newAdmin._id,
      createdBy: req.user.id, // The super admin who created this admin
    });

    await adminRecord.save();

    res.status(201).json({
      message: "Admin created successfully",
      adminId: adminRecord._id,
      adminEmail: newAdmin.email,
    });
  } catch (error) {
    console.error("Admin creation error:", error);
    res.status(500).json({
      error: "Failed to create admin",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    if (!adminId) {
      return res.status(400).json({ error: "Admin ID is required" });
    }

    // Find the Admin record
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Delete the linked User account
    await User.findByIdAndDelete(admin.userId);

    // Delete the Admin record
    await Admin.findByIdAndDelete(adminId);

    res.json({ message: "Admin deleted successfully" });
  } catch (error) {
    console.error("Admin deletion error:", error);
    res.status(500).json({
      error: "Failed to delete admin",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


module.exports = {
  getDashboard,
  createAdmin,
  deleteAdmin
};
