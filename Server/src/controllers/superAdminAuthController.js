const { User } = require("../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const superAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user and verify role
    const user = await User.findOne({ email, role: "superAdmin" });

    if (!user) {
      return res
        .status(401)
        .json({ error: "Invalid credentials or not a super admin" });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate token with super admin specific claims
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        isSuperAdmin: true,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Return token and dashboard redirect URL
    res.json({
      message: "Super admin login successful",
      token,
      redirectTo: "/super-admin/dashboard",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { superAdminLogin };
