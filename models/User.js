/**
 * User Model - Premium Refactor
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const walletSchema = new mongoose.Schema(
  {
    coin: { type: String, required: true, trim: true, uppercase: true },
    balance: { type: Number, default: 0, min: 0 },
    address: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const kycSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    documentUrl: { type: String, trim: true },
    submittedAt: { type: Date },
    error: { type: String, trim: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    username: { type: String, unique: true, sparse: true, trim: true },
    avatar: { type: String, default: "" },
    referralCode: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
    wallets: { type: [walletSchema], default: [] },
    balance: { type: Number, default: 0, min: 0 },
    kyc: { type: kycSchema, default: () => ({}) },
    confirmationCode: { type: String },
    isVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    verificationCode: { type: String },
    verificationCodeExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isBanned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);