import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// Password is injected at build time from Vercel Environment Variables.
// Set VITE_APP_PASSWORD in your Vercel project dashboard:
//   Vercel Dashboard → Your Project → Settings → Environment Variables
// NEVER hardcode the password here — it would be visible in your GitHub repo.
const PASSWORD = import.meta.env.VITE_APP_PASSWORD ?? "";
const STORAGE_KEY = "gyrucheia.auth";

type AuthCtx = {
  isAuthed: boolean;
  login: (password: string) => boolean;
  logout: () => void;
  ready: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setIsAuthed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const login = (password: string) => {
    if (password === PASSWORD) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      setIsAuthed(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setIsAuthed(false);
  };

  return <Ctx.Provider value={{ isAuthed, login, logout, ready }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
