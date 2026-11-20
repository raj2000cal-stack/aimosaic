"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AuthForm({ mode, inviteRequired = false }: { mode: "login" | "signup"; inviteRequired?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, inviteCode }),
      });
      if (res.ok) {
        router.push("/app");
        return;
      }
      const j = await res.json().catch(() => ({}));
      setError(j.message ?? "Something went wrong. Please try again.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
  }

  const field = "mt-1.5 w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none focus:border-indigo-brand";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          AI<span className="text-gold-ink">Mosaic</span>
        </Link>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">{signup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-muted">
          {signup ? "One workspace for every leading AI model." : "Sign in to your workspace."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-3xl border border-line bg-surface p-6">
          <label className="block text-sm font-medium">
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              required
              minLength={signup ? 10 : undefined}
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
            {signup && <span className="mt-1 block text-xs font-normal text-muted">At least 10 characters.</span>}
          </label>
          {signup && inviteRequired && (
            <label className="block text-sm font-medium">
              Invite code
              <input type="text" required value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} className={field} />
              <span className="mt-1 block text-xs font-normal text-muted">AIMosaic is in private beta.</span>
            </label>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-on-gold disabled:opacity-50">
            {busy ? "Please wait" : signup ? "Create account" : "Sign in"}
          </button>
          {signup && (
            <p className="text-xs text-muted">
              By creating an account you agree to the draft{" "}
              <Link href="/terms" className="underline">Terms</Link> and{" "}
              <Link href="/privacy" className="underline">Privacy Policy</Link>.
            </p>
          )}
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {signup ? "Already have an account? " : "New to AIMosaic? "}
          <Link href={signup ? "/login" : "/signup"} className="font-medium text-indigo-brand hover:underline">
            {signup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </main>
  );
}
