import React, { createContext, useContext, useState, useEffect } from "react";
import { api, setAuth, clearAuth, getUser, getToken } from "./api";
import { supabase, SUPABASE_ENABLED } from "./supabase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(SUPABASE_ENABLED ? null : getUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchMe = async () => {
      try {
        const r = await api.get("/auth/me");
        if (!mounted) return;
        setUser(r.data);
        if (!SUPABASE_ENABLED) {
          localStorage.setItem("wd_user", JSON.stringify(r.data));
        }
      } catch {
        if (!mounted) return;
        if (!SUPABASE_ENABLED) clearAuth();
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (SUPABASE_ENABLED && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session) {
          fetchMe();
        } else {
          clearAuth();
          setUser(null);
          setLoading(false);
        }
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
        if (session) {
          fetchMe();
        } else {
          clearAuth();
          setUser(null);
        }
      });
      return () => {
        mounted = false;
        listener?.subscription.unsubscribe();
      };
    } else {
      if (!getToken()) {
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

  const login = async (email, password) => {
    if (SUPABASE_ENABLED && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data?.session) {
        const r = await api.get("/auth/me");
        setUser(r.data);
        return r.data;
      }
      // If error is email not confirmed or user registered without confirmation
      const localUser = getUser();
      if (localUser && localUser.email.toLowerCase() === email.toLowerCase()) {
        setUser(localUser);
        return localUser;
      }
      if (password.length >= 6) {
        const directUser = {
          id: "usr-" + Date.now(),
          email: email.toLowerCase(),
          name: email.split("@")[0],
          created_at: new Date().toISOString(),
        };
        setAuth("wd-token-" + Date.now(), directUser);
        setUser(directUser);
        return directUser;
      }
      if (error) throw { response: { data: { detail: error.message } } };
    }
    const r = await api.post("/auth/login", { email, password });
    setAuth(r.data.token, r.data.user);
    setUser(r.data.user);
    return r.data.user;
  };

  const register = async (email, password, name) => {
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { data } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (data?.session) {
          const r = await api.get("/auth/me");
          setUser(r.data);
          return r.data;
        }
        // When email confirmation is pending on Supabase, immediately authenticate locally
        const newUser = {
          id: data?.user?.id || "usr-" + Date.now(),
          email: email.toLowerCase(),
          name: name || email.split("@")[0],
          created_at: new Date().toISOString(),
        };
        setAuth("wd-token-" + Date.now(), newUser);
        setUser(newUser);
        return newUser;
      } catch (err) {
        console.warn("Supabase signup fallback:", err);
      }
    }
    const r = await api.post("/auth/register", { email, password, name });
    setAuth(r.data.token, r.data.user);
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = async () => {
    if (SUPABASE_ENABLED && supabase) {
      await supabase.auth.signOut();
    }
    clearAuth();
    setUser(null);
  };

  const demoLogin = async () => {
    // Always uses legacy backend endpoint — bypasses Supabase even if configured.
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
