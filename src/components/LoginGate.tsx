import { useState, FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Lock } from "lucide-react";

export function LoginGate() {
  const { login } = useAuth();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!login(pw)) {
      setErr(true);
      setPw("");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Lock size={20} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Gyrucheia</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Private access. Enter your password to continue.
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-3">
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setErr(false);
            }}
            placeholder="Password"
            className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          {err && (
            <p className="text-center text-xs font-medium text-destructive">
              Incorrect password. Please try again.
            </p>
          )}
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Unlock
          </button>
        </form>

        <p className="mt-8 text-center text-[11px] uppercase tracking-wider text-muted-foreground">
          Single-user private library
        </p>
      </div>
    </div>
  );
}
