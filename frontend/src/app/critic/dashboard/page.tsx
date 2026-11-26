"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Star, Trophy, UtensilsCrossed } from "lucide-react";

export default function CriticDashboardPage() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [criticLeaderboard, setCriticLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    apiRequest("/restaurants?limit=6").then(setRestaurants).catch(() => {});
    apiRequest("/rankings?category=critics").then(setCriticLeaderboard).catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Badge variant="amber">
            <Award className="w-3.5 h-3.5" /> Food Critic & Reviewer Studio
          </Badge>
          <h1 className="text-3xl font-bold mt-2">Critic Dashboard</h1>
          <p className="text-sm text-[#475569] dark:text-[#A7B8AE]">
            Publish weighted restaurant & recipe reviews, track critic authority score, and audit rankings.
          </p>
        </div>
        <Link href="/rankings">
          <Button variant="outline"><Trophy className="w-4 h-4" /> View Rankings</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs font-bold text-[#475569]">Vote Signal Weight</p>
          <p className="text-2xl font-bold text-[#059669] mt-1">{user?.is_verified ? "2.0x Critic" : "1.0x Standard"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-[#475569]">Verification Status</p>
          <p className="text-2xl font-bold mt-1">{user?.is_verified ? "Verified Critic" : "Pending Review"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold text-[#475569]">Eligible Venues</p>
          <p className="text-2xl font-bold mt-1">{restaurants.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UtensilsCrossed className="w-4 h-4 text-[#EA580C]" /> Restaurants Ready for Critic Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {restaurants.map((r) => (
              <div key={r.business_id} className="flex items-center justify-between p-3 rounded-xl border border-[#E7DFD3] dark:border-[#253D31]">
                <div>
                  <p className="font-bold text-sm">{r.business_name}</p>
                  <p className="text-xs text-[#475569]">{r.cuisine_type} • {r.address}</p>
                </div>
                <Link href={`/restaurants/${r.business_id}`}>
                  <Button size="sm" variant="primary">Review</Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="w-4 h-4 text-amber-500" /> Top Approved Food Critics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticLeaderboard.map((c, idx) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-[#F5F0E6]/60 dark:bg-[#1A2D24]">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-[#9A3412]">#{idx + 1}</span>
                  <div>
                    <p className="font-bold text-sm">{c.name}</p>
                    <p className="text-xs text-[#475569]">{c.badge}</p>
                  </div>
                </div>
                <Badge variant="emerald">{c.bayesian_score}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
