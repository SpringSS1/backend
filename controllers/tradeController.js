/**
 * Trade Controller - Professional Refactor
 * Features: Input validation, standardized response, clean structure
 */

const Trade = require("../models/Trade");
const Coin = require("../models/Coin");
const User = require("../models/User");

// Place a trade (Buy/Sell)
exports.placeTrade = async (req, res) => {
  try {
    const { type, coinSymbol, amount, price } = req.body;
    if (!type || !coinSymbol || !amount || !price) {
      return res.status(400).json({ success: false, error: "Incomplete trade details" });
    }

    const coin = await Coin.findOne({ symbol: coinSymbol.toUpperCase() });
    if (!coin) return res.status(404).json({ success: false, error: "Coin not found" });

    const user = await User.findById(req.user._id);

    // Buy logic: deduct USDT, add coin
    if (type === "buy") {
      const usdtWallet = user.wallets.find((w) => w.coin === "USDT");
      const cost = amount * price;
      if (!usdtWallet || usdtWallet.balance < cost) {
        return res.status(400).json({ success: false, error: "Insufficient USDT balance" });
      }
      usdtWallet.balance -= cost;
      let coinWallet = user.wallets.find((w) => w.coin === coinSymbol.toUpperCase());
      if (!coinWallet) {
        user.wallets.push({ coin: coinSymbol.toUpperCase(), balance: amount, address: "" });
      } else {
        coinWallet.balance += amount;
      }
    } else if (type === "sell") {
      let coinWallet = user.wallets.find((w) => w.coin === coinSymbol.toUpperCase());
      if (!coinWallet || coinWallet.balance < amount) {
        return res.status(400).json({ success: false, error: "Insufficient coin balance" });
      }
      coinWallet.balance -= amount;
      const usdtWallet = user.wallets.find((w) => w.coin === "USDT");
      if (!usdtWallet) {
        user.wallets.push({ coin: "USDT", balance: amount * price, address: "" });
      } else {
        usdtWallet.balance += amount * price;
      }
    } else {
      return res.status(400).json({ success: false, error: "Invalid trade type" });
    }

    await user.save();

    const trade = await Trade.create({
      user: user._id,
      pair: `${coinSymbol}/USDT`,
      type,
      amount,
      price,
      status: "closed",
      createdAt: new Date(),
    });

    res.status(201).json({ success: true, msg: "Trade executed", data: trade });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get user's trade history
exports.getMyTrades = async (req, res) => {
  try {
    const trades = await Trade.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: trades });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};