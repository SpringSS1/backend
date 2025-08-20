/**
 * Announcement Controller - Professional Refactor
 */
const Announcement = require("../models/Announcement");

// Get latest announcements (limit 10, pinned first)
exports.getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .sort({ pinned: -1, createdAt: -1 })
      .limit(10)
      .populate("createdBy", "email");
    res.json({
      success: true,
      msg: "Fetched announcements",
      data: announcements,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch announcements",
    });
  }
};

// Admin: Post announcement
exports.postAnnouncement = async (req, res) => {
  try {
    const { title, message, pinned } = req.body;
    if (!title || !message)
      return res.status(400).json({
        success: false,
        error: "Title and message required",
      });
    const ann = await Announcement.create({
      title,
      message,
      createdBy: req.user.id,
      pinned: !!pinned,
    });
    res.status(201).json({
      success: true,
      msg: "Announcement posted",
      data: ann,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to post announcement",
    });
  }
};