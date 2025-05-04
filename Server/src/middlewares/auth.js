const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ _id: decoded.id });

    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Log user role for debugging
    console.log(`Auth Middleware - User ID: ${user._id}, Role: ${user.role}`);

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

const authRole = (requiredRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    const roles = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];

    console.log(`AuthRole Check - User: ${userRole}, Required: ${roles}`);

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        error: `Access denied. Requires one of: ${roles.join(", ")}`,
        yourRole: userRole,
      });
    }

    next();
  };
};

module.exports = { auth, authRole };
