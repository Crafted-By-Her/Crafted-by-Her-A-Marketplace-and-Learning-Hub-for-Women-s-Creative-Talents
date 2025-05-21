const { User, Admin } = require("../models");
const bcrypt = require("bcrypt");
const { deleteFile } = require("../middlewares/upload");
const sendEmail = require("../services/sendEmail");

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
          select:
            "firstName lastName email role isActive createdAt profilePhoto",
        })
        .populate({
          path: "createdBy",
          select: "firstName lastName email profilePhoto",
        })
        .lean(),
    ]);

    // Transform profilePhoto for admins and creators
    const transformedAdmins = admins.map((admin) => {
      let userProfilePhoto =
        admin.userId?.profilePhoto?.url || admin.userId?.profilePhoto;
      if (
        userProfilePhoto &&
        typeof userProfilePhoto === "string" &&
        !userProfilePhoto.startsWith("http")
      ) {
        userProfilePhoto = `${
          process.env.BASE_URL || "http://localhost:8080"
        }${userProfilePhoto}`;
      }

      let creatorProfilePhoto =
        admin.createdBy?.profilePhoto?.url || admin.createdBy?.profilePhoto;
      if (
        creatorProfilePhoto &&
        typeof creatorProfilePhoto === "string" &&
        !creatorProfilePhoto.startsWith("http")
      ) {
        creatorProfilePhoto = `${
          process.env.BASE_URL || "http://localhost:8080"
        }${creatorProfilePhoto}`;
      }

      return {
        _id: admin._id,
        userInfo: {
          ...admin.userId,
          profilePhoto: userProfilePhoto,
        },
        createdBy: admin.createdBy
          ? {
              ...admin.createdBy,
              profilePhoto: creatorProfilePhoto,
            }
          : null,
        createdAt: admin.createdAt,
      };
    });

    res.json({
      message: "Super Admin Dashboard",
      stats,
      admins: transformedAdmins,
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

// Create Admin
const createAdmin = async (req, res) => {
  try {
    const { email, firstName, lastName, phoneNumber, gender, password } =
      req.body;

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

    // Send email with credentials
    const emailSubject = "Your New Admin Account Credentials";
    const emailText = `Hello ${firstName} ${lastName},\n\nYour admin account has been successfully created.\n\nLogin Credentials:\nEmail: ${email}\nTemporary Password: ${password}\n\nPlease change your password after first login.\n\nBest regards,\nCrafted By Her Team`;
    const emailHtml = `
      <h1>Welcome to the Admin Team!</h1>
      <p>Hello ${firstName} ${lastName},</p>
      <p>Your admin account has been successfully created.</p>
      <p><strong>Login Credentials:</strong></p>
      <ul>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Temporary Password:</strong> ${password}</li>
      </ul>
      <p style="color: red;">Please change your password after first login.</p>
      <p>Best regards,<br>Crafted By Her Team</p>
    `;
    // Fire-and-forget email sending
    sendEmail(email, emailSubject, emailText, emailHtml)
      .then(() => console.log(`Email sent successfully to ${email}`))
      .catch((error) => console.error("Email sending error:", error));

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
        $match: { role: "admin" }, // Only get users with admin role
      },
      {
        $lookup: {
          from: "admins", // Collection name in MongoDB (usually lowercase plural)
          localField: "_id",
          foreignField: "userId",
          as: "adminDetails",
        },
      },
      {
        $unwind: "$adminDetails", // Convert the array to an object
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
          profilePhoto: 1,
          "adminDetails.canDeletePosts": 1,
          "adminDetails.canManageUsers": 1,
          "adminDetails.canHandleReports": 1,
          "adminDetails.createdBy": 1,
          "adminDetails.createdAt": 1,
        },
      },
      {
        $sort: { createdAt: -1 }, // Sort by newest first
      },
    ]);

    // Format the response with creator details
    const adminsWithCreator = await Promise.all(
      admins.map(async (admin) => {
        const creator = await User.findById(admin.adminDetails.createdBy)
          .select("firstName lastName email profilePhoto")
          .lean();

        // Transform profilePhoto for admin and creator
        let adminProfilePhoto = admin.profilePhoto?.url || admin.profilePhoto;
        if (
          adminProfilePhoto &&
          typeof adminProfilePhoto === "string" &&
          !adminProfilePhoto.startsWith("http")
        ) {
          adminProfilePhoto = `${
            process.env.BASE_URL || "http://localhost:8080"
          }${adminProfilePhoto}`;
        }

        let creatorProfilePhoto =
          creator?.profilePhoto?.url || creator?.profilePhoto;
        if (
          creatorProfilePhoto &&
          typeof creatorProfilePhoto === "string" &&
          !creatorProfilePhoto.startsWith("http")
        ) {
          creatorProfilePhoto = `${
            process.env.BASE_URL || "http://localhost:8080"
          }${creatorProfilePhoto}`;
        }

        return {
          ...admin,
          profilePhoto: adminProfilePhoto,
          createdBy: creator
            ? {
                name: `${creator.firstName} ${creator.lastName}`,
                email: creator.email,
                profilePhoto: creatorProfilePhoto,
              }
            : null,
        };
      })
    );

    res.status(200).json({
      count: adminsWithCreator.length,
      admins: adminsWithCreator,
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({
      error: "Failed to fetch admins",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete Admin
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

    // Delete the user's profile photo from Cloudinary if exists
    const user = await User.findById(result.userId);
    if (user && user.profilePhoto?.public_id) {
      await deleteFile(user.profilePhoto.public_id);
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
  getDashboard,
  createAdmin,
  getAdmins,
  deleteAdmin,
};
