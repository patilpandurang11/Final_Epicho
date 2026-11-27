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

type SavedCollectionSummary = {
  collection_id: string;
  name: string;
};

type CollectionItemSummary = {
  item_id: string;
  recipe_id?: string | null;
};

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [adjustedServings, setAdjustedServings] = useState<number | null>(null);
  const [adjustedIngredients, setAdjustedIngredients] = useState<any[] | null>(null);
  const [collections, setCollections] = useState<SavedCollectionSummary[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [collectionFeedback, setCollectionFeedback] = useState<string | null>(null);
  const [collectionFeedbackError, setCollectionFeedbackError] = useState(false);
  const [collectionItemId, setCollectionItemId] = useState<string | null>(null);
  const [collectionItemLoading, setCollectionItemLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    apiRequest(`/recipes/${encodeURIComponent(slug)}`).then((r) => {
      if (!active) return;
      setRecipe(r);
      apiRequest(`/recipes/${r.recipe_id}/versions`).then(setVersions).catch(() => {});
      apiRequest(`/recipes/${r.recipe_id}/reviews`).then(setReviews).catch(() => {});
      apiRequest(`/recipes/${r.recipe_id}/comments`).then(setComments).catch(() => {});
      if (user) {
        apiRequest<SavedCollectionSummary[]>("/posts/collections")
          .then(setCollections)
          .catch((error: Error) => {
            setCollectionFeedback(error.message);
            setCollectionFeedbackError(true);
          });
      }
    }).catch((error: Error) => {
      if (active) setLoadError(error.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [slug, user]);

  const currentRecipeId = recipe?.recipe_id;
  useEffect(() => {
    if (!collectionId || !currentRecipeId || !user) return;
    let active = true;
    apiRequest<CollectionItemSummary[]>(`/posts/collections/${collectionId}/items`)
      .then((items) => {
        if (!active) return;
        const savedItem = items.find((item) => item.recipe_id === currentRecipeId);
        setCollectionItemId(savedItem?.item_id ?? null);
      })
      .catch((error: Error) => {
        if (active) {
          setCollectionFeedback(error.message);
          setCollectionFeedbackError(true);
        }
      })
      .finally(() => {
        if (active) setCollectionItemLoading(false);
      });
    return () => {
      active = false;
    };
  }, [collectionId, currentRecipeId, user]);

  const handleSave = async () => {
    if (!user) return router.push("/login");
    const res = await apiRequest(`/recipes/${recipe.recipe_id}/save`, { method: "POST" });
    setFeedbackError(false);
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
    setFeedbackError(false);
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

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return router.push("/login");
    await apiRequest(`/recipes/${recipe.recipe_id}/comments`, {
      method: "POST",
      body: JSON.stringify({ content: commentText, parent_comment_id: replyTo?.comment_id || null }),
    });
    setCommentText("");
    setReplyTo(null);
    setComments(await apiRequest(`/recipes/${recipe.recipe_id}/comments`));
  };

  const handleAdjustServings = async (servings: number) => {
    if (!recipe || servings < 1) return;
    try {
      const adjusted = await apiRequest(
        `/recipes/${recipe.recipe_id}/adjust-servings?servings=${servings}`,
      );
      setAdjustedServings(adjusted.adjusted_servings);
      setAdjustedIngredients(adjusted.ingredients);
    } catch (error: any) {
      setFeedback(error.message);
      setFeedbackError(true);
    }
  };

  const handleReviewFeedback = async (reviewId: string, helpful: boolean) => {
    if (!user) return router.push("/login");
    try {
      const result = await apiRequest(
        `/recipes/${recipe.recipe_id}/reviews/${reviewId}/feedback?helpful=${helpful}`,
        { method: "POST" },
      );
      setReviews((items) => items.map((item) =>
        item.review_id === reviewId
          ? { ...item, helpful_count: result.helpful_count, unhelpful_count: result.unhelpful_count }
          : item
      ));
    } catch (error: any) {
      setFeedback(error.message);
      setFeedbackError(true);
    }
  };

  const handleCollectionItem = async () => {
    if (!user) return router.push("/login");
    if (!recipe || !collectionId) return;
    setCollectionFeedback(null);
    setCollectionFeedbackError(false);
    try {
      if (collectionItemId) {
        await apiRequest(
          `/posts/collections/${collectionId}/items/${collectionItemId}`,
          { method: "DELETE" },
        );
        setCollectionItemId(null);
        setCollectionFeedback("Recipe removed from the collection.");
        return;
      }
      const result = await apiRequest(
        `/posts/collections/${collectionId}/items`,
        {
          method: "POST",
          body: JSON.stringify({ recipe_id: recipe.recipe_id }),
        },
      );
      setCollectionItemId(result.item_id);
      setCollectionFeedback(
        result.already_saved
          ? "This recipe is already in the selected collection."
          : "Recipe added to the collection.",
      );
    } catch (error: any) {
      setCollectionFeedback(error.message);
      setCollectionFeedbackError(true);
    }
  };

  const handleReportReview = async (event: React.FormEvent, reviewId: string) => {
    event.preventDefault();
    if (!user) return router.push("/login");
    try {
      await apiRequest(
        `/recipes/${recipe.recipe_id}/reviews/${reviewId}/report?reason=${encodeURIComponent(reportReason)}`,
        { method: "POST" },
      );
      setReportingReviewId(null);
      setReportReason("");
      setFeedbackError(false);
      setFeedback("Review report submitted for moderation.");
    } catch (error: any) {
      setFeedback(error.message);
      setFeedbackError(true);
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-20 text-center text-sm">Loading recipe details...</div>;
  }

  if (loadError) {
    return <p role="alert" className="max-w-5xl mx-auto px-4 py-20 text-center text-sm text-red-700">{loadError}</p>;
  }

  if (!recipe) {
    return <p role="alert" className="max-w-5xl mx-auto px-4 py-20 text-center text-sm">Recipe not found.</p>;
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
            <p
              role={feedbackError ? "alert" : "status"}
              className={`text-xs font-semibold p-3 rounded-xl ${feedbackError ? "text-red-700 bg-red-50" : "text-[#059669] bg-emerald-50 dark:bg-emerald-950/40"}`}
            >
              {feedback}
            </p>
          )}
          {user && (
            <div className="space-y-2 rounded-xl border border-[#E7DFD3] p-3 dark:border-[#253D31]">
              <label htmlFor="recipe-collection" className="text-xs font-bold">Save to collection</label>
              <div className="flex flex-wrap gap-2">
                <select
                  id="recipe-collection"
                  aria-label="Select collection"
                  value={collectionId}
                  onChange={(event) => {
                    const selectedId = event.target.value;
                    setCollectionId(selectedId);
                    setCollectionItemId(null);
                    setCollectionItemLoading(Boolean(selectedId));
                    setCollectionFeedback(null);
                    setCollectionFeedbackError(false);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select a collection</option>
                  {collections.map((collection) => (
                    <option key={collection.collection_id} value={collection.collection_id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!collectionId || collectionItemLoading}
                  onClick={handleCollectionItem}
                >
                  {collectionItemLoading ? "Checking..." : collectionItemId ? "Remove from collection" : "Add to collection"}
                </Button>
              </div>
              {collectionFeedback && (
                <p
                  role={collectionFeedbackError ? "alert" : "status"}
                  className={`text-xs ${collectionFeedbackError ? "text-red-700" : "text-emerald-800"}`}
                >
                  {collectionFeedback}
                </p>
              )}
              {collections.length === 0 && <p className="text-xs text-stone-600">Create a collection from your profile first.</p>}
            </div>
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
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <span className="text-xs font-bold">Adjust servings:</span>
              {[1, 2, 4, 6, 8].map((count) => (
                <Button
                  key={count}
                  type="button"
                  size="sm"
                  variant={adjustedServings === count ? "emerald" : "outline"}
                  onClick={() => handleAdjustServings(count)}
                >
                  {count}
                </Button>
              ))}
            </div>
            {adjustedIngredients && (
              <p className="text-xs text-amber-700">
                Estimated quantities for {adjustedServings} servings. Exact scaling may require culinary judgment.
              </p>
            )}
            {(adjustedIngredients || recipe.ingredients)?.map((ing: any, i: number) => (
              <div key={i} className="flex justify-between text-sm py-1.5 border-b border-[#E7DFD3]/60 dark:border-[#253D31]">
                <span className="font-medium">{ing.ingredient_name}</span>
                <span className="text-xs font-bold text-[#475569]">
                  {ing.quantity} {ing.unit}
                </span>
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
          <CardHeader><CardTitle>Recipe discussion ({comments.length})</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {comments.map((comment) => (
                <div key={comment.comment_id} className={`rounded-xl bg-[#F5F0E6]/60 dark:bg-[#1A2D24] p-3 ${comment.parent_comment_id ? "ml-6" : ""}`}>
                  <p className="text-xs font-bold">{comment.author_name}</p>
                  <p className="text-sm">{comment.content}</p>
                  <button type="button" onClick={() => setReplyTo(comment)} className="mt-1 text-xs font-semibold text-[#9A3412]">Reply</button>
                </div>
              ))}
            </div>
            <form onSubmit={handleSubmitComment} className="space-y-2">
              {replyTo && <button type="button" onClick={() => setReplyTo(null)} className="text-xs text-stone-500">Replying to {replyTo.author_name} · cancel</button>}
              <Textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} required placeholder={replyTo ? "Write a reply…" : "Join the recipe discussion…"} />
              <Button type="submit" variant="primary" size="sm">Post Comment</Button>
            </form>
          </CardContent>
      </Card>

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
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleReviewFeedback(rv.review_id, true)}
                  >
                    Helpful ({rv.helpful_count || 0})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleReviewFeedback(rv.review_id, false)}
                  >
                    Not helpful ({rv.unhelpful_count || 0})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReportingReviewId(reportingReviewId === rv.review_id ? null : rv.review_id);
                      setReportReason("");
                    }}
                  >
                    Report review
                  </Button>
                </div>
                {reportingReviewId === rv.review_id && (
                  <form onSubmit={(event) => handleReportReview(event, rv.review_id)} className="space-y-2 pt-2">
                    <Textarea
                      aria-label="Reason for reporting review"
                      required
                      minLength={5}
                      maxLength={2000}
                      value={reportReason}
                      onChange={(event) => setReportReason(event.target.value)}
                      placeholder="Explain why this review should be reviewed."
                    />
                    <Button type="submit" size="sm" variant="destructive">Submit report</Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
