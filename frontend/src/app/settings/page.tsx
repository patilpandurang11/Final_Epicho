"use client";

import React, { useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, KeyRound, Settings, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [mfaData, setMfaData] = useState<{ secret: string; provisioning_uri: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
        <Settings className="w-10 h-10 mx-auto text-[#059669]" />
        <h1 className="text-2xl font-bold">Sign in to manage settings</h1>
        <Link href="/login"><Button>Log In</Button></Link>
      </div>
    );
  }

  const handleSetupMfa = async () => {
    const res = await apiRequest("/auth/mfa/setup", { method: "POST" });
    setMfaData(res);
  };

  const handleEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/auth/mfa/enable", { method: "POST", body: JSON.stringify({ code: mfaCode }) });
      await refreshUser();
      setMsg("TOTP Multi-Factor Authentication is now enabled on your account.");
      setMfaData(null);
      setMfaCode("");
    } catch (err: any) {
      setMsg(err.message);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest("/admin/tickets", {
      method: "POST",
      body: JSON.stringify({ subject: ticketSubject, description: ticketDesc, category: "account" }),
    });
    setTicketSubject("");
    setTicketDesc("");
    setMsg("Support ticket submitted to EpiCho Customer Support.");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Settings className="w-7 h-7 text-[#059669]" /> Account & Security Settings
      </h1>

      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          {msg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-[#EA580C]" /> Multi-Factor Authentication (TOTP)</span>
            <Badge variant={user.mfa_enabled ? "emerald" : "outline"}>
              {user.mfa_enabled ? "Enabled" : "Not Enabled"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-[#475569] dark:text-[#A7B8AE]">
            Protect your account (required for administrative staff operations) with any RFC 6238 authenticator app.
          </p>
          {!mfaData ? (
            <Button onClick={handleSetupMfa} variant="emerald" size="sm">
              <ShieldCheck className="w-4 h-4" /> Generate MFA Secret
            </Button>
          ) : (
            <form onSubmit={handleEnableMfa} className="space-y-3 p-4 rounded-xl bg-[#F5F0E6] dark:bg-[#1A2D24]">
              <p className="text-xs font-bold">Secret Key: <code className="px-2 py-0.5 bg-white dark:bg-black rounded">{mfaData.secret}</code></p>
              <p className="text-[11px] break-all text-[#475569]">URI: {mfaData.provisioning_uri}</p>
              <div className="flex gap-2">
                <Input required value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} />
                <Button type="submit" size="sm">Verify & Enable</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#9A3412]" /> Contact Customer Support
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitTicket} className="space-y-3">
            <Input required value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} placeholder="Subject (e.g., Verification question or billing)" />
            <Textarea required value={ticketDesc} onChange={(e) => setTicketDesc(e.target.value)} placeholder="Describe how our team can help..." />
            <Button type="submit" variant="primary" size="sm">Submit Support Ticket</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
