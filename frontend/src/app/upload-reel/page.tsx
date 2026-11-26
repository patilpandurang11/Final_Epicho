"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Film, UploadCloud, Link as LinkIcon, Sparkles, CheckCircle2, 
  ArrowLeft, AlertCircle, Play, Tag
} from "lucide-react";
import { api } from "@/lib/api";

export default function UploadReelPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-chef-slicing-onions-42407-large.mp4");
  const [recipeId, setRecipeId] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(45);
  const [tags, setTags] = useState("quickbites, streetfood, crispy");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        title,
        description,
        video_url: videoUrl,
        duration_seconds: durationSeconds,
        recipe_id: recipeId ? recipeId : undefined,
      };

      await api.createReel(payload);
      setSuccess(true);
      setTimeout(() => {
        router.push("/reels");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to upload reel. Please check your credentials.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/reels" className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 mb-6 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Reels
      </Link>

      <div className="pb-4 border-b border-border mb-8">
        <h1 className="text-3xl font-extrabold text-stone-900 font-serif">Upload Food Reel (9:16)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Share short culinary magic, knife skills, plating aesthetics, and step-by-step teasers.
        </p>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 mb-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Reel uploaded successfully! Redirecting to feed...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left 9:16 Preview */}
        <div className="md:col-span-1 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">Reel Preview</label>
          <div className="relative aspect-[9/16] bg-stone-900 rounded-3xl overflow-hidden shadow-lg border border-border flex items-center justify-center group">
            {videoUrl ? (
              <video
                src={videoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-4">
                <UploadCloud className="w-10 h-10 text-stone-600 mx-auto mb-2" />
                <span className="text-xs text-stone-400">9:16 Vertical Video</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4 pointer-events-none">
              <span className="text-white text-xs font-bold line-clamp-1">{title || "Your Reel Title"}</span>
              <span className="text-white/70 text-[10px] line-clamp-1">{description || "Caption preview will appear here..."}</span>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground block text-center">
            Max 60 seconds • Vertical 1080x1920 recommended
          </span>
        </div>

        {/* Right Form Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Reel Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Secret to Fluffy Sourdough in 60 Seconds"
                className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Caption & Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Share your tips, flavor notes, or a question to spark comments..."
                className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Video Stream URL *</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2 rounded-xl border border-border text-sm"
                required
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                CDN or cloud object storage URL (MP4 / HLS).
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Duration (seconds)</label>
                <input
                  type="number"
                  max={90}
                  min={5}
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Link to Recipe (UUID)</label>
                <input
                  type="text"
                  value={recipeId}
                  onChange={(e) => setRecipeId(e.target.value)}
                  placeholder="Optional recipe link"
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-stone-400" /> Hashtags & Keywords
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="baking, sourdough, artisan"
                className="w-full px-3 py-2 rounded-xl border border-border text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            <Link
              href="/reels"
              className="px-5 py-2.5 rounded-xl border border-border text-stone-700 text-sm font-semibold hover:bg-stone-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white text-sm font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Film className="w-4 h-4" /> Publish Reel
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
