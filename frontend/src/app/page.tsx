"use client";

import React, { useState } from "react";
import { 
  Sparkles, 
  Flame, 
  Film, 
  BookOpen, 
  UtensilsCrossed, 
  Trophy, 
  CalendarDays, 
  ShoppingCart, 
  HeartHandshake, 
  ArrowRight, 
  CheckCircle2, 
  Star, 
  ShieldCheck, 
  Clock, 
  ChefHat, 
  Play
} from "lucide-react";

export default function HomePage() {
  const [demoIngredients, setDemoIngredients] = useState(["Paneer", "Tomatoes", "Capsicum", "Garlic"]);
  const [cuisineChoice, setCuisineChoice] = useState("Indian");

  return (
    <div className="space-y-24 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FFFBEB] via-[#FDFBF7] to-white -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Heading & Value Proposition */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#9A3412]/10 border border-[#9A3412]/20 text-[#9A3412] text-xs font-bold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-[#C2410C]" />
                Next-Gen AI Culinary Ecosystem
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#0F172A] tracking-tight leading-[1.1]">
                Discover. Create. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9A3412] via-[#C2410C] to-amber-600">
                  Cook. Connect.
                </span>
              </h1>

              <p className="text-lg text-stone-600 max-w-2xl leading-relaxed">
                Transform any ingredients in your pantry into Michelin-grade recipes. Watch 9:16 cooking Reels with instant cookable recipe links, automate weekly meal planning, preserve ancestral heritage, and connect with verified chefs.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <a
                  href="/ai-kitchen"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white font-bold text-base hover:shadow-lg hover:shadow-[#9A3412]/25 transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Try AI Kitchen Free
                </a>
                <a
                  href="/reels"
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-stone-300 bg-white text-stone-800 font-bold text-base hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Film className="w-5 h-5 text-[#C2410C]" />
                  Watch Food Reels
                </a>
              </div>

              {/* Trust Badges */}
              <div className="pt-6 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-stone-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#059669]" />
                  <span>Allergen & Cross-Contamination Guard</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                  <span>Verified Cooked-This Social Proof</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Bayesian Rating Anti-Gaming</span>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive AI Kitchen Teaser Card */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/50 border border-[#F2E6E2] space-y-6 relative">
                <div className="absolute -top-3 -right-3 bg-[#059669] text-white text-[11px] font-extrabold uppercase px-3 py-1 rounded-full shadow-md">
                  Live Assistant
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[#9A3412] font-bold text-sm">
                    <ChefHat className="w-5 h-5" />
                    <span>What's in your kitchen right now?</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {demoIngredients.map((ing, i) => (
                      <span key={i} className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFFBEB] text-[#9A3412] text-xs font-semibold border border-[#F2E6E2]">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8F2F0] border border-[#F2E6E2] space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-600 font-medium">
                    <span>Generated Result Preview:</span>
                    <span className="text-[#059669] font-bold">100% Cookable</span>
                  </div>
                  <h4 className="font-bold text-[#0F172A] text-base">
                    Artisanal Indian Paneer Sauté with Tangy Tomato Glaze
                  </h4>
                  <div className="flex items-center gap-4 text-xs text-stone-500">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 20 Mins</span>
                    <span>•</span>
                    <span>340 kcal / serving</span>
                    <span>•</span>
                    <span className="text-[#059669] font-semibold">Nut Free</span>
                  </div>
                </div>

                <a
                  href="/ai-kitchen"
                  className="w-full py-3 rounded-xl bg-[#0F172A] text-white font-bold text-sm hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
                >
                  <span>Launch Full AI Kitchen Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Feature Pillar Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#9A3412]">
            Comprehensive Culinary Ecosystem
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
            Everything Food Enthusiasts, Chefs & Creators Need
          </h3>
          <p className="text-stone-600 text-sm sm:text-base">
            From zero-waste AI recipe generation to viral short videos and ancestral heritage preservation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: AI Kitchen & Fusion */}
          <div className="bg-white p-8 rounded-3xl border border-[#F2E6E2] hover:shadow-xl transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-2xl bg-[#9A3412]/10 text-[#9A3412] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-[#0F172A]">AI Kitchen & Fusion Studio</h4>
            <p className="text-stone-600 text-sm leading-relaxed">
              Feed in what you have in the fridge. Our culinary AI adapts cooking time, equipment, taste profiles, and performs cross-cuisine fusion with verified allergen checks.
            </p>
            <a href="/ai-kitchen" className="inline-flex items-center gap-1 text-sm font-bold text-[#9A3412] hover:text-[#C2410C]">
              Generate recipes <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Card 2: 9:16 Food Reels */}
          <div className="bg-white p-8 rounded-3xl border border-[#F2E6E2] hover:shadow-xl transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-2xl bg-[#C2410C]/10 text-[#C2410C] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Film className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-[#0F172A]">Vertical Short Video Reels</h4>
            <p className="text-stone-600 text-sm leading-relaxed">
              Immersive, full-screen vertical short videos designed specifically for food lovers. Every cooking reel links directly to a structured, downloadable recipe.
            </p>
            <a href="/reels" className="inline-flex items-center gap-1 text-sm font-bold text-[#C2410C] hover:text-[#9A3412]">
              Explore food reels <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Card 3: Meal Planning & Grocery */}
          <div className="bg-white p-8 rounded-3xl border border-[#F2E6E2] hover:shadow-xl transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-2xl bg-[#059669]/10 text-[#059669] flex items-center justify-center group-hover:scale-110 transition-transform">
              <CalendarDays className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-[#0F172A]">Meal Planner & Smart Grocery</h4>
            <p className="text-stone-600 text-sm leading-relaxed">
              Drag-and-drop weekly meal planning with automatic grocery list generation. Automatically subtracts pantry ingredients and connects to Blinkit, Zepto, and Instamart.
            </p>
            <a href="/meal-planner" className="inline-flex items-center gap-1 text-sm font-bold text-[#059669] hover:text-emerald-800">
              Plan your week <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Card 4: Heritage & Grandmother's Recipes */}
          <div className="bg-white p-8 rounded-3xl border border-[#F2E6E2] hover:shadow-xl transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-[#0F172A]">Grandmother's Recipes</h4>
            <p className="text-stone-600 text-sm leading-relaxed">
              Preserve sacred family cooking traditions. Document ancestral origin stories, dialects, and original measurements like 'chutki' and 'katori' with AI standardization.
            </p>
            <a href="/heritage" className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-900">
              Browse heritage food <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Card 5: Restaurant & Chef Discovery */}
          <div className="bg-white p-8 rounded-3xl border border-[#F2E6E2] hover:shadow-xl transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-[#0F172A]">Restaurant & Chef Portals</h4>
            <p className="text-stone-600 text-sm leading-relaxed">
              Discover verified dining establishments, live interactive menus, verified ratings, and chef portfolios. Manage business profiles with FSSAI verification.
            </p>
            <a href="/restaurants" className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-900">
              Discover restaurants <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Card 6: Bayesian Rankings & Hidden Gems */}
          <div className="bg-white p-8 rounded-3xl border border-[#F2E6E2] hover:shadow-xl transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Trophy className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-[#0F172A]">Rankings & Hidden Gems</h4>
            <p className="text-stone-600 text-sm leading-relaxed">
              Unbought, unbribed rankings powered by Bayesian scoring. Our automated algorithm unearths under-discovered high-quality culinary gems every 2 days.
            </p>
            <a href="/rankings" className="inline-flex items-center gap-1 text-sm font-bold text-purple-700 hover:text-purple-900">
              View leaderboards <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-[#9A3412] via-[#C2410C] to-amber-700 text-white p-10 sm:p-14 text-center space-y-6 shadow-xl shadow-[#9A3412]/20">
          <h3 className="text-3xl sm:text-4xl font-black tracking-tight">
            Ready to Elevate Your Culinary Journey?
          </h3>
          <p className="text-amber-100 max-w-2xl mx-auto text-base sm:text-lg">
            Join thousands of home cooks, master chefs, and food lovers. Sign up today and experience the future of AI-powered cooking.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <a
              href="/register"
              className="px-8 py-3.5 rounded-xl bg-white text-[#9A3412] font-black text-base hover:bg-stone-100 transition-colors shadow-md"
            >
              Get Started Free
            </a>
            <a
              href="/pricing"
              className="px-8 py-3.5 rounded-xl bg-[#0F172A]/40 border border-white/30 text-white font-bold text-base hover:bg-[#0F172A]/60 transition-colors"
            >
              View Premium Membership (₹149/mo)
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
