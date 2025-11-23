/**
 * Announcement Routes - Premium Professional Refactor
 */
const router = require("express").Router();
const { protect, adminOnly } = require("../middlewares/auth");
const { getAnnouncements, postAnnouncement } = require("../controllers/announcementController");

// GET /api/announcement (protected)
router.get("/", protect, getAnnouncements);

// POST /api/announcement (admin only)
router.post("/", protect, adminOnly, postAnnouncement);

module.exports = router;