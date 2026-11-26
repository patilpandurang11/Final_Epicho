"use client";

import React, { useState } from "react";
import { Flame, Lock, Mail, User, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { login } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [diet, setDiet] = useState("veg");
  const [accountTier, setAccountTier] = useState("registered");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          username,
          email,
          password,
          diet_preference: diet,
          account_tier: accountTier
        })
      });
      login(res.access_token, res.user);
      window.location.href = "/feed";
    } catch (err: any) {
      setError(err.message || "Failed to register account.");
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
          <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
            {error}
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
              placeholder="Pankaj Patil"
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
              placeholder="pankajcooks"
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
              placeholder="pankaj@example.com"
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
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                Account Type
              </label>
              <select
                value={accountTier}
                onChange={(e) => setAccountTier(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none"
              >
                <option value="registered">Home Cook</option>
                <option value="creator">Food Creator</option>
                <option value="business">Restaurant / Brand</option>
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
