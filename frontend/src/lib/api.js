import axios from "axios";
import { supabase, SUPABASE_ENABLED } from "./supabase";

const rawBackendUrl = process.env.REACT_APP_BACKEND_URL || "";
const BACKEND_URL = rawBackendUrl.replace(/\/+$/, "");

const CF_HOST = "pm.workflow.com";
const sameOrigin =
  typeof window !== "undefined" && window.location && window.location.hostname === CF_HOST;

export const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  // Prefer Supabase session token when logged in via Supabase.
  if (SUPABASE_ENABLED && supabase) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      config.headers.Authorization = `Bearer ${data.session.access_token}`;
      return config;
    }
  }
  // Fall back to legacy localStorage token (used by demo login + non-Supabase mode).
  const token = localStorage.getItem("wd_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && !SUPABASE_ENABLED) {
      localStorage.removeItem("wd_token");
      localStorage.removeItem("wd_user");
    }
    return Promise.reject(err);
  }
);

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
