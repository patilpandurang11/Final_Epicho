"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Lock, Mail, KeyRound } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth, type AuthUser } from "@/lib/auth";

interface LoginResponse {
  access_token: string;
  refresh_token?: string | null;
  mfa_required?: boolean;
  mfa_challenge_token?: string | null;
  user?: AuthUser | null;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishLogin = (res: LoginResponse) => {
    if (!res.access_token || !res.refresh_token || !res.user) {
      throw new Error("The authentication response was incomplete. Please try again.");
    }
    login(res.access_token, res.refresh_token, res.user);
    const requestedPath = new URLSearchParams(window.location.search).get("next");
    const adminRoles = new Set([
      "super_admin",
      "sysadmin",
      "infra_admin",
      "tech_admin",
      "content_moderator",
      "moderator",
      "verification_admin",
      "bizadmin",
      "ranking_admin",
      "finance_admin",
      "finance",
      "customer_support",
      "analytics_admin",
    ]);
    let safePath = res.user.roles.some((role) => adminRoles.has(role.toLowerCase()))
      ? "/admin/dashboard"
      : "/feed";
    if (requestedPath) {
      try {
        const target = new URL(requestedPath, window.location.origin);
        if (
          target.origin === window.location.origin &&
          target.pathname !== "/login" &&
          target.pathname !== "/register"
        ) {
          safePath = `${target.pathname}${target.search}${target.hash}`;
        }
      } catch {
        // Keep the role-appropriate default for malformed redirect targets.
      }
    }
    router.replace(safePath);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (res.mfa_required && res.mfa_challenge_token) {
        setChallengeToken(res.mfa_challenge_token);
        setMfaCode("");
        return;
      }
      finishLogin(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest<LoginResponse>("/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({
          code: mfaCode,
          challenge_token: challengeToken,
        }),
      });
      finishLogin(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to verify MFA.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#F2E6E2] shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#9A3412] to-[#C2410C] flex items-center justify-center text-white mx-auto shadow-md">
            <Flame className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-[#0F172A] tracking-tight">Welcome to EpiCho</h2>
          <p className="text-xs text-stone-500">Sign in to your culinary account to continue cooking.</p>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
            {error}
          </div>
        )}

        {!challengeToken ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
                />
              </div>
            </div>

            <div className="text-right">
              <a href="/forgot-password" className="text-xs font-semibold text-[#9A3412] hover:underline">
                Forgot password?
              </a>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#802B0F] transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-[#9A3412]/20"
            >
              {isLoading ? "Signing in..." : "Log In to EpiCho"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfaVerify} className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4" />
              Enter the six-digit code from your authenticator app.
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm tracking-widest"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-[#9A3412] text-white font-bold text-xs disabled:opacity-60"
            >
              {isLoading ? "Verifying..." : "Verify and sign in"}
            </button>
            <button
              type="button"
              className="w-full text-xs font-semibold text-stone-600"
              onClick={() => {
                setChallengeToken(null);
                setMfaCode("");
                setError(null);
              }}
            >
              Back to password
            </button>
          </form>
        )}

        <p className="text-center text-xs text-stone-500">
          Don&apos;t have an account yet?{" "}
          <a href="/register" className="font-bold text-[#9A3412] hover:underline">
            Register free
          </a>
        </p>
      </div>
    </div>
  );
}
