"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Share2, 
  ChefHat, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  ChevronUp, 
  ChevronDown, 
  Plus, 
  CheckCircle2, 
  Sparkles,
  Utensils,
  CalendarPlus,
  ShoppingCart
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const CATEGORIES = [
  "All", "Trending Food Reels", "Street Food", "Home Cooking", 
  "Desserts", "Healthy Food", "Traditional Food", "International Cuisine"
];

export default function ReelsPage() {
  const { user } = useAuth();
  const [reels, setReels] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [category, setCategory] = useState("All");
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [recipeDrawerOpen, setRecipeDrawerOpen] = useState(false);
  const [linkedRecipe, setLinkedRecipe] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchReels = async () => {
    try {
      const url = category === "All" ? "/reels" : `/reels?category=${encodeURIComponent(category)}`;
      const data = await apiRequest(url);
      setReels(data);
      setCurrentIndex(0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchReels();
  }, [category]);

  const currentReel = reels[currentIndex];

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [currentIndex, isPlaying]);

  const handleNext = () => {
    if (currentIndex < reels.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsPlaying(true);
      setRecipeDrawerOpen(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsPlaying(true);
      setRecipeDrawerOpen(false);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentReel) return;
    try {
      const res = await apiRequest(`/reels/${currentReel.reel_id}/like`, { method: "POST" });
      setReels(reels.map((r, idx) => idx === currentIndex ? { ...r, has_liked: res.liked, likes_count: res.likes_count } : r));
    } catch {
      alert("Please log in to like reels.");
    }
  };

  const openRecipeDetails = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentReel?.recipe_id) return;
    try {
      const recipe = await apiRequest(`/recipes/${currentReel.recipe_id}`);
      setLinkedRecipe(recipe);
      setRecipeDrawerOpen(true);
    } catch {
      alert("Could not load linked recipe.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#0D1A13] text-white flex flex-col items-center justify-center p-0 sm:p-4">
      {/* Category Pills Header */}
      <div className="w-full max-w-md py-3 px-4 flex gap-2 overflow-x-auto scrollbar-none z-20 bg-[#0D1A13]/90">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold transition-all ${
              category === cat
                ? "bg-[#C2410C] text-white shadow-md"
                : "bg-white/10 text-stone-300 hover:bg-white/20"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main 9:16 Reels Frame */}
      <div className="relative w-full max-w-[420px] h-[calc(100vh-140px)] sm:h-[720px] bg-black rounded-none sm:rounded-3xl overflow-hidden shadow-2xl border-0 sm:border border-stone-800 flex items-center justify-center">
        {currentReel ? (
          <div 
            onClick={togglePlay}
            className="relative w-full h-full cursor-pointer group flex items-center justify-center"
          >
            {/* Video Element */}
            <video
              ref={videoRef}
              src={currentReel.video_url}
              loop
              muted={isMuted}
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Play/Pause indicator icon */}
            {!isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                <Play className="w-16 h-16 text-white/90 fill-white/80" />
              </div>
            )}

            {/* Sound Toggle */}
            <button
              onClick={toggleMute}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition-colors z-30"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* Right Action Bar */}
            <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-30">
              {/* Creator Profile / Follow */}
              <div className="relative">
                <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden bg-[#9A3412] flex items-center justify-center font-bold text-sm">
                  {currentReel.author_name ? currentReel.author_name[0] : "C"}
                </div>
                <button className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#C2410C] text-white flex items-center justify-center font-bold text-xs shadow-md">
                  +
                </button>
              </div>

              {/* Like */}
              <button
                onClick={handleLike}
                className="flex flex-col items-center gap-1 group/btn"
              >
                <div className={`p-3 rounded-full bg-black/40 backdrop-blur-md transition-transform group-hover/btn:scale-110 ${
                  currentReel.has_liked ? "text-red-500 fill-red-500" : "text-white"
                }`}>
                  <Heart className={`w-6 h-6 ${currentReel.has_liked ? "fill-red-500" : ""}`} />
                </div>
                <span className="text-xs font-bold">{currentReel.likes_count}</span>
              </button>

              {/* Comment */}
              <button 
                onClick={(e) => { e.stopPropagation(); alert("Open Comments drawer"); }}
                className="flex flex-col items-center gap-1 group/btn"
              >
                <div className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white transition-transform group-hover/btn:scale-110">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold">{currentReel.comments_count}</span>
              </button>

              {/* Save */}
              <button 
                onClick={(e) => { e.stopPropagation(); alert("Reel saved!"); }}
                className="flex flex-col items-center gap-1 group/btn"
              >
                <div className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white transition-transform group-hover/btn:scale-110">
                  <Bookmark className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold">Save</span>
              </button>

              {/* Share */}
              <button 
                onClick={(e) => { e.stopPropagation(); alert("Share link copied!"); }}
                className="flex flex-col items-center gap-1 group/btn"
              >
                <div className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white transition-transform group-hover/btn:scale-110">
                  <Share2 className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold">Share</span>
              </button>
            </div>

            {/* Bottom Caption & Linked Recipe Integration */}
            <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-20 space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">@{currentReel.author_username || "chef"}</span>
                {currentReel.is_verified && (
                  <CheckCircle2 className="w-4 h-4 text-[#059669] fill-white" />
                )}
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/20 text-stone-200">
                  {currentReel.category}
                </span>
              </div>

              <h3 className="font-extrabold text-base text-white leading-snug">
                {currentReel.title}
              </h3>
              
              <p className="text-xs text-stone-300 line-clamp-2">
                {currentReel.caption}
              </p>

              {/* Cooking Recipe Integration Drawer Trigger */}
              {currentReel.recipe_id && (
                <div className="pt-1">
                  <button
                    onClick={openRecipeDetails}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#9A3412] to-[#C2410C] text-white font-bold text-xs flex items-center justify-between shadow-lg shadow-[#9A3412]/40 hover:opacity-95 transition-opacity"
                  >
                    <span className="flex items-center gap-1.5">
                      <ChefHat className="w-4 h-4 text-amber-300" />
                      <span>Cook This: View Full Recipe & Ingredients</span>
                    </span>
                    <span className="text-amber-200 font-extrabold text-xs">Tap to Open →</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center p-6 space-y-2">
            <p className="text-stone-400">Loading food short videos...</p>
          </div>
        )}

        {/* Up / Down Navigation Controls for Desktop */}
        <div className="hidden lg:flex flex-col gap-3 absolute -right-16 top-1/2 -translate-y-1/2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-all"
          >
            <ChevronUp className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === reels.length - 1}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-all"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Linked Recipe Slide-up Drawer Modal */}
      {recipeDrawerOpen && linkedRecipe && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6 text-stone-900 max-h-[85vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-xs font-bold text-[#9A3412] bg-[#9A3412]/10 px-2.5 py-0.5 rounded-full">
                  Linked Recipe
                </span>
                <h3 className="text-xl font-black text-[#0F172A] mt-1">{linkedRecipe.title}</h3>
              </div>
              <button
                onClick={() => setRecipeDrawerOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-700 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">{linkedRecipe.description}</p>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">Ingredients</h4>
              <ul className="space-y-1.5 text-xs">
                {linkedRecipe.ingredients?.map((ing: any, i: number) => (
                  <li key={i} className="flex justify-between py-1 border-b border-stone-50">
                    <span className="font-medium text-stone-800">{ing.ingredient_name}</span>
                    <span className="font-bold text-stone-500">{ing.quantity} {ing.unit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100">
              <a
                href="/meal-planner"
                className="py-2.5 px-3 rounded-xl bg-amber-50 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-amber-100"
              >
                <CalendarPlus className="w-4 h-4 text-amber-700" />
                Add to Planner
              </a>
              <a
                href="/grocery"
                className="py-2.5 px-3 rounded-xl bg-emerald-50 text-emerald-900 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-100"
              >
                <ShoppingCart className="w-4 h-4 text-emerald-700" />
                To Grocery List
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
