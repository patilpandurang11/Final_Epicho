"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminModerationPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("open");

  const load = () => {
    apiRequest(`/admin/moderation?status_filter=${statusFilter}`).then(setReports).catch(() => {});
  };
  useEffect(() => { load(); }, [statusFilter]);

  const takeAction = async (id: string, action: string) => {
    await apiRequest(`/admin/moderation/${id}/action`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    load();
  };

  return (
    <AdminShell title="Content Moderation" subtitle="Review flagged recipes, posts, Reels, blogs, and unsafe AI outputs.">
      <div className="flex gap-2">
        {["open", "resolved", "dismissed"].map((s) => (
          <Button key={s} size="sm" variant={statusFilter === s ? "primary" : "outline"} onClick={() => setStatusFilter(s)}>
            {s.toUpperCase()}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Moderation Queue ({reports.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {reports.length === 0 ? (
            <p className="text-sm text-[#475569]">No reports in &ldquo;{statusFilter}&rdquo; queue.</p>
          ) : (
            reports.map((r) => (
              <div key={r.report_id} className="p-4 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] flex flex-col sm:flex-row justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="amber">{r.target_type}</Badge>
                    <span className="text-xs font-semibold">Reported by {r.reporter_name}</span>
                  </div>
                  <p className="text-sm">{r.reason}</p>
                </div>
                {statusFilter === "open" && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="destructive" onClick={() => takeAction(r.report_id, "remove_content")}>Remove Content</Button>
                    <Button size="sm" variant="outline" onClick={() => takeAction(r.report_id, "dismiss")}>Dismiss</Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
