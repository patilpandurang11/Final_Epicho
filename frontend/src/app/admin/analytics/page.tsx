"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card } from "@/components/ui/card";

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    apiRequest("/admin/stats").then(setStats).catch(() => {});
  }, []);

  return (
    <AdminShell title="Platform Analytics" subtitle="Live culinary ecosystem KPIs across recipes, Reels, AI Kitchen, and subscriptions.">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: stats.total_users },
            { label: "Active Creators", value: stats.active_creators },
            { label: "Businesses", value: stats.total_businesses },
            { label: "Recipes", value: stats.total_recipes },
            { label: "Reels", value: stats.total_reels },
            { label: "Social Posts", value: stats.total_posts },
            { label: "AI Generations", value: stats.total_ai_requests },
            { label: "Active Subscriptions", value: stats.active_subscriptions },
          ].map((k) => (
            <Card key={k.label} className="p-5">
              <p className="text-xs font-bold text-[#475569]">{k.label}</p>
              <p className="text-3xl font-bold text-[#059669] mt-1">{k.value}</p>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
