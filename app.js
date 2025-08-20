/**
 * Main Express App - Premium Professional Refactor
 */

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Health check route
app.get("/", (req, res) => {
  res.send("API is running.");
});

// Modular route imports (all features, fully integrated)
app.use("/api/auth", require("./routes/auth"));
app.use("/api/user", require("./routes/user"));
app.use("/api/coin", require("./routes/coin"));
app.use("/api/finance", require("./routes/finance"));
app.use("/api/futures", require("./routes/futures"));
app.use("/api/trade", require("./routes/trade"));
app.use("/api/wallet", require("./routes/wallet"));
app.use("/api/kyc", require("./routes/kyc"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/news", require("./routes/news"));
app.use("/api/announcement", require("./routes/announcement"));
app.use("/api/referral", require("./routes/referral"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/audit-logs", require("./routes/auditLogs"));

// --- Optional: Automated Crypto News Fetcher using node-cron ---
// Uncomment the lines below to fetch news every hour automatically
/*
const cron = require("node-cron");
const fetchAndSaveNews = require("./scripts/fetchCryptoNews");
cron.schedule("0 * * * *", () => {
  fetchAndSaveNews();
  console.log("Scheduled crypto news fetch complete.");
});
*/

// Centralized error handler (should be last)
app.use(require("./middlewares/errorHandler").errorHandler);

module.exports = app;