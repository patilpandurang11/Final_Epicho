"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminRankingsPage() {
  const [methodology, setMethodology] = useState<any>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);

  useEffect(() => {
    apiRequest("/rankings/methodology").then(setMethodology).catch(() => {});
    apiRequest("/rankings?category=restaurants").then(setRestaurants).catch(() => {});
    apiRequest("/rankings?category=recipes").then(setRecipes).catch(() => {});
  }, []);

  return (
    <AdminShell title="Ranking Audit & Integrity" subtitle="Verify Bayesian scoring parameters, anti-fraud protections, and organic leaderboards.">
      {methodology && (
        <Card>
          <CardHeader><CardTitle className="text-base">Bayesian Methodology</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="font-mono p-3 rounded-xl bg-[#F5F0E6] dark:bg-[#1A2D24]">{methodology.formula}</p>
            <p className="text-[#475569]">{methodology.paid_influence_policy}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Restaurant Leaderboard</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {restaurants.map((r, i) => (
              <div key={r.id} className="flex justify-between items-center text-xs p-2.5 rounded-xl border border-[#E7DFD3] dark:border-[#253D31]">
                <span>#{i + 1} <strong>{r.name}</strong> ({r.votes_count} votes)</span>
                <Badge variant="emerald">{r.bayesian_score}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recipe Leaderboard</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recipes.slice(0, 8).map((r, i) => (
              <div key={r.id} className="flex justify-between items-center text-xs p-2.5 rounded-xl border border-[#E7DFD3] dark:border-[#253D31]">
                <span className="truncate max-w-[230px]">#{i + 1} <strong>{r.name}</strong></span>
                <Badge variant="amber">{r.bayesian_score}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
