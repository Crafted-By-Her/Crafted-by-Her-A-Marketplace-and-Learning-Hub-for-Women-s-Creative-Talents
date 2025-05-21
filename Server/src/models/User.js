const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Product = require("./Product");

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  phoneNumber: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^\+?[0-9]{9,15}$/.test(v);
      },
      message: (props) => `${props.value} is not a valid phone number!`,
    },
  },
  gender: { type: String, enum: ["female", "male", "other"], required: true },
  role: {
    type: String,
    enum: ["user", "admin", "superAdmin"],
    default: "user",
  },
  profilePhoto: {
    url: {
      type: String,
      default: null, // Default to null if no photo is uploaded
      validate: {
        validator: function (value) {
          // Validate that the URL is a valid Cloudinary URL
          return (
            value === null ||
            /^https:\/\/res\.cloudinary\.com\/[^\s/$.?#].[^\s]*$/i.test(value)
          );
        },
        message: (props) => `${props.value} is not a valid Cloudinary URL`,
      },
    },
    public_id: {
      type: String,
      default: null, // Default to null if no photo is uploaded
      validate: {
        validator: function (value) {
          // Validate that the public_id follows Cloudinary's format (e.g., "profilePhotos/abc123")
          return (
            value === null || /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(value)
          );
        },
        message: (props) =>
          `${props.value} is not a valid Cloudinary public_id`,
      },
    },
  }, // Updated to store Cloudinary URL and public_id
  warnings: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// // Password hash
// UserSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();

//   try {
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//     next();
//   } catch (err) {
//     next(err);
//   }
// });

// Compare password method (optional)
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await Product.deleteMany({ userId: doc._id });
    console.log(`All products of user ${doc._id} deleted.`);

    // Clean up profile photo from Cloudinary if it exists
    if (doc.profilePhoto?.public_id) {
      const deleteFile = require("../middlewares/upload").deleteFile;
      await deleteFile(doc.profilePhoto.public_id);
      console.log(
        `Profile photo ${doc.profilePhoto.public_id} deleted from Cloudinary.`
      );
    }
  }
});

module.exports = mongoose.model("User", UserSchema);
