/**
 * Admin Controller - Professional Refactor
 * Features: Input validation, standardized responses, security, clean structure
 */
const User = require("../models/User");
const Coin = require("../models/Coin");
const DepositRequest = require("../models/DepositRequest");
const WithdrawRequest = require("../models/WithdrawRequest");
const auditLogger = require("../middlewares/auditLogger");
const AuditLog = require("../models/AuditLog");
const Trade = require("../models/Trade");

// --- Helper: Ban check on admin actions ---
function checkNotBanned(req, res) {
  if (req.user && req.user.isBanned) {
    res.status(403).json({ success: false, error: "Your admin account is banned." });
    return false;
  }
  return true;
}

// --- Helper: Standardized Success Response ---
function success(data, msg = "success") {
  return { success: true, msg, data };
}

// --- Helper: Standardized Error Response ---
function error(msg, code = 400) {
  return { success: false, error: msg, code };
}

// --- KYC Review ---
exports.getKycSubmissions = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const users = await User.find({ "kyc.status": "pending" }).select("-password");
    res.json(success(users));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.reviewKyc = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const { userId, status, remark } = req.body;
    if (!userId || !["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json(error("Invalid KYC status or userId."));
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json(error("User not found"));
    const previousStatus = user.kyc?.status || null;
    user.kyc.status = status;
    await user.save();

    await auditLogger({
      adminId: req.user._id,
      action: "kyc_review",
      targetType: "kyc",
      targetId: user._id,
      details: { previousStatus, newStatus: status, approvedBy: req.user.email },
      ip: req.ip,
      note: remark || "",
    });

    res.json(success({ userId, status }, "KYC status updated"));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

// --- Coin Management ---
exports.listCoins = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const coins = await Coin.find();
    res.json(success(coins));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.upsertCoin = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const { symbol, name, price, iconUrl, depositAddress } = req.body;
    if (!symbol || !name || typeof price !== "number" || price < 0) {
      return res.status(400).json(error("Invalid coin data."));
    }
    let coin = await Coin.findOne({ symbol: symbol.toUpperCase() });
    if (coin) {
      coin.name = name ?? coin.name;
      coin.price = price ?? coin.price;
      coin.iconUrl = iconUrl ?? coin.iconUrl;
      coin.depositAddress = depositAddress ?? coin.depositAddress;
      await coin.save();
      await auditLogger({
        adminId: req.user._id,
        action: "coin_update",
        targetType: "coin",
        targetId: coin._id,
        details: { symbol, name, price, iconUrl, depositAddress },
        ip: req.ip,
        note: "Updated coin",
      });
      res.json(success(coin, "Coin updated"));
    } else {
      coin = new Coin({
        symbol: symbol.toUpperCase(),
        name,
        price,
        iconUrl,
        depositAddress,
      });
      await coin.save();
      await auditLogger({
        adminId: req.user._id,
        action: "coin_create",
        targetType: "coin",
        targetId: coin._id,
        details: { symbol, name, price, iconUrl, depositAddress },
        ip: req.ip,
        note: "Created coin",
      });
      res.status(201).json(success(coin, "Coin created"));
    }
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.editCoinById = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const { id } = req.params;
    const update = req.body;
    const coin = await Coin.findByIdAndUpdate(id, update, { new: true });
    if (!coin) return res.status(404).json(error("Coin not found."));
    await auditLogger({
      adminId: req.user._id,
      action: "coin_edit",
      targetType: "coin",
      targetId: id,
      details: { update },
      ip: req.ip,
      note: "Edited coin by _id",
    });
    res.json(success(coin, "Coin edited"));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.deleteCoin = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const { symbol } = req.params;
    const coin = await Coin.findOne({ symbol: symbol.toUpperCase() });
    if (!coin) return res.status(404).json(error("Coin not found."));
    await Coin.deleteOne({ symbol: symbol.toUpperCase() });
    await auditLogger({
      adminId: req.user._id,
      action: "coin_delete",
      targetType: "coin",
      targetId: coin._id,
      details: { symbol },
      ip: req.ip,
      note: "Deleted coin",
    });
    res.json(success({ symbol }, "Coin deleted"));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.getCoinChart = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const { symbol, interval } = req.params;
    const coin = await Coin.findOne({ symbol: symbol.toUpperCase() });
    if (!coin) return res.status(404).json(error("Coin not found"));
    const chart = (coin.candlesticks || []).find((cs) => cs.interval === interval);
    res.json(success(chart ? chart.data : [], "Chart data"));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

// --- User Management ---
exports.listUsers = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const users = await User.find().select("-password");
    res.json(success(users));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.banUser = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const { id } = req.params;
    if (id === req.user._id.toString()) {
      return res.status(400).json(error("You cannot ban yourself."));
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json(error("User not found"));
    user.isBanned = true;
    await user.save();
    await auditLogger({
      adminId: req.user._id,
      action: "ban_user",
      targetType: "user",
      targetId: user._id,
      details: { banned: true },
      ip: req.ip,
      note: "User banned",
    });
    res.json(success({ userId: user._id }, "User banned"));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.unbanUser = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const { id } = req.params;
    if (id === req.user._id.toString()) {
      return res.status(400).json(error("You cannot unban yourself."));
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json(error("User not found"));
    user.isBanned = false;
    await user.save();
    await auditLogger({
      adminId: req.user._id,
      action: "unban_user",
      targetType: "user",
      targetId: user._id,
      details: { banned: false },
      ip: req.ip,
      note: "User unbanned",
    });
    res.json(success({ userId: user._id }, "User unbanned"));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.setUserBalance = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const { userId, coin, balance } = req.body;
    if (!userId || !coin || typeof balance !== "number" || balance < 0) {
      return res.status(400).json(error("Invalid balance data."));
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json(error("User not found"));
    let wallet = user.wallets.find((w) => w.coin === coin.toUpperCase());
    if (!wallet) {
      user.wallets.push({ coin: coin.toUpperCase(), balance, address: "" });
    } else {
      wallet.balance = balance;
    }
    await user.save();
    await auditLogger({
      adminId: req.user._id,
      action: "set_balance",
      targetType: "wallet",
      targetId: user._id,
      details: { coin, balance },
      ip: req.ip,
      note: "Set user balance",
    });
    res.json(success({ userId, coin, balance }, "Balance updated"));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.setUserDepositAddress = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const { userId, address } = req.body;
    if (!userId || !address || typeof address !== "object") {
      return res.status(400).json(error("Invalid deposit address data."));
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json(error("User not found"));
    user.depositAddress = address; // Overwrite all deposit addresses for this user
    await user.save();
    await auditLogger({
      adminId: req.user._id,
      action: "set_deposit_address",
      targetType: "wallet",
      targetId: user._id,
      details: { address },
      ip: req.ip,
      note: "Set user deposit address",
    });
    res.json(success({ userId, address }, "Deposit address updated"));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

// --- Deposit/Withdraw Management ---
exports.listDepositRequests = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const requests = await DepositRequest.find().populate("user", "username email");
    res.json(success(requests));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.reviewDeposit = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const { requestId, status, remark } = req.body;
    if (!requestId || !["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json(error("Invalid deposit review data."));
    }
    const reqDoc = await DepositRequest.findById(requestId);
    if (!reqDoc) return res.status(404).json(error("Request not found"));
    reqDoc.status = status;
    reqDoc.reviewedBy = req.user.id;
    reqDoc.reviewedAt = new Date();
    await reqDoc.save();

    await auditLogger({
      adminId: req.user._id,
      action: "deposit_review",
      targetType: "deposit",
      targetId: reqDoc._id,
      details: { status, reviewedBy: req.user.email },
      ip: req.ip,
      note: remark || "",
    });

    if (status === "approved") {
      const user = await User.findById(reqDoc.user);
      let wallet = user.wallets.find((w) => w.coin === reqDoc.coin.toUpperCase());
      if (!wallet) {
        user.wallets.push({ coin: reqDoc.coin.toUpperCase(), balance: reqDoc.amount, address: "" });
      } else {
        wallet.balance += reqDoc.amount;
      }
      await user.save();
    }
    res.json(success({ request: reqDoc }, "Deposit reviewed"));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.listWithdrawRequests = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const requests = await WithdrawRequest.find().populate("user", "username email");
    res.json(success(requests));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.reviewWithdraw = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const { requestId, status, remark } = req.body;
    if (!requestId || !["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json(error("Invalid withdrawal review data."));
    }
    const reqDoc = await WithdrawRequest.findById(requestId);
    if (!reqDoc) return res.status(404).json(error("Request not found"));
    reqDoc.status = status;
    reqDoc.reviewedBy = req.user.id;
    reqDoc.reviewedAt = new Date();
    await reqDoc.save();

    await auditLogger({
      adminId: req.user._id,
      action: "withdraw_review",
      targetType: "withdraw",
      targetId: reqDoc._id,
      details: { status, reviewedBy: req.user.email },
      ip: req.ip,
      note: remark || "",
    });

    if (status === "approved") {
      const user = await User.findById(reqDoc.user);
      let wallet = user.wallets.find((w) => w.coin === reqDoc.coin.toUpperCase());
      if (!wallet || wallet.balance < reqDoc.amount) {
        return res.status(400).json(error("Insufficient balance"));
      }
      wallet.balance -= reqDoc.amount;
      await user.save();
    }
    res.json(success({ request: reqDoc }, "Withdraw reviewed"));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

// --- Analytics Endpoints ---
exports.getAnalyticsSummary = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const userCount = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: Date.now() - 7 * 24 * 60 * 60 * 1000 },
    });
    const totalDeposits = await DepositRequest.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, sum: { $sum: "$amount" } } },
    ]);
    const totalWithdrawals = await WithdrawRequest.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, sum: { $sum: "$amount" } } },
    ]);
    res.json(
      success({
        userCount,
        activeUsers,
        totalDeposits: totalDeposits[0]?.sum || 0,
        totalWithdrawals: totalWithdrawals[0]?.sum || 0,
      })
    );
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.getKYCStats = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const pending = await User.countDocuments({ "kyc.status": "pending" });
    const approved = await User.countDocuments({ "kyc.status": "approved" });
    const rejected = await User.countDocuments({ "kyc.status": "rejected" });
    res.json(success({ pending, approved, rejected }));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

exports.getVolumeStats = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const trades = await Trade.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          volume: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json(success(trades));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};

// --- Audit Logs Retrieval ---
exports.getAuditLogs = async (req, res) => {
  if (!checkNotBanned(req, res)) return;
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
    res.json(success(logs));
  } catch (err) {
    res.status(500).json(error("Internal server error"));
  }
};