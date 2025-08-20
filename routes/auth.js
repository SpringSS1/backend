/**
 * Auth Routes - Premium Professional Refactor
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendConfirmationCode, sendPasswordResetCode } = require("../utils/email");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "changeme";

// Helper to generate random code
function randomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Register: create user, or resend code if not verified
router.post("/register", async (req, res) => {
  const { email, password, referralCode } = req.body;
  try {
    if (!email || !password)
      return res.status(400).json({ success: false, error: "Email and password required." });
    let user = await User.findOne({ email });
    if (user) {
      if (!user.emailVerified) {
        // Resend code
        const code = randomCode();
        const codeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
        user.verificationCode = code;
        user.verificationCodeExpires = codeExpires;
        await user.save();
        await sendConfirmationCode(email, code);
        return res.status(200).json({
          success: true,
          msg: "Verification code resent to your email.",
          userId: user._id,
          code: "EMAIL_NOT_VERIFIED",
        });
      } else {
        return res.status(400).json({ success: false, error: "Email already registered.", code: "EMAIL_ALREADY_REGISTERED" });
      }
    }
    const code = randomCode();
    const codeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    user = await User.create({
      email,
      password,
      referralCode,
      emailVerified: false,
      verificationCode: code,
      verificationCodeExpires: codeExpires,
    });
    await sendConfirmationCode(email, code);
    res.json({ success: true, msg: "Verification code sent to your email.", userId: user._id });
  } catch (e) {
    console.error("Registration error:", e);
    if (e.code === 11000) {
      return res.status(400).json({ success: false, error: "Email already registered.", code: "EMAIL_ALREADY_REGISTERED" });
    }
    res.status(500).json({ success: false, error: "Registration failed: " + e.message });
  }
});

// Confirm email
router.post("/confirm", async (req, res) => {
  const { userId, code } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(400).json({ success: false, error: "Invalid user." });
  if (user.emailVerified) return res.status(400).json({ success: false, error: "Already verified." });
  if (user.verificationCode !== code || user.verificationCodeExpires < Date.now()) {
    return res.status(400).json({ success: false, error: "Invalid or expired code." });
  }
  user.emailVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  await user.save();
  res.json({ success: true, msg: "Email verified. You can now log in." });
});

// Login: only allow if email verified
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, error: "Invalid credentials." });
    const match = await user.comparePassword(password);
    if (!match) return res.status(400).json({ success: false, error: "Invalid credentials." });

    if (!user.emailVerified) {
      return res.status(403).json({ success: false, error: "Please verify your email.", code: "EMAIL_NOT_VERIFIED", userId: user._id });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token, user: { email: user.email, _id: user._id } });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
});

// Forgot password: send code
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.json({ success: true, msg: "If registered, a code will be sent." });
  const code = randomCode();
  user.verificationCode = code;
  user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();
  await sendPasswordResetCode(email, code);
  res.json({ success: true, msg: "If registered, a code will be sent." });
});

// Reset password with code
router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ success: false, error: "Invalid email." });
  if (user.verificationCode !== code || user.verificationCodeExpires < Date.now()) {
    return res.status(400).json({ success: false, error: "Invalid or expired code." });
  }
  user.password = newPassword;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  await user.save();
  res.json({ success: true, msg: "Password reset. You can now log in." });
});

module.exports = router;