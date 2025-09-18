/**
 * Auth Controller - Unified Registration, Confirmation, Login, and Password Reset
 * Features:
 * - Registration with confirmation code (email verification)
 * - Resend confirmation code if not verified
 * - Block registration if already verified
 * - Password reset with code
 * - Standardized responses
 */

const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const JWT_SECRET = process.env.JWT_SECRET || "changeme";

// Helper: Generate random 6-digit code
function randomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper: Send confirmation code email
async function sendConfirmationCode(email, code) {
  // Replace with your email sending logic
  // Example: using Nodemailer
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.mailtrap.io",
    port: process.env.MAIL_PORT || 2525,
    auth: {
      user: process.env.MAIL_USER || "user",
      pass: process.env.MAIL_PASS || "pass",
    },
  });

  await transporter.sendMail({
    to: email,
    subject: "Your Aexon Exchange confirmation code",
    text: `Your confirmation code is: ${code}`,
    html: `<p>Your confirmation code is: <b>${code}</b></p>`,
  });
}

// --- Registration ---
exports.register = async (req, res) => {
  try {
    const { email, password, referralCode } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required." });
    }

    let user = await User.findOne({ email });

    if (user) {
      if (!user.emailVerified) {
        // Email exists but not verified: resend code
        const code = randomCode();
        user.verificationCode = code;
        user.verificationCodeExpires = Date.now() + 15 * 60 * 1000; // 15 min
        await user.save();
        await sendConfirmationCode(email, code);
        return res.status(200).json({
          success: true,
          msg: "Verification code resent to your email.",
          userId: user._id,
          code: "EMAIL_NOT_VERIFIED",
        });
      } else {
        // Already verified
        return res.status(400).json({
          success: false,
          error: "Email already registered and verified.",
          code: "EMAIL_ALREADY_REGISTERED",
        });
      }
    }

    // New user registration
    const code = randomCode();
    const userData = {
      email,
      password,
      emailVerified: false,
      verificationCode: code,
      verificationCodeExpires: Date.now() + 15 * 60 * 1000, // 15 min
      username: "aexonuser_" + Math.random().toString(36).substring(2, 8),
    };
    if (referralCode && referralCode.trim() !== "") {
      userData.referralCode = referralCode.trim();
    }
    user = await User.create(userData);

    await sendConfirmationCode(email, code);

    res.json({
      success: true,
      msg: "Verification code sent to your email.",
      userId: user._id,
    });
  } catch (e) {
    console.error("Registration error:", e);
    if (e.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Email already registered.",
        code: "EMAIL_ALREADY_REGISTERED",
      });
    }
    res.status(500).json({ success: false, error: "Registration failed: " + e.message });
  }
};

// --- Confirm Email ---
exports.confirm = async (req, res) => {
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
};

// --- Login (only if verified) ---
exports.login = async (req, res) => {
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
        userId: user._id,
      });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      success: true,
      token,
      user: {
        email: user.email,
        _id: user._id,
        username: user.username,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
};

// --- Forgot Password: send code ---
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: true, msg: "If registered, a code will be sent." });
    const code = randomCode();
    user.verificationCode = code;
    user.verificationCodeExpires = Date.now() + 15 * 60 * 1000;
    await user.save();
    await sendConfirmationCode(email, code); // Reuse confirmation code sender
    res.json({ success: true, msg: "If registered, a code will be sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ success: false, error: "Failed to send password reset code." });
  }
};

// --- Reset Password With Code ---
exports.resetPassword = async (req, res) => {
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
};