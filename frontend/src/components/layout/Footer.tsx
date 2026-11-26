import React from "react";
import Link from "next/link";
import { ChefHat, Heart } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#14281D] text-stone-300 border-t border-emerald-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#EA580C] flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <span className="font-display text-xl font-bold text-white">EpiCho</span>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              Discover. Create. Cook. Connect. An AI-powered culinary social ecosystem uniting recipes, 9:16 Reels, meal planning, and culinary heritage.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-3">Discover</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/explore" className="hover:text-white transition-colors">Explore EpiCho</Link></li>
              <li><Link href="/ai-kitchen" className="hover:text-white transition-colors">AI Kitchen Studio</Link></li>
              <li><Link href="/reels" className="hover:text-white transition-colors">Cooking Reels</Link></li>
              <li><Link href="/hidden-gems" className="hover:text-white transition-colors">Hidden Gems</Link></li>
              <li><Link href="/rankings" className="hover:text-white transition-colors">Bayesian Rankings</Link></li>
              <li><Link href="/heritage" className="hover:text-white transition-colors">Grandmother&apos;s Recipes</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-3">Tools & Professionals</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/meal-planner" className="hover:text-white transition-colors">Meal Planner</Link></li>
              <li><Link href="/grocery" className="hover:text-white transition-colors">Smart Grocery List</Link></li>
              <li><Link href="/restaurants" className="hover:text-white transition-colors">Restaurant Discovery</Link></li>
              <li><Link href="/consultations" className="hover:text-white transition-colors">Nutritionists & Dietitians</Link></li>
              <li><Link href="/blogs" className="hover:text-white transition-colors">Culinary Blogs</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Subscriptions & Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-3">Dashboards & Governance</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/about" className="hover:text-white transition-colors">About EpiCho</Link></li>
              <li><Link href="/creator/dashboard" className="hover:text-white transition-colors">Creator Studio</Link></li>
              <li><Link href="/business/dashboard" className="hover:text-white transition-colors">Business Portal</Link></li>
              <li><Link href="/nutritionist/dashboard" className="hover:text-white transition-colors">Nutritionist Portal</Link></li>
              <li><Link href="/critic/dashboard" className="hover:text-white transition-colors">Food Critic Portal</Link></li>
              <li><Link href="/admin/login" className="hover:text-amber-300 transition-colors">Staff Admin Login</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-emerald-900/70 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400">
          <p>© {new Date().getFullYear()} EpiCho Culinary Technologies. DPDP Privacy Aligned.</p>
          <p className="flex items-center gap-1.5">
            Built with culinary care <Heart className="w-3.5 h-3.5 text-[#EA580C]" aria-hidden="true" /> for kitchens everywhere
          </p>
        </div>
      </div>
    </footer>
  );
};
