"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useAuth, type AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KeyRound, ShieldCheck } from "lucide-react";

interface AdminLoginResponse {
  access_token: string;
  refresh_token?: string | null;
  mfa_required?: boolean;
  mfa_challenge_token?: string | null;
  user?: AuthUser | null;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<AdminLoginResponse>("/auth/admin-login", {
        method: "POST",
        body: JSON.stringify({ email, password, mfa_code: mfaCode || undefined }),
      });
      if (res.mfa_required && res.mfa_challenge_token) {
        setChallengeToken(res.mfa_challenge_token);
        return;
      }
      if (!res.access_token || !res.refresh_token || !res.user) {
        throw new Error("The authentication response was incomplete. Please try again.");
      }
      login(res.access_token, res.refresh_token, res.user);
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<AdminLoginResponse>("/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ code: mfaCode, challenge_token: challengeToken }),
      });
      if (!res.access_token || !res.refresh_token || !res.user) {
        throw new Error("The authentication response was incomplete. Please try again.");
      }
      login(res.access_token, res.refresh_token, res.user);
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to verify MFA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <Card>
        <CardHeader className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#14281D] text-emerald-300 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">EpiCho Staff & Admin Portal</CardTitle>
          <p className="text-xs text-[#475569]">Authorized governance access with MFA & audit logging</p>
        </CardHeader>
        <CardContent>
          {error && <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">{error}</div>}
          {!challengeToken ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Staff Email</label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Password</label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter staff password" />
              </div>
              <Button type="submit" disabled={loading} className="w-full" variant="emerald">
                {loading ? "Authenticating..." : "Sign In to Admin Console"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 text-amber-900 text-xs font-medium flex items-center gap-2">
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>Enter the 6-digit TOTP verification code from your authenticator app.</span>
              </div>
              <Input required value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="6-digit code" maxLength={6} />
              <Button type="submit" disabled={loading} className="w-full" variant="emerald">
                Verify MFA & Continue
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
