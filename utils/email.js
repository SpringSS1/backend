/**
 * Email Utility - Premium Professional Refactor
 * Handles confirmation and password reset emails using SMTP.
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Send confirmation code for registration/verification.
 */
exports.sendConfirmationCode = async (to, code) => {
  try {
    await transporter.sendMail({
      from: `"Aexon Support" <${process.env.SUPPORT_EMAIL}>`,
      to,
      subject: "Aexon - Your Confirmation Code",
      text: `Your confirmation code is: ${code}`,
      html: `<h2>Your confirmation code is:</h2><p><b>${code}</b></p>`
    });
  } catch (err) {
    console.error("Failed to send confirmation code:", err);
    throw new Error("Failed to send confirmation email.");
  }
};

/**
 * Send password reset code for password recovery.
 */
exports.sendPasswordResetCode = async (to, code) => {
  try {
    await transporter.sendMail({
      from: `"Aexon Support" <${process.env.SUPPORT_EMAIL}>`,
      to,
      subject: "Aexon - Password Reset Code",
      text: `Your password reset code is: ${code}`,
      html: `<h2>Your password reset code is:</h2><p><b>${code}</b></p>`
    });
  } catch (err) {
    console.error("Failed to send password reset code:", err);
    throw new Error("Failed to send password reset email.");
  }
};