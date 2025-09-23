/**
 * Auth Routes - Premium Professional Refactor (Fully Fixed & Updated)
 * Features:
 * - Registration with confirmation code (email verification)
 * - Resend confirmation code if not verified
 * - Block registration if already verified
 * - Email confirmation
 * - Login (only if email verified)
 * - Forgot password (send reset code)
 * - Reset password with code
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
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required." });
    }

    let user = await User.findOne({ email });
    if (user) {
      if (!user.emailVerified) {
        // Resend code
        const code = randomCode();
        user.verificationCode = code;
        user.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 min as timestamp
        await user.save();
        await sendConfirmationCode(email, code);
        return res.status(200).json({
          success: true,
          msg: "Verification code resent to your email.",
          userId: user._id,
          code: "EMAIL_NOT_VERIFIED",
        });
      } else {
        return res.status(400).json({
          success: false,
          error: "Email already registered and verified.",
          code: "EMAIL_ALREADY_REGISTERED"
        });
      }
    }

    // Only set referralCode if provided and non-empty string
    const userData = {
      email,
      password,
      emailVerified: false,
      verificationCode: null,
      verificationCodeExpires: null,
      username: "aexonuser_" + Math.random().toString(36).substring(2, 8).toLowerCase(),
      referralCode: referralCode && referralCode.trim() !== "" ? referralCode.trim() : undefined
    };

    // Generate and set code
    const code = randomCode();
    const codeExpires = Date.now() + 10 * 60 * 1000; // 10 min as timestamp
    userData.verificationCode = code;
    userData.verificationCodeExpires = codeExpires;

    user = await User.create(userData);
    await sendConfirmationCode(email, code);
    res.json({
      success: true,
      msg: "Verification code sent to your email.",
      userId: user._id
    });
  } catch (e) {
    console.error("Registration error:", e);
    // Duplicate key error for unique fields (Mongo error code 11000)
    if (e.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Email already registered.",
        code: "EMAIL_ALREADY_REGISTERED"
      });
    }
    res.status(500).json({ success: false, error: "Registration failed: " + e.message });
  }
});

// Confirm email
router.post("/confirm", async (req, res) => {
  const { userId, code } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ success: false, error: "Invalid user." });
    if (user.emailVerified) return res.status(400).json({ success: false, error: "Already verified." });
    if (
      user.verificationCode !== code ||
      !user.verificationCodeExpires ||
      user.verificationCodeExpires < Date.now()
    ) {
      return res.status(400).json({ success: false, error: "Invalid or expired code." });
    }
    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();
    res.json({ success: true, msg: "Email verified. You can now log in." });
  } catch (e) {
    console.error("Email confirmation error:", e);
    res.status(500).json({ success: false, error: "Email confirmation failed: " + e.message });
  }
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
      return res.status(403).json({
        success: false,
        error: "Please verify your email.",
        code: "EMAIL_NOT_VERIFIED",
        userId: user._id
      });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      success: true,
      token,
      user: {
        email: user.email,
        _id: user._id,
        username: user.username
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
});

// Forgot password: send code
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: true, msg: "If registered, a code will be sent." });
    const code = randomCode();
    user.verificationCode = code;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
    await user.save();
    await sendPasswordResetCode(email, code);
    res.json({ success: true, msg: "If registered, a code will be sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ success: false, error: "Failed to send password reset code." });
  }
});

// Reset password with code
router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, error: "Invalid email." });
    if (
      user.verificationCode !== code ||
      !user.verificationCodeExpires ||
      user.verificationCodeExpires < Date.now()
    ) {
      return res.status(400).json({ success: false, error: "Invalid or expired code." });
    }
    user.password = newPassword;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();
    res.json({ success: true, msg: "Password reset. You can now log in." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ success: false, error: "Failed to reset password." });
  }
});

module.exports = router;