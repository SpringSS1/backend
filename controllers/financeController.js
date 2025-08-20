/**
 * Finance Controller - Professional Refactor
 * Features: Input validation, standardized response, clean structure
 */

const DepositRequest = require("../models/DepositRequest");
const WithdrawRequest = require("../models/WithdrawRequest");

// User: Create deposit request (simulated deposit)
exports.requestDeposit = async (req, res) => {
  try {
    const { coin, amount, address } = req.body;
    if (!coin || !amount || !address) return res.status(400).json({ success: false, error: "Missing fields" });
    const reqDoc = new DepositRequest({
      user: req.user.id,
      coin,
      amount,
      address,
    });
    await reqDoc.save();
    res.status(201).json({ success: true, msg: "Deposit request submitted", data: reqDoc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// User: Create withdraw request (simulated withdraw)
exports.requestWithdraw = async (req, res) => {
  try {
    const { coin, amount, address } = req.body;
    if (!coin || !amount || !address) return res.status(400).json({ success: false, error: "Missing fields" });
    const reqDoc = new WithdrawRequest({
      user: req.user.id,
      coin,
      amount,
      address,
    });
    await reqDoc.save();
    res.status(201).json({ success: true, msg: "Withdraw request submitted", data: reqDoc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// User: List own deposit/withdraw requests
exports.myDeposits = async (req, res) => {
  try {
    const reqs = await DepositRequest.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: reqs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
exports.myWithdrawals = async (req, res) => {
  try {
    const reqs = await WithdrawRequest.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: reqs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};