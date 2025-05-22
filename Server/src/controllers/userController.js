const { User, Admin } = require("../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { deleteFile } = require("../middlewares/upload");

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
          createdBy: req.user?.id || saved._id, // Self-created if superAdmin
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

// LOGIN User
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

    // Check if account is active
    if (!user.isActive) {
      return res
        .status(403)
        .json({ error: "Account is inactive. Contact support." });
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
        role: verifiedRole,
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

    // Transform profilePhoto
    let profilePhoto = user.profilePhoto?.url || user.profilePhoto;
    if (
      profilePhoto &&
      typeof profilePhoto === "string" &&
      !profilePhoto.startsWith("http")
    ) {
      profilePhoto = `${
        process.env.BASE_URL || "http://localhost:8080"
      }${profilePhoto}`;
    }

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePhoto, // Use transformed profilePhoto
        gender: user.gender,
        role: verifiedRole,
        interfaceAccess,
      },
    });
  } catch (err) {
    console.error("Login error:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      error: "Login failed",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// User: Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id; // From auth middleware

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        error:
          "Current password, new password, and confirm password are required",
      });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "New password must be at least 8 characters" });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ error: "New password and confirm password do not match" });
    }

    // Restrict to users with role: "user"
    if (req.user.role !== "user") {
      return res.status(403).json({
        error: "Only users can change their password via this endpoint",
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({
      message: "Password updated successfully",
      userId: user._id,
      email: user.email,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error(
      "🔥 ERROR in changePassword:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    res.status(500).json({
      error: "Failed to change password",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// READ All Users (only role: "user")
const getUsers = async (req, res) => {
  try {
    // Restrict access to admin or superAdmin
    if (!["admin", "superAdmin"].includes(req.user?.role)) {
      return res
        .status(403)
        .json({ error: "Access denied. Admin or superAdmin role required." });
    }

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

    // Get users with role: "user" and isActive: false
    const users = await User.find(
      { role: "user", isActive: false },
      projection
    ).lean();

    // Transform profilePhoto for response
    const transformedUsers = users.map((user) => {
      let profilePhoto = user.profilePhoto?.url || user.profilePhoto;
      if (
        profilePhoto &&
        typeof profilePhoto === "string" &&
        !profilePhoto.startsWith("http")
      ) {
        profilePhoto = `${
          process.env.BASE_URL || "http://localhost:8080"
        }${profilePhoto}`;
      }
      return { ...user, profilePhoto };
    });

    res.json({
      message: "Inactive users retrieved successfully",
      count: transformedUsers.length,
      users: transformedUsers,
    });
  } catch (err) {
    console.error(
      "🔥 ERROR in getUsers:",
      JSON.stringify(err, Object.getOwnPropertyNames(err))
    );
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

    const user = await User.findById(req.params.id, projection).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    // Transform profilePhoto
    let profilePhoto = user.profilePhoto?.url || user.profilePhoto;
    if (
      profilePhoto &&
      typeof profilePhoto === "string" &&
      !profilePhoto.startsWith("http")
    ) {
      profilePhoto = `${
        process.env.BASE_URL || "http://localhost:8080"
      }${profilePhoto}`;
    }

    res.json({ ...user, profilePhoto });
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

    // Prepare the update object
    const update = { ...req.body };

    // Handle profilePhoto update if present
    if (req.body.profilePhoto) {
      if (typeof req.body.profilePhoto === "string") {
        // Legacy string handling (optional: log or migrate)
        console.log(
          `Legacy profilePhoto string found: ${req.body.profilePhoto}`
        );
        update.profilePhoto = { url: null, public_id: null }; // Reset to null if not a valid upload
      }
      // Note: For file uploads, rely on upload middleware to set req.file
      if (req.file) {
        // Delete old profile photo from Cloudinary if exists
        const existingUser = await User.findById(req.params.id);
        if (existingUser.profilePhoto?.public_id) {
          await deleteFile(existingUser.profilePhoto.public_id);
        } else if (
          typeof existingUser.profilePhoto === "string" &&
          existingUser.profilePhoto
        ) {
          console.log(
            `Legacy profilePhoto string found for user ${req.params.id}: ${existingUser.profilePhoto}`
          );
        }

        // Set new profilePhoto with Cloudinary data
        update.profilePhoto = {
          url: req.file.path, // Cloudinary secure_url
          public_id: req.file.filename, // Cloudinary public_id
        };
      }
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    // Transform profilePhoto for response
    const profilePhoto = updated.profilePhoto?.url || null;

    res.json({ ...updated, profilePhoto });
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

    // Delete profile photo from Cloudinary if exists
    if (userToDelete.profilePhoto?.public_id) {
      await deleteFile(userToDelete.profilePhoto.public_id);
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
    let profilePhoto = req.user.profilePhoto?.url || req.user.profilePhoto;
    if (
      profilePhoto &&
      typeof profilePhoto === "string" &&
      !profilePhoto.startsWith("http")
    ) {
      profilePhoto = `${
        process.env.BASE_URL || "http://localhost:8080"
      }${profilePhoto}`;
    }

    res.json({
      id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      phoneNumber: req.user.phoneNumber,
      profilePhoto,
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

    // Transform profilePhoto
    let profilePhoto = user.profilePhoto?.url || user.profilePhoto;
    if (
      profilePhoto &&
      typeof profilePhoto === "string" &&
      !profilePhoto.startsWith("http")
    ) {
      profilePhoto = `${
        process.env.BASE_URL || "http://localhost:8080"
      }${profilePhoto}`;
    }

    res.json({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profilePhoto,
      gender: user.gender,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Update user profile info (excluding password)
const updateProfile = async (req, res) => {
  try {
    const allowedUpdates = [
      "firstName",
      "lastName",
      "phoneNumber",
      "gender",
      "email",
    ];

    // Handle file upload if present
    if (req.file) {
      req.body.profilePhoto = {
        url: req.file.path, // Cloudinary secure_url
        public_id: req.file.filename, // Cloudinary public_id
      };

      // Delete old profile photo from Cloudinary if exists
      if (req.user.profilePhoto?.public_id) {
        await deleteFile(req.user.profilePhoto.public_id);
      }
    }

    // Validate updates
    const updates = Object.keys(req.body);
    const isValidOperation = updates.every(
      (update) => allowedUpdates.includes(update) || update === "profilePhoto"
    );

    if (!isValidOperation) {
      // Clean up uploaded file if invalid operation
      if (req.file && req.body.profilePhoto?.public_id) {
        await deleteFile(req.body.profilePhoto.public_id);
      }
      return res.status(400).json({ error: "Invalid updates!" });
    }

    // Update user
    const user = await User.findByIdAndUpdate(req.user._id, req.body, {
      new: true,
      runValidators: true,
    }).select("-password -__v -warnings -role -isActive");

    if (!user) {
      if (req.file && req.body.profilePhoto?.public_id) {
        await deleteFile(req.body.profilePhoto.public_id);
      }
      return res.status(404).json({ error: "User not found" });
    }

    // Transform profilePhoto for response
    let profilePhoto = user.profilePhoto?.url || user.profilePhoto;
    if (
      profilePhoto &&
      typeof profilePhoto === "string" &&
      !profilePhoto.startsWith("http")
    ) {
      profilePhoto = `${
        process.env.BASE_URL || "http://localhost:8080"
      }${profilePhoto}`;
    }

    res.json({ ...user.toObject(), profilePhoto });
  } catch (err) {
    // Clean up file if error occurs
    if (req.file && req.body.profilePhoto?.public_id) {
      await deleteFile(req.body.profilePhoto.public_id);
    }

    res.status(400).json({
      error: "Profile update failed",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

module.exports = {
  createUser,
  loginUser,
  changePassword,
  getUsers,
  getUserById,
  updateProfile,
  updateUser,
  deleteUser,
  getCurrentUser,
  updateCurrentUser,
};
