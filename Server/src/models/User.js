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
        return /^\+?[0-9]{9,15}$/.test(v); // Basic international phone validation
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
  warnings: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// Password hash
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
  }
});


module.exports = mongoose.model("User", UserSchema);
