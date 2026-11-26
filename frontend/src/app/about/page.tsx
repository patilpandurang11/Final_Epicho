"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Heart, ShieldCheck, Award, Users, Utensils, ChefHat, ArrowRight } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full inline-block mb-3">
          Our Culinary Philosophy
        </span>
        <h1 className="text-4xl md:text-5xl font-black text-stone-900 font-serif tracking-tight leading-tight">
          Discover. Create. Cook. Connect.
        </h1>
        <p className="text-stone-600 mt-4 text-base md:text-lg leading-relaxed">
          EpiCho is an all-in-one AI-powered food social platform engineered to bridge timeless family heritage with cutting-edge culinary intelligence.
        </p>
      </div>

      {/* 4 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="bg-white p-8 rounded-3xl border border-border shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-stone-900 font-serif">Intelligent AI Kitchen</h3>
          <p className="text-stone-600 text-sm leading-relaxed">
            Our multi-step culinary engine leverages Google Gemini API with strict post-generation allergen filtering, custom fusion controls, and verified USDA nutritional databases.
          </p>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-border shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center">
            <Heart className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-stone-900 font-serif">Grandmother's Heritage</h3>
          <p className="text-stone-600 text-sm leading-relaxed">
            Preserving centuries of generational culinary wisdom. We archive oral heirloom recipes, regional dialects, cooking vessels, and heirloom measures before they are forgotten.
          </p>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-border shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-stone-900 font-serif">Bayesian Hidden Gems</h3>
          <p className="text-stone-600 text-sm leading-relaxed">
            Say goodbye to fake 5-star reviews and bought food hype. Our Dirichlet-multinomial Bayesian scoring spotlight authentic neighborhood joints on a fair 2-day rotation.
          </p>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-border shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-stone-900 font-serif">Verified Nutrition & Safety</h3>
          <p className="text-stone-600 text-sm leading-relaxed">
            Direct teleconsultation booking with IDA-certified clinical dietitians and FSSAI-compliant restaurant menus guarantee food trust from farm to fork.
          </p>
        </div>
      </div>

      {/* Call to action */}
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white p-10 rounded-3xl text-center space-y-6">
        <h2 className="text-3xl font-bold font-serif">Join the EpiCho Food Revolution</h2>
        <p className="text-stone-300 text-sm max-w-xl mx-auto leading-relaxed">
          Whether you are a home cook testing your first sourdough, a certified chef sharing 60-second reels, or a food critic unearthing hidden gems — your table is ready.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/register"
            className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-md transition"
          >
            Create Free Account
          </Link>
          <Link
            href="/ai-kitchen"
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition"
          >
            Try AI Kitchen Demo
          </Link>
        </div>
      </div>
    </div>
  );
}
