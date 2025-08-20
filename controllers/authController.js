/**
 * Auth Controller - Professional Refactor
 * Features: Input validation, centralized error handling, JWT, secure password reset, standardized responses
 */

const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const referralController = require("./referralController");

const JWT_SECRET = process.env.JWT_SECRET || "REPLACE_THIS_WITH_A_REAL_SECRET";

// --- Helper: Standardized Success/Error Responses ---
function success(data, msg = "Success") {
  return { success: true, msg, data };
}
function error(msg, code = 400) {
  return { success: false, error: msg, code };
}

// Registration (random username)
exports.register = async (req, res) => {
  try {
    const { email, password, referralCode } = req.body;
    if (!email || !password)
      return res.status(400).json(error("Email and password are required"));

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json(error("Email already registered"));

    const userReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const randomUserName = "aexonuser_" + Math.random().toString(36).substring(2, 8).toLowerCase();
    const user = await User.create({
      email,
      password,
      referralCode: userReferralCode,
      username: randomUserName,
    });

    await referralController.handleReferralOnRegister(user._id, referralCode);

    // FIX: Use userId instead of id in JWT payload
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json(success({
      token,
      user: {
        userId: user._id, // also use userId here for consistency
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        referralCode: userReferralCode,
        username: user.username,
      },
    }, "Registration successful"));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json(error("Email already registered"));
    }
    res.status(500).json(error("Server error: " + err.message));
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json(error("Email and password are required"));

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json(error("Invalid credentials"));

    const match = await user.comparePassword(password);
    if (!match) return res.status(400).json(error("Invalid credentials"));

    // FIX: Use userId instead of id in JWT payload
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json(success({
      token,
      user: {
        userId: user._id, // also use userId here for consistency
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        referralCode: user.referralCode,
        username: user.username,
      },
    }, "Login successful"));
  } catch (err) {
    res.status(500).json(error("Server error: " + err.message));
  }
};

// Update username (User Profile)
exports.updateUsername = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.length < 3)
      return res.status(400).json(error("Username must be at least 3 characters"));

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json(error("Username already taken"));

    // FIX: Use req.user.userId (not req.user.id)
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json(error("User not found"));
    user.username = username;
    await user.save();
    res.json(success({ username: user.username }, "Username updated"));
  } catch (err) {
    res.status(500).json(error("Server error: " + err.message));
  }
};

// Get profile (me)
exports.me = async (req, res) => {
  try {
    // FIX: Use req.user.userId (not req.user.id)
    const user = await User.findById(req.user.userId).select("-password -resetPasswordToken -resetPasswordExpires");
    if (!user) return res.status(404).json(error("User not found"));
    res.json(success(user));
  } catch (err) {
    res.status(500).json(error("Server error: " + err.message));
  }
};

// Request password reset
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json(error("No user with that email."));

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || "smtp.mailtrap.io",
      port: process.env.MAIL_PORT || 2525,
      auth: { user: process.env.MAIL_USER || "your_user", pass: process.env.MAIL_PASS || "your_pass" },
    });

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password/${token}`;
    await transporter.sendMail({
      to: user.email,
      subject: "Password Reset",
      text: `Reset your password by clicking this link: ${resetUrl}`,
      html: `<p>Reset your password by clicking <a href="${resetUrl}">this link</a></p>`,
    });

    res.json(success({}, "Reset link sent to your email."));
  } catch (err) {
    res.status(500).json(error("Server error: " + err.message));
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!password) return res.status(400).json(error("Password required."));
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json(error("Invalid or expired token."));

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json(success({}, "Password has been reset."));
  } catch (err) {
    res.status(500).json(error("Server error: " + err.message));
  }
};