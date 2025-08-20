/**
 * Admin Routes - Premium Professional Refactor
 * Protects all admin endpoints, enforces adminOnly, clean structure
 */
const router = require("express").Router();
const admin = require("../controllers/adminController");
const { protect, adminOnly } = require("../middlewares/auth");

// --- KYC ---
router.get("/kyc", protect, adminOnly, admin.getKycSubmissions);
router.post("/kyc/review", protect, adminOnly, admin.reviewKyc);

// --- Coin Management ---
router.get("/coins", protect, adminOnly, admin.listCoins);
router.post("/coins", protect, adminOnly, admin.upsertCoin);
router.patch("/coins/:id", protect, adminOnly, admin.editCoinById);
router.delete("/coins/:symbol", protect, adminOnly, admin.deleteCoin);
router.get("/coins/:symbol/chart/:interval", protect, adminOnly, admin.getCoinChart);

// --- User Management ---
router.get("/users", protect, adminOnly, admin.listUsers);
router.post("/users/balance", protect, adminOnly, admin.setUserBalance);
router.post("/users/deposit-address", protect, adminOnly, admin.setUserDepositAddress);

// --- Deposit/Withdraw ---
router.get("/deposits", protect, adminOnly, admin.listDepositRequests);
router.post("/deposits/review", protect, adminOnly, admin.reviewDeposit);
router.get("/withdraws", protect, adminOnly, admin.listWithdrawRequests);
router.post("/withdraws/review", protect, adminOnly, admin.reviewWithdraw);

// --- Analytics ---
router.get("/analytics/summary", protect, adminOnly, admin.getAnalyticsSummary);
router.get("/analytics/kyc", protect, adminOnly, admin.getKYCStats);
router.get("/analytics/volume", protect, adminOnly, admin.getVolumeStats);

// --- Audit Logs ---
router.get("/auditLogs", protect, adminOnly, admin.getAuditLogs);

module.exports = router;