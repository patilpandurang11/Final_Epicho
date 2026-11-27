"use client";

import { useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError("This password reset link is missing its token.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await apiRequest<{ message: string }>(
        "/auth/password-reset/confirm",
        {
          method: "POST",
          body: JSON.stringify({ token, new_password: password }),
        },
      );
      setMessage(response.message);
      setPassword("");
      setConfirmation("");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to reset your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="space-y-5 rounded-3xl border border-[#F2E6E2] bg-white p-8 shadow-xl">
        <h1 className="text-center text-2xl font-black">Choose a new password</h1>
        {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1 text-sm font-semibold">
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={72}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 font-normal"
            />
          </label>
          <label className="block space-y-1 text-sm font-semibold">
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={72}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full rounded-xl border border-stone-300 px-4 py-3 font-normal"
            />
          </label>
          <p className="text-xs text-stone-500">Use at least 12 characters, including a letter and a number.</p>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#9A3412] py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? "Updating..." : "Reset password"}
          </button>
        </form>
        <Link href="/login" className="block text-center text-sm font-semibold text-[#9A3412] hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
