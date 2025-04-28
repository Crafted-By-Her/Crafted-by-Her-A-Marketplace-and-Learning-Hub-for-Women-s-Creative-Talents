const { User, Admin } = require("../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// CREATE User
const createUser = async (req, res) => {
  try {
    const isBulk = Array.isArray(req.body);
    const usersToRegister = isBulk ? req.body : [req.body];
    const registeredUsers = [];

    for (const user of usersToRegister) {
      const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        gender,
        role = "user", // Default to 'user'
      } = user;

      // Validation
      if (
        !firstName ||
        !lastName ||
        !email ||
        !password ||
        !phoneNumber ||
        !gender
      ) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Prevent non-superAdmins from creating admin/superAdmin accounts
      if (
        ["admin", "superAdmin"].includes(role) &&
        req.user?.role !== "superAdmin"
      ) {
        return res.status(403).json({
          error: "Insufficient privileges to create admin users",
        });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          error: `Email already registered: ${email}`,
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const newUser = new User({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        phoneNumber,
        gender,
        role,
        warnings: 0,
        isActive: true,
      });

      const saved = await newUser.save();
      
      // If creating admin, create admin record
      if (role === "admin" || role === "superAdmin") {
        const newAdmin = new Admin({
          userId: saved._id,
          createdBy: req.user?.id || saved._id // Self-created if superAdmin
        });
        await newAdmin.save();
      }

      registeredUsers.push({
        id: saved._id,
        firstName: saved.firstName,
        lastName: saved.lastName,
        email: saved.email,
        role: saved.role,
      });
    }

    return res.status(201).json({
      message: isBulk
        ? "Users registered successfully"
        : "User registered successfully",
      users: registeredUsers,
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ error: err.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify admin status if role is admin
    let verifiedRole = user.role;
    if (user.role === "admin") {
      const adminRecord = await Admin.findOne({ userId: user._id }).populate(
        "createdBy",
        "role email"
      );

      // If admin record exists and was created by superAdmin
      if (adminRecord && adminRecord.createdBy.role === "superAdmin") {
        verifiedRole = "admin"; // Verified admin
      } else {
        verifiedRole = "user"; // Downgrade to user if not properly created
        await User.findByIdAndUpdate(user._id, { role: "user" });
      }
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: verifiedRole, // Use verified role in token
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Determine interface access based on verified role
    const interfaceAccess = {
      dashboard:
        verifiedRole === "user"
          ? "user"
          : verifiedRole === "admin"
          ? "admin"
          : "superAdmin",
      features:
        verifiedRole === "user"
          ? ["products", "profile"]
          : verifiedRole === "admin"
          ? ["products", "users", "reports"]
          : ["products", "users", "admins", "reports", "system"],
    };

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePhoto: user.profilePhoto,
        gender: user.gender,
        role: verifiedRole, // Return verified role
        interfaceAccess, // Include interface access information
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      error: "Login failed",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// READ All Users
const getUsers = async (req, res) => {
  try {
    // Set projection based on user role
    let projection = {};
    if (req.user?.role === "user") {
      projection = {
        firstName: 1,
        lastName: 1,
        profilePhoto: 1,
        email: 1,
        gender: 1,
      };
    }

    const users = await User.find({}, projection);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ One User
const getUserById = async (req, res) => {
  try {
    // Set projection based on user role
    let projection = {};
    if (req.user?.role === "user") {
      projection = {
        firstName: 1,
        lastName: 1,
        profilePhoto: 1,
        email: 1,
        gender: 1,
      };
    }

    const user = await User.findById(req.params.id, projection);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE User
const updateUser = async (req, res) => {
  try {
    // Prevent non-superAdmins from changing roles
    if (req.body.role && req.user?.role !== "superAdmin") {
      return res.status(403).json({
        error: "Only super admins can change user roles",
      });
    }

    const updated = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE User
const deleteUser = async (req, res) => {
  try {
    // Prevent deleting super admins unless by another super admin
    const userToDelete = await User.findById(req.params.id);
    if (
      userToDelete?.role === "superAdmin" &&
      req.user?.role !== "superAdmin"
    ) {
      return res.status(403).json({
        error: "Cannot delete super admin accounts",
      });
    }

    // Prevent users from deleting themselves
    if (req.params.id === req.user?.id) {
      return res.status(400).json({
        error: "Cannot delete your own account via this endpoint",
      });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get current user profile
const getCurrentUser = async (req, res) => {
  try {
    res.json({
      id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      phoneNumber: req.user.phoneNumber,
      profilePhoto: req.user.profilePhoto,
      gender: req.user.gender,
      role: req.user.role,
      warnings: req.user.warnings,
      isActive: req.user.isActive,
      createdAt: req.user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update current user profile
const updateCurrentUser = async (req, res) => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      "firstName",
      "lastName",
      "phoneNumber",
      "gender",
      "profilePhoto",
      "password",
    ];

    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).json({ error: "Invalid updates!" });
    }

    // Explicitly remove restricted fields
    delete req.body.role;
    delete req.body.isActive;
    delete req.body.warnings;

    // Handle password change
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const user = await User.findByIdAndUpdate(req.user._id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profilePhoto: user.profilePhoto,
      gender: user.gender,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  createUser,
  loginUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getCurrentUser,
  updateCurrentUser,
};
