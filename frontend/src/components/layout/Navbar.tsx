"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/components/layout/ThemeProvider";
import { apiRequest } from "@/lib/api";
import {
  Bell,
  Bookmark,
  BookOpen,
  CalendarDays,
  ChefHat,
  Compass,
  Crown,
  Film,
  Flame,
  HeartHandshake,
  LogOut,
  Menu,
  Moon,
  PlusCircle,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Sun,
  Trophy,
  User,
  UtensilsCrossed,
  X,
} from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout, isAdmin, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    apiRequest<{ unread_count: number }>("/notifications")
      .then((res) => setUnreadCount(res.unread_count || 0))
      .catch(() => {});
  }, [user]);

  return (
    <header className="sticky top-0 z-50 bg-[#FDFBF7]/92 dark:bg-[#0D1511]/92 backdrop-blur-md border-b border-[#E7DFD3] dark:border-[#253D31]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] rounded-xl px-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9A3412] via-[#C2410C] to-[#EA580C] flex items-center justify-center shadow-sm">
              <ChefHat className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
                EpiCho
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#059669]">
                Culinary AI
              </span>
            </div>
          </Link>

          {/* Primary Desktop Nav */}
          <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-5 text-sm font-semibold text-[#475569] dark:text-[#A7B8AE]">
            <Link href="/explore" className="hover:text-[#9A3412] dark:hover:text-white transition-colors flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#059669]" aria-hidden="true" />
              Explore
            </Link>
            <Link href="/ai-kitchen" className="hover:text-[#9A3412] dark:hover:text-white transition-colors flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#EA580C]" aria-hidden="true" />
              AI Kitchen
            </Link>
            <Link href="/recipes" className="hover:text-[#9A3412] dark:hover:text-white transition-colors flex items-center gap-1.5">
              <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
              Recipes
            </Link>
            <Link href="/reels" className="hover:text-[#9A3412] dark:hover:text-white transition-colors flex items-center gap-1.5">
              <Film className="w-4 h-4 text-[#C2410C]" aria-hidden="true" />
              Reels
            </Link>
            <Link href="/feed" className="hover:text-[#9A3412] dark:hover:text-white transition-colors flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[#EA580C]" aria-hidden="true" />
              Feed
            </Link>
            <Link href="/hidden-gems" className="hover:text-[#9A3412] dark:hover:text-white transition-colors flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-600" aria-hidden="true" />
              Hidden Gems
            </Link>
            <Link href="/meal-planner" className="hover:text-[#9A3412] dark:hover:text-white transition-colors flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" aria-hidden="true" />
              Planner
            </Link>
            <Link href="/heritage" className="hover:text-[#9A3412] dark:hover:text-white transition-colors flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-[#059669]" aria-hidden="true" />
              Heritage
            </Link>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="p-2 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] text-[#475569] dark:text-[#A7B8AE] hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/create-recipe"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#059669] text-white text-xs font-bold hover:bg-[#047857] transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  Create
                </Link>

                <Link
                  href="/notifications"
                  aria-label="Notifications"
                  className="relative p-2 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] text-[#475569] dark:text-[#A7B8AE] hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EA580C] text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin/dashboard"
                    className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#0F172A] text-amber-300 text-xs font-bold hover:bg-slate-800 transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    Admin
                  </Link>
                )}

                {hasRole("creator") && (
                  <Link
                    href="/creator/dashboard"
                    className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-100 text-amber-900 text-xs font-bold"
                  >
                    <Crown className="w-3.5 h-3.5" aria-hidden="true" />
                    Creator
                  </Link>
                )}

                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#13211A] hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] transition-colors"
                >
                  <User className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
                  <span className="hidden sm:inline text-xs font-bold max-w-[90px] truncate">
                    {user.full_name.split(" ")[0]}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={logout}
                  aria-label="Log out"
                  className="p-2 rounded-xl text-[#475569] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/pricing"
                  className="hidden sm:inline-flex px-3 py-1.5 rounded-xl text-xs font-semibold text-[#475569] dark:text-[#A7B8AE] hover:text-[#9A3412]"
                >
                  Pricing
                </Link>
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#0F172A] dark:text-white border border-[#E7DFD3] dark:border-[#253D31] hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24]"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#EA580C] text-white hover:bg-[#C2410C] shadow-sm transition-colors"
                >
                  Join Free
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-2 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] text-[#0F172A] dark:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#13211A] px-4 py-4 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
            <Link href="/explore" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#059669]" /> Explore
            </Link>
            <Link href="/ai-kitchen" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#EA580C]" /> AI Kitchen
            </Link>
            <Link href="/recipes" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4" /> Recipes
            </Link>
            <Link href="/reels" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <Film className="w-4 h-4" /> Reels
            </Link>
            <Link href="/feed" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <Flame className="w-4 h-4" /> Feed
            </Link>
            <Link href="/blogs" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Blogs
            </Link>
            <Link href="/restaurants" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4" /> Restaurants
            </Link>
            <Link href="/rankings" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-600" /> Rankings
            </Link>
            <Link href="/hidden-gems" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" /> Hidden Gems
            </Link>
            <Link href="/heritage" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-[#059669]" /> Heritage
            </Link>
            <Link href="/meal-planner" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Meal Planner
            </Link>
            <Link href="/grocery" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Grocery
            </Link>
            <Link href="/saved-recipes" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <Bookmark className="w-4 h-4" /> Saved
            </Link>
            <Link href="/consultations" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Nutritionists
            </Link>
            <Link href="/settings" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <Settings className="w-4 h-4" /> Settings
            </Link>
            <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-xl hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] flex items-center gap-2">
              <Crown className="w-4 h-4" /> Pricing
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
