import axios from "axios";
import { supabase, SUPABASE_ENABLED } from "./supabase";
import { handleLocalRequest, seedDemoData } from "./localDb";

const rawBackendUrl = process.env.REACT_APP_BACKEND_URL || "";
const BACKEND_URL = rawBackendUrl.replace(/\/+$/, "");

export const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

// Base axios instance for remote backend requests
const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

axiosInstance.interceptors.request.use(async (config) => {
  // Prefer Supabase session token when logged in via Supabase.
  if (SUPABASE_ENABLED && supabase) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      config.headers.Authorization = `Bearer ${data.session.access_token}`;
      return config;
    }
  }
  // Fall back to legacy localStorage token.
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

// Seamless smart api client
export const api = {
  get: async (url, config) => {
    if (!BACKEND_URL) return handleLocalRequest("get", url);
    try {
      const res = await axiosInstance.get(url, config);
      if (typeof res.data === "string" && res.data.includes("<!doctype html>")) {
        return handleLocalRequest("get", url);
      }
      return res;
    } catch (err) {
      if (!err.response || [404, 405, 502, 503].includes(err.response?.status)) {
        return handleLocalRequest("get", url);
      }
      throw err;
    }
  },
  post: async (url, data, config) => {
    if (!BACKEND_URL) return handleLocalRequest("post", url, data);
    try {
      const res = await axiosInstance.post(url, data, config);
      if (typeof res.data === "string" && res.data.includes("<!doctype html>")) {
        return handleLocalRequest("post", url, data);
      }
      return res;
    } catch (err) {
      if (!err.response || [404, 405, 502, 503].includes(err.response?.status)) {
        return handleLocalRequest("post", url, data);
      }
      throw err;
    }
  },
  put: async (url, data, config) => {
    if (!BACKEND_URL) return handleLocalRequest("put", url, data);
    try {
      const res = await axiosInstance.put(url, data, config);
      if (typeof res.data === "string" && res.data.includes("<!doctype html>")) {
        return handleLocalRequest("put", url, data);
      }
      return res;
    } catch (err) {
      if (!err.response || [404, 405, 502, 503].includes(err.response?.status)) {
        return handleLocalRequest("put", url, data);
      }
      throw err;
    }
  },
  patch: async (url, data, config) => {
    if (!BACKEND_URL) return handleLocalRequest("patch", url, data);
    try {
      const res = await axiosInstance.patch(url, data, config);
      if (typeof res.data === "string" && res.data.includes("<!doctype html>")) {
        return handleLocalRequest("patch", url, data);
      }
      return res;
    } catch (err) {
      if (!err.response || [404, 405, 502, 503].includes(err.response?.status)) {
        return handleLocalRequest("patch", url, data);
      }
      throw err;
    }
  },
  delete: async (url, config) => {
    if (!BACKEND_URL) return handleLocalRequest("delete", url);
    try {
      const res = await axiosInstance.delete(url, config);
      if (typeof res.data === "string" && res.data.includes("<!doctype html>")) {
        return handleLocalRequest("delete", url);
      }
      return res;
    } catch (err) {
      if (!err.response || [404, 405, 502, 503].includes(err.response?.status)) {
        return handleLocalRequest("delete", url);
      }
      throw err;
    }
  },
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
