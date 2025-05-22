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
    type: mongoose.Schema.Types.Mixed, // Changed to Mixed type
    default: null,
    validate: {
      validator: function (value) {
        // Allow null
        if (value === null) return true;

        // Allow empty string (for backward compatibility)
        if (value === "") return true;

        // Allow object with url and public_id
        if (typeof value === "object" && value.url && value.public_id) {
          return (
            /^https:\/\/res\.cloudinary\.com\/[^\s/$.?#].[^\s]*$/i.test(
              value.url
            ) && /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(value.public_id)
          );
        }

        // Allow just a URL string (for backward compatibility)
        if (typeof value === "string") {
          return /^https:\/\/res\.cloudinary\.com\/[^\s/$.?#].[^\s]*$/i.test(
            value
          );
        }

        return false;
      },
      message: (props) =>
        `Invalid profilePhoto format: ${JSON.stringify(props.value)}`,
    },
    set: function (value) {
      // Convert empty string to null
      if (value === "") return null;

      // Convert URL string to object
      if (typeof value === "string" && value.startsWith("http")) {
        return {
          url: value,
          public_id: `profilePhotos/${mongoose.Types.ObjectId()}`,
        };
      }

      return value;
    },
  },

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
