"use client";

import { useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await apiRequest<{ message: string }>(
        "/auth/password-reset/request",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setMessage(response.message);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to request password recovery.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="space-y-5 rounded-3xl border border-[#F2E6E2] bg-white p-8 shadow-xl">
        <h1 className="text-center text-2xl font-black">Reset your password</h1>
        <p className="text-sm text-stone-600">
          Enter your account email. If it is registered, we will send a secure reset link.
        </p>
        {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1 text-sm font-semibold">
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 font-normal"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#9A3412] py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <Link href="/login" className="block text-center text-sm font-semibold text-[#9A3412] hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
