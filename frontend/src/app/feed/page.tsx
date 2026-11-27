"use client";

import React, { useState, useEffect } from "react";
import { 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Share2, 
  ChefHat, 
  Image as ImageIcon, 
  Sparkles, 
  CheckCircle2, 
  Send,
  Pencil,
  Trash2,
  UtensilsCrossed,
  Filter
} from "lucide-react";
import { apiRequest, apiUpload } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [availableRecipes, setAvailableRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedFilter, setFeedFilter] = useState<"all" | "cooked_this">("all");

  // Create post modal / inline state
  const [caption, setCaption] = useState("");
  const [dishName, setDishName] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [technique, setTechnique] = useState("");
  const [isCookedThis, setIsCookedThis] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [mediaUploading, setMediaUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active comments modal
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [replyTarget, setReplyTarget] = useState<any>(null);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const url = feedFilter === "cooked_this" ? "/posts?cooked_only=true" : "/posts";
      const data = await apiRequest(url);
      setPosts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setMediaUploading(true);
    try {
      const upload = await apiUpload<{ media_url: string; media_type: string }>("/posts/upload-media", formData);
      setMediaUrl(upload.media_url);
      setMediaType(upload.media_type);
    } catch (error: any) {
      alert(error.message || "Unable to upload media.");
    } finally {
      setMediaUploading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [feedFilter]);

  useEffect(() => {
    apiRequest("/recipes?limit=100").then(setAvailableRecipes).catch(() => setAvailableRecipes([]));
  }, []);

  const handleLike = async (postId: string) => {
    try {
      const res = await apiRequest(`/posts/${postId}/like`, { method: "POST" });
      setPosts(posts.map((p) => p.post_id === postId ? { ...p, has_liked: res.liked, likes_count: res.likes_count } : p));
    } catch {
      alert("Please log in to like posts.");
    }
  };

  const handleSave = async (postId: string) => {
    const post = posts.find((item) => item.post_id === postId);
    if (!post) return;
    try {
      await apiRequest(`/posts/${postId}/save`, { method: post.has_saved ? "DELETE" : "POST" });
      setPosts((items) => items.map((item) =>
        item.post_id === postId ? { ...item, has_saved: !post.has_saved } : item
      ));
    } catch (error: any) {
      alert(error.message || "Please log in to save posts.");
    }
  };

  const handleShare = async (postId: string) => {
    try {
      const { share_url } = await apiRequest<{ share_url: string }>(`/posts/${postId}/share`, {
        method: "POST",
      });
      const url = new URL(share_url, window.location.origin).toString();
      if (navigator.share) await navigator.share({ title: "EpiCho post", url });
      else {
        await navigator.clipboard.writeText(url);
        alert("Post link copied.");
      }
    } catch (error: any) {
      if (error.name !== "AbortError") alert(error.message || "Unable to share this post.");
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption && !dishName) return;

    setIsSubmitting(true);
    try {
      const payload = {
        caption,
        dish_name: dishName,
        recipe_id: recipeId || null,
        technique,
        is_cooked_this: isCookedThis,
        media: mediaUrl ? [{ media_url: mediaUrl, media_type: mediaType, sort_order: 0 }] : []
      };

      await apiRequest("/posts", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setCaption("");
      setDishName("");
      setRecipeId("");
      setTechnique("");
      setMediaUrl("");
      setMediaType("image");
      setIsCookedThis(false);
      fetchPosts();
    } catch (err: any) {
      alert(err.message || "Please log in to share posts.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openComments = async (postId: string) => {
    setActiveCommentsPostId(postId);
    try {
      const data = await apiRequest(`/posts/${postId}/comments`);
      setCommentsList(data);
    } catch {
      setCommentsList([]);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText || !activeCommentsPostId) return;

    try {
      const newComment = await apiRequest(`/posts/${activeCommentsPostId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: commentText, parent_comment_id: replyTarget?.comment_id || null })
      });
      setCommentsList([...commentsList, newComment]);
      setCommentText("");
      setReplyTarget(null);
      // increment comment count in post
      setPosts(posts.map((p) => p.post_id === activeCommentsPostId ? { ...p, comments_count: p.comments_count + 1 } : p));
    } catch (err: any) {
      alert(err.message || "Please log in to comment.");
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await apiRequest(`/posts/comments/${commentId}`, { method: "DELETE" });
      const removedCount = commentsList.filter((item) => item.comment_id === commentId || item.parent_comment_id === commentId).length;
      setCommentsList((items) => items.filter((item) => item.comment_id !== commentId && item.parent_comment_id !== commentId));
      if (activeCommentsPostId) setPosts((items) => items.map((post) =>
        post.post_id === activeCommentsPostId ? { ...post, comments_count: Math.max(0, post.comments_count - removedCount) } : post
      ));
    } catch (error: any) {
      alert(error.message || "Unable to delete comment.");
    }
  };

  const editComment = async (comment: any) => {
    const content = window.prompt("Edit your comment", comment.content);
    if (content === null) return;
    try {
      const updated = await apiRequest(`/posts/comments/${comment.comment_id}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      });
      setCommentsList((items) => items.map((item) => item.comment_id === comment.comment_id ? updated : item));
    } catch (error: any) {
      alert(error.message || "Unable to edit comment.");
    }
  };

  const editPost = async (post: any) => {
    const caption = window.prompt("Edit your post caption", post.caption || "");
    if (caption === null) return;
    try {
      const updated = await apiRequest(`/posts/${post.post_id}`, {
        method: "PATCH",
        body: JSON.stringify({ caption }),
      });
      setPosts((items) => items.map((item) => item.post_id === post.post_id ? updated : item));
    } catch (error: any) {
      alert(error.message || "Unable to edit post.");
    }
  };

  const deletePost = async (postId: string) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await apiRequest(`/posts/${postId}`, { method: "DELETE" });
      setPosts((items) => items.filter((item) => item.post_id !== postId));
    } catch (error: any) {
      alert(error.message || "Unable to delete post.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Feed Filter Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2 border-b border-[#F2E6E2]">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
            Food Community Feed
          </h1>
          <p className="text-xs text-stone-500">
            Real dishes cooked by everyday foodies, verified creators, and master chefs.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setFeedFilter("all")}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              feedFilter === "all"
                ? "bg-white text-[#9A3412] shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            All Culinary Posts
          </button>
          <button
            onClick={() => setFeedFilter("cooked_this")}
            className={`px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              feedFilter === "cooked_this"
                ? "bg-white text-[#059669] shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
            Cooked This Proofs
          </button>
        </div>
      </div>

      {/* Share / Cooked This Publisher Box */}
      <div className="bg-white rounded-3xl p-6 border border-[#F2E6E2] shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
          <ChefHat className="w-5 h-5 text-[#9A3412]" />
          <span>Share What You Cooked Today</span>
        </div>

        <form onSubmit={handleCreatePost} className="space-y-3">
          <textarea
            placeholder="Share your culinary triumph, flavor adjustments, or recipe remix..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
            >
              <option value="">Link a recipe (optional)</option>
              {availableRecipes.map((recipe) => <option key={recipe.recipe_id} value={recipe.recipe_id}>{recipe.title}</option>)}
            </select>
            <input
              type="text"
              placeholder="Dish Name (e.g. Kashmiri Dum Aloo)"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
            />
            <input
              type="text"
              placeholder="Cooking Technique (e.g. Slow Braise, Tawa Sear)"
              value={technique}
              onChange={(e) => setTechnique(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-600">
            <ImageIcon className="w-4 h-4" />
            <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={handleMediaUpload} />
            {mediaUploading ? "Uploading…" : mediaUrl ? "Media ready" : "Upload a photo or video"}
          </label>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isCookedThis}
                onChange={(e) => setIsCookedThis(e.target.checked)}
                disabled={!recipeId || !mediaUrl}
                className="w-4 h-4 text-[#059669] rounded focus:ring-[#059669]"
              />
              <span className="text-[#059669]">Tag as "I Cooked This Recipe" proof (linked recipe and media required)</span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting || mediaUploading || (!caption && !dishName)}
              className="px-6 py-2 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#802B0F] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Posting..." : "Publish to Feed"}
            </button>
          </div>
        </form>
      </div>

      {/* Posts Feed Stream */}
      {loading ? (
        <div className="text-center py-12 text-stone-400 font-medium">Loading delicious posts...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-[#F2E6E2] space-y-2">
          <UtensilsCrossed className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="font-bold text-stone-700">No posts in this feed yet</h3>
          <p className="text-xs text-stone-400">Be the first to share your cooking result!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <article key={post.post_id} className="bg-white rounded-3xl border border-[#F2E6E2] overflow-hidden shadow-sm">
              {/* Post Header */}
              <div className="p-4 sm:p-5 flex items-center justify-between border-b border-stone-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center font-bold text-sm text-[#9A3412]">
                    {post.author_name ? post.author_name[0] : "C"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-[#0F172A]">{post.author_name}</span>
                      {post.is_verified && (
                        <CheckCircle2 className="w-4 h-4 text-[#059669] fill-[#059669]/10" />
                      )}
                    </div>
                    <span className="text-xs text-stone-400">@{post.author_username || "cook"}</span>
                  </div>
                  {user?.user_id === post.author_id && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => editPost(post)} aria-label="Edit post" className="p-2 text-stone-500 hover:text-[#9A3412]"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deletePost(post.post_id)} aria-label="Delete post" className="p-2 text-stone-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>

                {post.is_cooked_this && (
                  <span className="text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Cooked This Proof
                  </span>
                )}
              </div>

              {/* Media Image */}
              {post.media && post.media.length > 0 && (
                <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
                  {post.media[0].media_type === "video" ? (
                    <video src={post.media[0].media_url} controls className="w-full h-full object-cover" />
                  ) : (
                    <img src={post.media[0].media_url} alt={post.dish_name || "Food creation"} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                  )}
                  {post.dish_name && (
                    <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-xs font-bold">
                      {post.dish_name} {post.technique ? `• ${post.technique}` : ""}
                    </div>
                  )}
                </div>
              )}

              {/* Post Body & Actions */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between text-stone-600">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleLike(post.post_id)}
                      className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                        post.has_liked ? "text-red-600 font-bold" : "hover:text-red-500"
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${post.has_liked ? "fill-red-600 text-red-600" : ""}`} />
                      <span>{post.likes_count}</span>
                    </button>
                    <button
                      onClick={() => openComments(post.post_id)}
                      className="flex items-center gap-1.5 text-sm font-semibold hover:text-[#9A3412] transition-colors"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>{post.comments_count}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={post.has_saved ? "Remove saved post" : "Save post"}
                      onClick={() => handleSave(post.post_id)}
                      className={`flex items-center gap-1.5 text-sm font-semibold ${post.has_saved ? "text-emerald-700" : "hover:text-emerald-700"}`}
                    >
                      <Bookmark className={`w-5 h-5 ${post.has_saved ? "fill-emerald-700" : ""}`} />
                    </button>
                    <button
                      type="button"
                      aria-label="Share post"
                      onClick={() => handleShare(post.post_id)}
                      className="flex items-center gap-1.5 text-sm font-semibold hover:text-[#9A3412]"
                    >
                      <Share2 className="w-5 h-5" />
                      <span>{post.shares_count || 0}</span>
                    </button>
                  </div>

                  {post.recipe_id && (
                    <a
                      href={`/recipes/${post.recipe_id}`}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#FFFBEB] text-[#9A3412] border border-[#F2E6E2] hover:bg-[#F8F2F0] transition-colors flex items-center gap-1"
                    >
                      <ChefHat className="w-3.5 h-3.5 text-[#C2410C]" />
                      View Recipe
                    </a>
                  )}
                </div>

                <p className="text-sm text-stone-700 leading-relaxed">
                  {post.caption}
                </p>

                {/* Inline Comment Drawer Modal */}
                {activeCommentsPostId === post.post_id && (
                  <div className="pt-4 border-t border-stone-100 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">Comments</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {commentsList.map((c) => (
                        <div key={c.comment_id} className={`text-xs bg-stone-50 p-2.5 rounded-xl ${c.parent_comment_id ? "ml-5" : ""}`}>
                          <span className="font-bold text-stone-900 mr-2">{c.author_name}:</span>
                          <span className="text-stone-700">{c.content}</span>
                          <div className="mt-1 flex gap-3">
                            <button type="button" onClick={() => setReplyTarget(c)} className="font-semibold text-[#9A3412]">Reply</button>
                            {user?.user_id === c.user_id && <>
                              <button type="button" onClick={() => editComment(c)} className="font-semibold text-stone-600">Edit</button>
                              <button type="button" onClick={() => deleteComment(c.comment_id)} className="font-semibold text-red-600">Delete</button>
                            </>}
                          </div>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleAddComment} className="flex gap-2">
                      {replyTarget && <button type="button" onClick={() => setReplyTarget(null)} className="text-[11px] text-stone-500">Replying to {replyTarget.author_name} · cancel</button>}
                      <input
                        type="text"
                        placeholder={replyTarget ? "Write a reply..." : "Write a comment..."}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 text-xs focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-[#9A3412] text-white font-bold text-xs hover:bg-[#802B0F]"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
