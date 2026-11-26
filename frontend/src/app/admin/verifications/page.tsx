"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminVerificationsPage() {
  const [data, setData] = useState<any>({ businesses: [], nutritionists: [], requests: [] });
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => apiRequest("/admin/verifications").then(setData).catch(() => {});
  useEffect(() => { load(); }, []);

  const review = async (id: string, entityType: string, status: "verified" | "rejected") => {
    await apiRequest(`/admin/verifications/${id}/review?entity_type=${entityType}`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    setMsg(`Marked ${entityType} as ${status}.`);
    load();
  };

  return (
    <AdminShell title="Verification Management" subtitle="Review credentials for Creators, FSSAI Businesses, Nutritionists, and Food Critics.">
      {msg && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">{msg}</div>}

      <Card>
        <CardHeader><CardTitle className="text-base">Role Verification Applications ({data.requests?.length || 0})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.requests?.length === 0 ? <p className="text-xs text-[#475569]">No pending role applications.</p> : data.requests.map((r: any) => (
            <div key={r.id} className="p-3 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <p className="font-bold text-sm">{r.user_name} — <span className="capitalize">{r.target_role}</span></p>
                <p className="text-xs text-[#475569]">Ref: {r.document_reference}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.status === "verified" ? "emerald" : "amber"}>{r.status}</Badge>
                <Button size="sm" variant="emerald" onClick={() => review(r.id, "request", "verified")}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => review(r.id, "request", "rejected")}>Reject</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Businesses & Restaurants ({data.businesses?.length || 0})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.businesses?.map((b: any) => (
            <div key={b.id} className="p-3 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <p className="font-bold text-sm">{b.name}</p>
                <p className="text-xs text-[#475569]">FSSAI: {b.fssai_license_no || "N/A"} • {b.address}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={b.status === "verified" ? "emerald" : "amber"}>{b.status}</Badge>
                <Button size="sm" variant="emerald" onClick={() => review(b.id, "business", "verified")}>Verify</Button>
                <Button size="sm" variant="outline" onClick={() => review(b.id, "business", "rejected")}>Reject</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Nutritionists ({data.nutritionists?.length || 0})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.nutritionists?.map((n: any) => (
            <div key={n.id} className="p-3 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <p className="font-bold text-sm">{n.name}</p>
                <p className="text-xs text-[#475569]">{n.credentials}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={n.status === "verified" ? "emerald" : "amber"}>{n.status}</Badge>
                <Button size="sm" variant="emerald" onClick={() => review(n.id, "nutritionist", "verified")}>Verify</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
