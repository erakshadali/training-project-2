"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { SessionUser } from "@/lib/auth";

type ApiResult = { ok: true } | { ok: false; error: string; fields?: Record<string, string> };

type AuthValue = {
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<ApiResult>;
  register: (input: { name: string; email: string; phone: string; password: string }) => Promise<ApiResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export function AuthProvider({ initialUser, children }: { initialUser: SessionUser | null; children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);

  const login = useCallback<AuthValue["login"]>(async (email, password) => {
    const { res, data } = await post("/api/auth/login", { email, password });
    if (!res.ok) return { ok: false, error: data.error ?? "Could not log in.", fields: data.fields };
    setUser(data.user);
    return { ok: true };
  }, []);

  const register = useCallback<AuthValue["register"]>(async (input) => {
    const { res, data } = await post("/api/auth/register", input);
    if (!res.ok) return { ok: false, error: data.error ?? "Could not create your account.", fields: data.fields };
    setUser(data.user);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await post("/api/auth/logout");
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
