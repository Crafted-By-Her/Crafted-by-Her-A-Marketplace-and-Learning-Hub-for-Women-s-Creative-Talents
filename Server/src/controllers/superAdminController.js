const { User, Admin } = require("../models");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const updateSuperAdminProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      gender,
      currentPassword,
      newPassword,
    } = req.body;
    const superAdminId = req.user.id; // From auth middleware

    // Get the superadmin
    const superAdmin = await User.findById(superAdminId);
    if (!superAdmin || superAdmin.role !== "superAdmin") {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    // Prepare update object
    const updates = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (gender) updates.gender = gender;

    // Email update requires special handling
    if (email && email !== superAdmin.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ error: "Email already in use" });
      }
      updates.email = email;
    }

    // Password change requires verification
    if (newPassword) {
      if (!currentPassword) {
        return res
          .status(400)
          .json({ error: "Current password is required to change password" });
      }

      const isMatch = await bcrypt.compare(
        currentPassword,
        superAdmin.password
      );
      if (!isMatch) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      if (newPassword.length < 8) {
        return res
          .status(400)
          .json({ error: "New password must be at least 8 characters" });
      }

      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(newPassword, salt);
    }

    // Apply updates
    const updatedAdmin = await User.findByIdAndUpdate(
      superAdminId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password"); // Exclude password from response

    res.json({
      message: "Profile updated successfully",
      admin: updatedAdmin,
    });
  } catch (error) {
    console.error("SuperAdmin update error:", error);
    res.status(500).json({
      error: "Failed to update profile",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


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
    const { email, firstName, lastName, phoneNumber, gender, password } =
      req.body;

    // Validation (unchanged)
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

    // Hash the password
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

    // Create admin record
    const adminRecord = new Admin({
      userId: newAdmin._id,
      createdBy: req.user.id,
      canDeletePosts: true,
      canManageUsers: false,
      canHandleReports: true,
    });

    await adminRecord.save();

    console.log(process.env.EMAIL_USERNAME);
    console.log(process.env.EMAIL_PASSWORD);
    // Email configuration
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Then update your mailOptions to use your email for both from and replyTo:
    const mailOptions = {
      from: '"Crafted By Her" <your@gmail.com>',
      to: email,
      replyTo: process.env.EMAIL_USERNAME, // Replies will come back to your email
      subject: "Your New Admin Account Credentials",
      html: `
    <h1>Welcome to the Admin Team!</h1>
    <p>Hello ${firstName} ${lastName},</p>
    <p>Your admin account has been successfully created.</p>
    <p><strong>Login Credentials:</strong></p>
    <ul>
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Temporary Password:</strong> ${password}</li>
    </ul>
    <p style="color: red;">Please change your password after first login.</p>
    <p>Best regards,<br>Your App Team</p>
  `,
    };


    // Send email (fire-and-forget, don't await)
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Email sending error:", error);
      } else {
        console.log("Email sent:", info.response);
      }
    });

    // Prepare response
    const response = {
      message: "Admin created successfully. Credentials sent to email.",
      admin: {
        id: newAdmin._id,
        name: `${newAdmin.firstName} ${newAdmin.lastName}`,
        email: newAdmin.email,
        role: newAdmin.role,
        status: newAdmin.isActive ? "active" : "inactive",
        createdAt: newAdmin.createdAt,
        permissions: {
          canDeletePosts: adminRecord.canDeletePosts,
          canManageUsers: adminRecord.canManageUsers,
          canHandleReports: adminRecord.canHandleReports,
        },
      },
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Admin creation error:", error);
    res.status(500).json({
      error: "Failed to create admin",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// Get All Admins
const getAdmins = async (req, res) => {
  try {
    // Find all admin users by joining User and Admin collections
    const admins = await User.aggregate([
      {
        $match: { role: "admin" } // Only get users with admin role
      },
      {
        $lookup: {
          from: "admins", // Collection name in MongoDB (usually lowercase plural)
          localField: "_id",
          foreignField: "userId",
          as: "adminDetails"
        }
      },
      {
        $unwind: "$adminDetails" // Convert the array to an object
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          phoneNumber: 1,
          gender: 1,
          role: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          "adminDetails.canDeletePosts": 1,
          "adminDetails.canManageUsers": 1,
          "adminDetails.canHandleReports": 1,
          "adminDetails.createdBy": 1,
          "adminDetails.createdAt": 1
        }
      },
      {
        $sort: { createdAt: -1 } // Sort by newest first
      }
    ]);

    // Format the response with creator details
    const adminsWithCreator = await Promise.all(admins.map(async admin => {
      const creator = await User.findById(admin.adminDetails.createdBy)
        .select('firstName lastName email')
        .lean();

      return {
        ...admin,
        createdBy: creator ? {
          name: `${creator.firstName} ${creator.lastName}`,
          email: creator.email
        } : null
      };
    }));

    res.status(200).json({
      count: adminsWithCreator.length,
      admins: adminsWithCreator
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({
      error: "Failed to fetch admins",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    // Try deleting by User ID first
    const result = await Admin.findOneAndDelete({
      $or: [{ _id: adminId }, { userId: adminId }],
    });

    if (!result) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Delete the user account
    await User.findByIdAndDelete(result.userId);

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
  updateSuperAdminProfile,
  getDashboard,
  createAdmin,
  deleteAdmin,
  getAdmins
};
