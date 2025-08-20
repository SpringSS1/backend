/**
 * Referral Controller - Professional Refactor
 */

const Referral = require("../models/Referral");
const User = require("../models/User");

exports.handleReferralOnRegister = async (newUserId, referralCode) => {
  if (!referralCode) return;
  const referrer = await User.findOne({ referralCode });
  if (!referrer) return;
  await Referral.create({
    referrer: referrer._id,
    referred: newUserId,
    code: referralCode,
  });
  // Example reward logic (customize as needed)
  referrer.balance += 10;
  await referrer.save();
};

exports.getMyReferrals = async (req, res) => {
  try {
    const referrals = await Referral.find({ referrer: req.user.id }).populate("referred", "email");
    res.json({
      success: true,
      msg: "Fetched referrals",
      data: referrals,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};