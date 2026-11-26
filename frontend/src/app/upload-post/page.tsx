"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, apiUpload } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Camera, CheckCircle2, Flame, Upload } from "lucide-react";

export default function UploadPostPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [caption, setCaption] = useState("");
  const [dishName, setDishName] = useState("");
  const [restaurantTag, setRestaurantTag] = useState("");
  const [hashtags, setHashtags] = useState("HomeCooking, EpiCho");
  const [ingredientTags, setIngredientTags] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [isCookedThis, setIsCookedThis] = useState(true);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [recipes, setRecipes] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest("/recipes?limit=30").then(setRecipes).catch(() => {});
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await apiUpload("/posts/upload-media", fd);
      setMediaUrl(res.media_url);
      setMediaType(res.media_type);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return router.push("/login");
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("/posts", {
        method: "POST",
        body: JSON.stringify({
          caption,
          dish_name: dishName || undefined,
          restaurant_tag: restaurantTag || undefined,
          recipe_id: recipeId || null,
          is_cooked_this: isCookedThis,
          hashtags: hashtags.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
          ingredient_tags: ingredientTags.split(",").map((s) => s.trim()).filter(Boolean),
          media: mediaUrl ? [{ media_url: mediaUrl, media_type: mediaType, sort_order: 0 }] : [],
        }),
      });
      router.push("/feed");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Camera className="w-7 h-7 text-[#EA580C]" /> Share a Food Post
        </h1>
        <p className="text-sm text-[#475569] dark:text-[#A7B8AE]">
          Post photos or videos of your latest creation, or tag a recipe with &ldquo;Cooked This&rdquo;.
        </p>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">{error}</div>}

      <Card>
        <CardHeader><CardTitle>Post Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1">Dish Name</label>
              <Input value={dishName} onChange={(e) => setDishName(e.target.value)} placeholder="e.g., Crispy Garlic Paneer Bowl" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Caption & Tasting Notes</label>
              <Textarea required value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="How did it turn out?" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">Link Recipe (for Cooked This)</label>
                <select
                  value={recipeId}
                  onChange={(e) => setRecipeId(e.target.value)}
                  className="w-full h-10 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#0D1511] px-3 text-sm"
                >
                  <option value="">None</option>
                  {recipes.map((r) => (
                    <option key={r.recipe_id} value={r.recipe_id}>{r.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Tag Restaurant (optional)</label>
                <Input value={restaurantTag} onChange={(e) => setRestaurantTag(e.target.value)} placeholder="e.g., Spice Route Bistro" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">Hashtags</label>
                <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Ingredient Tags</label>
                <Input value={ingredientTags} onChange={(e) => setIngredientTags(e.target.value)} placeholder="Paneer, Saffron" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Upload Dish Photo / Video</label>
              <input type="file" accept="image/*,video/*" onChange={handleFileChange} className="text-xs" />
              {mediaUrl && (
                <p className="text-xs text-[#059669] mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded: {mediaUrl}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={isCookedThis} onChange={(e) => setIsCookedThis(e.target.checked)} />
              <Flame className="w-4 h-4 text-[#EA580C]" /> Mark as &ldquo;Cooked This&rdquo; verification post
            </label>
            <Button type="submit" disabled={submitting} className="w-full">
              <Upload className="w-4 h-4" /> {submitting ? "Publishing..." : "Publish to Feed"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
