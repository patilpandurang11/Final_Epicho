"use client";

import React, { useState, useEffect } from "react";
import { 
  Trophy, 
  Sparkles, 
  Star, 
  ShieldCheck, 
  Flame, 
  Award, 
  Clock, 
  TrendingUp, 
  Info,
  ChefHat,
  Gem
} from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function RankingsPage() {
  const [category, setCategory] = useState<"restaurants" | "recipes" | "chefs">("restaurants");
  const [rankings, setRankings] = useState<any[]>([]);
  const [hiddenGems, setHiddenGems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRankingsAndGems = async () => {
      setLoading(true);
      try {
        const rankData = await apiRequest(`/rankings?category=${category}`);
        setRankings(rankData);
        const gemData = await apiRequest("/rankings/hidden-gems");
        setHiddenGems(gemData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRankingsAndGems();
  }, [category]);

  const handleVote = async (targetId: string) => {
    try {
      await apiRequest("/rankings/vote", {
        method: "POST",
        body: JSON.stringify({
          target_type: category === "restaurants" ? "restaurant" : "recipe",
          target_id: targetId,
          score: 5
        })
      });
      alert("Your verified ranking vote has been recorded with anti-bot verification!");
    } catch {
      alert("Please log in to cast ranking votes.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#F2E6E2]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold uppercase tracking-wider mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
            Unbribed Community Leaderboard
          </div>
          <h1 className="text-3xl font-black text-[#0F172A] tracking-tight">
            Culinary Rankings & Hidden Gems
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Weighted by Bayesian rating adjustments and verified "Cooked-This" signals. Paid ads cannot boost ranking.
          </p>
        </div>

        {/* Category Switcher */}
        <div className="flex items-center gap-2 bg-stone-100 p-1.5 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setCategory("restaurants")}
            className={`px-4 py-2 rounded-xl transition-all ${
              category === "restaurants" ? "bg-white text-[#9A3412] shadow-sm" : "text-stone-600"
            }`}
          >
            🍽️ Restaurants
          </button>
          <button
            onClick={() => setCategory("recipes")}
            className={`px-4 py-2 rounded-xl transition-all ${
              category === "recipes" ? "bg-white text-[#9A3412] shadow-sm" : "text-stone-600"
            }`}
          >
            📖 Top Recipes
          </button>
          <button
            onClick={() => setCategory("chefs")}
            className={`px-4 py-2 rounded-xl transition-all ${
              category === "chefs" ? "bg-white text-[#9A3412] shadow-sm" : "text-stone-600"
            }`}
          >
            👨‍🍳 Master Chefs
          </button>
        </div>
      </div>

      {/* EpiCho Hidden Gems Spotlight Section */}
      {hiddenGems.length > 0 && (
        <section className="bg-gradient-to-r from-amber-900 via-[#9A3412] to-amber-800 rounded-3xl p-8 text-white shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/20 rounded-xl">
                <Gem className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
                  Current Selection Cycle (Every 2 Days)
                </span>
                <h3 className="text-2xl font-black">EpiCho Hidden Gems Selection</h3>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full text-xs font-semibold text-amber-200">
              <Clock className="w-3.5 h-3.5" />
              <span>Refreshes in ~36 hours</span>
            </div>
          </div>

          <p className="text-amber-100 text-xs sm:text-sm max-w-3xl leading-relaxed">
            Our automated quality-to-exposure algorithm selects high-quality culinary treasures with exceptional ratings and community saves that haven't received mainstream viral exposure.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {hiddenGems.map((gem) => (
              <div key={gem.gem_id} className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    {gem.entity_type} • {gem.cuisine}
                  </span>
                  <span className="text-xs font-extrabold bg-amber-400 text-stone-900 px-2.5 py-0.5 rounded-full">
                    Gem Score: {gem.gem_score}
                  </span>
                </div>
                <h4 className="text-xl font-bold">{gem.title}</h4>
                <p className="text-xs text-stone-200 leading-relaxed">{gem.description}</p>
                {gem.author && (
                  <span className="text-xs text-amber-200 block">Created by {gem.author}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Leaderboard Table */}
      <section className="bg-white rounded-3xl border border-[#F2E6E2] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#9A3412]" />
            Official Ranking Leaderboard
          </h2>
          <div className="flex items-center gap-1 text-xs text-stone-500">
            <Info className="w-4 h-4 text-stone-400" />
            <span>Bayesian adjusted score $S = (vR + mC) / (v + m)$</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-stone-400 font-medium">Computing verified rankings...</div>
        ) : (
          <div className="space-y-3">
            {rankings.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-2xl border border-stone-100 hover:border-[#F2E6E2] hover:bg-[#FFFBEB]/50 transition-all text-xs sm:text-sm"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                    index === 0 ? "bg-amber-400 text-stone-900" : index === 1 ? "bg-stone-300 text-stone-800" : index === 2 ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-600"
                  }`}>
                    #{index + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[#0F172A] text-sm sm:text-base">{item.name}</span>
                      {item.is_verified && (
                        <ShieldCheck className="w-4 h-4 text-[#059669]" />
                      )}
                    </div>
                    <span className="text-xs text-stone-500">
                      {item.cuisine || item.tier || "Culinary"} • {item.votes_count} verified votes
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="block text-base font-black text-[#9A3412]">
                      ★ {item.bayesian_score}
                    </span>
                    <span className="text-[10px] text-stone-400 uppercase font-semibold">Bayesian Score</span>
                  </div>

                  <button
                    onClick={() => handleVote(item.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 font-bold text-xs hover:bg-amber-100 transition-colors"
                  >
                    Vote
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
