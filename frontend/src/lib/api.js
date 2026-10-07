import axios from "axios";
import { supabase, SUPABASE_ENABLED } from "./supabase";
import { handleLocalRequest, seedDemoData } from "./localDb";
import { handleSupabaseRequest } from "./supabaseDb";

const rawBackendUrl = process.env.REACT_APP_BACKEND_URL || "";
const BACKEND_URL = rawBackendUrl.replace(/\/+$/, "");

export const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

// Base axios instance for remote backend requests
const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

axiosInstance.interceptors.request.use(async (config) => {
  if (SUPABASE_ENABLED && supabase) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      config.headers.Authorization = `Bearer ${data.session.access_token}`;
      return config;
    }
  }
  const token = localStorage.getItem("wd_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosInstance.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && !SUPABASE_ENABLED) {
      localStorage.removeItem("wd_token");
      localStorage.removeItem("wd_user");
    }
    return Promise.reject(err);
  }
);

// Route handler dispatcher:
// 1. If BACKEND_URL configured -> use Axios
// 2. If SUPABASE_ENABLED -> use Supabase PostgreSQL Cloud (Real-time Team Sharing)
// 3. Else -> use Local Database
async function dispatchRequest(method, url, data, config) {
  if (BACKEND_URL) {
    try {
      const res = await axiosInstance[method](url, data, config);
      if (typeof res.data === "string" && res.data.includes("<!doctype html>")) {
        // Fallback if proxy serves SPA HTML
        if (SUPABASE_ENABLED) return handleSupabaseRequest(method, url, data);
        return handleLocalRequest(method, url, data);
      }
      return res;
    } catch (err) {
      if (!err.response || [404, 405, 502, 503].includes(err.response?.status)) {
        if (SUPABASE_ENABLED) return handleSupabaseRequest(method, url, data);
        return handleLocalRequest(method, url, data);
      }
      throw err;
    }
  }

  if (SUPABASE_ENABLED && supabase) {
    try {
      return await handleSupabaseRequest(method, url, data);
    } catch (err) {
      console.warn("Supabase request failed, falling back to local DB:", err);
      return handleLocalRequest(method, url, data);
    }
  }

  return handleLocalRequest(method, url, data);
}

// Seamless smart api client
export const api = {
  get: (url, config) => dispatchRequest("get", url, undefined, config),
  post: (url, data, config) => dispatchRequest("post", url, data, config),
  put: (url, data, config) => dispatchRequest("put", url, data, config),
  patch: (url, data, config) => dispatchRequest("patch", url, data, config),
  delete: (url, config) => dispatchRequest("delete", url, undefined, config),
};

export const setAuth = (token, user) => {
  localStorage.setItem("wd_token", token);
  localStorage.setItem("wd_user", JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem("wd_token");
  localStorage.removeItem("wd_user");
};

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("wd_user"));
  } catch {
    return null;
  }
};

export const getToken = () => localStorage.getItem("wd_token");
export { seedDemoData };
