"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

export default function FollowersPage() {
  const params = useParams();
  const username = params?.username as string;
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    apiRequest(`/posts/profile/${encodeURIComponent(username)}`)
      .then((profile) => apiRequest(`/posts/followers/${profile.user_id}?limit=${PAGE_SIZE}&offset=${offset}`))
      .then(setUsers)
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [username, offset]);

  if (error) return <p role="alert" className="mx-auto max-w-3xl px-4 py-12 text-center text-red-700">{error}</p>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-5 text-2xl font-bold">Followers</h1>
      {loading ? (
        <p role="status" className="text-sm text-stone-600">Loading followers...</p>
      ) : users.length === 0 ? (
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
      {!loading && (
        <div className="mt-5 flex justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={offset === 0}
            onClick={() => {
              setError(null);
              setOffset((value) => Math.max(0, value - PAGE_SIZE));
              setLoading(true);
            }}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={users.length < PAGE_SIZE}
            onClick={() => {
              setError(null);
              setOffset((value) => value + PAGE_SIZE);
              setLoading(true);
            }}
          >
            Next
          </Button>
        </div>
      )}
    </main>
  );
}
