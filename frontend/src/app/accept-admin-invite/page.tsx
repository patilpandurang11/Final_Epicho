"use client";

import { useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

export default function AcceptAdminInvitePage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError("This invitation link is missing its token.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await apiRequest<{ message: string }>(
        "/auth/admin-invite/accept",
        {
          method: "POST",
          body: JSON.stringify({ token, email, full_name: fullName, username, password }),
        },
      );
      setMessage(response.message);
      setPassword("");
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : "Unable to accept this invitation.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="space-y-5 rounded-3xl border border-[#F2E6E2] bg-white p-8 shadow-xl">
        <h1 className="text-center text-2xl font-black">Accept your staff invitation</h1>
        {message && (
          <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {!message && (
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1 text-sm font-semibold">
              Full name
              <input
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-3 font-normal"
              />
            </label>
            <label className="block space-y-1 text-sm font-semibold">
              Username
              <input
                autoComplete="username"
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9_]+"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-3 font-normal"
              />
            </label>
            <label className="block space-y-1 text-sm font-semibold">
              Invited email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-stone-300 px-4 py-3 font-normal"
              />
            </label>
            <label className="block space-y-1 text-sm font-semibold">
              Password
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
            <p className="text-xs text-stone-500">
              Use at least 12 characters, including a letter and a number.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#166534] py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create staff account"}
            </button>
          </form>
        )}
        <Link
          href="/admin/login"
          className="block text-center text-sm font-semibold text-[#166534] hover:underline"
        >
          Go to administrative sign in
        </Link>
      </div>
    </div>
  );
}
