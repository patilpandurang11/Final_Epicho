"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PostData = {
  post_id: string;
  author_id: string;
  author_name: string;
  author_username?: string | null;
  author_avatar?: string | null;
  caption?: string | null;
  dish_name?: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  has_liked: boolean;
  has_saved: boolean;
  media: { media_url: string; media_type: "image" | "video" }[];
};

type CommentData = {
  comment_id: string;
  parent_comment_id?: string | null;
  author_name?: string | null;
  content: string;
};

export default function PostDetailPage() {
  const params = useParams();
  const postId = params?.postId as string;
  const { user } = useAuth();
  const [post, setPost] = useState<PostData | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    Promise.all([
      apiRequest<PostData>(`/posts/${postId}`),
      apiRequest<CommentData[]>(`/posts/${postId}/comments`),
    ])
      .then(([postData, commentData]) => {
        setPost(postData);
        setComments(commentData);
      })
      .catch((requestError: Error) => setError(requestError.message));
  }, [postId]);

  const toggleLike = async () => {
    if (!post) return;
    try {
      const result = await apiRequest<{ liked: boolean; likes_count: number }>(
        `/posts/${post.post_id}/like`,
        { method: "POST" },
      );
      setPost({ ...post, has_liked: result.liked, likes_count: result.likes_count });
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  const toggleSave = async () => {
    if (!post) return;
    try {
      await apiRequest(`/posts/${post.post_id}/save`, {
        method: post.has_saved ? "DELETE" : "POST",
      });
      setPost({ ...post, has_saved: !post.has_saved });
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!post || !commentText.trim()) return;
    try {
      const comment = await apiRequest<CommentData>(`/posts/${post.post_id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: commentText.trim() }),
      });
      setComments((items) => [...items, comment]);
      setCommentText("");
      setPost({ ...post, comments_count: post.comments_count + 1 });
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  const share = async () => {
    if (!post) return;
    try {
      const result = await apiRequest<{ share_url: string; shares_count: number }>(`/posts/${post.post_id}/share`, {
        method: "POST",
      });
      const url = new URL(result.share_url, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setPost({ ...post, shares_count: result.shares_count });
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  if (error) return <p role="alert" className="mx-auto max-w-3xl px-4 py-12 text-center text-red-700">{error}</p>;
  if (!post) return <p className="mx-auto max-w-3xl px-4 py-12 text-center">Loading post...</p>;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-10">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <Link
            href={`/profile/${post.author_username || post.author_id}`}
            className="font-semibold hover:underline"
          >
            {post.author_name}
          </Link>
          {post.media.map((item, index) => item.media_type === "video" ? (
            <video key={`${item.media_url}-${index}`} src={item.media_url} controls className="max-h-[70vh] w-full rounded-xl object-contain" />
          ) : (
            <img key={`${item.media_url}-${index}`} src={item.media_url} alt={post.dish_name || "Community food post"} className="max-h-[70vh] w-full rounded-xl object-contain" />
          ))}
          {post.dish_name && <h1 className="text-xl font-bold">{post.dish_name}</h1>}
          {post.caption && <p className="whitespace-pre-wrap">{post.caption}</p>}
          <div className="flex items-center gap-4">
            <Button type="button" variant="outline" onClick={toggleLike} aria-label="Like post">
              <Heart className={post.has_liked ? "fill-red-600 text-red-600" : ""} /> {post.likes_count}
            </Button>
            <span className="inline-flex items-center gap-1 text-sm"><MessageCircle className="h-4 w-4" /> {post.comments_count}</span>
            <Button type="button" variant="outline" onClick={toggleSave} aria-label={post.has_saved ? "Unsave post" : "Save post"}>
              <Bookmark className={post.has_saved ? "fill-emerald-700 text-emerald-700" : ""} />
            </Button>
            <Button type="button" variant="outline" onClick={share} aria-label="Share post">
              <Share2 /> {post.shares_count}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <h2 className="font-bold">Comments</h2>
          {comments.map((comment) => (
            <div key={comment.comment_id} className={comment.parent_comment_id ? "ml-5 border-l pl-3" : ""}>
              <p className="text-xs font-semibold">{comment.author_name || "Community member"}</p>
              <p className="text-sm">{comment.content}</p>
            </div>
          ))}
          {user && (
            <form onSubmit={addComment} className="flex gap-2">
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                maxLength={2000}
                aria-label="Write a comment"
                placeholder="Add a comment..."
                className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
              <Button type="submit" disabled={!commentText.trim()}>Comment</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
