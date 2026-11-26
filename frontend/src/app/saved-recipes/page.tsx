"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bookmark, Clock, Trash2 } from "lucide-react";

export default function SavedRecipesPage() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<any[]>([]);

  const load = () => {
    if (!user) return;
    apiRequest("/recipes/saved").then(setRecipes).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleUnsave = async (recipeId: string) => {
    await apiRequest(`/recipes/${recipeId}/save`, { method: "POST" });
    setRecipes((prev) => prev.filter((r) => r.recipe_id !== recipeId));
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
        <Bookmark className="w-10 h-10 mx-auto text-[#9A3412]" />
        <h1 className="text-2xl font-bold">Sign in to view Saved Recipes</h1>
        <Link href="/login"><Button>Log In</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bookmark className="w-7 h-7 text-[#9A3412]" /> Saved Recipes Cookbook
          </h1>
          <p className="text-sm text-[#475569] dark:text-[#A7B8AE]">Your personal collection of bookmarked community and AI recipes.</p>
        </div>
        <Link href="/recipes"><Button variant="outline" size="sm">Discover More</Button></Link>
      </div>

      {recipes.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <p className="text-sm text-[#475569]">Your cookbook is empty.</p>
          <Link href="/recipes"><Button>Browse Recipes</Button></Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recipes.map((r) => (
            <Card key={r.recipe_id} className="overflow-hidden flex flex-col">
              <img src={r.image_url} alt={r.title} className="w-full h-44 object-cover" />
              <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <Badge variant="emerald">{r.cuisine_type}</Badge>
                  <Link href={`/recipes/${r.slug}`} className="block font-bold text-base mt-2 hover:text-[#9A3412]">
                    {r.title}
                  </Link>
                  <p className="text-xs text-[#475569] mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {r.cook_time_mins} mins
                  </p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#E7DFD3]/60 dark:border-[#253D31]">
                  <Link href={`/recipes/${r.slug}`} className="text-xs font-bold text-[#059669] hover:underline">Cook Now</Link>
                  <button type="button" onClick={() => handleUnsave(r.recipe_id)} className="text-xs text-red-600 flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
