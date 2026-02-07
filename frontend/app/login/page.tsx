"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Login failed");
      return;
    }
    router.push(next);
  };

  return (
    <div className="min-h-screen bg-mesh px-6 py-20">
      <div className="mx-auto flex max-w-lg flex-col gap-8">
        <div className="glass rounded-3xl p-10">
          <div className="space-y-4">
            <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--accent)]">
              Shared Context
            </p>
            <h1 className="font-display text-4xl leading-tight text-[var(--ink)]">
              Sign in to continue
            </h1>
            <p className="text-[var(--muted)]">
              Use your access email and password to manage the shared context workspace.
            </p>
          </div>
          <form className="mt-8 space-y-5" onSubmit={submit}>
            <div className="space-y-2">
              <label className="text-sm text-[var(--muted)]">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[var(--muted)]">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="••••••••"
              />
            </div>
            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--ink)] px-4 py-3 font-display text-white transition hover:translate-y-[-1px]"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-[var(--muted)]">
          Need access? Ask your admin for credentials.
        </p>
      </div>
    </div>
  );
}
