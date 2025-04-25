const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");

const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);

const uploadDir = path.join(__dirname, "../public/uploads");

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const exists = await existsAsync(uploadDir);
    if (!exists) await mkdirAsync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "img-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpe?g|png|gif|webp/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) return cb(null, true);
  cb(new Error("Only image files (jpeg, png, gif, webp) are allowed!"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
    files: 3, // Max 3 files
  },
}).array("images", 3);

// Wrap multer middleware for async/await
const uploadProductImages = (req, res, next) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: "Each image must be less than 3MB",
        });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          error: "Maximum 3 images allowed",
        });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      // An unknown error occurred
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

module.exports = uploadProductImages;
