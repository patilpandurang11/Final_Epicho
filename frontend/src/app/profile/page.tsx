"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import {
  BadgeCheck,
  Bookmark,
  ChefHat,
  Crown,
  KeyRound,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

export default function ProfilePage() {
  const { user, isLoading, refreshUser } = useAuth();
  const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
  const [verifyRole, setVerifyRole] = useState("creator");
  const [docRef, setDocRef] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("Mumbai");
  const [allergies, setAllergies] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (!user) return;
    setBio(user.profile?.bio || "");
    setCity(user.profile?.city || "Mumbai");
    setAllergies((user.profile?.allergies || []).join(", "));
    setConsent(Boolean(user.profile?.health_data_consent));
    apiRequest("/recipes/saved").then(setSavedRecipes).catch(() => {});
  }, [user]);

  if (isLoading) {
    return <div className="max-w-5xl mx-auto px-4 py-16 text-center text-sm">Loading profile...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
        <User className="w-12 h-12 mx-auto text-[#9A3412]" />
        <h1 className="text-2xl font-bold">Sign in to view your culinary profile</h1>
        <Link href="/login">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      await apiRequest("/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          bio,
          city,
          health_data_consent: consent,
          allergies: allergies.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      await refreshUser();
      setStatusMsg("Profile and dietary preferences saved.");
    } catch (err: any) {
      setStatusMsg(err.message);
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      await apiRequest("/admin/verifications/submit", {
        method: "POST",
        body: JSON.stringify({
          target_role: verifyRole,
          document_reference: docRef,
          portfolio_url: portfolioUrl,
        }),
      });
      setStatusMsg(`Verification application submitted for '${verifyRole}'.`);
      setDocRef("");
    } catch (err: any) {
      setStatusMsg(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9A3412] to-[#EA580C] text-white flex items-center justify-center text-2xl font-bold">
              {user.full_name.charAt(0)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{user.full_name}</h1>
                {user.is_verified && (
                  <Badge variant="emerald">
                    <BadgeCheck className="w-3.5 h-3.5" /> Verified
                  </Badge>
                )}
                <Badge variant="amber">
                  <Crown className="w-3.5 h-3.5" /> {(user.tier || user.account_tier).toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-[#475569] dark:text-[#A7B8AE]">
                @{user.username || "chef"} • {user.email}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {user.roles?.map((r) => (
                  <Badge key={r} variant="outline">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/settings">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4" /> Settings
              </Button>
            </Link>
            <Link href="/subscriptions">
              <Button variant="emerald" size="sm">
                <Sparkles className="w-4 h-4" /> Subscription
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-200 font-medium">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#059669]" /> Culinary & DPDP Allergy Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Bio</label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell the community about your cooking style..." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">City</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Encrypted Allergies (comma-separated)</label>
                  <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Peanuts, Dairy" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#A7B8AE]">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="rounded border-stone-300"
                />
                I consent to encrypted storage of my dietary & health preferences (DPDP aligned).
              </label>
              <Button type="submit" variant="primary">Save Preferences</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#EA580C]" /> Apply for Role Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitVerification} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Role to Verify</label>
                <select
                  value={verifyRole}
                  onChange={(e) => setVerifyRole(e.target.value)}
                  className="w-full h-10 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#0D1511] px-3 text-sm"
                >
                  <option value="creator">Verified Creator</option>
                  <option value="business">Business / Restaurant (FSSAI)</option>
                  <option value="nutritionist">Nutritionist / Dietitian (IDA)</option>
                  <option value="critic">Food Critic / Reviewer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Credential / FSSAI / License Reference</label>
                <Input
                  required
                  value={docRef}
                  onChange={(e) => setDocRef(e.target.value)}
                  placeholder="e.g., FSSAI-10019022009876 or RD-IDA-4512"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Portfolio or Publication Link</label>
                <Input
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <Button type="submit" variant="emerald">Submit for Verification</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-[#9A3412]" /> Saved Recipes ({savedRecipes.length})
          </CardTitle>
          <Link href="/saved-recipes" className="text-xs font-bold text-[#059669] hover:underline">
            View Full Cookbook
          </Link>
        </CardHeader>
        <CardContent>
          {savedRecipes.length === 0 ? (
            <p className="text-sm text-[#475569]">No saved recipes yet. Explore recipes or AI Kitchen to bookmark dishes.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {savedRecipes.slice(0, 6).map((r) => (
                <Link key={r.recipe_id} href={`/recipes/${r.slug}`} className="p-3 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] hover:border-[#059669] transition-colors flex items-center gap-3">
                  <ChefHat className="w-5 h-5 text-[#EA580C] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{r.title}</p>
                    <p className="text-xs text-[#475569]">{r.cuisine_type} • {r.cook_time_mins} mins</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
