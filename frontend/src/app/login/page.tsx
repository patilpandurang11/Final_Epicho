"use client";

import React, { useState } from "react";
import { Flame, Lock, Mail, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      login(res.access_token, res.user);
      window.location.href = res.user.account_tier === "admin" ? "/admin/dashboard" : "/feed";
    } catch (err: any) {
      setError(err.message || "Invalid credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickDemo = (demoEmail: string, demoPw: string) => {
    setEmail(demoEmail);
    setPassword(demoPw);
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
          <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="you@epicho.com"
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
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#802B0F] transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-[#9A3412]/20"
          >
            {isLoading ? "Signing in..." : "Log In to EpiCho"}
          </button>
        </form>

        {/* Demo Roles Quick Fill */}
        <div className="pt-4 border-t border-stone-100 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block text-center">
            Instant Test Demo Logins:
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => fillQuickDemo("admin@epicho.com", "AdminSecret123!")}
              className="p-2 rounded-lg bg-red-50 text-red-900 border border-red-200 font-bold hover:bg-red-100 text-left truncate"
            >
              🛡️ Super Admin
            </button>
            <button
              type="button"
              onClick={() => fillQuickDemo("pandurang@epicho.com", "Password123!")}
              className="p-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-bold hover:bg-amber-100 text-left truncate"
            >
              🎬 Verified Creator
            </button>
            <button
              type="button"
              onClick={() => fillQuickDemo("chef.sanjeev@epicho.com", "ChefSecret123!")}
              className="p-2 rounded-lg bg-stone-100 text-stone-900 border border-stone-200 font-bold hover:bg-stone-200 text-left truncate"
            >
              👨‍🍳 Master Chef
            </button>
            <button
              type="button"
              onClick={() => fillQuickDemo("dr.anita@epicho.com", "DoctorSecret123!")}
              className="p-2 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold hover:bg-emerald-100 text-left truncate"
            >
              🩺 Nutritionist
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-stone-500">
          Don't have an account yet?{" "}
          <a href="/register" className="font-bold text-[#9A3412] hover:underline">
            Register free
          </a>
        </p>
      </div>
    </div>
  );
}
