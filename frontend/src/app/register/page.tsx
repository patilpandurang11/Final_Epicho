"use client";

import React, { useState } from "react";
import { Flame } from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [diet, setDiet] = useState("veg");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await apiRequest<{ message: string; email: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          username,
          email,
          password,
          diet_preference: diet,
        }),
      });
      setNotice(res.message);
      setCanResend(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to create your account.";
      setError(message);
      if (message.includes("verification email")) setCanResend(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ message: string }>("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setNotice(res.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to resend the verification link.");
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
          <h2 className="text-2xl font-black text-[#0F172A] tracking-tight">Create Your Account</h2>
          <p className="text-xs text-stone-500">Join the EpiCho community to discover, create, and connect.</p>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
            {notice}
            {canResend && (
              <button
                type="button"
                disabled={isLoading || !email}
                onClick={handleResendVerification}
                className="ml-2 underline disabled:opacity-50"
              >
                Resend link
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
              Username
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_]+"
              autoComplete="username"
              placeholder="cooking_name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
              placeholder="At least 12 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
            />
            <p className="mt-1 text-[11px] text-stone-500">
              Use at least 12 characters, including a letter and a number.
            </p>
          </div>

          <div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                Diet Preference
              </label>
              <select
                value={diet}
                onChange={(e) => setDiet(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none"
              >
                <option value="veg">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="non_veg">Non-Veg</option>
                <option value="eggetarian">Eggetarian</option>
                <option value="jain">Jain</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#802B0F] transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-[#9A3412]/20 mt-2"
          >
            {isLoading ? "Creating Account..." : "Create Account Free"}
          </button>
        </form>

        <p className="text-center text-xs text-stone-500">
          Already have an account?{" "}
          <a href="/login" className="font-bold text-[#9A3412] hover:underline">
            Sign In
          </a>
        </p>
      </div>
    </div>
  );
}
