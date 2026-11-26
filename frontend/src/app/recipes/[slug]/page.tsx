"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import {
  Bookmark,
  ChefHat,
  Clock,
  Download,
  Flame,
  GitFork,
  History,
  ShoppingCart,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    apiRequest(`/recipes/${encodeURIComponent(slug)}`).then((r) => {
      setRecipe(r);
      apiRequest(`/recipes/${r.recipe_id}/versions`).then(setVersions).catch(() => {});
      apiRequest(`/recipes/${r.recipe_id}/reviews`).then(setReviews).catch(() => {});
    }).catch(() => {});
  }, [slug]);

  const handleSave = async () => {
    if (!user) return router.push("/login");
    const res = await apiRequest(`/recipes/${recipe.recipe_id}/save`, { method: "POST" });
    setFeedback(res.saved ? "Saved to your cookbook." : "Removed from saved recipes.");
  };

  const handleRemix = async () => {
    if (!user) return router.push("/login");
    const remixed = await apiRequest(`/recipes/${recipe.recipe_id}/remix`, {
      method: "POST",
      body: JSON.stringify({ twist_notes: "Personalized community remix" }),
    });
    router.push(`/recipes/${remixed.slug}`);
  };

  const handleDownload = () => {
    if (!recipe) return;
    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recipe.slug || "epicho-recipe"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddToGrocery = async () => {
    if (!user) return router.push("/login");
    await apiRequest(`/grocery/from-recipe/${recipe.recipe_id}?servings=${recipe.servings}`, { method: "POST" });
    setFeedback("Ingredients added to your Smart Grocery List!");
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return router.push("/login");
    await apiRequest(`/recipes/${recipe.recipe_id}/reviews`, {
      method: "POST",
      body: JSON.stringify({ rating, review_text: reviewText }),
    });
    setReviewText("");
    const updated = await apiRequest(`/recipes/${recipe.recipe_id}/reviews`);
    setReviews(updated);
  };

  if (!recipe) {
    return <div className="max-w-5xl mx-auto px-4 py-20 text-center text-sm">Loading recipe details...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 space-y-4">
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="w-full h-80 object-cover rounded-3xl border border-[#E7DFD3] dark:border-[#253D31]"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} variant="primary" size="sm">
              <Bookmark className="w-4 h-4" /> Save
            </Button>
            <Button onClick={handleRemix} variant="emerald" size="sm">
              <GitFork className="w-4 h-4" /> Remix Recipe
            </Button>
            <Button onClick={handleAddToGrocery} variant="outline" size="sm">
              <ShoppingCart className="w-4 h-4" /> Add to Grocery
            </Button>
            <Button onClick={handleDownload} variant="outline" size="sm">
              <Download className="w-4 h-4" /> Download
            </Button>
          </div>
          {feedback && (
            <p className="text-xs font-semibold text-[#059669] bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl">
              {feedback}
            </p>
          )}
        </div>

        <div className="lg:col-span-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="emerald">{recipe.cuisine_type}</Badge>
            <Badge variant="outline">{recipe.diet_type}</Badge>
            {recipe.is_ai_generated && (
              <Badge variant="amber">
                <Sparkles className="w-3 h-3" /> AI-Generated
              </Badge>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{recipe.title}</h1>
          <p className="text-sm text-[#475569] dark:text-[#A7B8AE] leading-relaxed">{recipe.description}</p>

          {recipe.author && (
            <Link
              href={`/profile/${recipe.author.username || recipe.author.user_id}`}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#9A3412] hover:underline"
            >
              <ChefHat className="w-4 h-4" /> By {recipe.author.full_name}
            </Link>
          )}

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-[#F5F0E6] dark:bg-[#1A2D24] text-center">
              <Clock className="w-4 h-4 mx-auto text-[#EA580C] mb-1" />
              <p className="text-xs font-bold">{recipe.prep_time_mins + recipe.cook_time_mins} mins</p>
              <p className="text-[11px] text-[#475569]">Total Time</p>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F0E6] dark:bg-[#1A2D24] text-center">
              <Users className="w-4 h-4 mx-auto text-[#059669] mb-1" />
              <p className="text-xs font-bold">{recipe.servings} Servings</p>
              <p className="text-[11px] text-[#475569]">Yield</p>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F0E6] dark:bg-[#1A2D24] text-center">
              <Flame className="w-4 h-4 mx-auto text-[#9A3412] mb-1" />
              <p className="text-xs font-bold">{recipe.nutrition?.calories || 320} kcal</p>
              <p className="text-[11px] text-[#475569]">Per Serving</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card className="md:col-span-5">
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recipe.ingredients?.map((ing: any, i: number) => (
              <div key={i} className="flex justify-between text-sm py-1.5 border-b border-[#E7DFD3]/60 dark:border-[#253D31]">
                <span className="font-medium">{ing.ingredient_name}</span>
                <span className="text-xs font-bold text-[#475569]">{ing.quantity} {ing.unit}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-7">
          <CardHeader>
            <CardTitle>Step-by-Step Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recipe.steps?.map((st: any) => (
              <div key={st.step_number} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#9A3412] text-white text-xs font-bold flex items-center justify-center">
                    {st.step_number}
                  </span>
                  <span className="text-sm font-bold">Step {st.step_number}</span>
                </div>
                <p className="text-sm text-[#475569] dark:text-[#A7B8AE] pl-8">{st.instruction}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="w-4 h-4 text-[#059669]" /> Recipe Version History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {versions.map((v) => (
              <div key={v.version_id} className="flex justify-between p-2.5 rounded-xl bg-[#F5F0E6]/60 dark:bg-[#1A2D24]">
                <span className="font-bold">v{v.version_number} — {v.change_summary}</span>
                <span className="text-[#475569]">{new Date(v.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" /> Ratings & Community Reviews ({reviews.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleSubmitReview} className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold">Rating:</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="h-9 rounded-lg border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#0D1511] px-2 text-sm"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n} Stars</option>
                ))}
              </select>
            </div>
            <Textarea
              required
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your tasting notes or cooking tips..."
            />
            <Button type="submit" variant="primary" size="sm">Post Review</Button>
          </form>

          <div className="space-y-3">
            {reviews.map((rv) => (
              <div key={rv.review_id} className="p-3.5 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{rv.author_name}</span>
                  <span className="text-amber-600">{rv.rating} / 5</span>
                </div>
                <p className="text-sm text-[#475569] dark:text-[#A7B8AE]">{rv.comment}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
