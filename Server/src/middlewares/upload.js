const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const path = require("path");

// Load environment variables (fallback if not loaded in index.js)
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Debug Cloudinary config
console.log("Cloudinary configuration:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? "Set" : "Not set",
  api_key: process.env.CLOUDINARY_API_KEY ? "Set" : "Not set",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "Set" : "Not set",
});

// Storage for product images
const productStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "products",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

// Storage for profile photos
const profilePhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "profilePhotos",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

// Multer middleware for product images (up to 5 images)
const uploadProductImages = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
}).array("images", 5);

// Multer middleware for profile photo (single image)
const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
}).single("profilePhoto");

// Function to delete file from Cloudinary
const deleteFile = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
    throw error;
  }
};

module.exports = {
  uploadProductImages,
  uploadProfilePhoto,
  deleteFile,
};
