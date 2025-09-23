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
      console.error("[REGISTER] Missing email or password:", req.body);
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
        console.warn("[REGISTER] Email exists but not verified. Resending code.", { email });
        return res.status(200).json({
          success: true,
          msg: "Verification code resent to your email.",
          userId: user._id,
          code: "EMAIL_NOT_VERIFIED",
        });
      } else {
        console.error("[REGISTER] Email already registered and verified:", req.body);
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
    console.info("[REGISTER] New user registered and confirmation code sent.", { email, userId: user._id });
    res.json({
      success: true,
      msg: "Verification code sent to your email.",
      userId: user._id
    });
  } catch (e) {
    console.error("[REGISTER] Registration error:", e, "Request body:", req.body);
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
    if (!user) {
      console.error("[CONFIRM] Invalid userId:", userId);
      return res.status(400).json({ success: false, error: "Invalid user." });
    }
    if (user.emailVerified) {
      console.warn("[CONFIRM] User already verified:", userId);
      return res.status(400).json({ success: false, error: "Already verified." });
    }
    if (
      user.verificationCode !== code ||
      !user.verificationCodeExpires ||
      user.verificationCodeExpires < Date.now()
    ) {
      console.error("[CONFIRM] Invalid or expired confirmation code.", { userId, code, storedCode: user.verificationCode, expires: user.verificationCodeExpires });
      return res.status(400).json({ success: false, error: "Invalid or expired code." });
    }
    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();
    console.info("[CONFIRM] Email verified.", { userId });
    res.json({ success: true, msg: "Email verified. You can now log in." });
  } catch (e) {
    console.error("[CONFIRM] Email confirmation error:", e, "Request body:", req.body);
    res.status(500).json({ success: false, error: "Email confirmation failed: " + e.message });
  }
});

// Login: only allow if email verified
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.error("[LOGIN] Invalid credentials. Email not found:", email);
      return res.status(400).json({ success: false, error: "Invalid credentials." });
    }
    const match = await user.comparePassword(password);
    if (!match) {
      console.error("[LOGIN] Invalid credentials. Password mismatch for email:", email);
      return res.status(400).json({ success: false, error: "Invalid credentials." });
    }

    if (!user.emailVerified) {
      console.warn("[LOGIN] Email not verified for user:", email);
      return res.status(403).json({
        success: false,
        error: "Please verify your email.",
        code: "EMAIL_NOT_VERIFIED",
        userId: user._id
      });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    console.info("[LOGIN] Successful login for user:", email);
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
    console.error("[LOGIN] Login error:", err, "Request body:", req.body);
    res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
});

// Forgot password: send code
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.warn("[FORGOT-PASSWORD] Email not found for forgot password request:", email);
      return res.json({ success: true, msg: "If registered, a code will be sent." });
    }
    const code = randomCode();
    user.verificationCode = code;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
    await user.save();
    await sendPasswordResetCode(email, code);
    console.info("[FORGOT-PASSWORD] Password reset code sent.", { email });
    res.json({ success: true, msg: "If registered, a code will be sent." });
  } catch (err) {
    console.error("[FORGOT-PASSWORD] Error sending password reset code:", err, "Request body:", req.body);
    res.status(500).json({ success: false, error: "Failed to send password reset code." });
  }
});

// Reset password with code
router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.error("[RESET-PASSWORD] Invalid email for password reset:", email);
      return res.status(400).json({ success: false, error: "Invalid email." });
    }
    if (
      user.verificationCode !== code ||
      !user.verificationCodeExpires ||
      user.verificationCodeExpires < Date.now()
    ) {
      console.error("[RESET-PASSWORD] Invalid or expired reset code.", { email, code, storedCode: user.verificationCode, expires: user.verificationCodeExpires });
      return res.status(400).json({ success: false, error: "Invalid or expired code." });
    }
    user.password = newPassword;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();
    console.info("[RESET-PASSWORD] Password reset successful.", { email });
    res.json({ success: true, msg: "Password reset. You can now log in." });
  } catch (err) {
    console.error("[RESET-PASSWORD] Failed to reset password:", err, "Request body:", req.body);
    res.status(500).json({ success: false, error: "Failed to reset password." });
  }
});

module.exports = router;