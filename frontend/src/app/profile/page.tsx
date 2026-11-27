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
  Plus,
  Trash2,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

export default function ProfilePage() {
  const { user, isLoading, refreshUser } = useAuth();
  const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [collectionItems, setCollectionItems] = useState<Record<string, any[]>>({});
  const [collectionName, setCollectionName] = useState("");
  const [followRequests, setFollowRequests] = useState<any[]>([]);
  const [verifyRole, setVerifyRole] = useState("creator");
  const [docRef, setDocRef] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("Mumbai");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [cuisineInterests, setCuisineInterests] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [dietPreference, setDietPreference] = useState("veg");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [allergies, setAllergies] = useState("");
  const [consent, setConsent] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (!user) return;
    setBio(user.profile?.bio || "");
    setCity(user.profile?.city || "Mumbai");
    setFullName(user.full_name || "");
    setUsername(user.username || "");
    setAvatarUrl(user.avatar_url || "");
    setCoverImageUrl(user.profile?.cover_image_url || "");
    setCuisineInterests((user.profile?.cuisine_interests || []).join(", "));
    setWebsiteUrl(user.profile?.website_url || "");
    setSocialLinks(
      Object.entries(user.profile?.social_links || {})
        .map(([name, url]) => `${name}=${url}`)
        .join(", "),
    );
    setDietPreference(user.profile?.diet_preference || "veg");
    setDietaryRestrictions((user.profile?.dietary_restrictions || []).join(", "));
    setDislikes((user.profile?.dislikes || []).join(", "));
    setAllergies((user.profile?.allergies || []).join(", "));
    setConsent(Boolean(user.profile?.health_data_consent));
    setIsPrivate(Boolean(user.profile?.is_private));
    apiRequest("/recipes/saved").then(setSavedRecipes).catch(() => {});
    apiRequest("/posts/saved").then(setSavedPosts).catch(() => setSavedPosts([]));
    apiRequest("/posts/collections").then(setCollections).catch(() => setCollections([]));
    apiRequest("/posts/follow-requests").then(setFollowRequests).catch(() => setFollowRequests([]));
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
          full_name: fullName,
          username,
          avatar_url: avatarUrl || null,
          cover_image_url: coverImageUrl || null,
          cuisine_interests: cuisineInterests.split(",").map((item) => item.trim()).filter(Boolean),
          website_url: websiteUrl || null,
          social_links: Object.fromEntries(
            socialLinks.split(",").map((item) => {
              const [name, ...urlParts] = item.split("=");
              return [name.trim(), urlParts.join("=").trim()];
            }).filter(([name, url]) => name && url),
          ),
          bio,
          city,
          diet_preference: dietPreference,
          dietary_restrictions: dietaryRestrictions.split(",").map((s) => s.trim()).filter(Boolean),
          dislikes: dislikes.split(",").map((s) => s.trim()).filter(Boolean),
          is_private: isPrivate,
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

  const acceptFollowRequest = async (followerId: string) => {
    try {
      await apiRequest(`/posts/follow-requests/${followerId}/accept`, { method: "POST" });
      setFollowRequests((items) => items.filter((item) => item.user_id !== followerId));
    } catch (err: any) {
      setStatusMsg(err.message);
    }
  };

  const createCollection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!collectionName.trim()) return;
    try {
      const collection = await apiRequest("/posts/collections", {
        method: "POST",
        body: JSON.stringify({ name: collectionName.trim() }),
      });
      setCollections((items) => [collection, ...items]);
      setCollectionName("");
    } catch (error: any) {
      setStatusMsg(error.message);
    }
  };

  const renameCollection = async (collection: any) => {
    const name = window.prompt("Rename collection", collection.name)?.trim();
    if (!name || name === collection.name) return;
    try {
      const updated = await apiRequest(`/posts/collections/${collection.collection_id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setCollections((items) => items.map((item) =>
        item.collection_id === collection.collection_id ? { ...item, ...updated } : item
      ));
    } catch (error: any) {
      setStatusMsg(error.message);
    }
  };

  const deleteCollection = async (collectionId: string) => {
    if (!window.confirm("Delete this saved collection?")) return;
    try {
      await apiRequest(`/posts/collections/${collectionId}`, { method: "DELETE" });
      setCollections((items) => items.filter((item) => item.collection_id !== collectionId));
    } catch (error: any) {
      setStatusMsg(error.message);
    }
  };

  const loadCollectionItems = async (collectionId: string) => {
    try {
      const items = await apiRequest(`/posts/collections/${collectionId}/items`);
      setCollectionItems((current) => ({ ...current, [collectionId]: items }));
    } catch (error: any) {
      setStatusMsg(error.message);
    }
  };

  const removeCollectionItem = async (collectionId: string, itemId: string) => {
    try {
      await apiRequest(`/posts/collections/${collectionId}/items/${itemId}`, {
        method: "DELETE",
      });
      setCollectionItems((current) => ({
        ...current,
        [collectionId]: (current[collectionId] || []).filter((item) => item.item_id !== itemId),
      }));
    } catch (error: any) {
      setStatusMsg(error.message);
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-emerald-700" /> Saved Community Posts ({savedPosts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {savedPosts.length === 0 ? (
            <p className="text-sm text-[#475569]">No saved community posts yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savedPosts.slice(0, 8).map((post) => (
                <Link
                  key={post.post_id}
                  href={`/posts/${post.post_id}`}
                  className="rounded-xl border border-[#E7DFD3] dark:border-[#253D31] p-3 hover:border-[#059669]"
                >
                  <p className="font-semibold">{post.dish_name || "Kitchen update"}</p>
                  <p className="mt-1 text-sm text-[#475569] line-clamp-2">{post.caption}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Collections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={createCollection} className="flex gap-2">
            <Input
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
              maxLength={80}
              placeholder="New collection name"
              aria-label="New collection name"
            />
            <Button type="submit" variant="emerald">
              <Plus className="h-4 w-4" /> Create
            </Button>
          </form>
          {collections.length === 0 ? (
            <p className="text-sm text-[#475569]">No collections yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {collections.map((collection) => (
                <div key={collection.collection_id} className="rounded-xl border border-[#E7DFD3] p-3 dark:border-[#253D31]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{collection.name}</p>
                      <p className="text-xs text-[#475569]">{collection.items_count || 0} saved items</p>
                    </div>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => renameCollection(collection)}>
                        Rename
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={`Delete ${collection.name}`}
                        onClick={() => deleteCollection(collection.collection_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadCollectionItems(collection.collection_id)}
                    className="mt-3 text-xs font-bold text-emerald-700 hover:underline"
                  >
                    View saved items
                  </button>
                  {(collectionItems[collection.collection_id] || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {collectionItems[collection.collection_id].map((item) => (
                        <div key={item.item_id} className="flex items-center justify-between rounded-lg bg-stone-50 px-2 py-1.5 text-xs">
                          <span>
                            {item.recipe_id ? `Recipe ${item.recipe_id.slice(0, 8)}` : `Post ${item.post_id.slice(0, 8)}`}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove item ${item.item_id}`}
                            onClick={() => removeCollectionItem(collection.collection_id, item.item_id)}
                            className="font-bold text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-200 font-medium">
          {statusMsg}
        </div>
      )}

      {followRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Private profile follow requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {followRequests.map((request) => (
              <div key={request.user_id} className="flex items-center justify-between gap-3 text-sm">
                <span>{request.full_name} {request.username ? `(@${request.username})` : ""}</span>
                <Button size="sm" variant="emerald" onClick={() => acceptFollowRequest(request.user_id)}>Accept</Button>
              </div>
            ))}
          </CardContent>
        </Card>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Display name</label>
                  <Input required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Username</label>
                  <Input required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Avatar image URL</label>
                <Input type="url" maxLength={2048} value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Cover image URL</label>
                <Input type="url" maxLength={2048} value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Bio</label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell the community about your cooking style..." />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Cuisine interests</label>
                <Input value={cuisineInterests} onChange={(e) => setCuisineInterests(e.target.value)} placeholder="Indian, Italian, Mediterranean" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Website</label>
                  <Input type="url" maxLength={2048} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://…" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Social links (label=url, comma-separated)</label>
                  <Input value={socialLinks} onChange={(e) => setSocialLinks(e.target.value)} placeholder="Instagram=https://…" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#A7B8AE]">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="rounded border-stone-300" />
                Private profile — only approved followers can view my recipes and posts.
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">City</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Encrypted Allergies (comma-separated)</label>
                  <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Peanuts, Dairy" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Diet preference</label>
                  <select value={dietPreference} onChange={(e) => setDietPreference(e.target.value)} className="w-full h-10 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#0D1511] px-3 text-sm">
                    {["veg", "non_veg", "vegan", "eggetarian", "jain"].map((diet) => <option key={diet} value={diet}>{diet.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Dietary restrictions</label>
                  <Input value={dietaryRestrictions} onChange={(e) => setDietaryRestrictions(e.target.value)} placeholder="Low sodium, lactose-free" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Ingredients to avoid</label>
                  <Input value={dislikes} onChange={(e) => setDislikes(e.target.value)} placeholder="Coriander, olives" />
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
