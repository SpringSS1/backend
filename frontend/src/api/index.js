// src/api/index.js
import axios from "axios";

// Create a single Axios instance for API calls
const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  timeout: 12000,
});

// Automatically inject JWT token for protected endpoints
API.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Optional: Handle global errors (for notifications/logging)
API.interceptors.response.use(
  response => response,
  error => {
    // Central place to log errors, show toasts, etc.
    // Example: window.showToast(error.response?.data?.error || "Error occurred");
    return Promise.reject(error);
  }
);

// Utility: handle API calls with error, loading, and data
export const apiCall = async (fn, ...args) => {
  try {
    const res = await fn(...args);
    return [res, null];
  } catch (err) {
    return [null, err.response?.data?.error || err.message];
  }
};

// Auth
export const register = (data) => API.post("/auth/register", data).then(res => res.data);
export const login = (data) => API.post("/auth/login", data).then(res => res.data);
export const forgotPassword = (data) => API.post("/auth/forgot-password", data).then(res => res.data);
export const resetPassword = (token, data) => API.post(`/auth/reset-password/${token}`, data).then(res => res.data);

// User
export const getMe = () => API.get("/user/me").then(res => res.data);
export const getWallet = () => API.get("/wallet").then(res => res.data);
export const getUserList = () => API.get("/admin/users").then(res => res.data);

// Coins/Market
export const getCoins = () => API.get("/coin").then(res => res.data);
export const adminListCoins = () => API.get("/admin/coins").then(res => res.data);
export const adminUpsertCoin = (data) => API.post("/admin/coins", data).then(res => res.data);
export const adminEditCoinById = (id, data) => API.patch(`/admin/coins/${id}`, data).then(res => res.data);
export const adminDeleteCoin = (symbol) => API.delete(`/admin/coins/${symbol}`).then(res => res.data);

// Admin: User management
export const adminSetUserBalance = (data) => API.post("/admin/users/balance", data).then(res => res.data);
export const adminSetDepositAddress = (data) => API.post("/admin/users/deposit-address", data).then(res => res.data);
export const adminBanUser = (userId) => API.post(`/admin/users/${userId}/ban`).then(res => res.data);
export const adminUnbanUser = (userId) => API.post(`/admin/users/${userId}/unban`).then(res => res.data);

// Trade
export const placeTrade = (trade) => API.post("/trade/place", trade).then(res => res.data);
export const myTrades = () => API.get("/trade/my").then(res => res.data);

// Futures
export const openFutures = (data) => API.post("/futures/futures/open", data).then(res => res.data);
export const closeFutures = (data) => API.post("/futures/futures/close", data).then(res => res.data);
export const myFutures = () => API.get("/futures/futures/my-positions").then(res => res.data);

// Finance
export const deposit = (data) => API.post("/finance/deposit", data).then(res => res.data);
export const withdraw = (data) => API.post("/finance/withdraw", data).then(res => res.data);
export const myDeposits = () => API.get("/finance/my-deposits").then(res => res.data);
export const myWithdrawals = () => API.get("/finance/my-withdrawals").then(res => res.data);

// KYC
export const submitKyc = (data) => API.post("/kyc/submit", data).then(res => res.data);
export const adminGetKycSubmissions = () => API.get("/admin/kyc").then(res => res.data);
export const adminReviewKyc = (data) => API.post("/admin/kyc/review", data).then(res => res.data);

// Announcements
export const getAnnouncements = () => API.get("/announcement").then(res => res.data);
export const postAnnouncement = (data) => API.post("/announcement", data).then(res => res.data);

// Audit Logs (admin)
export const getAuditLogs = () => API.get("/admin/auditLogs").then(res => res.data);

// Analytics (admin)
export const getAdminAnalyticsSummary = () => API.get("/admin/analytics/summary").then(res => res.data);
export const getAdminAnalyticsKyc = () => API.get("/admin/analytics/kyc").then(res => res.data);
export const getAdminAnalyticsVolume = () => API.get("/admin/analytics/volume").then(res => res.data);
