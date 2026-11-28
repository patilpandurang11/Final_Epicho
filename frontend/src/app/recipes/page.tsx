"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  Clock, 
  ChefHat, 
  Bookmark, 
  Sparkles, 
  UtensilsCrossed, 
  Plus, 
  ChevronRight 
} from "lucide-react";
import { apiRequest } from "@/lib/api";

const CUISINES = ["All", "Indian", "Italian", "Mexican", "Asian", "Mediterranean"];
const DIETS = ["All", "veg", "vegan", "non_veg", "eggetarian"];

type RecipeCard = {
  recipe_id: string;
  slug?: string;
  title: string;
  cuisine_type: string;
  servings: number;
  cook_time_mins?: number;
  prep_time_mins?: number;
  image_url?: string | null;
  is_ai_generated?: boolean;
  average_rating?: number | null;
  review_count?: number;
  description?: string | null;
  difficulty_level?: string | null;
};

function requestRecipes(
  search: string,
  cuisine: string,
  diet: string,
  sort: string,
): Promise<RecipeCard[]> {
  const params = new URLSearchParams();
  if (cuisine !== "All") params.append("cuisine", cuisine);
  if (diet !== "All") params.append("diet", diet);
  if (search) params.append("search", search);
  params.append("sort", sort);
  return apiRequest<RecipeCard[]>(`/recipes?${params.toString()}`);
}

export default function RecipesCatalogPage() {
  const [recipes, setRecipes] = useState<RecipeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const [selectedDiet, setSelectedDiet] = useState("All");
  const [sort, setSort] = useState("recent");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    requestRecipes(appliedSearch, selectedCuisine, selectedDiet, sort)
      .then((data) => {
        if (active) setRecipes(data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message || "Unable to load recipes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appliedSearch, selectedCuisine, selectedDiet, sort]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setAppliedSearch(search);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Catalog Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#F2E6E2]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#9A3412]">
            Culinary Archives
          </span>
          <h1 className="text-3xl font-black text-[#0F172A] tracking-tight">
            Recipe Discovery & Management
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Explore community creations, chef masterclasses, and AI Kitchen adapted dishes.
          </p>
        </div>

        <a
          href="/create-recipe"
          className="self-start md:self-auto px-5 py-2.5 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#802B0F] transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Structured Recipe
        </a>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#F2E6E2] shadow-sm flex flex-col md:flex-row items-center gap-4">
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search recipes, ingredients, dish names..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
          />
        </form>

        {/* Cuisine Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none">
          <span className="text-xs font-bold text-stone-500 whitespace-nowrap mr-1">Cuisine:</span>
          {CUISINES.map((c) => (
            <button
              key={c}
              onClick={() => {
                setError(null);
                setLoading(true);
                setSelectedCuisine(c);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCuisine === c
                  ? "bg-[#9A3412] text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Diet Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none">
          <span className="text-xs font-bold text-stone-500 whitespace-nowrap mr-1">Diet:</span>
          {DIETS.map((d) => (
            <button
              key={d}
              onClick={() => {
                setError(null);
                setLoading(true);
                setSelectedDiet(d);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedDiet === d
                  ? "bg-[#059669] text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {d.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs font-bold whitespace-nowrap">
          Sort:
          <select value={sort} onChange={(event) => {
            setError(null);
            setLoading(true);
            setSort(event.target.value);
          }} className="rounded-lg border border-stone-200 bg-white px-2 py-1.5">
            <option value="recent">Newest</option>
            <option value="popular">Most viewed</option>
            <option value="rating">Top rated</option>
          </select>
        </label>
      </div>

      {/* Recipe Cards Grid */}
      {loading ? (
        <div className="text-center py-20 text-stone-400 font-medium">Loading delicious recipes...</div>
      ) : error ? (
        <p role="alert" className="text-center py-20 text-red-700">{error}</p>
      ) : recipes.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#F2E6E2] space-y-3">
          <UtensilsCrossed className="w-12 h-12 text-stone-300 mx-auto" />
          <h3 className="font-bold text-stone-800 text-lg">No recipes match your criteria</h3>
          <p className="text-xs text-stone-500">Try adjusting your filters or search terms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((rec) => (
            <a
              key={rec.recipe_id}
              href={`/recipes/${rec.slug || rec.recipe_id}`}
              className="group bg-white rounded-3xl border border-[#F2E6E2] overflow-hidden hover:shadow-xl transition-all flex flex-col"
            >
              {/* Image banner */}
              <div className="relative aspect-[16/10] bg-stone-100 overflow-hidden">
                <img
                  src={rec.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"}
                  alt={rec.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 flex gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white">
                    {rec.cuisine_type}
                  </span>
                  {rec.is_ai_generated && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI
                    </span>
                  )}
                </div>
              </div>

              {/* Recipe Info */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#C2410C]" />
                      {(rec.prep_time_mins || 15) + (rec.cook_time_mins || 20)} Mins
                    </span>
                    <span>{rec.servings} Servings</span>
                    <span>{rec.average_rating ? `★ ${rec.average_rating} (${rec.review_count})` : "New"}</span>
                  </div>

                  <h3 className="font-extrabold text-[#0F172A] text-base group-hover:text-[#9A3412] transition-colors line-clamp-1">
                    {rec.title}
                  </h3>

                  <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                    {rec.description || "Freshly curated culinary preparation with exact measurements and verified nutrition."}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700 capitalize">
                    Difficulty: {rec.difficulty_level || "Medium"}
                  </span>
                  <span className="font-bold text-[#9A3412] flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                    View Recipe <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
