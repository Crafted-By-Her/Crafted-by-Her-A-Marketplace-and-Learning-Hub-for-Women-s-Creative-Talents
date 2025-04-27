const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No token, authorization denied" });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Find user and check if token hasn't been revoked
    const user = await User.findOne({
      _id: decoded.id,
      // You could add token to user model if you want to implement token invalidation
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Add user and token to request object
    req.token = token;
    req.user = user;

    next();
  } catch (err) {
    console.error("Authentication error:", err);
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// Middleware to check if user has specific role
const authRole = (requiredRole) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    // Define role hierarchy
    const roleHierarchy = {
      user: 1,
      admin: 2,
      superAdmin: 3,
    };

    if (!userRole || roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      return res.status(403).json({
        error: `Access denied. ${requiredRole} privileges required.`,
      });
    }

    next();
  };
};

module.exports = { auth, authRole };
