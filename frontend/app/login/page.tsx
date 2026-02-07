"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from 'next/link';
import Navbar from '@/components/Navbar';

import { Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResend = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResendSuccess(true);
        setError("Confirmation email sent! Please check your inbox.");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to resend confirmation");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setResendLoading(false);
    }
  };

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

    // Use window.location for a hard redirect to ensure the session cookie is correctly picked up
    // and to bypass any potential state-hanging with router.push in complex auth flows.
    window.location.href = next;
  };

  return (
    <div className="w-full max-w-[400px]">
      <div className="text-center mb-12 mix-blend-difference drop-shadow-[0_2px_40px_rgba(0,0,0,1)]">
        <h1 className="text-3xl font-medium tracking-tight mb-2 lowercase">welcome back</h1>
        <p className="text-[11px] text-white/70 font-semibold uppercase tracking-[0.2em] lowercase">access your axis context</p>
      </div>

      <div className="bg-[#0D0D0D]/40 backdrop-blur-xl border border-white/5 p-8 rounded">
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-mono text-white/30 uppercase tracking-[0.2em] mb-2 lowercase opacity-40">email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/5 rounded px-4 py-3 outline-none focus:border-white/10 transition-colors text-sm lowercase"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-white/30 uppercase tracking-[0.2em] mb-2 lowercase opacity-40">password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/5 rounded px-4 py-3 outline-none focus:border-white/10 transition-colors text-sm pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-rose-500 text-[12px] font-mono bg-rose-500/5 border border-rose-500/10 p-3 rounded flex flex-col gap-2">
              <span>{error}</span>
              {error === "Email not confirmed" && !resendSuccess && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="text-xs underline hover:text-rose-400 self-start"
                >
                  {resendLoading ? "Sending..." : "Resend confirmation email"}
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-nia-primary !tracking-[0.3em] uppercase py-4 lowercase font-bold"
          >
            {loading ? 'signing in...' : 'sign in'}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-white/5 text-center relative z-20">
          <p className="text-[12px] text-white/30 lowercase">
            don&apos;t have an account?{' '}
            <Link href="/signup" className="text-white hover:underline lowercase relative z-30 pointer-events-auto">
              create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white/10 tracking-tight lowercase">
      <div className="bg-avalanche pointer-events-none fixed inset-0 z-[0]" />
      <Navbar />
      <main className="pt-40 flex flex-col items-center justify-center px-6 relative z-10 lowercase">
        <div className="absolute inset-0 z-[-1] bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.4)_0%,transparent_70%)] pointer-events-none" />
        <Suspense fallback={<div className="font-mono text-[10px] text-white/20 uppercase tracking-[0.3em] lowercase">loading session...</div>}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
