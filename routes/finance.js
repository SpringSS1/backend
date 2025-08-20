/**
 * Finance Routes - Premium Professional Refactor
 */
const router = require("express").Router();
const finance = require("../controllers/financeController");
const { protect } = require("../middlewares/auth");

router.post("/deposit", protect, finance.requestDeposit);
router.post("/withdraw", protect, finance.requestWithdraw);
router.get("/my-deposits", protect, finance.myDeposits);
router.get("/my-withdrawals", protect, finance.myWithdrawals);

module.exports = router;