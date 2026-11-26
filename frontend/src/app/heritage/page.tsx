"use client";

import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Heart, 
  ShieldCheck, 
  Sparkles, 
  Plus, 
  Clock, 
  Award, 
  CheckCircle2, 
  ScrollText,
  History
} from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function HeritagePage() {
  const [heritageList, setHeritageList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHeritage = async () => {
      try {
        const data = await apiRequest("/heritage");
        setHeritageList(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHeritage();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Page Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5 text-amber-700" />
          Culinary Heritage Preservation
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#0F172A] tracking-tight">
          Grandmother's Recipes
        </h1>
        <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
          Sacred ancestral recipes passed through generations. Preserving regional dialects, timeless family memories, and traditional heirloom measurements with AI standardization.
        </p>
      </div>

      {/* Heritage Cards Grid */}
      {loading ? (
        <div className="text-center py-20 text-stone-400 font-medium">Gathering heirloom stories...</div>
      ) : heritageList.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#F2E6E2] space-y-3">
          <ScrollText className="w-12 h-12 text-stone-300 mx-auto" />
          <h3 className="font-bold text-stone-800 text-lg">No heritage recipes archived yet</h3>
          <p className="text-xs text-stone-500">Be the first to immortalize your family's culinary legacy.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {heritageList.map((h) => (
            <div key={h.heritage_id} className="bg-white rounded-3xl border border-[#F2E6E2] p-6 sm:p-8 shadow-sm space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <History className="w-3.5 h-3.5 text-amber-700" />
                    Passed down {h.generation_depth} Generations
                  </span>

                  {h.verified_by_family && (
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Verified by Family
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-[#0F172A]">{h.title}</h3>
                  <span className="text-xs font-bold text-stone-500 block">
                    Origin: {h.family_origin} {h.regional_dialect ? `• Dialect: ${h.regional_dialect}` : ""}
                  </span>
                </div>

                {/* Ancestral Story */}
                <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-amber-200/70 text-xs text-stone-700 leading-relaxed italic">
                  "{h.historical_story}"
                </div>

                {/* Traditional Measurements */}
                {h.original_measurements && (
                  <div className="space-y-1 text-xs">
                    <span className="font-bold text-stone-500 uppercase tracking-wider text-[10px]">
                      Original Heirloom Measures:
                    </span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {Object.entries(h.original_measurements).map(([k, v]: [string, any]) => (
                        <span key={k} className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-semibold text-[11px]">
                          {k}: <strong>{v}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                <a
                  href={`/recipes/${h.recipe_id}`}
                  className="px-5 py-2.5 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#802B0F] transition-colors"
                >
                  View Standardized Cookable Recipe →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
