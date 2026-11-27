"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

export default function FollowersPage() {
  const params = useParams();
  const username = params?.username as string;
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    apiRequest(`/posts/profile/${encodeURIComponent(username)}`)
      .then((profile) => apiRequest(`/posts/followers/${profile.user_id}?limit=50&offset=0`))
      .then(setUsers)
      .catch((requestError: Error) => setError(requestError.message));
  }, [username]);

  if (error) return <p role="alert" className="mx-auto max-w-3xl px-4 py-12 text-center text-red-700">{error}</p>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-5 text-2xl font-bold">Followers</h1>
      {users.length === 0 ? (
        <p className="text-sm text-stone-600">No followers yet.</p>
      ) : (
        <div className="space-y-2">
          {users.map((profile) => (
            <Link
              key={profile.user_id}
              href={`/profile/${profile.username || profile.user_id}`}
              className="flex items-center gap-3 rounded-xl border p-3 hover:border-emerald-600"
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700 font-bold text-white">
                  {(profile.full_name || "?").charAt(0)}
                </span>
              )}
              <div>
                <p className="font-semibold">{profile.full_name}</p>
                {profile.username && <p className="text-xs text-stone-500">@{profile.username}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
