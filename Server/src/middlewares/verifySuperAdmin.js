const verifySuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "superAdmin") {
      return res.status(403).json({
        error: "Access denied. Super admin privileges required.",
      });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = verifySuperAdmin;
