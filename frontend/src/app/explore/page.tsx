"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BookOpen, Compass, Film, Gem, HeartHandshake, Search, Trophy, UtensilsCrossed } from "lucide-react";

export default function ExplorePage() {
  const [search, setSearch] = useState("");
  const [recipes, setRecipes] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [blogs, setBlogs] = useState<any[]>([]);

  useEffect(() => {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    apiRequest(`/recipes${q}`).then(setRecipes).catch(() => {});
    apiRequest("/reels?limit=4").then(setReels).catch(() => {});
    apiRequest("/restaurants?limit=4").then(setRestaurants).catch(() => {});
    apiRequest("/blogs?limit=4").then(setBlogs).catch(() => {});
  }, [search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="space-y-4">
        <Badge variant="emerald">
          <Compass className="w-3.5 h-3.5" /> Unified Culinary Discovery
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-bold">Explore EpiCho</h1>
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#475569]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes, regional cuisines, ingredients..."
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <Link href="/hidden-gems" className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <Gem className="w-3.5 h-3.5" /> Hidden Gems
          </Link>
          <Link href="/rankings" className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Bayesian Rankings
          </Link>
          <Link href="/heritage" className="px-3.5 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
            <HeartHandshake className="w-3.5 h-3.5" /> Grandmother&apos;s Recipes
          </Link>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-[#EA580C]" /> Trending Recipes
          </h2>
          <Link href="/recipes" className="text-xs font-bold text-[#059669] hover:underline">View All</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {recipes.slice(0, 4).map((r) => (
            <Link key={r.recipe_id} href={`/recipes/${r.slug}`}>
              <Card className="overflow-hidden h-full hover:border-[#059669]">
                <img src={r.image_url} alt={r.title} className="w-full h-40 object-cover" />
                <CardContent className="pt-4 space-y-1">
                  <Badge variant="outline">{r.cuisine_type}</Badge>
                  <h3 className="font-bold text-sm line-clamp-2">{r.title}</h3>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Film className="w-5 h-5 text-[#9A3412]" /> Short Cooking Reels
          </h2>
          <Link href="/reels" className="text-xs font-bold text-[#059669] hover:underline">Open 9:16 Player</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {reels.map((rl) => (
            <Link key={rl.reel_id} href="/reels">
              <Card className="overflow-hidden hover:border-[#EA580C]">
                <img src={rl.thumbnail_url} alt={rl.title} className="w-full h-56 object-cover" />
                <CardContent className="pt-3">
                  <p className="text-xs font-bold line-clamp-2">{rl.title}</p>
                  <p className="text-[11px] text-[#475569] mt-1">{rl.views_count} views</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Featured Restaurants</h2>
            <Link href="/restaurants" className="text-xs font-bold text-[#059669] hover:underline">Browse All</Link>
          </div>
          <div className="space-y-3">
            {restaurants.map((b) => (
              <Link key={b.business_id} href={`/restaurants/${b.business_id}`}>
                <Card className="p-4 hover:border-[#059669]">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-sm">{b.business_name}</h3>
                      <p className="text-xs text-[#475569]">{b.cuisine_type} • {b.address}</p>
                    </div>
                    <Badge variant={b.verification_status === "verified" ? "emerald" : "outline"}>
                      {b.verification_status}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#059669]" /> Culinary Stories
            </h2>
            <Link href="/blogs" className="text-xs font-bold text-[#059669] hover:underline">Read Blogs</Link>
          </div>
          <div className="space-y-3">
            {blogs.map((bl) => (
              <Link key={bl.blog_id} href={`/blogs/${bl.slug}`}>
                <Card className="p-4 hover:border-[#059669]">
                  <h3 className="font-bold text-sm">{bl.title}</h3>
                  <p className="text-xs text-[#475569] line-clamp-2 mt-1">{bl.excerpt}</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
