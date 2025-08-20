/**
 * Referral Routes - Premium Professional Refactor
 */
const router = require("express").Router();
const { protect } = require("../middlewares/auth");
const { getMyReferrals } = require("../controllers/referralController");

router.get("/my", protect, getMyReferrals);

module.exports = router;