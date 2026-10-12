import React, { createContext, useContext, useState, useEffect } from "react";
import { api, setAuth, clearAuth, getUser, getToken } from "./api";
import { supabase, SUPABASE_ENABLED } from "./supabase";

import {
  findAccount,
  verifyPassword,
  saveLocalAccount,
  saveCloudAccount,
  hashPassword,
  generateSalt,
} from "./userRegistry";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getUser());
  const [loading, setLoading] = useState(() => !getUser());

  useEffect(() => {
    let mounted = true;

    const fetchMe = async () => {
      try {
        const r = await api.get("/auth/me");
        if (!mounted) return;
        setUser(r.data);
        localStorage.setItem("wd_user", JSON.stringify(r.data));
      } catch (err) {
        if (!mounted) return;
        if (err?.response?.status === 401 && !getUser()) {
          clearAuth();
          setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (SUPABASE_ENABLED && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        if (data?.session) {
          fetchMe();
        } else if (getUser()) {
          // Persist user across reload
          setUser(getUser());
          setLoading(false);
          fetchMe();
        } else {
          setUser(null);
          setLoading(false);
        }
      });

      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (!mounted) return;
        if (session) {
          fetchMe();
        } else if (event === "SIGNED_OUT") {
          const token = getToken();
          if (!token || !token.startsWith("wd-token-")) {
            clearAuth();
            setUser(null);
            setLoading(false);
          }
        } else if (getUser()) {
          setUser(getUser());
          setLoading(false);
        }
      });

      return () => {
        mounted = false;
        listener?.subscription.unsubscribe();
      };
    } else {
      if (!getToken() && !getUser()) {
        setLoading(false);
        return () => {
          mounted = false;
        };
      }
      fetchMe();
      return () => {
        mounted = false;
      };
    }
  }, []);

  const login = async (rawEmail, password) => {
    const cleanEmail = (rawEmail || "").toLowerCase().trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      const err = new Error("Format email tidak valid");
      err.response = { data: { detail: "Format email tidak valid" }, status: 400 };
      throw err;
    }

    if (!password || password.length < 6) {
      const err = new Error("Password minimal 6 karakter");
      err.response = { data: { detail: "Password minimal 6 karakter" }, status: 400 };
      throw err;
    }

    // 1. Check Supabase Auth session if enabled
    let supabasePasswordVerified = false;
    let supabaseUser = null;
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (!error && data?.session) {
          const r = await api.get("/auth/me");
          setAuth(data.session.access_token, r.data);
          setUser(r.data);
          return r.data;
        }

        // Supabase returns "Email not confirmed" ONLY IF the password was verified correct!
        if (error && error.message === "Email not confirmed") {
          supabasePasswordVerified = true;
          supabaseUser = {
            id: "usr-" + cleanEmail.replace(/[^a-zA-Z0-9]/g, "_"),
            email: cleanEmail,
            name: cleanEmail.split("@")[0],
            created_at: new Date().toISOString(),
          };
        }
      } catch (e) {
        console.warn("Supabase auth check notice:", e);
      }
    }

    // If Supabase verified the password
    if (supabasePasswordVerified && supabaseUser) {
      const existingAcc = await findAccount(cleanEmail);
      if (!existingAcc) {
        const salt = generateSalt();
        const hash = await hashPassword(password, salt);
        const newAcc = {
          ...supabaseUser,
          password_hash: hash,
          salt,
        };
        saveLocalAccount(newAcc);
        await saveCloudAccount(newAcc);
      }
      setAuth("wd-token-" + Date.now(), supabaseUser);
      setUser(supabaseUser);
      return supabaseUser;
    }

    // 2. Check GeoFlow User Registry (Cloud Supabase + Local Cache)
    const account = await findAccount(cleanEmail);
    if (!account) {
      const err = new Error("Akun belum terdaftar. Silakan daftar terlebih dahulu.");
      err.response = {
        data: { detail: "Akun belum terdaftar. Silakan daftar terlebih dahulu." },
        status: 404,
      };
      throw err;
    }

    // Verify stored password hash
    const isPasswordValid = await verifyPassword(
      password,
      account.salt,
      account.password_hash
    );

    if (!isPasswordValid) {
      const err = new Error("Email atau password salah");
      err.response = {
        data: { detail: "Email atau password salah. Silakan periksa kembali." },
        status: 401,
      };
      throw err;
    }

    const verifiedUser = {
      id: account.id || "usr-" + Date.now(),
      email: account.email,
      name: account.name || account.email.split("@")[0],
      created_at: account.created_at || new Date().toISOString(),
    };
    setAuth("wd-token-" + Date.now(), verifiedUser);
    setUser(verifiedUser);
    return verifiedUser;
  };

  const register = async (rawEmail, password, name) => {
    const cleanEmail = (rawEmail || "").toLowerCase().trim();
    const cleanName = (name || "").trim() || cleanEmail.split("@")[0];

    if (!cleanEmail || !cleanEmail.includes("@")) {
      const err = new Error("Format email tidak valid");
      err.response = { data: { detail: "Format email tidak valid" }, status: 400 };
      throw err;
    }

    if (!password || password.length < 6) {
      const err = new Error("Password minimal 6 karakter");
      err.response = { data: { detail: "Password minimal 6 karakter" }, status: 400 };
      throw err;
    }

    // Check if account already exists
    const existing = await findAccount(cleanEmail);
    if (existing) {
      const err = new Error("Email sudah terdaftar. Silakan masuk.");
      err.response = {
        data: { detail: "Email sudah terdaftar. Silakan masuk dengan akun Anda." },
        status: 400,
      };
      throw err;
    }

    // Generate secure password hash
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    let userId = "usr-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);

    // Optional Supabase Auth background registration
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { data } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { name: cleanName } },
        });
        if (data?.session) {
          const r = await api.get("/auth/me");
          setAuth(data.session.access_token, r.data);
          setUser(r.data);
          return r.data;
        }
        if (data?.user?.id) {
          userId = data.user.id;
        }
      } catch (err) {
        console.warn("Supabase signup note:", err);
      }
    }

    const newAccount = {
      id: userId,
      email: cleanEmail,
      name: cleanName,
      password_hash: passwordHash,
      salt,
      created_at: new Date().toISOString(),
    };

    saveLocalAccount(newAccount);
    await saveCloudAccount(newAccount);

    const sessionUser = {
      id: newAccount.id,
      email: newAccount.email,
      name: newAccount.name,
      created_at: newAccount.created_at,
    };
    setAuth("wd-token-" + Date.now(), sessionUser);
    setUser(sessionUser);
    return sessionUser;
  };

  const logout = async () => {
    if (SUPABASE_ENABLED && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    clearAuth();
    setUser(null);
  };

  const demoLogin = async () => {
    const r = await api.post("/auth/demo");
    setAuth(r.data.token, r.data.user);
    setUser(r.data.user);
    return r.data.user;
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, demoLogin, supabaseMode: SUPABASE_ENABLED }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
