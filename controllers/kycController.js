/**
 * KYC Controller - Professional Refactor
 * Features: Input validation, standardized responses
 */

const User = require("../models/User");

// User submits KYC
exports.submitKYC = async (req, res) => {
  try {
    const { documentUrl } = req.body;
    if (!documentUrl) return res.status(400).json({ success: false, error: "Document URL required" });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    user.kyc = {
      status: "pending",
      documentUrl,
      submittedAt: new Date(),
    };
    await user.save();
    res.json({ success: true, msg: "KYC submitted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// User checks their KYC status
exports.getKYCStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    res.json({
      success: true,
      data: {
        status: user.kyc.status,
        documentUrl: user.kyc.documentUrl,
        error: user.kyc.error,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Admin: list all pending KYC requests
exports.adminListKYC = async (req, res) => {
  try {
    const users = await User.find({ "kyc.status": "pending" });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Admin: approve/reject KYC
exports.adminApproveKYC = async (req, res) => {
  try {
    const { userId, status, error: kycError } = req.body;
    if (!userId || !status) return res.status(400).json({ success: false, error: "Missing fields" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    user.kyc.status = status;
    user.kyc.error = kycError || "";
    await user.save();
    res.json({ success: true, msg: "KYC status updated" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};