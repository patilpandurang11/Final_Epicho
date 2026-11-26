"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminFinancePage() {
  const [data, setData] = useState<any>({ total_revenue_inr: 0, total_refunded_inr: 0, payments: [], plans: [] });
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    apiRequest("/admin/finance").then((res) => {
      setData(res);
      const map: Record<string, string> = {};
      res.plans?.forEach((p: any) => { map[p.plan_id] = String(p.price); });
      setPrices(map);
    }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const savePrice = async (planId: string) => {
    await apiRequest(`/admin/plans/${planId}`, {
      method: "PATCH",
      body: JSON.stringify({ price: Number(prices[planId] || 0) }),
    });
    setMsg("Plan pricing updated.");
    load();
  };

  const refund = async (paymentId: string) => {
    await apiRequest(`/admin/payments/${paymentId}/refund`, { method: "POST" });
    setMsg("Payment refunded.");
    load();
  };

  return (
    <AdminShell title="Finance & Subscription Pricing" subtitle="Track revenue, issue refunds, and configure subscription plan pricing.">
      {msg && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">{msg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-xs font-bold text-[#475569]">Total Paid Revenue</p>
          <p className="text-3xl font-bold text-[#059669] mt-1">₹{data.total_revenue_inr}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-[#475569]">Total Refunded</p>
          <p className="text-3xl font-bold text-red-600 mt-1">₹{data.total_refunded_inr}</p>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Configurable Plan Pricing (INR / month)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.plans?.map((pl: any) => (
            <div key={pl.plan_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-[#E7DFD3] dark:border-[#253D31]">
              <span className="font-bold text-sm">{pl.name}</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={prices[pl.plan_id] ?? pl.price}
                  onChange={(e) => setPrices({ ...prices, [pl.plan_id]: e.target.value })}
                  className="w-28"
                />
                <Button size="sm" variant="emerald" onClick={() => savePrice(pl.plan_id)}>Update</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Transactions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments?.map((p: any) => (
                <TableRow key={p.payment_id}>
                  <TableCell className="text-xs">{p.user_email}</TableCell>
                  <TableCell className="text-xs font-semibold">{p.plan_name}</TableCell>
                  <TableCell>₹{p.amount}</TableCell>
                  <TableCell><Badge variant={p.status === "paid" ? "emerald" : "destructive"}>{p.status}</Badge></TableCell>
                  <TableCell>
                    {p.status === "paid" && (
                      <Button size="sm" variant="outline" onClick={() => refund(p.payment_id)}>Refund</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
