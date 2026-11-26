"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminHiddenGemsPage() {
  const [gems, setGems] = useState<any[]>([]);
  const [cycleDays, setCycleDays] = useState("2");
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    apiRequest("/rankings/hidden-gems").then(setGems).catch(() => {});
    apiRequest("/admin/technical").then((t) => {
      if (t.configs?.hidden_gems_cycle_days) setCycleDays(t.configs.hidden_gems_cycle_days);
    }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const saveCycle = async () => {
    await apiRequest("/admin/config", {
      method: "PUT",
      body: JSON.stringify({ configs: { hidden_gems_cycle_days: cycleDays } }),
    });
    setMsg(`Hidden Gems selection frequency set to every ${cycleDays} day(s).`);
  };

  const triggerCycle = async () => {
    const res = await apiRequest("/admin/hidden-gems/cycle", { method: "POST" });
    setMsg(res.message);
    load();
  };

  return (
    <AdminShell title="Hidden Gems Management" subtitle="Configure 2-day or monthly selection cycles and rotate featured gems.">
      {msg && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">{msg}</div>}

      <Card>
        <CardHeader><CardTitle className="text-base">Selection Frequency Configuration</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <select
            value={cycleDays}
            onChange={(e) => setCycleDays(e.target.value)}
            className="h-10 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#0D1511] px-3 text-sm"
          >
            <option value="2">Every 2 Days (Default)</option>
            <option value="30">Monthly (30 Days)</option>
          </select>
          <Button onClick={saveCycle} variant="primary" size="sm">Save Frequency</Button>
          <Button onClick={triggerCycle} variant="emerald" size="sm">Rotate Hidden Gems Now</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Currently Active Hidden Gems</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {gems.map((g) => (
            <div key={g.gem_id} className="p-3.5 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] flex justify-between items-center">
              <div>
                <p className="font-bold text-sm">{g.title}</p>
                <p className="text-xs text-[#475569]">{g.entity_type.toUpperCase()} • {g.cuisine}</p>
              </div>
              <Badge variant="amber">Score {Number(g.gem_score).toFixed(2)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
