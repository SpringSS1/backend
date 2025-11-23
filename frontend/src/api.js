import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE || "https://aexon.onrender.com/api";
const api = axios.create({
  baseURL: API_BASE,
});

// Centralized auth & error handling
let onForceLogout = () => {};

export function setForceLogoutHandler(fn) {
  onForceLogout = fn;
}

api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    const status = error?.response?.status;
    const msg = error?.response?.data?.message || error?.response?.data?.error || error?.message || "";
    if (
      status === 403 ||
      (typeof msg === "string" && (
        msg.toLowerCase().includes("banned") ||
        msg.toLowerCase().includes("jwt expired") ||
        msg.toLowerCase().includes("not authorized")
      ))
    ) {
      localStorage.clear();
      if (typeof onForceLogout === "function") onForceLogout(msg);
      window.location.replace("/login");
      return Promise.reject(typeof msg === "string" ? msg : "Unauthorized");
    }
    if (
      status === 404 &&
      typeof msg === "string" &&
      msg.toLowerCase().includes("user not found")
    ) {
      localStorage.clear();
      window.location.replace("/login");
      return Promise.reject("User not found. Please login again.");
    }
    return Promise.reject(typeof msg === "string" ? msg : error);
  }
);

export default api;