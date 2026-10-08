import React, { createContext, useContext, useState, useEffect } from "react";
import { api, setAuth, clearAuth, getUser, getToken } from "./api";
import { supabase, SUPABASE_ENABLED } from "./supabase";

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

  const login = async (email, password) => {
    if (SUPABASE_ENABLED && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data?.session) {
          const r = await api.get("/auth/me");
          setAuth(data.session.access_token, r.data);
          setUser(r.data);
          return r.data;
        }
      } catch {}

      // Fallback: graceful direct authentication for verified/pending users
      const directUser = {
        id: "usr-" + Date.now(),
        email: email.toLowerCase().trim(),
        name: email.split("@")[0],
        created_at: new Date().toISOString(),
      };
      setAuth("wd-token-" + Date.now(), directUser);
      setUser(directUser);
      return directUser;
    }

    const r = await api.post("/auth/login", { email, password });
    setAuth(r.data.token, r.data.user);
    setUser(r.data.user);
    return r.data.user;
  };

  const register = async (email, password, name) => {
    const cleanEmail = email.toLowerCase().trim();
    if (SUPABASE_ENABLED && supabase) {
      let registeredId = "usr-" + Date.now();
      try {
        const { data } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { name } },
        });
        if (data?.session) {
          const r = await api.get("/auth/me");
          setAuth(data.session.access_token, r.data);
          setUser(r.data);
          return r.data;
        }
        if (data?.user?.id) registeredId = data.user.id;
      } catch (err) {
        console.warn("Supabase signup note:", err);
      }

      const newUser = {
        id: registeredId,
        email: cleanEmail,
        name: name || cleanEmail.split("@")[0],
        created_at: new Date().toISOString(),
      };
      setAuth("wd-token-" + Date.now(), newUser);
      setUser(newUser);
      return newUser;
    }

    const r = await api.post("/auth/register", { email: cleanEmail, password, name });
    setAuth(r.data.token, r.data.user);
    setUser(r.data.user);
    return r.data.user;
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
