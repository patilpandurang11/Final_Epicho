"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Crown, FileText, Sparkles } from "lucide-react";

export default function SubscriptionsPage() {
  const { user, refreshUser } = useAuth();
  const [statusData, setStatusData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [invoice, setInvoice] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    if (!user) return;
    apiRequest("/subscriptions/status").then(setStatusData).catch(() => {});
    apiRequest("/subscriptions/history").then(setHistory).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleCancel = async () => {
    try {
      const res = await apiRequest("/subscriptions/cancel", { method: "POST" });
      setMsg(res.message);
      await refreshUser();
      load();
    } catch (err: any) {
      setMsg(err.message);
    }
  };

  const viewInvoice = async (invoiceId: string) => {
    const inv = await apiRequest(`/subscriptions/invoices/${invoiceId}`);
    setInvoice(inv);
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
        <Crown className="w-10 h-10 mx-auto text-amber-500" />
        <h1 className="text-2xl font-bold">Sign in to manage subscriptions</h1>
        <Link href="/login"><Button>Log In</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Crown className="w-7 h-7 text-amber-500" /> Subscription Management
          </h1>
          <p className="text-sm text-[#475569] dark:text-[#A7B8AE]">Manage your EpiCho membership, AI quotas, and GST invoices.</p>
        </div>
        <Link href="/pricing">
          <Button variant="emerald">
            <Sparkles className="w-4 h-4" /> Change / Upgrade Plan
          </Button>
        </Link>
      </div>

      {msg && <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">{msg}</div>}

      {statusData && (
        <Card>
          <CardContent className="pt-6 flex flex-col sm:flex-row justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{statusData.plan_name}</h2>
                <Badge variant={statusData.has_active_subscription ? "emerald" : "outline"}>
                  {statusData.has_active_subscription ? "Active" : "Free"}
                </Badge>
              </div>
              <p className="text-xs text-[#475569]">
                AI Kitchen Today: {statusData.ai_used_today} / {statusData.ai_limit_per_day} generations
                {statusData.end_date && ` • Renews/Ends: ${statusData.end_date}`}
              </p>
              <ul className="text-xs space-y-1 pt-1">
                {statusData.features?.map((f: string) => <li key={f}>• {f}</li>)}
              </ul>
            </div>
            {statusData.has_active_subscription && (
              <Button onClick={handleCancel} variant="destructive" size="sm" className="self-start">
                Cancel Subscription
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {invoice && (
        <Card className="border-emerald-400">
          <CardHeader><CardTitle className="text-base">GST Invoice: {invoice.invoice_number}</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            <p>Taxable Amount: ₹{invoice.amount_inr}</p>
            <p>GST (18%): ₹{invoice.gst_inr}</p>
            <p className="font-bold text-sm">Total Paid: ₹{invoice.total_inr}</p>
            <p className="text-[#475569]">Issued: {new Date(invoice.issued_at).toLocaleString()}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Payment & Invoice History</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-[#475569]">No subscription payments recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((p) => (
                  <TableRow key={p.payment_id}>
                    <TableCell className="font-semibold">{p.plan_name}</TableCell>
                    <TableCell>₹{p.amount}</TableCell>
                    <TableCell><Badge variant="emerald">{p.status}</Badge></TableCell>
                    <TableCell>
                      {p.invoice_id && (
                        <Button onClick={() => viewInvoice(p.invoice_id)} variant="ghost" size="sm">
                          <FileText className="w-3.5 h-3.5" /> {p.invoice_number}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
