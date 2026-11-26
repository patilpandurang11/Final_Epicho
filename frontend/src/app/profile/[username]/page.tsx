"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, Clock, MapPin, UserPlus, UserCheck, Utensils } from "lucide-react";

export default function PublicProfilePage() {
  const params = useParams();
  const username = params?.username as string;
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    apiRequest(`/posts/profile/${encodeURIComponent(username)}`)
      .then(setProfile)
      .catch((e) => setError(e.message));
  }, [username]);

  const handleFollow = async () => {
    if (!profile) return;
    try {
      const res = await apiRequest(`/posts/follow/${profile.user_id}`, { method: "POST" });
      setProfile((prev: any) => ({
        ...prev,
        is_following: res.following,
        followers_count: prev.followers_count + (res.following ? 1 : -1),
      }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (error) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-red-600">{error}</div>;
  if (!profile) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm">Loading creator profile...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <Card>
        <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold">{profile.full_name}</h1>
              {profile.is_verified && (
                <Badge variant="emerald">
                  <BadgeCheck className="w-3.5 h-3.5" /> Verified
                </Badge>
              )}
              <Badge>{profile.account_tier}</Badge>
            </div>
            <p className="text-sm text-[#475569] dark:text-[#A7B8AE]">@{profile.username} • <MapPin className="w-3.5 h-3.5 inline" /> {profile.city}</p>
            <p className="text-sm max-w-2xl">{profile.bio}</p>
            <div className="flex gap-5 text-xs font-bold pt-1">
              <span>{profile.followers_count} Followers</span>
              <span>{profile.following_count} Following</span>
              <span>{profile.recipes?.length || 0} Recipes</span>
            </div>
          </div>

          {user && user.user_id !== profile.user_id && (
            <Button onClick={handleFollow} variant={profile.is_following ? "outline" : "emerald"}>
              {profile.is_following ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Utensils className="w-5 h-5 text-[#EA580C]" /> Published Recipes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {profile.recipes?.map((r: any) => (
            <Link key={r.recipe_id} href={`/recipes/${r.slug}`}>
              <Card className="overflow-hidden hover:border-[#059669]">
                <img src={r.image_url} alt={r.title} className="w-full h-44 object-cover" />
                <CardContent className="pt-4 space-y-1">
                  <Badge variant="outline">{r.cuisine_type}</Badge>
                  <h3 className="font-bold text-base truncate">{r.title}</h3>
                  <p className="text-xs text-[#475569] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {r.cook_time_mins} mins
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
