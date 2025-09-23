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
      console.error("[REGISTER] Missing email or password:", req.body);
      return res.status(400).json({ success: false, error: "Email and password are required." });
    }

    let user = await User.findOne({ email });

    if (user) {
      if (!user.emailVerified) {
        // Email exists but not verified: resend code
        const code = randomCode();
        user.verificationCode = code;
        user.verificationCodeExpires = Date.now() + 15 * 60 * 1000; // 15 min as timestamp
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
      verificationCodeExpires: Date.now() + 15 * 60 * 1000, // 15 min as timestamp
      username: "aexonuser_" + Math.random().toString(36).substring(2, 8),
    };
    if (referralCode && referralCode.trim() !== "") {
      userData.referralCode = referralCode.trim();
    }
    user = await User.create(userData);

    await sendConfirmationCode(email, code);
    console.info("[REGISTER] New user registered and confirmation code sent.", { email, userId: user._id });

    res.json({
      success: true,
      msg: "Verification code sent to your email.",
      userId: user._id,
    });
  } catch (e) {
    console.error("[REGISTER] Registration error:", e, "Request body:", req.body);
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
};

// --- Login (only if verified) ---
exports.login = async (req, res) => {
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
        userId: user._id,
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
        username: user.username,
      },
    });
  } catch (err) {
    console.error("[LOGIN] Login error:", err, "Request body:", req.body);
    res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
};

// --- Forgot Password: send code ---
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.warn("[FORGOT-PASSWORD] Email not found for forgot password request:", email);
      return res.json({ success: true, msg: "If registered, a code will be sent." });
    }
    const code = randomCode();
    user.verificationCode = code;
    user.verificationCodeExpires = Date.now() + 15 * 60 * 1000; // 15 min as timestamp
    await user.save();
    await sendConfirmationCode(email, code); // Reuse confirmation code sender
    console.info("[FORGOT-PASSWORD] Password reset code sent.", { email });
    res.json({ success: true, msg: "If registered, a code will be sent." });
  } catch (err) {
    console.error("[FORGOT-PASSWORD] Error sending password reset code:", err, "Request body:", req.body);
    res.status(500).json({ success: false, error: "Failed to send password reset code." });
  }
};

// --- Reset Password With Code ---
exports.resetPassword = async (req, res) => {
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
};