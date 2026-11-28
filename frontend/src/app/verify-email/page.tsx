"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

export default function VerifyEmailPage() {
  const [message, setMessage] = useState("Verifying your email link...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError("This verification link is missing its token.");
      return () => {
        active = false;
      };
    }

    apiRequest<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((response) => {
        if (active) setMessage(response.message);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Unable to verify this email.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      {error ? (
        <p role="alert" className="mb-4 text-sm font-semibold text-red-700">{error}</p>
      ) : (
        <p role="status" className="mb-4 text-sm font-semibold">{message}</p>
      )}
      <Link href="/login" className="font-bold text-[#9A3412] hover:underline">
        Continue to sign in
      </Link>
    </div>
  );
}
