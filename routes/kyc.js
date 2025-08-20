/**
 * KYC Routes - Premium Professional Refactor
 */
const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middlewares/auth");
const { submitKYC, getKYCStatus, adminListKYC, adminApproveKYC } = require("../controllers/kycController");

// User submits KYC
router.post("/submit", protect, submitKYC);

// User checks their KYC status
router.get("/status", protect, getKYCStatus);

// Admin: list all KYC requests
router.get("/admin/list", protect, adminOnly, adminListKYC);

// Admin: approve/reject KYC request
router.post("/admin/approve", protect, adminOnly, adminApproveKYC);

module.exports = router;