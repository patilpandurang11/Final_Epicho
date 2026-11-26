"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { 
  BarChart3, Film, Users, TrendingUp, Sparkles, PlusCircle, 
  Eye, Heart, MessageSquare, Award, ArrowUpRight, DollarSign
} from "lucide-react";

export default function CreatorDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "reels" | "recipes" | "monetization">("overview");

  const analytics = {
    totalViews: "482.4K",
    engagementRate: "8.7%",
    followers: "14.2K",
    earnings: "₹18,450",
    viewsChange: "+24.5%",
    followersChange: "+1,240 this month"
  };

  const topReels = [
    { id: "1", title: "Authentic Dum Biryani Dumming Secret", views: "142.8K", likes: "12.4K", comments: 480, revenue: "₹4,200" },
    { id: "2", title: "Crispy Samosa Dough Without Fail", views: "98.2K", likes: "8.9K", comments: 312, revenue: "₹2,800" },
    { id: "3", title: "3-Ingredient 5-Minute Chocolate Mug Cake", views: "76.4K", likes: "6.5K", comments: 195, revenue: "₹2,100" },
  ];

  const recentRecipes = [
    { id: "1", title: "Royal Awadhi Shahi Paneer", saves: "3.2K", rating: 4.9, reviewsCount: 88, status: "Published" },
    { id: "2", title: "Cold Fermented Sourdough Naan", saves: "1.8K", rating: 4.8, reviewsCount: 45, status: "Published" },
    { id: "3", title: "Smoked Butter Garlic Prawns", saves: "940", rating: 5.0, reviewsCount: 22, status: "Draft" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight font-serif">Creator Pro Studio</h1>
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> Verified Creator
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Welcome back, <span className="font-semibold text-stone-800">{user?.full_name || "Chef Creator"}</span>. Manage your reels, audience metrics, and monetization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/create-recipe"
            className="inline-flex items-center gap-2 border border-border bg-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-stone-50 transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-primary" /> New Recipe
          </Link>
          <Link
            href="/upload-reel"
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/95 transition shadow-sm"
          >
            <Film className="w-4 h-4" /> Upload Reel
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Video Views</span>
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-stone-900">{analytics.totalViews}</div>
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold mt-1">
            <TrendingUp className="w-3.5 h-3.5" /> {analytics.viewsChange} vs last month
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Community Followers</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-stone-900">{analytics.followers}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {analytics.followersChange}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Avg. Engagement Rate</span>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-stone-900">{analytics.engagementRate}</div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">Top 5% on EpiCho</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Creator Earnings (MTD)</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-stone-900">{analytics.earnings}</div>
          <div className="text-xs text-muted-foreground mt-1">Direct tips & brand sponsorships</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {[
          { id: "overview", label: "Overview", icon: BarChart3 },
          { id: "reels", label: "Reels Performance", icon: Film },
          { id: "recipes", label: "Published Recipes", icon: Sparkles },
          { id: "monetization", label: "Monetization & Payouts", icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-stone-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <h3 className="text-lg font-bold text-stone-900 mb-4 font-serif">High Performing Reels</h3>
              <div className="space-y-4">
                {topReels.map((reel) => (
                  <div key={reel.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 border border-transparent hover:border-border transition">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-16 rounded-lg bg-stone-900 flex items-center justify-center text-white text-xs font-bold">
                        9:16
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900 text-sm">{reel.title}</h4>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {reel.views}</span>
                          <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-rose-500" /> {reel.likes}</span>
                          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {reel.comments}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-600 block">{reel.revenue}</span>
                      <Link href={`/reels?id=${reel.id}`} className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 mt-0.5">
                        View Reel <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <h3 className="text-lg font-bold text-stone-900 mb-4 font-serif">Recipe Portfolio</h3>
              <div className="space-y-3">
                {recentRecipes.map((recipe) => (
                  <div key={recipe.id} className="flex items-center justify-between p-3 rounded-xl border border-border">
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">{recipe.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>{recipe.saves} saves</span>
                        <span>⭐ {recipe.rating} ({recipe.reviewsCount} reviews)</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      recipe.status === "Published" ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-700"
                    }`}>
                      {recipe.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-stone-900 text-white p-6 rounded-2xl shadow-sm">
              <h3 className="text-lg font-bold mb-2 font-serif flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> Creator Milestones
              </h3>
              <p className="text-stone-300 text-xs mb-4">
                Unlock higher platform rev-share and priority badge on search results by completing your monthly creator goals.
              </p>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Upload 4 Reels / month</span>
                    <span className="font-bold text-amber-400">3/4</span>
                  </div>
                  <div className="w-full bg-stone-800 rounded-full h-1.5">
                    <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: "75%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Publish 2 Original Recipes</span>
                    <span className="font-bold text-emerald-400">2/2 ✓</span>
                  </div>
                  <div className="w-full bg-stone-800 rounded-full h-1.5">
                    <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: "100%" }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <h3 className="text-base font-bold text-stone-900 mb-3 font-serif">Audience Demographics</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Top Cuisine Interest:</span>
                  <span className="font-bold text-stone-800">Awadhi & North Indian</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Dietary Preference:</span>
                  <span className="font-bold text-stone-800">62% Vegetarian</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Primary Cities:</span>
                  <span className="font-bold text-stone-800">Mumbai, Bengaluru, Delhi</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab !== "overview" && (
        <div className="bg-white p-12 text-center rounded-2xl border border-border shadow-sm">
          <BarChart3 className="w-10 h-10 text-primary mx-auto mb-3" />
          <h3 className="text-lg font-bold text-stone-900 capitalize mb-1">{activeTab} Details</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Detailed interactive charts and drill-downs for {activeTab} are actively synced with our real-time telemetry stream.
          </p>
        </div>
      )}
    </div>
  );
}
