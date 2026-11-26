"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Gem, History, Sparkles, UtensilsCrossed } from "lucide-react";

export default function HiddenGemsPage() {
  const [activeGems, setActiveGems] = useState<any[]>([]);
  const [archive, setArchive] = useState<any[]>([]);

  useEffect(() => {
    apiRequest("/rankings/hidden-gems").then(setActiveGems).catch(() => {});
    apiRequest("/rankings/hidden-gems/archive").then(setArchive).catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="space-y-3">
        <Badge variant="amber">
          <Gem className="w-3.5 h-3.5" /> Rotating Every 2 Days
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-bold">EpiCho Hidden Gems</h1>
        <p className="text-sm text-[#475569] dark:text-[#A7B8AE] max-w-2xl">
          Surfacing high-quality, under-discovered dishes and independent restaurants using exposure-normalized quality scoring with 30-day cooldown fairness.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {activeGems.map((g) => (
          <Card key={g.gem_id} className="overflow-hidden border-2 border-amber-400/50">
            <img src={g.image_url} alt={g.title} className="w-full h-56 object-cover" />
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="amber">
                  <Sparkles className="w-3 h-3" /> {g.badge}
                </Badge>
                <span className="text-xs font-bold text-[#059669] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {g.cycle_remaining_hours ?? 36}h left
                </span>
              </div>
              <h2 className="text-2xl font-bold">{g.title}</h2>
              <p className="text-sm text-[#475569] dark:text-[#A7B8AE]">{g.description}</p>
              <div className="flex items-center justify-between pt-2 text-xs font-semibold">
                <span>By {g.author} • {g.cuisine}</span>
                <span>Gem Score: {Number(g.gem_score).toFixed(2)}</span>
              </div>
              {g.entity_type === "recipe" && g.slug && (
                <Link href={`/recipes/${g.slug}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#9A3412] hover:underline">
                  <UtensilsCrossed className="w-3.5 h-3.5" /> Cook This Hidden Gem
                </Link>
              )}
              {g.entity_type === "restaurant" && (
                <Link href={`/restaurants/${g.entity_id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#059669] hover:underline">
                  Visit Restaurant Profile
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#059669]" /> Historical Hidden Gems Archive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {archive.map((a) => (
            <div key={a.gem_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-[#E7DFD3] dark:border-[#253D31]">
              <div>
                <p className="font-bold text-sm">{a.title}</p>
                <p className="text-xs text-[#475569]">{a.entity_type.toUpperCase()} • {a.cuisine}</p>
              </div>
              <Badge variant="outline">Score {Number(a.gem_score).toFixed(2)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
