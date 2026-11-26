"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminTechnicalPage() {
  const [tech, setTech] = useState<any>(null);

  useEffect(() => {
    apiRequest("/admin/technical").then(setTech).catch(() => {});
  }, []);

  return (
    <AdminShell title="Technical & AI Infrastructure" subtitle="Monitor PostgreSQL, Redis, Gemini AI latency, and storage configuration.">
      {tech && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-xs text-[#475569]">Environment</p>
              <p className="text-lg font-bold mt-1 uppercase">{tech.environment}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[#475569]">Redis Cache</p>
              <Badge variant={tech.redis_connected ? "emerald" : "amber"} className="mt-2">
                {tech.redis_connected ? "Connected" : "In-Memory Fallback"}
              </Badge>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[#475569]">Gemini AI Provider</p>
              <Badge variant={tech.gemini_configured ? "emerald" : "outline"} className="mt-2">
                {tech.gemini_configured ? "Live API Key Active" : "Deterministic Fallback"}
              </Badge>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[#475569]">Razorpay Gateway</p>
              <Badge variant={tech.razorpay_configured ? "emerald" : "amber"} className="mt-2">
                {tech.razorpay_configured ? "Live Secret Active" : "Sandbox Mode"}
              </Badge>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent AI Kitchen Requests & Latency</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {tech.recent_ai_latency?.map((a: any) => (
                <div key={a.request_id} className="flex justify-between items-center p-2.5 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] text-xs">
                  <span><strong>{a.type}</strong> • {a.latency_ms ?? 0}ms</span>
                  <div className="flex gap-2">
                    <Badge variant={a.allergen_check_passed ? "emerald" : "amber"}>
                      {a.allergen_check_passed ? "Allergen Safe" : "Allergen Swapped"}
                    </Badge>
                    {a.flagged_unsafe && <Badge variant="destructive">Flagged</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </AdminShell>
  );
}
