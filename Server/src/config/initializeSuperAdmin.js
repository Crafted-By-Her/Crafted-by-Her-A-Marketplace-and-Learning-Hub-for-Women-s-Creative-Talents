const User = require("../models/User");
const bcrypt = require("bcrypt");

const initializeSuperAdmin = async () => {
  try {
    // Check if any superAdmin exists
    const superAdminExists = await User.findOne({ role: "superAdmin" });

    if (!superAdminExists) {
      // Hash the default password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("admin", salt);

      // Create the default super admin
      const superAdmin = new User({
        firstName: "Admin",
        lastName: "System",
        email: "admin@admin.com",
        password: hashedPassword,
        phoneNumber: "+1234567890", // Default phone number
        gender: "other",
        role: "superAdmin",
        profilePhoto: "",
      });

      await superAdmin.save();
      console.log("Default super admin created successfully");
    }
  } catch (error) {
    console.error("Error initializing super admin:", error);
  }
};

module.exports = initializeSuperAdmin;
